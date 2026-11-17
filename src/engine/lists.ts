import { battleSpecies, dex, getSpecies, isCosmeticForme, isTeambuildable, withinGen } from './dex';
import { formatOptions, isBannedIn, speciesInPokedex } from './formats';
import type { Format, FormatId } from './format';
import { GAME_IDS, GAME_LOCK, type GameId } from './games';

/** Le due liste personali: preferiti (♥) e bannati (⊘). */
export type ListKind = 'favorites' | 'bans';

/**
 * Il contesto di una raccolta "del formato": il gioco quando è scelto, altrimenti il formato (Pokédex + tier).
 * Ogni contesto ha la sua raccolta, che si attiva da sola quando il contesto cambia.
 */
export type ListContext = FormatId | GameId;

/**
 * Una raccolta (Preferiti + Bannati): l'Universale (vale ovunque, sotto le altre), quella di un contesto, o una
 * personalizzata (`custom:<id>`).
 */
export type ListScope = 'universal' | ListContext | `custom:${string}`;

export interface ListPair {
  favorites: string[];
  bans: string[];
}

/** Raccolta creata dall'utente, col suo nome: scelta, vale al posto di quella del formato (l'Universale resta sotto). */
export interface CustomList extends ListPair {
  id: string;
  name: string;
}

/**
 * Le raccolte salvate: l'Universale, una per contesto, le personalizzate, e per ogni contesto la personalizzata scelta
 * al posto di quella del formato (se c'è; si ricorda per contesto). I Pokémon col nome canonico.
 */
export interface UserLists {
  universal: ListPair;
  byContext: Partial<Record<ListContext, ListPair>>;
  custom: CustomList[];
  active: Partial<Record<ListContext, string>>;
}

export const EMPTY_LISTS: UserLists = { universal: { favorites: [], bans: [] }, byContext: {}, custom: [], active: {} };

/** Le liste che valgono: quelle della raccolta più quelle universali (a conflitto vince la raccolta). */
export interface EffectiveLists {
  favorites: Set<string>;
  bans: Set<string>;
  /** Voci universali coperte dalla raccolta, con la lista universale in cui stanno. */
  overridden: Map<string, ListKind>;
  /** Voci che arrivano dalla lista universale. */
  universal: Set<string>;
  /** Mostrati anche se bannati (ricerca col nome esatto, "mostra"). */
  allow?: Set<string>;
}

/** Un preferito passa davanti a chi lo supera al massimo di tanto (punti del voto, o punti percentuali d'uso). */
export const FAVORITE_MARGIN = 2;

const KINDS: ListKind[] = ['favorites', 'bans'];
export const otherKind = (kind: ListKind): ListKind => (kind === 'favorites' ? 'bans' : 'favorites');
const other = otherKind;
const EMPTY_PAIR = (): ListPair => ({ favorites: [], bans: [] });

/** Il contesto delle raccolte per il formato scelto: il gioco, se c'è, altrimenti il formato. */
export const listContext = (format: Pick<Format, 'formatId' | 'game'>): ListContext => format.game ?? format.formatId;

/** Tutti i contesti possibili, nell'ordine dei menu: i formati, poi i giochi. */
export const LIST_CONTEXTS: ListContext[] = [...formatOptions().map(f => f.id), ...GAME_IDS];
const isContext = (id: string): id is ListContext => (LIST_CONTEXTS as string[]).includes(id);

export const customScope = (id: string): ListScope => `custom:${id}`;
export const customIdOf = (scope: ListScope): string | null => (scope.startsWith('custom:') ? scope.slice(7) : null);

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

function sanitizeContexts(raw: unknown, only: readonly string[] = LIST_CONTEXTS): UserLists['byContext'] {
  const out: UserLists['byContext'] = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [id, value] of Object.entries(raw)) {
    const pair = only.includes(id) ? sanitizePair(value) : null;
    if (pair) out[id as ListContext] = pair;
  }
  return out;
}

/**
 * Liste lette dal salvataggio: forma sbagliata, nomi sconosciuti e contesti inesistenti si scartano.
 * Migrazione dal salvataggio di prima delle raccolte (`{ universal, byFormat }`): l'Universale resta l'Universale e
 * ogni lista per formato diventa la raccolta di quel formato, voce per voce. La lista di Anything Goes (Gen 9) valeva
 * anche col gioco Scarlatto e Violetto (che impone quel formato): la stessa lista diventa anche la raccolta del gioco,
 * così col gioco scelto si vede quello che si vedeva prima.
 */
