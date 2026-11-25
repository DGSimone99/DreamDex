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
 * Un team da 6 viene circa un terzo del link di prima. Tutti i caratteri restano sicuri in un indirizzo, e il link
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

/** Il codice del team per il link: formato e set (vedi sopra). Ha sempre almeno un `~`. */
export function encodeShare(team: TeamSet[], choice: FormatChoice): string {
  return [packChoice(choice), ...team.map(packSet)].join('~');
}

/** Il team del link (`#t=`, o `#team=` di prima), o null se il link non ne contiene uno valido. */
export function decodeShare(hash: string): SharedTeam | null {
  const code = hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : hash.startsWith(OLD_PREFIX) ? hash.slice(OLD_PREFIX.length) : null;
  if (code === null) return null;
  try {
    // Il codice corto ha sempre `~` (il base64 di prima non ce l'ha mai)
    if (code.includes('~')) {
      const [choice, ...sets] = code.split('~');
      const team = sets.slice(0, 6).map(unpackSet);
      return team.length ? { team, choice: unpackChoice(choice) } : null;
    }
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
