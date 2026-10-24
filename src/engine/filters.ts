import type { Lang } from '../i18n';
import { fitsArchetype, type FitArchetype } from './archetype';
import type { EngineData } from './data';
import { battleName, battleSpecies, dex, getSpecies, isCosmeticForme, isDefined, isMega, isTeambuildable, toID, withinGen } from './dex';
import { isBannedIn, speciesInPokedex, tierIn } from './formats';
import type { Format } from './format';
import { formatRules, type FormatRules } from './formatRules';
import { detectRoles, hasPriority, hasSetup, hasSpeedControl } from './roles';
import type { SubRole } from './subRoles';
import { scoreSets, uniqueFormes, type Suggestion } from './scoring';
import { defaultSet, type TeamSet } from './sets';
import { usageOf } from './stats';
import { benefits, enables, type Condition } from './synergy';
import { defensiveMultiplier, superEffectiveMove, type TypeName } from './types';

/** Ruoli cercabili: i 17 sotto-ruoli più tre filtri sulle mosse (priorità, controllo velocità, setup), che non entrano nel voto. */
export type FilterRole = SubRole | 'priority' | 'speedControl' | 'setup';

/** Il set ha il ruolo cercato: i tre filtri extra guardano le mosse, gli altri i sotto-ruoli del set. */
export function hasFilterRole(set: TeamSet, role: FilterRole, rules: FormatRules): boolean {
  if (role === 'priority') return hasPriority(set);
  if (role === 'speedControl') return hasSpeedControl(set);
  if (role === 'setup') return hasSetup(set);
  return detectRoles(set, rules).includes(role);
}

export interface CandidateFilters {
  query: string;
  /** Il Pokémon deve avere tutti i tipi scelti (al massimo 2). */
  types: TypeName[];
  /** Il Pokémon deve avere tutti i ruoli scelti. */
  roles: FilterRole[];
  provides: Condition | '';
  benefitsFrom: Condition | '';
  /** Adatto a un team di questo archetipo (stall, hyper offense, bulky offense). */
  fitsArchetype: FitArchetype | '';
  /** Deve resistere a tutti i tipi scelti. */
  resists: TypeName[];
  /** Deve colpire super efficace tutti i tipi scelti. */
  hits: TypeName[];
  mega: 'all' | 'only' | 'none';
  /** Leggendari e misteriosi insieme. */
  legendary: Inclusion;
  usage: 'all' | 'common' | 'niche';
  tier: TierFilter;
}

export type TierFilter = 'all' | 'legal' | 'uber' | 'ou' | 'uu' | 'ru' | 'nfe';
/** Includere, escludere o mostrare solo una categoria (leggendari e misteriosi, Mega). */
export type Inclusion = 'all' | 'none' | 'only';

export const EMPTY_FILTERS: CandidateFilters = {
  query: '', types: [], roles: [], provides: '', benefitsFrom: '', fitsArchetype: '', resists: [], hits: [],
  mega: 'all', legendary: 'all', usage: 'all', tier: 'all',
};

/** Soglie del filtro "Uso nel meta". */
/** Un Pokémon ha al massimo due tipi. */
export const MAX_TYPES = 2;

export const COMMON_USAGE = 0.05;
export const NICHE_USAGE = 0.01;

/** Quanti filtri sono attivi (la ricerca per nome non conta). */
export function activeFilterCount(f: CandidateFilters): number {
  return [
    f.types.length > 0, f.roles.length > 0, f.provides !== '', f.benefitsFrom !== '', f.fitsArchetype !== '',
    f.resists.length > 0, f.hits.length > 0, f.mega !== 'all', f.legendary !== 'all',
    f.usage !== 'all', f.tier !== 'all',
  ].filter(Boolean).length;
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
  if (f.roles.length && !f.roles.every(r => hasFilterRole(set, r, rules))) return false;
  if (f.provides && !enables(set).some(e => e.condition === f.provides)) return false;
  if (f.benefitsFrom && !benefits(set).some(b => b.condition === f.benefitsFrom)) return false;
  if (f.fitsArchetype && !fitsArchetype(set, f.fitsArchetype, rules)) return false;
  if (!f.resists.every(type => defensiveMultiplier(type, set) < 1)) return false;
  if (!f.hits.every(type => superEffectiveMove(set, type) !== null)) return false;
  if (!included(f.mega, isMega(set))) return false;
  if (f.legendary !== 'all') {
    const tags = getSpecies(candidate.species)?.tags ?? [];
    if (!included(f.legendary, tags.some(tag => ['Sub-Legendary', 'Restricted Legendary', 'Mythical'].includes(tag)))) return false;
  }
  if (f.usage !== 'all') {
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
    .filter(s => isTeambuildable(s) && speciesInPokedex(s, format) && !isCosmeticForme(s) && withinGen(s, format) && !teamNumbers.has(s.num))
    .filter(s => !query || toID(s.name).includes(query))
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
