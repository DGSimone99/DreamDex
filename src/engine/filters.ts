import type { Lang } from '../i18n';
import type { EngineData } from './data';
import { battleName, battleSpecies, dex, getSpecies, isCosmeticForme, isDefined, isMega, isTeambuildable, toID, withinGen } from './dex';
import { gameOf, obtainableIn } from './games';
import { isBannedIn, speciesInPokedex, tierIn } from './formats';
import type { Format } from './format';
import { formatRules, isOneType, type FormatRules } from './formatRules';
import { detectRoles, hasPriority, hasSetup, hasSpeedControl, shownRoles } from './roles';
import { FAMILIES, type SubRole } from './subRoles';
import { scoreSets, uniqueFormes, type Suggestion } from './scoring';
import { defaultSet, type TeamSet } from './sets';
import { isUserFavorite } from './lists';
import { usageOf } from './stats';
import { benefits, enables, type Condition } from './synergy';
import { defensiveMultiplier, superEffectiveMove, type TypeName } from './types';

/**
 * Ruoli cercabili: i sotto-ruoli più tre filtri sulle mosse (priorità, controllo velocità, setup), che non entrano nel
 * voto; in doppio anche "Attaccante" e "Muro", le voci uniche del doppio.
 */
export type FilterRole = SubRole | 'anyAttacker' | 'anyWall' | 'priority' | 'speedControl' | 'setup';

/** I ruoli del filtro nel singolo: i sotto-ruoli nell'ordine delle famiglie (il Controllo Velocità è fra loro), poi i filtri sulle mosse. */
const singlesFilterRoles = (): FilterRole[] => [...Object.values(FAMILIES).flat(), 'priority', 'setup'];
/** In doppio i ruoli del doppio; la priorità resta la voce di sempre (un attacco con priorità), una sola. */
const DOUBLES_FILTER_ROLES: FilterRole[] = ['anyAttacker', 'anyWall', 'fakeOut', 'redirector', 'spread', 'protect', 'pivot', 'hazards', 'priority', 'setup'];

/** I ruoli che il filtro offre nel formato. */
export const filterRolesFor = (rules: FormatRules): FilterRole[] => (isOneType(rules) ? DOUBLES_FILTER_ROLES : singlesFilterRoles());

/**
 * Il set ha il ruolo cercato: i tre filtri extra guardano le mosse, gli altri i ruoli del set. Un ruolo che il formato
 * non offre (scelto nel singolo, poi si passa al doppio, o il contrario) si ignora: non svuota la lista.
 */
export function hasFilterRole(set: TeamSet, role: FilterRole, rules: FormatRules): boolean {
  if (!filterRolesFor(rules).includes(role)) return true;
  if (role === 'priority') return hasPriority(set);
  if (role === 'speedControl') return hasSpeedControl(set);
  if (role === 'setup') return hasSetup(set);
  return (shownRoles(detectRoles(set, rules), rules) as FilterRole[]).includes(role);
}

/**
 * I filtri come valgono nel formato: i ruoli che il formato non offre si tolgono (non restano accesi senza vedersi).
 * Lo stesso oggetto se non c'è niente da togliere.
 */
export function filtersFor(filters: CandidateFilters, rules: FormatRules): CandidateFilters {
  const offered = filterRolesFor(rules);
  return filters.roles.every(role => offered.includes(role)) ? filters : { ...filters, roles: filters.roles.filter(role => offered.includes(role)) };
}

export interface CandidateFilters {
  query: string;
  /** Il Pokémon deve avere tutti i tipi scelti (al massimo 2). */
  types: TypeName[];
  /** Solo Pokémon con un tipo (con `types[0]`: solo monotipo di quel tipo). */
  mono: boolean;
  /** Il Pokémon deve avere tutti i ruoli scelti. */
  roles: FilterRole[];
  provides: Condition | '';
  benefitsFrom: Condition | '';
  /** Deve resistere a tutti i tipi scelti. */
  resists: TypeName[];
  /** Deve colpire super efficace tutti i tipi scelti. */
  hits: TypeName[];
  mega: 'all' | 'only' | 'none';
  /** Leggendari e misteriosi insieme. */
  legendary: Inclusion;
  usage: 'all' | 'common' | 'niche';
  tier: TierFilter;
  /** Solo i preferiti delle Liste. */
  favoritesOnly: boolean;
}

