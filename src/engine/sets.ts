import { Sets } from '@pkmn/sets';
import { dex, getMove, getSpecies, toID } from './dex';
import type { EngineData } from './data';
import { legalAbilities, legalMoves } from './learnsets';
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
  /** Preferito: il coaching non ne suggerisce mai la sostituzione. */
  favorite?: boolean;
  /** Custom Skillset: qualunque mossa e abilità (hackrom), solo per questo membro del team. */
  customSkillset?: boolean;
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

/**
 * Un set per ogni Pokémon presente in almeno una fonte: dal formato in cui è più usato,
 * altrimenti dai set delle analisi. Serve come riserva quando il formato scelto non ha dati.
 */
export function buildFallbackSets(sources: EngineData[]): SetsData {
  const best = new Map<string, { usage: number; stats: StatsData }>();
  for (const source of sources) {
    for (const [name, entry] of Object.entries(source.stats?.pokemon ?? {})) {
      const current = best.get(name);
      if (!current || entry.usage > current.usage) best.set(name, { usage: entry.usage, stats: source.stats! });
    }
  }
  const result: SetsData = {};
  for (const source of sources) {
    for (const [name, set] of Object.entries(source.sets ?? {})) if (!result[name]) result[name] = set;
  }
  for (const [name, { stats }] of best) result[name] = mostCommonSet(stats, name)!;
  return result;
}

/**
 * Set di riferimento: statistiche del formato → analisi → riserva → set vuoto,
 * reso legale fino a `genLimit` (mosse non imparabili sostituite dalle successive più usate).
 */
export function defaultSet(data: EngineData, speciesName: string, genLimit = 9): TeamSet {
  const base = mostCommonSet(data.stats, speciesName)
    ?? findByName(data.sets ?? undefined, speciesName)
    ?? findByName(data.fallback ?? undefined, speciesName)
    ?? emptySet(speciesName);
  return makeLegal(base, data, genLimit);
}

function makeLegal(set: TeamSet, data: EngineData, genLimit: number): TeamSet {
  const moves = legalMoves(set.species, genLimit);
  const abilities = legalAbilities(set.species, genLimit);
  const entry = statsEntry(data.stats, set.species);
  let result = set;
  const isLegal = (name: string) => !moves || moves.has(toID(name));
  if (set.moves.some(m => !isLegal(m))) {
    const kept = set.moves.filter(isLegal);
    const ranking = entry ? sortedKeys(entry.moves).map(id => getMove(id)?.name ?? id) : [];
    const extra = ranking.filter(name => isLegal(name) && !kept.includes(name));
    result = { ...result, moves: [...kept, ...extra].slice(0, 4) };
  }
  if (abilities && set.ability && !abilities.includes(set.ability)) {
    const ranked = entry ? sortedKeys(entry.abilities).map(id => dex.abilities.get(id).name) : [];
    result = { ...result, ability: ranked.find(a => abilities.includes(a)) ?? abilities[0] ?? set.ability };
  }
  return result;
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
