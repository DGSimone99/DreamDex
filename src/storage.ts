export interface SavedTeam {
  name: string;
  text: string;
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
  && typeof (value as SavedTeam).name === 'string' && typeof (value as SavedTeam).text === 'string';

export function loadSavedTeams(storage: Storage | undefined = defaultStorage()): SavedTeam[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isSavedTeam) : [];
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