export type TierFilter = 'all' | 'legal' | 'uber' | 'ou' | 'uu' | 'ru' | 'nfe';
/** Includere, escludere o mostrare solo una categoria (leggendari e misteriosi, Mega). */
export type Inclusion = 'all' | 'none' | 'only';

export const EMPTY_FILTERS: CandidateFilters = {
  query: '', types: [], mono: false, roles: [], provides: '', benefitsFrom: '', resists: [], hits: [],
  mega: 'all', legendary: 'all', usage: 'all', tier: 'all', favoritesOnly: false,
};

/** Soglie del filtro "Uso nel meta". */
/** Un Pokémon ha al massimo due tipi. */
export const MAX_TYPES = 2;

export const COMMON_USAGE = 0.05;
export const NICHE_USAGE = 0.01;

/** Quanti filtri sono attivi (la ricerca per nome non conta). */
export function activeFilterCount(f: CandidateFilters): number {
  return [
    f.types.length > 0, f.roles.length > 0, f.provides !== '', f.benefitsFrom !== '',
    f.resists.length > 0, f.hits.length > 0, f.mega !== 'all', f.legendary !== 'all',
    f.usage !== 'all', f.tier !== 'all', f.favoritesOnly,
  ].filter(Boolean).length;
}

/** Tipo 1 e Tipo 2 uguali vogliono dire "solo monotipo" di quel tipo. */
export function normalizeTypes(types: TypeName[]): { types: TypeName[]; mono: boolean } {
  return types.length === 2 && types[0] === types[1] ? { types: [types[0]], mono: true } : { types, mono: false };
}

export function isFiltering(f: CandidateFilters): boolean {
  return f.query.trim() !== '' || activeFilterCount(f) > 0;
}

/** Etichetta del tier per le carte: 'Uber' bannato, 'OU', 'RU', 'LC', 'NFE'… */
export function tierLabel(speciesName: string, format: Format): { label: string; banned: boolean } {
  const species = getSpecies(speciesName);
  if (!species) return { label: '?', banned: false };
  const tier = tierIn(species, format);
  // Senza tier National Dex, per i non evoluti si usa il tier singolo (LC / NFE)
  const fallback = ['LC', 'NFE'].includes(String(species.tier)) ? String(species.tier) : species.nfe ? 'NFE' : '—';
  return { label: tier || fallback, banned: isBannedIn(species, format) };
}

const included = (rule: Inclusion, is: boolean) => rule === 'all' || (rule === 'only') === is;

function matchesTier(speciesName: string, tier: TierFilter, format: Format): boolean {
  if (tier === 'all') return true;
  const species = getSpecies(speciesName);
  if (!species) return false;
  const t = tierIn(species, format);
  switch (tier) {
    case 'legal': return !isBannedIn(species, format);
    case 'uber': return t === 'Uber' || t === 'AG';
    case 'ou': return t === 'OU';
    case 'uu': return t === 'UU' || t === 'UUBL';
    case 'ru': return t === 'RU' || t === 'RUBL';
    case 'nfe': return species.nfe || ['NFE', 'LC'].includes(t) || ['NFE', 'LC'].includes(String(species.tier));
  }
}

