import type { StatID } from '@pkmn/dex';
import { dex } from './engine/dex';
import { DEFAULT_CHOICE, sanitizeChoice, type FormatChoice } from './engine/formatChoice';
import type { TeamSet } from './engine/sets';
import { isTeamSet } from './storage';

/** Team e formato condivisi in un link (`#t=...`): niente server, sta tutto nell'indirizzo. */
export interface SharedTeam {
  team: TeamSet[];
  choice: FormatChoice;
}

const PREFIX = '#t=';
/** I link di prima (`#team=` + JSON in base64): si leggono ancora. */
const OLD_PREFIX = '#team=';

/*
 * Il link corto: il formato, poi i set, separati da `~`. In un set i campi sono separati da `_`, le liste (mosse,
 * EV, IV) da `.`. Specie, strumento, abilità, mosse, natura e Tera si scrivono col loro id di Showdown
 * ("Great Tusk" → greattusk); un nome che l'id non ridà uguale (hackrom, accenti) va per intero dopo un `!`.
 * Serve quando il codice a bit (sotto) non basta. Tutti i caratteri restano sicuri in un indirizzo, e il link
 * non finisce mai con un punto (le chat lo staccherebbero).
 */
const STATS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
type Table = { get(name: string): { exists: boolean; id: string; name: string } };
const TABLES = {
  species: dex.species as unknown as Table,
  item: dex.items as unknown as Table,
  ability: dex.abilities as unknown as Table,
  move: dex.moves as unknown as Table,
  nature: dex.natures as unknown as Table,
  type: dex.types as unknown as Table,
};
type Kind = keyof typeof TABLES;