export function sanitizeLists(raw: unknown): UserLists {
  if (typeof raw !== 'object' || raw === null) return EMPTY_LISTS;
  const record = raw as Record<string, unknown>;
  const universal = sanitizePair(record.universal) ?? EMPTY_PAIR();
  if (!('byContext' in record)) {
    const byContext = sanitizeContexts(record.byFormat, formatOptions().map(f => f.id));
    for (const game of GAME_IDS) {
      const locked = byContext[GAME_LOCK[game].formatId];
      if (locked && (locked.favorites.length || locked.bans.length)) byContext[game] = { favorites: [...locked.favorites], bans: [...locked.bans] };
    }
    return { universal, byContext, custom: [], active: {} };
  }
  const custom: CustomList[] = [];
  if (Array.isArray(record.custom)) {
    for (const value of record.custom) {
      const pair = sanitizePair(value);
      const { id, name } = (value ?? {}) as Record<string, unknown>;
      if (!pair || typeof id !== 'string' || !id || typeof name !== 'string' || custom.some(c => c.id === id)) continue;
      custom.push({ id, name: name.trim() || id, ...pair });
    }
  }
  const active: UserLists['active'] = {};
  if (typeof record.active === 'object' && record.active !== null) {
    for (const [context, id] of Object.entries(record.active)) {
      if (isContext(context) && typeof id === 'string' && custom.some(c => c.id === id)) active[context] = id;
    }
  }
  return { universal, byContext: sanitizeContexts(record.byContext), custom, active };
}

/** Le due liste di una raccolta (vuote se non c'è ancora o se la personalizzata non esiste più). */
export function pairOf(lists: UserLists, scope: ListScope): ListPair {
  if (scope === 'universal') return lists.universal;
  const id = customIdOf(scope);
  if (id !== null) return lists.custom.find(c => c.id === id) ?? EMPTY_PAIR();
  return lists.byContext[scope as ListContext] ?? EMPTY_PAIR();
}

function withPair(lists: UserLists, scope: ListScope, pair: ListPair): UserLists {
  if (scope === 'universal') return { ...lists, universal: pair };
  const id = customIdOf(scope);
  if (id !== null) return { ...lists, custom: lists.custom.map(c => (c.id === id ? { ...c, favorites: pair.favorites, bans: pair.bans } : c)) };
  return { ...lists, byContext: { ...lists.byContext, [scope]: pair } };
}

/** La raccolta attiva nel contesto: la personalizzata scelta, altrimenti quella del contesto. */
export function activeScope(lists: UserLists, context: ListContext): ListScope {
  const id = lists.active[context];
  return id && lists.custom.some(c => c.id === id) ? customScope(id) : context;
}

/**
 * Sceglie la raccolta attiva del contesto: una personalizzata vale al posto di quella del formato (finché non si torna
 * a quella), la raccolta del contesto torna quella del formato. Le altre (Universale, altri formati) non cambiano la
 * scelta: si guardano e si modificano soltanto.
 */
export function setActive(lists: UserLists, context: ListContext, scope: ListScope): UserLists {
  const id = customIdOf(scope);
  if (id !== null) return lists.active[context] === id ? lists : { ...lists, active: { ...lists.active, [context]: id } };
  if (scope !== context || !(context in lists.active)) return lists;
  const active = { ...lists.active };
  delete active[context];
  return { ...lists, active };
}

/** Nuova raccolta personalizzata, vuota: id "c1", "c2"… (il primo libero). */
export function createList(lists: UserLists, name: string): { lists: UserLists; id: string } {
  let n = lists.custom.length + 1;
  while (lists.custom.some(c => c.id === `c${n}`)) n++;
  const id = `c${n}`;
  return { lists: { ...lists, custom: [...lists.custom, { id, name: name.trim() || id, favorites: [], bans: [] }] }, id };
}

export function renameList(lists: UserLists, id: string, name: string): UserLists {
  const clean = name.trim();
  if (!clean) return lists;
  return { ...lists, custom: lists.custom.map(c => (c.id === id ? { ...c, name: clean } : c)) };
}

/** Toglie una personalizzata: i contesti che la usavano tornano alla raccolta del formato. */
export function deleteList(lists: UserLists, id: string): UserLists {
  const active = Object.fromEntries(Object.entries(lists.active).filter(([, value]) => value !== id)) as UserLists['active'];
  return { ...lists, custom: lists.custom.filter(c => c.id !== id), active };
}

/** Aggiunge (togliendolo dall'altra lista della stessa raccolta) o, se c'è già, toglie. */
export function toggleIn(lists: UserLists, scope: ListScope, kind: ListKind, species: string): UserLists {
  const name = getSpecies(species)?.name ?? species;
  const pair = pairOf(lists, scope);
  const next: ListPair = pair[kind].includes(name)
    ? { ...pair, [kind]: pair[kind].filter(n => n !== name) }
    : { ...pair, [kind]: [...pair[kind], name], [other(kind)]: pair[other(kind)].filter(n => n !== name) } as ListPair;
  return withPair(lists, scope, next);
}