export function matchesFilters(candidate: { species: string; set: TeamSet }, f: CandidateFilters, data: EngineData, format: Format): boolean {
  const { set } = candidate;
  const rules = formatRules(format.formatId);
  const query = toID(f.query);
  if (query && !toID(candidate.species).includes(query)) return false;
  if (!matchesTier(candidate.species, f.tier, format)) return false;
  if (f.types.length) {
    const types = (battleSpecies(set)?.types ?? []) as readonly string[];
    if (!f.types.every(t => types.includes(t))) return false;
  }
  if (f.mono && (battleSpecies(set)?.types.length ?? 0) !== 1) return false;
  if (f.favoritesOnly && !isUserFavorite(set, data.userLists)) return false;
  if (f.roles.length && !f.roles.every(r => hasFilterRole(set, r, rules))) return false;
  if (f.provides && !enables(set).some(e => e.condition === f.provides)) return false;
  if (f.benefitsFrom && !benefits(set).some(b => b.condition === f.benefitsFrom)) return false;
  if (!f.resists.every(type => defensiveMultiplier(type, set) < 1)) return false;
  if (!f.hits.every(type => superEffectiveMove(set, type) !== null)) return false;
  if (!included(f.mega, isMega(set))) return false;
  if (f.legendary !== 'all') {
    const tags = getSpecies(candidate.species)?.tags ?? [];
    if (!included(f.legendary, tags.some(tag => ['Sub-Legendary', 'Restricted Legendary', 'Mythical'].includes(tag)))) return false;
  }
  // Nel gioco l'uso nel meta competitivo non conta (il filtro non si vede, ma può essere rimasto acceso)
  if (f.usage !== 'all' && !gameOf(format)) {
    const usage = usageOf(data.stats, battleName(set));
    if (f.usage === 'common' && usage < COMMON_USAGE) return false;
    if (f.usage === 'niche' && usage >= NICHE_USAGE) return false;
  }
  return true;
}

/**
 * Tutti i Pokémon del Pokédex (Uber compresi, entro il limite di generazione) che rispettano
 * ricerca e filtri, con il loro set di riferimento. I membri del team sono esclusi.
 */
const setCache = new WeakMap<EngineData, Map<string, TeamSet>>();

/** Set di riferimento, calcolato una volta per specie e riusato tra una ricerca e l'altra. */
function cachedDefaultSet(data: EngineData, species: string, genLimit: number): TeamSet {
  let cache = setCache.get(data);
  if (!cache) setCache.set(data, (cache = new Map()));
  const key = `${genLimit}:${species}`;
  let set = cache.get(key);
  if (!set) cache.set(key, (set = defaultSet(data, species, genLimit)));
  return set;
}

export function searchPool(team: TeamSet[], format: Format, data: EngineData, f: CandidateFilters): TeamSet[] {
  const teamNumbers = new Set(team.map(set => getSpecies(set.species)?.num).filter(isDefined));
  const query = toID(f.query);
  const candidates = dex.species.all()
    .filter(s => isTeambuildable(s) && speciesInPokedex(s, format) && obtainableIn(s, format) && !isCosmeticForme(s) && withinGen(s, format) && !teamNumbers.has(s.num))
    .filter(s => !query || toID(s.name).includes(query))
    // Fuori regola nel formato (Uber, bannati): solo cercandoli per nome, come senza filtri, o chiedendo proprio il tier
    // Uber; gli altri filtri da soli non li portano mai in lista (un bannato non può diventare il #1 da aggiungere)
    .filter(s => !!query || f.tier === 'uber' || !isBannedIn(s, format))
    .map(s => ({ species: s.name, set: cachedDefaultSet(data, s.name, format.genLimit) }))
    .filter(c => matchesFilters(c, f, data, format));
  return uniqueFormes(candidates).map(c => c.set);
}

/** Ricerca e filtri sui candidati, su tutto il Pokédex. Sempre ordinati per adattamento al team. */
export function searchCandidates(team: TeamSet[], format: Format, data: EngineData, f: CandidateFilters, limit = 20, lang: Lang = 'it'): Suggestion[] {
  return scoreSets(team, format, data, searchPool(team, format, data, f), lang).slice(0, limit);
}

/** Applica ricerca e filtri a una lista di sostituti già calcolata. */
export function filterList<T extends { species: string; set: TeamSet }>(list: T[], f: CandidateFilters, data: EngineData, format: Format, limit = 20): T[] {
  return list.filter(item => matchesFilters(item, f, data, format)).slice(0, limit);
}
