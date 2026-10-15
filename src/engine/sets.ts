import { Sets } from '@pkmn/sets';
import { dex, getMove, getSpecies, toID } from './dex';
import type { EngineData } from './data';
import { legalAbilities, legalMoves } from './learnsets';
import { findByName, statsEntry, type StatsData } from './stats';
import { generatedSet } from './generatedSet';

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
 * Un set per ogni Pokémon presente in almeno una fonte: dal formato in cui è più popolare
 * (in più squadre in assoluto, non in percentuale), altrimenti dai set delle analisi nell'ordine dato.
 * Serve come riserva quando il formato scelto non ha dati.
 */
export function buildFallbackSets(sources: EngineData[], analyses: SetsData[] = []): SetsData {
  const best = new Map<string, { count: number; usage: number; stats: StatsData }>();
  for (const source of sources) {
    for (const [name, entry] of Object.entries(source.stats?.pokemon ?? {})) {
      const current = best.get(name);
      const count = entry.count ?? 0;
      // Più squadre vince; a pari squadre, la percentuale d'uso più alta
      if (!current || count > current.count || (count === current.count && entry.usage > current.usage)) {
        best.set(name, { count, usage: entry.usage, stats: source.stats! });
      }
    }
  }
  const result: SetsData = {};
  for (const sets of [...sources.map(s => s.sets), ...analyses]) {
    for (const [name, set] of Object.entries(sets ?? {})) if (!result[name]) result[name] = set;
  }
  for (const [name, { stats }] of best) result[name] = mostCommonSet(stats, name)!;
  return result;
}

/** Il set della forma base, per forme senza dati proprie (Pikachu-Cosplay, Mega senza statistiche…). */
function baseFormeSet(sets: SetsData | null | undefined, speciesName: string): TeamSet | null {
  const species = getSpecies(speciesName);
  if (!species || species.baseSpecies === species.name) return null;
  const base = findByName(sets ?? undefined, species.baseSpecies);
  if (!base) return null;
  return { ...base, species: species.name, item: species.requiredItem ?? base.item };
}

/**
 * Set di riferimento: statistiche del formato → analisi → riserva (il formato in cui è più popolare)
 * → set della forma base → set generato dalle mosse imparabili.
 * Reso legale fino a `genLimit` (mosse non imparabili sostituite dalle successive più usate).
 */
export function defaultSet(data: EngineData, speciesName: string, genLimit = 9): TeamSet {
  const base = mostCommonSet(data.stats, speciesName)
    ?? findByName(data.sets ?? undefined, speciesName)
    ?? findByName(data.fallback ?? undefined, speciesName)
    ?? baseFormeSet(data.fallback, speciesName);
  if (!base) return generatedSet(getSpecies(speciesName)?.name ?? speciesName, genLimit);
  const legal = makeLegal(base, data, genLimit);
  // Se le mosse illegali non hanno sostituti dalle statistiche, si completa con quelle generate
  if (legal.moves.length >= Math.min(4, base.moves.length)) return legal;
  const extra = generatedSet(legal.species, genLimit).moves.filter(m => !legal.moves.includes(m));
  return { ...legal, moves: [...legal.moves, ...extra].slice(0, 4) };
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

function fromAnalysis(species: string, set: RawAnalysisSet): TeamSet {
  const tera = first(set.teraType ?? set.teratypes);
  return {
    species,
    item: first(set.item) ?? '',
    ability: first(set.ability) ?? '',
    moves: (set.moves ?? []).map(move => first(move) ?? '').filter(Boolean).slice(0, 4),
    nature: first(set.nature) ?? 'Serious',
    evs: pickEvs(first(set.evs)),
    ...(tera ? { teraType: tera } : {}),
  };
}

export function normalizeAnalysisSets(raw: Record<string, Record<string, RawAnalysisSet>>): SetsData {
  const result: SetsData = {};
  for (const [species, named] of Object.entries(raw)) {
    const set = Object.values(named)[0];
    if (set) result[species] = fromAnalysis(species, set);
  }
  return result;
}

/** Un set delle analisi Smogon con il suo nome ("Sun Wallbreaker") e il formato da cui viene. */
export interface Preset {
  name: string;
  format: string;
  set: TeamSet;
}
export type PresetsData = Record<string, Preset[]>;

/** Quanti preset proporre per Pokémon. */
export const MAX_PRESETS = 5;

/** Tutti i set con nome delle analisi di un formato. */
export function normalizeAnalysisPresets(raw: Record<string, Record<string, RawAnalysisSet>>, format: string): PresetsData {
  return Object.fromEntries(Object.entries(raw).map(([species, named]) =>
    [species, Object.entries(named).map(([name, set]) => ({ name, format, set: fromAnalysis(species, set) }))]));
}

/** Stesso set da giocare: strumento, abilità, natura, mosse (in qualsiasi ordine), EV e Tera. */
export function sameSet(a: TeamSet, b: TeamSet): boolean {
  const moves = (s: TeamSet) => s.moves.filter(Boolean).map(toID).sort().join();
  const evs = (s: TeamSet) => STAT_IDS.map(stat => s.evs[stat] ?? 0).join();
  return toID(a.item) === toID(b.item) && toID(a.ability) === toID(b.ability) && toID(a.nature) === toID(b.nature)
    && moves(a) === moves(b) && evs(a) === evs(b) && toID(a.teraType ?? '') === toID(b.teraType ?? '');
}

const presetKey = (p: Preset) => `${toID(p.set.item)}|${p.set.moves.map(toID).sort().join(',')}`;

/** Unisce più elenchi nell'ordine dato: niente doppioni (stesse mosse e strumento), al massimo `limit` per Pokémon. */
export function mergePresets(lists: (PresetsData | null | undefined)[], limit = MAX_PRESETS): PresetsData {
  const result: PresetsData = {};
  for (const list of lists) {
    for (const [species, presets] of Object.entries(list ?? {})) {
      const current = (result[species] ??= []);
      for (const preset of presets) {
        if (current.length >= limit) break;
        if (!current.some(p => presetKey(p) === presetKey(preset))) current.push(preset);
      }
    }
  }
  return result;
}

/** I preset per un Pokémon: prima quelli del formato scelto, poi quelli degli altri formati. */
export function presetsFor(data: EngineData, speciesName: string): Preset[] {
  const own = findByName(data.presets ?? undefined, speciesName) ?? [];
  const other = findByName(data.fallbackPresets ?? undefined, speciesName) ?? [];
  return mergePresets([{ x: own }, { x: other }]).x ?? [];
}

const TIER_NAMES: Record<string, string> = { '': 'OU', ubers: 'Ubers', monotype: 'Monotype', ag: 'AG', lc: 'LC' };
/** "gen9nationaldexubers" → "NatDex Ubers", "gen8ou" → "Gen 8 OU". */
export function formatName(id: string): string {
  const match = /^gen(\d)(nationaldex)?(.*)$/.exec(id);
  if (!match) return id;
  const [, gen, natdex, tier] = match;
  return `${natdex ? 'NatDex' : `Gen ${gen}`} ${TIER_NAMES[tier] ?? tier.toUpperCase()}`;
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
