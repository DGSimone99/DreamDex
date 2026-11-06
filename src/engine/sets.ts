import type { Species } from '@pkmn/dex';
import { t, type Lang } from '../i18n';
import { Sets } from '@pkmn/sets';
import { battleSpecies, dex, getMove, getSpecies, teamFormeOf, toID } from './dex';
import type { EngineData } from './data';
import { isBannedName, pokedexOfId } from './formats';
import { isLearnable, isLegalAbility, legalAbilities, legalMoves } from './learnsets';
import { findByName, statsEntry, type StatsData } from './stats';
import { generatedSet } from './generatedSet';
import { lockedStatusMoves } from './lockedMoves';

export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export const STAT_IDS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export interface TeamSet {
  species: string;
  item: string;
  ability: string;
  moves: string[];
  nature: string;
  evs: Partial<Record<StatID, number>>;
  /** IV diversi da 31 (quelli che mancano valgono 31). */
  ivs?: Partial<Record<StatID, number>>;
  teraType?: string;
  /** Preferito: il coaching non ne suggerisce mai la sostituzione. */
  favorite?: boolean;
  /** Custom Skillset: qualunque mossa e abilità (hackrom), solo per questo membro del team. */
  customSkillset?: boolean;
  /** Soprannome (come su Showdown: "Nick (Specie)"); senza, il nome della specie. */
  name?: string;
  /** Shiny: cambia solo lo sprite (ed è esportato come "Shiny: Yes"). */
  shiny?: boolean;
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
  const abilityId = sortedKeys(entry.abilities)[0];
  const tera = sortedKeys(entry.teraTypes)[0];
  const itemId = sortedKeys(entry.items)[0];
  const item = itemId ? dex.items.get(itemId).name : '';
  // Strumento e mosse più usati sono contati a parte: con la Choice o l'Assault Vest si saltano le mosse di stato che
  // non servono e si prendono le successive (Alomomola Assault Vest: niente Wish e Protect, i suoi attacchi)
  let pool = sortedKeys(entry.moves).map(id => getMove(id)?.name ?? id);
  let moves = pool.slice(0, 4);
  for (;;) {
    const locked = lockedStatusMoves({ species: speciesName, item, ability: '', moves, nature: '', evs: {} });
    if (!locked.length) break;
    pool = pool.filter(m => !locked.includes(m));
    moves = pool.slice(0, 4);
  }
  return {
    species: speciesName,
    item,
    ability: abilityId ? dex.abilities.get(abilityId).name : getSpecies(speciesName)?.abilities[0] ?? '',
    moves,
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

/** Le analisi non scrivono l'abilità quando la specie ne ha una sola: si mette la prima della specie. */
export function withAbility(set: TeamSet): TeamSet {
  return set.ability ? set : { ...set, ability: getSpecies(set.species)?.abilities[0] ?? '' };
}

/**
 * Set di riferimento: primo preset Smogon del formato (così l'editor lo riconosce) → statistiche del formato
 * → analisi → primo preset di un altro formato → riserva (il formato in cui è più popolare)
 * → set della forma base → set generato dalle mosse imparabili.
 * Reso legale fino a `genLimit` (mosse non imparabili sostituite dalle successive più usate).
 */
export function defaultSet(data: EngineData, speciesName: string, genLimit = 9): TeamSet {
  // Forma solo da battaglia (Necrozma-Ultra): nel team va la forma che la raggiunge, col suo strumento
  const team = teamFormeOf(speciesName);
  if (team) {
    const ultra = presetsFor(data, team.species).find(p => p.set.item === team.item);
    return ultra ? makeLegal(ultra.set, data, genLimit) : { ...defaultSet(data, team.species, genLimit), item: team.item };
  }
  // Mega e Primal: il primo preset della specie base con la pietra giusta, come per le altre specie (l'editor lo riconosce)
  const forme = getSpecies(speciesName);
  if (forme && isStoneForme(forme)) {
    const preset = presetsFor(data, forme.name)[0];
    if (preset) return makeLegal(preset.set, data, genLimit);
  }
  // Forma base di chi ha una Mega o una Primal: mai con la pietra (la Mega è un'altra voce)
  const stones = formeItemIds(forme?.name ?? speciesName);
  const plain = (list: Preset[] | undefined) => list?.find(p => !stones.has(toID(p.set.item)))?.set;
  const noStone = (set: TeamSet | null | undefined) => (set && !stones.has(toID(set.item)) ? set : undefined);
  const statsSet = mostCommonSet(data.stats, speciesName);
  const found = plain(findByName(data.presets ?? undefined, speciesName))
    ?? noStone(statsSet)
    ?? noStone(findByName(data.sets ?? undefined, speciesName))
    ?? plain(findByName(data.fallbackPresets ?? undefined, speciesName))
    ?? noStone(findByName(data.fallback ?? undefined, speciesName))
    // Solo set con la pietra: si tiene il set e le si toglie la pietra
    ?? statsSet
    ?? findByName(data.fallback ?? undefined, speciesName)
    ?? baseFormeSet(data.fallback, speciesName);
  const base = found && withAbility(withoutStone(found, stones, data));
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
  // Scarlatto/Violetto: niente mosse e strumenti che lì non esistono (Hidden Power, Pursuit, cristalli Z, megapietre)
  const sv = !!data.formatId && pokedexOfId(data.formatId) === 'sv';
  const inPokedex = (thing: { isNonstandard?: string | null } | null | undefined) => !sv || !thing?.isNonstandard;
  // Niente nemmeno di ciò che il formato vieta (Shed Tail, Spore in Gen 9 OU, King's Rock…)
  const banned = (kind: 'moves' | 'abilities' | 'items', name: string) => isBannedName(data.formatId, kind, name);
  const isLegal = (name: string) => (!moves || isLearnable(moves, name)) && inPokedex(getMove(name)) && !banned('moves', name);
  if (set.moves.some(m => !isLegal(m))) {
    const kept = set.moves.filter(isLegal);
    const ranking = entry ? sortedKeys(entry.moves).map(id => getMove(id)?.name ?? id) : [];
    const extra = ranking.filter(name => isLegal(name) && !kept.includes(name));
    result = { ...result, moves: [...kept, ...extra].slice(0, 4) };
  }
  if (set.item && (!inPokedex(dex.items.get(set.item)) || banned('items', set.item))) {
    const ranked = entry ? sortedKeys(entry.items).map(id => dex.items.get(id)).filter(item => item.exists && inPokedex(item) && !banned('items', item.name)) : [];
    result = { ...result, item: ranked[0]?.name ?? '' };
  }
  if (abilities && set.ability && (!isLegalAbility(set, abilities) || banned('abilities', set.ability))) {
    const allowed = abilities.filter(a => !banned('abilities', a));
    const ranked = entry ? sortedKeys(entry.abilities).map(id => dex.abilities.get(id).name) : [];
    result = { ...result, ability: ranked.find(a => allowed.includes(a)) ?? allowed[0] ?? set.ability };
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

/** Stesso set da giocare: strumento, abilità, natura, mosse (in qualsiasi ordine), EV e Tera (gli IV no: i preset non li hanno). */
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

/** Mega o Primal: forma raggiunta tenendo una pietra (o un'Orb) dalla specie base. */
function isStoneForme(forme: Species): boolean {
  return !!(forme.isMega || forme.isPrimal) && forme.baseSpecies !== forme.name;
}

/** Pietre Mega e Orb che fanno cambiare forma alla specie (Charizard: Charizardite X e Y). */
export function formeItemIds(speciesName: string): Set<string> {
  const species = getSpecies(speciesName);
  if (!species) return new Set();
  return new Set((species.otherFormes ?? [])
    .map(name => getSpecies(name))
    .filter((forme): forme is Species => !!forme && isStoneForme(forme))
    .map(forme => toID(forme.requiredItem ?? '')));
}

/** Il set senza la pietra: lo strumento più usato che non la sia (o nessuno). */
function withoutStone(set: TeamSet, stones: Set<string>, data: EngineData): TeamSet {
  if (!stones.has(toID(set.item))) return set;
  const entry = statsEntry(data.stats, set.species);
  const item = entry ? sortedKeys(entry.items).find(id => !stones.has(id) && id !== 'nothing') : undefined;
  return { ...set, item: item ? dex.items.get(item).name : '' };
}

/**
 * I preset per un Pokémon, divisi per forma: una Mega o una Primal ha solo quelli con la sua pietra,
 * la forma base solo quelli senza. Prima quelli del formato scelto, poi quelli degli altri formati.
 */
export function presetsFor(data: EngineData, speciesName: string): Preset[] {
  const forme = getSpecies(speciesName);
  // Le analisi Smogon stanno sotto la specie base: per Gardevoir-Mega si prendono quelle di Gardevoir con la pietra
  if (forme && isStoneForme(forme)) {
    const stone = toID(forme.requiredItem ?? '');
    return allPresetsFor(data, forme.baseSpecies).filter(p => toID(p.set.item) === stone);
  }
  const stones = formeItemIds(forme?.name ?? speciesName);
  return allPresetsFor(data, speciesName).filter(p => !stones.has(toID(p.set.item)));
}

/**
 * I preset per il set così com'è: con la pietra quelli della Mega, senza quelli della forma base.
 * Con `genLimit` (e senza Custom Skillset) resi legali fino a quella generazione, come il set di riferimento.
 */
export function presetsForSet(data: EngineData, set: TeamSet, genLimit?: number): Preset[] {
  const forme = battleSpecies(set);
  const presets = presetsFor(data, forme && isStoneForme(forme) ? forme.name : set.species);
  if (genLimit === undefined || set.customSkillset) return presets;
  return presets.map(p => ({ ...p, set: makeLegal(p.set, data, genLimit) }));
}

/** Tutti i preset della specie, senza distinguere le forme. */
function allPresetsFor(data: EngineData, speciesName: string): Preset[] {
  const forme = getSpecies(speciesName);
  const species = forme?.name ?? speciesName;
  // I preset di Smogon per "Necrozma-Ultra" vanno sulla forma da team che la raggiunge, con lo Z-cristallo
  const battleFormePresets = (list: PresetsData | null | undefined) =>
    (findByName(list ?? undefined, 'Necrozma-Ultra') ?? [])
      .map(p => ({ ...p, set: { ...p.set, ...teamFormeOf(p.set.species, p.set.evs) } }))
      .filter(p => p.set.species === species);
  const own = [...(findByName(data.presets ?? undefined, speciesName) ?? []), ...battleFormePresets(data.presets)];
  const other = [...(findByName(data.fallbackPresets ?? undefined, speciesName) ?? []), ...battleFormePresets(data.fallbackPresets)];
  return (mergePresets([{ x: own }, { x: other }]).x ?? []).map(p => ({ ...p, set: withAbility(p.set) }));
}

const TIER_NAMES: Record<string, string> = { '': 'OU', ubers: 'Ubers', monotype: 'Monotype', ag: 'AG', lc: 'LC' };
/** "gen9nationaldexubers" → "NatDex Ubers", "gen8ou" → "Gen 8 OU". */
export function formatName(id: string): string {
  const match = /^gen(\d)(nationaldex)?(.*)$/.exec(id);
  if (!match) return id;
  const [, gen, natdex, tier] = match;
  return `${natdex ? 'NatDex' : `Gen ${gen}`} ${TIER_NAMES[tier] ?? tier.toUpperCase()}`;
}

function toPkmn(set: TeamSet, tera = true): PkmnSet {
  const table = (fill: (stat: StatID) => number) =>
    Object.fromEntries(STAT_IDS.map(stat => [stat, fill(stat)]));
  return {
    name: set.name ?? '',
    species: set.species,
    ...(set.shiny ? { shiny: true } : {}),
    item: set.item,
    ability: set.ability,
    moves: set.moves.filter(Boolean),
    nature: set.nature,
    gender: '',
    evs: table(stat => set.evs[stat] ?? 0),
    ivs: table(stat => set.ivs?.[stat] ?? 31),
    level: 100,
    ...(tera && set.teraType ? { teraType: set.teraType } : {}),
  } as unknown as PkmnSet;
}

function fromPkmn(parsed: Partial<PkmnSet>): TeamSet {
  const species = getSpecies(String(parsed.species ?? ''));
  const evs: Partial<Record<StatID, number>> = {};
  for (const stat of STAT_IDS) {
    const value = (parsed.evs as Partial<Record<StatID, number>> | undefined)?.[stat];
    if (value && value > 0) evs[stat] = Math.min(252, value);
  }
  // Solo gli IV diversi da 31
  const ivs: Partial<Record<StatID, number>> = {};
  for (const stat of STAT_IDS) {
    const value = (parsed.ivs as Partial<Record<StatID, number>> | undefined)?.[stat];
    if (typeof value === 'number' && value >= 0 && value < 31) ivs[stat] = value;
  }
  const teraType = (parsed as { teraType?: string }).teraType;
  const name = String(parsed.name ?? '').trim();
  const speciesName = species?.name ?? String(parsed.species ?? '');
  // I nomi come li scrive il gioco ("choice band" → "Choice Band"); quelli sconosciuti restano com'erano (segnalati all'import)
  const item = String(parsed.item ?? '');
  const ability = String(parsed.ability || species?.abilities[0] || '');
  const nature = String(parsed.nature || 'Serious');
  return {
    species: species?.name ?? String(parsed.species ?? ''),
    item: (item && dex.items.get(item).exists ? dex.items.get(item).name : item),
    ability: (ability && dex.abilities.get(ability).exists ? dex.abilities.get(ability).name : ability),
    moves: [...(parsed.moves ?? [])].map(m => getMove(String(m))?.name ?? String(m)),
    // Una natura sconosciuta diventa neutra (Serious): la libreria del danno non la accetta
    nature: dex.natures.get(nature).exists ? dex.natures.get(nature).name : 'Serious',
    evs,
    ...(Object.keys(ivs).length ? { ivs } : {}),
    ...(teraType ? { teraType } : {}),
    ...(name && name !== speciesName ? { name } : {}),
    ...(parsed.shiny ? { shiny: true } : {}),
  };
}

export interface ImportResult {
  sets: TeamSet[];
  errors: string[];
}

export function importShowdown(text: string, lang: Lang = 'it'): ImportResult {
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
      errors.push(t(lang, 'import.unreadable', { n: i + 1, line: block.split('\n')[0] }));
      return;
    }
    if (sets.length === 6) {
      errors.push(t(lang, 'import.tooMany', { name }));
      return;
    }
    const set = fromPkmn(parsed);
    if (!getSpecies(set.species)) errors.push(t(lang, 'import.unknown', { name: set.species }));
    const nature = String(parsed.nature ?? '');
    if (nature && !dex.natures.get(nature).exists) errors.push(t(lang, 'import.unknownNature', { name: set.species, nature }));
    if (set.item && !dex.items.get(set.item).exists) errors.push(t(lang, 'import.unknownItem', { name: set.species, item: set.item }));
    sets.push(set);
  });
  return { sets, errors };
}

/** Testo Showdown del team; `tera: false` lo toglie per i formati che lo vietano (i salvataggi lo tengono). */
export function exportShowdown(team: TeamSet[], { tera = true }: { tera?: boolean } = {}): string {
  return team.map(set => Sets.exportSet(toPkmn(set, tera)).trimEnd()).join('\n\n');
}