// I separatori (e `!`, `-`…) dentro un testo libero diventano codici %XX: non si confondono con la struttura
const esc = (text: string) => encodeURIComponent(text).replace(/[._~!*'()-]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function packName(kind: Kind, name: string): string {
  if (!name) return '';
  const found = TABLES[kind].get(name);
  if (found.exists && found.id && TABLES[kind].get(found.id).name === name) return found.id;
  return `!${esc(name)}`;
}

function unpackName(kind: Kind, code: string): string {
  if (!code) return '';
  if (code.startsWith('!')) return decodeURIComponent(code.slice(1));
  const found = TABLES[kind].get(code);
  if (!found.exists) throw new Error(`nome sconosciuto: ${code}`);
  return found.name;
}

/** Le sei statistiche in fila, senza i punti in fondo; un oggetto vuoto è `-` (diverso dal campo assente). */
const packStats = (stats: Partial<Record<StatID, number>>) => STATS.map(s => stats[s] ?? '').join('.').replace(/\.+$/, '') || '-';
function unpackStats(code: string): Partial<Record<StatID, number>> {
  const stats: Partial<Record<StatID, number>> = {};
  if (code === '-') return stats;
  const parts = code.split('.');
  STATS.forEach((s, i) => {
    if (!parts[i]) return;
    const n = Number(parts[i]);
    if (!Number.isInteger(n)) throw new Error('statistica non valida');
    stats[s] = n;
  });
  return stats;
}

function packSet(set: TeamSet): string {
  const flags = `${set.favorite ? 'f' : ''}${set.customSkillset ? 'c' : ''}${set.shiny ? 's' : ''}`;
  const fields = [
    packName('species', set.species),
    packName('item', set.item),
    packName('ability', set.ability),
    // Uno slot vuoto è `!` (un nome vuoto): la lista non finisce mai con un punto
    set.moves.map(m => packName('move', m) || '!').join('.'),
    packName('nature', set.nature),
    packStats(set.evs),
    set.ivs ? packStats(set.ivs) : '',
    set.teraType ? packName('type', set.teraType) : '',
    flags,
    set.name ? esc(set.name) : '',
  ];
  while (fields.length && !fields[fields.length - 1]) fields.pop();
  return fields.join('_');
}

function unpackSet(code: string): TeamSet {
  const [species = '', item = '', ability = '', moves = '', nature = '', evs = '', ivs = '', tera = '', flags = '', name = ''] = code.split('_');
  if (!species) throw new Error('specie mancante');
  const set: TeamSet = {
    species: unpackName('species', species),
    item: unpackName('item', item),
    ability: unpackName('ability', ability),
    moves: moves ? moves.split('.').map(m => unpackName('move', m)) : [],
    nature: unpackName('nature', nature),
    evs: evs ? unpackStats(evs) : {},
  };
  if (ivs) set.ivs = unpackStats(ivs);
  if (tera) set.teraType = unpackName('type', tera);
  if (flags.includes('f')) set.favorite = true;
  if (flags.includes('c')) set.customSkillset = true;
  if (flags.includes('s')) set.shiny = true;
  if (name) set.name = decodeURIComponent(name);
  return set;
}

// Il formato: i valori della scelta in fila (niente se è quello di base)
const bit = (b: boolean) => (b ? '1' : '0');
function packChoice(c: FormatChoice): string {
  if (JSON.stringify(c) === JSON.stringify(DEFAULT_CHOICE)) return '';
  switch (c.family) {
    case 'competitive': return ['c', c.gen, c.battle, esc(c.tier), bit(c.ignoreBans), bit(c.multipleMegas)].join('.');
    case 'game': return ['g', c.game, bit(c.allPokedex), bit(c.legendaries)].join('.');
    case 'free': return ['f', c.genLimit, bit(c.multipleMegas)].join('.');
  }
}
function unpackChoice(code: string): FormatChoice {
  const [family, ...p] = code.split('.');
  const on = (s: string | undefined) => s === '1';
  if (family === 'c') return sanitizeChoice({ family: 'competitive', source: 'smogon', gen: p[0] === 'natdex' ? 'natdex' : Number(p[0]), battle: p[1], tier: decodeURIComponent(p[2] ?? ''), ignoreBans: on(p[3]), multipleMegas: on(p[4]) });
  if (family === 'g') return sanitizeChoice({ family: 'game', game: p[0], allPokedex: on(p[1]), legendaries: on(p[2]) });
  if (family === 'f') return sanitizeChoice({ family: 'free', genLimit: Number(p[0]), multipleMegas: on(p[1]) });
  return DEFAULT_CHOICE;
}

/** Il codice a testo (vedi sopra): ha sempre almeno un `~`. Resta per i team che il codice a bit non sa scrivere. */
const encodeText = (team: TeamSet[], choice: FormatChoice): string => [packChoice(choice), ...team.map(packSet)].join('~');

/*
 * Il codice a bit, il più corto (un team da 6 sta in circa 150 caratteri): specie, strumenti, abilità e mosse col loro
 * numero ufficiale dei giochi (non cambia quando escono Pokémon nuovi), natura e Tera col posto in liste fisse, gli EV
 * in quarti. Quello che non ha un numero sicuro (doppioni, hackrom, nomi scritti a mano) va per intero come testo.
 * Poi base64 per indirizzi. Il primo carattere è sempre una lettera tra E e H (la versione): mai `e` come il JSON di
 * prima, mai `~` come il codice a testo.
 */
const VERSION = 1;
const NATURES = dex.natures.all().map(n => n.name).sort();
const TYPES = dex.types.all().map(t => t.name).sort();

class Bits {
  private bits: number[] = [];
  private pos = 0;
  constructor(bytes?: Uint8Array) { if (bytes) for (const b of bytes) for (let i = 7; i >= 0; i--) this.bits.push((b >> i) & 1); }
  put(value: number, n: number) {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** n) throw new Error('fuori misura');
    for (let i = n - 1; i >= 0; i--) this.bits.push(Math.floor(value / 2 ** i) % 2);
  }
  get(n: number): number {
    if (this.pos + n > this.bits.length) throw new Error('codice troncato');
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 2 + this.bits[this.pos++];
    return v;
  }
  putText(text: string) {
    const bytes = new TextEncoder().encode(text);
    this.put(bytes.length, 8);
    bytes.forEach(b => this.put(b, 8));
  }
  getText(): string {
    const n = this.get(8);
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from({ length: n }, () => this.get(8)));
  }
  bytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((b, i) => { if (b) out[i >> 3] |= 0x80 >> (i & 7); });
    return out;
  }
}