/** Mette il Pokémon nella lista `kind` della raccolta (togliendolo dall'altra); se c'è già, resta. */
export function putIn(lists: UserLists, scope: ListScope, kind: ListKind, species: string): UserLists {
  const name = getSpecies(species)?.name ?? species;
  return pairOf(lists, scope)[kind].includes(name) ? lists : toggleIn(lists, scope, kind, name);
}

export function clearList(lists: UserLists, scope: ListScope, kind: ListKind): UserLists {
  return withPair(lists, scope, { ...pairOf(lists, scope), [kind]: [] } as ListPair);
}

/** Svuota tutte e due le liste della raccolta. */
export const clearScope = (lists: UserLists, scope: ListScope): UserLists => withPair(lists, scope, EMPTY_PAIR());

/** Quante voci ha la raccolta (preferiti, bannati). */
export const countOf = (lists: UserLists, scope: ListScope): [number, number] => {
  const pair = pairOf(lists, scope);
  return [pair.favorites.length, pair.bans.length];
};

/**
 * Copia le due liste di `from` nella raccolta `to`: si salta chi non c'è nel Pokédex del formato o vi è bannato,
 * e chi sta già nell'altra lista di destinazione (vince la destinazione). Chi c'è già nella stessa lista non conta.
 * `replace`: la destinazione prima si svuota (restano solo i copiati).
 */
export function copyLists(lists: UserLists, from: ListScope, to: ListScope, format: Format, mode: 'add' | 'replace' = 'add'): { lists: UserLists; copied: number; skipped: number } {
  const source = pairOf(lists, from);
  const target = mode === 'replace' ? EMPTY_PAIR() : pairOf(lists, to);
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

/**
 * Le liste che valgono guardando la raccolta `scope`: le sue più le universali sotto (a conflitto vince la raccolta).
 * L'Universale da sola: solo le sue.
 */
export function scopeLists(lists: UserLists, scope: ListScope): EffectiveLists {
  const own = pairOf(lists, scope);
  const effective: EffectiveLists = { favorites: new Set(own.favorites), bans: new Set(own.bans), overridden: new Map(), universal: new Set() };
  if (scope === 'universal') return effective;
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

/** Le liste che valgono nel contesto (suggerimenti, Coaching, Completa team): la raccolta attiva più l'Universale. */
export const effectiveLists = (lists: UserLists, context: ListContext): EffectiveLists => scopeLists(lists, activeScope(lists, context));

/** Tutti i Pokémon che si possono mettere in un team nel formato, in ordine di Pokédex (la forma base prima delle altre). */
export function pokedexSpecies(format: Format): string[] {
  return dex.species.all()
    .filter(s => isTeambuildable(s) && speciesInPokedex(s, format) && !isCosmeticForme(s) && withinGen(s, format) && !s.forme.includes('Totem'))
    .sort((a, b) => a.num - b.num || Number(!!a.forme) - Number(!!b.forme) || a.name.localeCompare(b.name))
    .map(s => s.name);
}

/** Le regioni dei Pokédex regionali del menu "Ordine" delle Liste, in ordine di generazione. */
export const REGIONS = ['kanto', 'johto', 'hoenn', 'sinnoh', 'unova', 'kalos', 'alola', 'galar', 'paldea'] as const;
export type Region = (typeof REGIONS)[number];
/** Ultimo numero del Pokédex nazionale di ogni generazione (Kanto 151 … Galar 905, Paldea fino alla fine). */
const REGION_END = [151, 251, 386, 493, 649, 721, 809, 905, Infinity];

/**
 * La regione d'origine del Pokémon. @pkmn/dex non ha i numeri dei Pokédex regionali: si usa la generazione d'origine
 * (dal numero nazionale), e le forme regionali vanno nella loro regione (Alola, Galar, Paldea; Hisui con Sinnoh, la
 * regione di prima). Mega e altre forme seguono la specie base.
 */
export function regionOf(name: string): Region | null {
  const species = getSpecies(name);
  if (!species || species.num <= 0) return null;
  const forme = species.forme;
  if (forme.startsWith('Alola')) return 'alola';
  if (forme.startsWith('Galar')) return 'galar';
  if (forme.startsWith('Hisui')) return 'sinnoh';
  if (forme.startsWith('Paldea')) return 'paldea';
  return REGIONS[REGION_END.findIndex(end => species.num <= end)] ?? null;
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
