import type { Format } from './engine/format';
import type { TeamSet } from './engine/sets';
import { isTeamSet, sanitizeFormat } from './storage';

/** Team e formato condivisi in un link (`#team=...`): niente server, sta tutto nell'indirizzo. */
export interface SharedTeam {
  team: TeamSet[];
  format: Format;
}

const PREFIX = '#team=';

/** JSON → UTF-8 → base64 per URL (senza +, / e =). */
export function encodeShare(team: TeamSet[], format: Format): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ team, format }));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Il team del link, o null se il link non ne contiene uno valido. */
export function decodeShare(hash: string): SharedTeam | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const base64 = hash.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { team?: unknown; format?: unknown };
    if (!Array.isArray(parsed.team) || !parsed.team.length || !parsed.team.every(isTeamSet)) return null;
    return { team: parsed.team.slice(0, 6), format: sanitizeFormat(parsed.format) };
  } catch {
    return null;
  }
}

/** Indirizzo dell'app con il team. */
export function shareUrl(team: TeamSet[], format: Format): string {
  return `${window.location.origin}${window.location.pathname}${PREFIX}${encodeShare(team, format)}`;
}

/** Legge il team dall'indirizzo una volta sola e lo toglie, così ricaricando non si reimporta. */
export function takeSharedTeam(): SharedTeam | null {
  if (typeof window === 'undefined') return null;
  const shared = decodeShare(window.location.hash);
  if (shared) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return shared;
}
