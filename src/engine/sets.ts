import { Sets } from '@pkmn/sets';
import { dex, getMove, getSpecies } from './dex';
import type { EngineData } from './data';
import { findByName, statsEntry, type StatsData } from './stats';

export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface TeamSet {
  species: string;
  item: string;
  ability: string;
  moves: string[];
  nature: string;
  evs: Partial<Record<StatID, number>>;
  teraType?: string;
}

export type SetsData = Record<string, TeamSet>;

type PkmnSet = Parameters<typeof Sets.exportSet>[0];

const sortedKeys = (record: Record<string, number>) =>
  Object.entries(record).sort((a, b) => b[1] - a[1]).map(([key]) => key);

export function emptySet(speciesName: string): TeamSet {
  const species = getSpecies(speciesName);
  return {
    species: species?.name ?? speciesName,
    item: '',
    ability: species?.abilities[0] ?? '',
    moves: [],
    nature: 'Serious',
    evs: {},
  };
}

export function parseSpread(spread: string | undefined): { nature: string; evs: Partial<Record<StatID, number>> } {
  if (!spread) return { nature: 'Serious', evs: {} };
  const [nature, values = ''] = spread.split(':');
  const evs: Partial<Record<StatID, number>> = {};
  values.split('/').forEach((value, i) => {
    const amount = Number(value);
    if (amount > 0 && STAT_IDS[i]) evs[STAT_IDS[i]] = amount;
  });
  return { nature, evs };
}

export function mostCommonSet(stats: StatsData | null, speciesName: string): TeamSet | null {
  const entry = statsEntry(stats, speciesName);
  if (!entry) return null;
  const { nature, evs } = parseSpread(sortedKeys(entry.spreads)[0]);
  const itemId = sortedKeys(entry.items)[0];
  const abilityId = sortedKeys(entry.abilities)[0];
  const tera = sortedKeys(entry.teraTypes)[0];
  return {
    species: speciesName,
    item: itemId ? dex.items.get(itemId).name : '',
    ability: abilityId ? dex.abilities.get(abilityId).name : getSpecies(speciesName)?.abilities[0] ?? '',
    moves: sortedKeys(entry.moves).slice(0, 4).map(id => getMove(id)?.name ?? id),
    nature,
    evs,
    ...(tera ? { teraType: tera } : {}),
  };
}

export function defaultSet(data: EngineData, speciesName: string): TeamSet {
  return mostCommonSet(data.stats, speciesName) ?? findByName(data.sets ?? undefined, speciesName) ?? emptySet(speciesName);
}

type OneOrMany<T> = T | T[];
export interface RawAnalysisSet {
  moves?: OneOrMany<string>[];
  item?: OneOrMany<string>;
  ability?: OneOrMany<string>;
  nature?: OneOrMany<string>;
  evs?: OneOrMany<Partial<Record<StatID, number>>>;
  teraType?: OneOrMany<string>;
  teratypes?: OneOrMany<string>;
}

const first = <T,>(value: OneOrMany<T> | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value;

function pickEvs(evs: Partial<Record<StatID, number>> | undefined): Partial<Record<StatID, number>> {
  const result: Partial<Record<StatID, number>> = {};
  for (const stat of STAT_IDS) {
    const value = evs?.[stat];
    if (typeof value === 'number' && value > 0) result[stat] = value;
  }
  return result;
}

export function normalizeAnalysisSets(raw: Record<string, Record<string, RawAnalysisSet>>): SetsData {
  const result: SetsData = {};
  for (const [species, named] of Object.entries(raw)) {
    const set = Object.values(named)[0];
    if (!set) continue;
    const tera = first(set.teraType ?? set.teratypes);
    result[species] = {
      species,
      item: first(set.item) ?? '',
      ability: first(set.ability) ?? '',
      moves: (set.moves ?? []).map(move => first(move) ?? '').filter(Boolean).slice(0, 4),
      nature: first(set.nature) ?? 'Serious',
      evs: pickEvs(first(set.evs)),
      ...(tera ? { teraType: tera } : {}),
    };
  }
  return result;
}

function toPkmn(set: TeamSet): PkmnSet {
  const table = (fill: (stat: StatID) => number) =>
    Object.fromEntries(STAT_IDS.map(stat => [stat, fill(stat)]));
  return {
    name: '',
    species: set.species,
    item: set.item,
    ability: set.ability,
    moves: set.moves.filter(Boolean),
    nature: set.nature,
    gender: '',
    evs: table(stat => set.evs[stat] ?? 0),
    ivs: table(() => 31),
    level: 100,
    ...(set.teraType ? { teraType: set.teraType } : {}),
  } as unknown as PkmnSet;
}

function fromPkmn(parsed: Partial<PkmnSet>): TeamSet {
  const species = getSpecies(String(parsed.species ?? ''));
  const evs: Partial<Record<StatID, number>> = {};
  for (const stat of STAT_IDS) {
    const value = (parsed.evs as Partial<Record<StatID, number>> | undefined)?.[stat];
    if (value && value > 0) evs[stat] = Math.min(252, value);
  }
  const teraType = (parsed as { teraType?: string }).teraType;
  return {
    species: species?.name ?? String(parsed.species ?? ''),
    item: String(parsed.item ?? ''),
    ability: String(parsed.ability || species?.abilities[0] || ''),
    moves: [...(parsed.moves ?? [])].map(String),
    nature: String(parsed.nature || 'Serious'),
    evs,
    ...(teraType ? { teraType } : {}),
  };
}

export interface ImportResult {
  sets: TeamSet[];
  errors: string[];
}

export function importShowdown(text: string): ImportResult {
  const sets: TeamSet[] = [];
  const errors: string[] = [];
  const blocks = text
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('==='))
    .join('\n')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);

  blocks.forEach((block, i) => {
    const parsed = Sets.importSet(block) as Partial<PkmnSet> | undefined;
    const name = String(parsed?.species ?? '').trim();
    if (!parsed || !name || name.startsWith('-')) {
      errors.push(`Blocco ${i + 1} non leggibile: "${block.split('\n')[0]}"`);
      return;
    }
    if (sets.length === 6) {
      errors.push(`Più di 6 Pokémon: ignorato ${name}`);
      return;
    }
    const set = fromPkmn(parsed);
    if (!getSpecies(set.species)) errors.push(`Pokémon sconosciuto: ${set.species}`);
    sets.push(set);
  });
  return { sets, errors };
}

export function exportShowdown(team: TeamSet[]): string {
  return team.map(set => Sets.exportSet(toPkmn(set)).trimEnd()).join('\n\n');
}
