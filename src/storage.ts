import { DEFAULT_FORMAT, type Format } from './engine/format';
import { formatOptions } from './engine/formats';
import type { TeamSet } from './engine/sets';
import { isLang, type Lang } from './i18n';
import { EMPTY_LISTS, sanitizeLists, type UserLists } from './engine/lists';

export interface SavedTeam {
  name: string;
  text: string;
  /** Posizioni dei membri preferiti (il formato Showdown non li prevede). */
  favorites?: number[];
  /** Posizioni dei membri con Custom Skillset. */
  custom?: number[];
  /** Formato in cui il team è stato salvato. */
  format?: Format;
}

const KEY = 'dreamdex.savedTeams';

function defaultStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const isSavedTeam = (value: unknown): value is SavedTeam =>
  typeof value === 'object' && value !== null
  && typeof (value as SavedTeam).name === 'string' && typeof (value as SavedTeam).text === 'string'
  && ((value as SavedTeam).favorites === undefined || Array.isArray((value as SavedTeam).favorites));

export function loadSavedTeams(storage: Storage | undefined = defaultStorage()): SavedTeam[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isSavedTeam).map(t => (t.format === undefined ? t : { ...t, format: sanitizeFormat(t.format) }))
      : [];
  } catch {
    return [];
  }
}

export function saveTeams(teams: SavedTeam[], storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify(teams));
    return true;
  } catch {
    return false;
  }
}


const LISTS_KEY = 'dreamdex.lists';

/** Liste personali (preferiti e bannati); dati assenti o rotti: liste vuote. */
export function loadLists(storage: Storage | undefined = defaultStorage()): UserLists {
  try {
    return sanitizeLists(JSON.parse(storage?.getItem(LISTS_KEY) ?? 'null'));
  } catch {
    return EMPTY_LISTS;
  }
}

export function saveLists(lists: UserLists, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LISTS_KEY, JSON.stringify(lists));
    return true;
  } catch {
    return false;
  }
}

export interface Session {
  team: TeamSet[];
  format: Format;
}

const SESSION_KEY = 'dreamdex.session';

/** Ricostruisce un formato valido da dati salvati (campi sconosciuti o errati tornano ai valori di default). */
export function sanitizeFormat(raw: unknown): Format {
  const f = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Format>;
  return {
    formatId: formatOptions().some(o => o.id === f.formatId) ? f.formatId! : DEFAULT_FORMAT.formatId,
    genLimit: typeof f.genLimit === 'number' && f.genLimit >= 1 && f.genLimit <= 9 ? f.genLimit : DEFAULT_FORMAT.genLimit,
    minUsage: typeof f.minUsage === 'number' && f.minUsage >= 0 ? f.minUsage : DEFAULT_FORMAT.minUsage,
    allowMultipleMegas: f.allowMultipleMegas === true,
    ignoreBans: f.ignoreBans === true,
    meta: f.meta !== false,
  };
}

export const isTeamSet = (value: unknown): value is TeamSet =>
  typeof value === 'object' && value !== null && typeof (value as TeamSet).species === 'string'
  && Array.isArray((value as TeamSet).moves);

/** Team e formato dell'ultima sessione, o null se assenti o non validi. */
export function loadSession(storage: Storage | undefined = defaultStorage()): Session | null {
  try {
    const raw = storage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { team?: unknown; format?: unknown };
    if (!Array.isArray(parsed.team) || !parsed.team.every(isTeamSet)) return null;
    return { team: parsed.team.slice(0, 6), format: sanitizeFormat(parsed.format) };
  } catch {
    return null;
  }
}

export function saveSession(session: Session, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

/** localStorage del browser, se accessibile. */
export const browserStorage = (): Storage | undefined => defaultStorage();

const LANG_KEY = 'dreamdex.lang';

/** Lingua salvata, o null se assente o non valida. */
export function loadLang(storage: Storage | undefined = defaultStorage()): Lang | null {
  try {
    const raw = storage?.getItem(LANG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isLang(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang, storage: Storage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(LANG_KEY, JSON.stringify(lang));
  } catch {
    // Archivio non disponibile: la scelta vale solo per questa sessione
  }
}

const TAB_KEY = 'dreamdex.tab';
const TABS = ['pokemon', 'analysis', 'meta', 'lists'] as const;
export type SavedTab = typeof TABS[number];

/** Ultima scheda aperta (Pokémon, Analisi, Meta), o null. */
export function loadTab(storage: Storage | undefined = defaultStorage()): SavedTab | null {
  try {
    const raw = storage?.getItem(TAB_KEY);
    return (TABS as readonly string[]).includes(raw ?? '') ? raw as SavedTab : null;
  } catch {
    return null;
  }
}

export function saveTab(tab: SavedTab, storage: Storage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(TAB_KEY, tab);
  } catch {
    // Archivio non disponibile: la scheda vale solo per questa sessione
  }
}
