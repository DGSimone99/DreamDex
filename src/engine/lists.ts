import { battleSpecies, getSpecies } from './dex';
import { formatOptions, isBannedIn, speciesInPokedex } from './formats';
import type { Format, FormatId } from './format';

/** Le due liste personali: preferiti (♥) e bannati (⊘). */
export type ListKind = 'favorites' | 'bans';
/** Dove vive una voce: nella lista universale o in quella di un formato. */
export type ListScope = 'universal' | FormatId;

export interface ListPair {
  favorites: string[];
  bans: string[];
}

/** Liste salvate: una coppia universale e una per formato. I Pokémon col nome canonico. */
export interface UserLists {
  universal: ListPair;
  byFormat: Partial<Record<FormatId, ListPair>>;
}

export const EMPTY_LISTS: UserLists = { universal: { favorites: [], bans: [] }, byFormat: {} };

/** Le liste che valgono in un formato: le sue più quelle universali (a conflitto vince il formato). */
export interface EffectiveLists {
  favorites: Set<string>;
  bans: Set<string>;
  /** Voci universali coperte dal formato, con la lista universale in cui stanno. */
  overridden: Map<string, ListKind>;
  /** Voci che arrivano dalla lista universale. */
  universal: Set<string>;
  /** Mostrati anche se bannati (ricerca col nome esatto, "mostra"). */
  allow?: Set<string>;
}

/** Un preferito passa davanti a chi lo supera al massimo di tanto (punti del voto, o punti percentuali d'uso). */
export const FAVORITE_MARGIN = 2;

const KINDS: ListKind[] = ['favorites', 'bans'];
const other = (kind: ListKind): ListKind => (kind === 'favorites' ? 'bans' : 'favorites');
const EMPTY_PAIR = (): ListPair => ({ favorites: [], bans: [] });

function sanitizeNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names = raw.map((name): string | undefined => (typeof name === 'string' ? getSpecies(name)?.name : undefined)).filter((n): n is string => !!n);
  return [...new Set(names)];
}

function sanitizePair(raw: unknown): ListPair | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { favorites, bans } = raw as Record<string, unknown>;
  return { favorites: sanitizeNames(favorites), bans: sanitizeNames(bans) };
}

/** Liste lette dal salvataggio: forma sbagliata, nomi sconosciuti e formati inesistenti si scartano. */
export function sanitizeLists(raw: unknown): UserLists {
  if (typeof raw !== 'object' || raw === null) return EMPTY_LISTS;
  const { universal, byFormat } = raw as Record<string, unknown>;
  const ids = new Set<string>(formatOptions().map(f => f.id));
  const formats: UserLists['byFormat'] = {};
  if (typeof byFormat === 'object' && byFormat !== null) {
    for (const [id, value] of Object.entries(byFormat)) {
      const pair = ids.has(id) ? sanitizePair(value) : null;
      if (pair) formats[id as FormatId] = pair;
    }
  }
  return { universal: sanitizePair(universal) ?? EMPTY_PAIR(), byFormat: formats };
}

const pairOf = (lists: UserLists, scope: ListScope): ListPair =>
  (scope === 'universal' ? lists.universal : lists.byFormat[scope]) ?? EMPTY_PAIR();

const withPair = (lists: UserLists, scope: ListScope, pair: ListPair): UserLists =>
  (scope === 'universal' ? { ...lists, universal: pair } : { ...lists, byFormat: { ...lists.byFormat, [scope]: pair } });

/** Aggiunge (togliendolo dall'altra lista dello stesso ambito) o, se c'è già, toglie. */
export function toggleIn(lists: UserLists, scope: ListScope, kind: ListKind, species: string): UserLists {
  const name = getSpecies(species)?.name ?? species;
  const pair = pairOf(lists, scope);
  const next: ListPair = pair[kind].includes(name)
    ? { ...pair, [kind]: pair[kind].filter(n => n !== name) }
    : { ...pair, [kind]: [...pair[kind], name], [other(kind)]: pair[other(kind)].filter(n => n !== name) } as ListPair;
  return withPair(lists, scope, next);
}

export function clearList(lists: UserLists, scope: ListScope, kind: ListKind): UserLists {
  return withPair(lists, scope, { ...pairOf(lists, scope), [kind]: [] } as ListPair);
}

/**
 * Copia le due liste di `from` nel formato `to`: si salta chi non c'è nel Pokédex del formato o vi è bannato,
 * e chi sta già nell'altra lista di destinazione (vince la destinazione). Chi c'è già nella stessa lista non conta.
 */
export function copyLists(lists: UserLists, from: ListScope, to: FormatId, format: Format): { lists: UserLists; copied: number; skipped: number } {
  const source = pairOf(lists, from);
  const target = pairOf(lists, to);
  const next: ListPair = { favorites: [...target.favorites], bans: [...target.bans] };
  let copied = 0;
  let skipped = 0;
  for (const kind of KINDS) {
    for (const name of source[kind]) {
      if (next[kind].includes(name)) continue;
      const species = getSpecies(name);
      if (!species || !speciesInPokedex(species, format) || isBannedIn(species, format) || next[other(kind)].includes(name)) {
        skipped++;
        continue;
      }
      next[kind].push(name);
      copied++;
    }
  }
  return { lists: withPair(lists, to, next), copied, skipped };
}

export function effectiveLists(lists: UserLists, formatId: FormatId): EffectiveLists {
  const own = pairOf(lists, formatId);
  const effective: EffectiveLists = { favorites: new Set(own.favorites), bans: new Set(own.bans), overridden: new Map(), universal: new Set() };
  for (const kind of KINDS) {
    for (const name of lists.universal[kind]) {
      if (own[other(kind)].includes(name)) effective.overridden.set(name, kind);
      else if (!own[kind].includes(name)) {
        effective[kind].add(name);
        effective.universal.add(name);
      }
    }
  }
  return effective;
}

/** Il set è nella lista: la forma in battaglia (Charizard-Mega-X) o la specie e la sua specie base (anche per le forme). */
function listed(set: { species: string; item: string }, names: Set<string>, allow?: Set<string>): boolean {
  const battle = battleSpecies(set)?.name;
  const species = getSpecies(set.species);
  if (allow && ((battle && allow.has(battle)) || (species && allow.has(species.name)))) return false;
  return (!!battle && names.has(battle)) || (!!species && (names.has(species.name) || names.has(species.baseSpecies)));
}

export const isUserBanned = (set: { species: string; item: string }, lists: EffectiveLists | undefined): boolean =>
  !!lists && listed(set, lists.bans, lists.allow);

export const isUserFavorite = (set: { species: string; item: string }, lists: EffectiveLists | undefined): boolean =>
  !!lists && listed(set, lists.favorites);

/**
 * Ordine già deciso, con i preferiti un po' più avanti: ognuno passa davanti ai non preferiti subito prima
 * che lo superano al massimo di `margin`. Non aggiunge né toglie nessuno.
 */
export function applyFavorites<T>(items: T[], isFavorite: (item: T) => boolean, value: (item: T) => number, margin = FAVORITE_MARGIN): T[] {
  const result: T[] = [];
  for (const item of items) {
    let at = result.length;
    if (isFavorite(item)) {
      while (at > 0 && !isFavorite(result[at - 1]) && value(result[at - 1]) - value(item) <= margin) at--;
    }
    result.splice(at, 0, item);
  }
  return result;
}
