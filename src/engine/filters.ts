import type { EngineData } from './data';
import { battleName, battleSpecies, getSpecies, isAllowed, isDefined, isMega, speciesNames, toID } from './dex';
import type { Format } from './format';
import { detectRoles, type Role } from './roles';
import { scoreCandidates, type Suggestion } from './scoring';
import { defaultSet, type TeamSet } from './sets';
import { usageOf } from './stats';
import { benefits, enables, type Condition } from './synergy';
import { defensiveMultiplier, superEffectiveMove, type TypeName } from './types';

export interface CandidateFilters {
  query: string;
  /** Basta uno dei tipi scelti. */
  types: TypeName[];
  /** Basta uno dei ruoli scelti. */
  roles: Role[];
  provides: Condition | '';
  benefitsFrom: Condition | '';
  resists: TypeName | '';
  hits: TypeName | '';
  mega: 'all' | 'only' | 'none';
  usage: 'all' | 'common' | 'niche';
}

export const EMPTY_FILTERS: CandidateFilters = {
  query: '', types: [], roles: [], provides: '', benefitsFrom: '', resists: '', hits: '', mega: 'all', usage: 'all',
};

/** Soglie del filtro "Uso nel meta". */
export const COMMON_USAGE = 0.05;
export const NICHE_USAGE = 0.01;

/** Quanti filtri sono attivi (la ricerca per nome non conta). */
export function activeFilterCount(f: CandidateFilters): number {
  return [
    f.types.length > 0, f.roles.length > 0, f.provides !== '', f.benefitsFrom !== '',
    f.resists !== '', f.hits !== '', f.mega !== 'all', f.usage !== 'all',
  ].filter(Boolean).length;
}

export function isFiltering(f: CandidateFilters): boolean {
  return f.query.trim() !== '' || activeFilterCount(f) > 0;
}

export function matchesFilters(candidate: { species: string; set: TeamSet }, f: CandidateFilters, data: EngineData): boolean {
  const { set } = candidate;
  const query = toID(f.query);
  if (query && !toID(candidate.species).includes(query)) return false;
  if (f.types.length) {
    const types = (battleSpecies(set)?.types ?? []) as readonly string[];
    if (!f.types.some(t => types.includes(t))) return false;
  }
  if (f.roles.length) {
    const roles = detectRoles(set);
    if (!f.roles.some(r => roles.includes(r))) return false;
  }
  if (f.provides && !enables(set).some(e => e.condition === f.provides)) return false;
  if (f.benefitsFrom && !benefits(set).some(b => b.condition === f.benefitsFrom)) return false;
  if (f.resists && !(defensiveMultiplier(f.resists, set) < 1)) return false;
  if (f.hits && superEffectiveMove(set, f.hits) === null) return false;
  if (f.mega === 'only' && !isMega(set)) return false;
  if (f.mega === 'none' && isMega(set)) return false;
  if (f.usage !== 'all') {
    const usage = usageOf(data.stats, battleName(set));
    if (f.usage === 'common' && usage < COMMON_USAGE) return false;
    if (f.usage === 'niche' && usage >= NICHE_USAGE) return false;
  }
  return true;
}

/**
 * Ricerca e filtri sui candidati: ignora la soglia di uso minimo e, con una ricerca per nome,
 * include anche i Pokémon senza dati Smogon. Sempre ordinati per adattamento al team.
 */
export function searchCandidates(team: TeamSet[], format: Format, data: EngineData, f: CandidateFilters, limit = 20): Suggestion[] {
  const query = toID(f.query);
  const inStats = new Set(Object.keys(data.stats?.pokemon ?? {}).map(toID));
  const teamNumbers = new Set(team.map(set => getSpecies(set.species)?.num).filter(isDefined));
  const extra = query
    ? speciesNames()
      .filter(name => toID(name).includes(query) && !inStats.has(toID(name)))
      .map(getSpecies)
      .filter(isDefined)
      .filter(s => isAllowed(s, format) && !teamNumbers.has(s.num))
      .slice(0, 50)
      .map(s => defaultSet(data, s.name))
    : [];
  return scoreCandidates(team, { ...format, minUsage: 0 }, data, extra)
    .filter(s => matchesFilters(s, f, data))
    .slice(0, limit);
}

/** Applica ricerca e filtri a una lista di sostituti già calcolata. */
export function filterList<T extends { species: string; set: TeamSet }>(list: T[], f: CandidateFilters, data: EngineData, limit = 20): T[] {
  return list.filter(item => matchesFilters(item, f, data)).slice(0, limit);
}