/** Numero → nome, solo per i numeri di un nome soltanto (i doppioni vanno come testo). */
type Entry = { num: number; name: string; forme?: string; exists: boolean };
const NUM_BITS = { species: 11, item: 12, ability: 9, move: 10 } as const;
type NumKind = keyof typeof NUM_BITS;
const keyOf = (kind: NumKind, num: number, forme = '') => (kind === 'species' ? `${num}:${forme}` : String(num));
let numMaps: Record<NumKind, Map<string, string | null>> | null = null;
function numMap(kind: NumKind): Map<string, string | null> {
  numMaps ??= (() => {
    const build = (kind: NumKind, all: Entry[]) => {
      const map = new Map<string, string | null>();
      for (const e of all) if (e.exists && e.num > 0) { const k = keyOf(kind, e.num, e.forme); map.set(k, map.has(k) ? null : e.name); }
      return map;
    };
    return {
      species: build('species', dex.species.all() as unknown as Entry[]),
      item: build('item', dex.items.all() as unknown as Entry[]),
      ability: build('ability', dex.abilities.all() as unknown as Entry[]),
      move: build('move', dex.moves.all() as unknown as Entry[]),
    };
  })();
  return numMaps[kind];
}

// Un nome: 0 vuoto, 1 numero (per la specie anche la forma, a testo), 2 testo intero
function putName(w: Bits, kind: NumKind, name: string) {
  if (!name) return w.put(0, 2);
  const found = TABLES[kind].get(name) as unknown as Entry;
  if (found.exists && found.name === name && found.num > 0 && found.num < 2 ** NUM_BITS[kind] && numMap(kind).get(keyOf(kind, found.num, found.forme)) === name) {
    w.put(1, 2);
    w.put(found.num, NUM_BITS[kind]);
    if (kind === 'species') w.putText(found.forme ?? '');
    return;
  }
  w.put(2, 2);
  w.putText(name);
}
function getName(r: Bits, kind: NumKind): string {
  const tag = r.get(2);
  if (tag === 0) return '';
  if (tag === 2) return r.getText();
  if (tag !== 1) throw new Error('nome non valido');
  const num = r.get(NUM_BITS[kind]);
  const name = numMap(kind).get(keyOf(kind, num, kind === 'species' ? r.getText() : ''));
  if (!name) throw new Error('numero sconosciuto');
  return name;
}
// Un nome da una lista fissa (natura, tipo): 0 vuoto, 1 posto nella lista, 2 testo
function putListed(w: Bits, list: string[], name: string) {
  const i = list.indexOf(name);
  if (!name) w.put(0, 2);
  else if (i >= 0) { w.put(1, 2); w.put(i, 5); }
  else { w.put(2, 2); w.putText(name); }
}
function getListed(r: Bits, list: string[]): string {
  const tag = r.get(2);
  if (tag === 0) return '';
  if (tag === 2) return r.getText();
  const name = list[r.get(5)];
  if (tag !== 1 || !name) throw new Error('voce non valida');
  return name;
}
// EV: per statistica c'è o no; i multipli di 4 fino a 252 in 6 bit, gli altri in 10. IV: c'è o no, poi 5 bit
function putStats(w: Bits, stats: Partial<Record<StatID, number>>, iv: boolean) {
  for (const s of STATS) {
    const v = stats[s];
    if (v === undefined) { w.put(0, 1); continue; }
    w.put(1, 1);
    if (iv) w.put(v, 5);
    else if (v % 4 === 0 && v <= 252) { w.put(1, 1); w.put(v / 4, 6); } else { w.put(0, 1); w.put(v, 10); }
  }
}
function getStats(r: Bits, iv: boolean): Partial<Record<StatID, number>> {
  const stats: Partial<Record<StatID, number>> = {};
  for (const s of STATS) if (r.get(1)) stats[s] = iv ? r.get(5) : r.get(1) ? r.get(6) * 4 : r.get(10);
  return stats;
}
const flag = (w: Bits, on: boolean | undefined) => w.put(on ? 1 : 0, 1);

function encodeBits(team: TeamSet[], choice: FormatChoice): string {
  const w = new Bits();
  w.put(VERSION, 4);
  const c = packChoice(choice);
  flag(w, !!c);
  if (c) w.putText(c);
  w.put(team.length, 3);
  for (const set of team) {
    putName(w, 'species', set.species);
    putName(w, 'item', set.item);
    putName(w, 'ability', set.ability);
    w.put(set.moves.length, 3);
    set.moves.forEach(m => putName(w, 'move', m));
    putListed(w, NATURES, set.nature);
    putStats(w, set.evs, false);
    flag(w, !!set.ivs);
    if (set.ivs) putStats(w, set.ivs, true);
    flag(w, !!set.teraType);
    if (set.teraType) putListed(w, TYPES, set.teraType);
    flag(w, set.favorite);
    flag(w, set.customSkillset);
    flag(w, set.shiny);
    flag(w, !!set.name);
    if (set.name) w.putText(set.name);
  }
  return btoa(String.fromCharCode(...w.bytes())).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBits(code: string): SharedTeam | null {
  const r = new Bits(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
  if (r.get(4) !== VERSION) return null;
  const choice = r.get(1) ? unpackChoice(r.getText()) : DEFAULT_CHOICE;
  const count = r.get(3);
  const team: TeamSet[] = [];
  for (let n = 0; n < count; n++) {
    const species = getName(r, 'species');
    if (!species) return null;
    const item = getName(r, 'item');
    const ability = getName(r, 'ability');
    const moves = Array.from({ length: r.get(3) }, () => getName(r, 'move'));
    const set: TeamSet = { species, item, ability, moves, nature: getListed(r, NATURES), evs: getStats(r, false) };
    if (r.get(1)) set.ivs = getStats(r, true);
    if (r.get(1)) set.teraType = getListed(r, TYPES);
    if (r.get(1)) set.favorite = true;
    if (r.get(1)) set.customSkillset = true;
    if (r.get(1)) set.shiny = true;
    if (r.get(1)) set.name = r.getText();
    team.push(set);
  }
  return team.length ? { team: team.slice(0, 6), choice } : null;
}

/** Il codice del team per il link: a bit (il più corto); se il team ha qualcosa che non ci sta, a testo. */
export function encodeShare(team: TeamSet[], choice: FormatChoice): string {
  try {
    return encodeBits(team, choice);
  } catch {
    return encodeText(team, choice);
  }
}

/** Il team del link (`#t=`, o `#team=` di prima), o null se il link non ne contiene uno valido. */
export function decodeShare(hash: string): SharedTeam | null {
  const code = hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : hash.startsWith(OLD_PREFIX) ? hash.slice(OLD_PREFIX.length) : null;
  if (code === null) return null;
  try {
    // Il codice a testo ha sempre `~` (i codici in base64 non ce l'hanno mai)
    if (code.includes('~')) {
      const [choice, ...sets] = code.split('~');
      const team = sets.slice(0, 6).map(unpackSet);
      return team.length ? { team, choice: unpackChoice(choice) } : null;
    }
    // Il JSON di prima comincia sempre con `eyJ` ({" in base64); il resto è il codice a bit
    if (!code.startsWith('eyJ')) return decodeBits(code);
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { team?: unknown; choice?: unknown };
    if (!Array.isArray(parsed.team) || !parsed.team.length || !parsed.team.every(isTeamSet)) return null;
    return { team: parsed.team.slice(0, 6), choice: sanitizeChoice(parsed.choice) };
  } catch {
    return null;
  }
}

/** Indirizzo dell'app con il team. */
export function shareUrl(team: TeamSet[], choice: FormatChoice): string {
  return `${window.location.origin}${window.location.pathname}${PREFIX}${encodeShare(team, choice)}`;
}

/** Legge il team dall'indirizzo una volta sola e lo toglie, così ricaricando non si reimporta. */
export function takeSharedTeam(): SharedTeam | null {
  if (typeof window === 'undefined') return null;
  const shared = decodeShare(window.location.hash);
  if (shared) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return shared;
}
