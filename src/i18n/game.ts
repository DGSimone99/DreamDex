import { dex, toID } from '../engine/dex';
import type { StatID } from '../engine/sets';
import { TYPES, type TypeName } from '../engine/types';
import { t, type Lang } from './index';

interface Entry { name: string; desc?: string }
export interface GameNames {
  moves: Record<string, Entry>;
  abilities: Record<string, Entry>;
  items: Record<string, Entry>;
  types: Record<string, string>;
  natures: Record<string, string>;
}
export type GameKind = 'move' | 'ability' | 'item';

let italian: GameNames | null = null;
let version = 0;

/** Da chiamare con `data/_i18n/it.json` (o null se manca): l'italiano ripiega sull'inglese. */
export function initGameNames(data: GameNames | null): void {
  italian = data;
  version++;
}

/** Cambia a ogni initGameNames: per invalidare ciò che dipende dai nomi. */
export const gameNamesVersion = (): number => version;
export const hasItalianNames = (): boolean => italian !== null;

const table = (kind: GameKind) => (kind === 'move' ? italian?.moves : kind === 'ability' ? italian?.abilities : italian?.items);

export function gameName(kind: GameKind, name: string, lang: Lang): string {
  if (lang === 'en' || !name) return name;
  return table(kind)?.[toID(name)]?.name ?? name;
}

export function gameDesc(kind: GameKind, name: string, lang: Lang, english?: string): string | undefined {
  if (lang === 'en') return english;
  return table(kind)?.[toID(name)]?.desc ?? english;
}

/** Per nomi che possono essere abilità, mosse o strumenti (es. come si attiva il meteo). */
export function anyGameName(name: string, lang: Lang): string {
  if (lang === 'en') return name;
  const id = toID(name);
  return italian?.abilities[id]?.name ?? italian?.moves[id]?.name ?? italian?.items[id]?.name ?? name;
}

export const typeName = (type: string, lang: Lang): string =>
  (lang === 'en' ? type : italian?.types[toID(type)] ?? type);

export const natureName = (nature: string, lang: Lang): string =>
  (lang === 'en' ? nature : italian?.natures[toID(nature)] ?? nature);

export const statShort = (stat: StatID, lang: Lang): string => t(lang, `stat.${stat}`);

/**
 * Nomi di mosse, abilità e strumenti che contengono il nome di un tipo come parola a sé
 * ("Pugno Fuoco", "Fire Punch"): nei testi restano interi, non si colorano come tipi.
 */
export function namesWithTypes(lang: Lang): string[] {
  const types = new Set(typeNames(lang).map(x => x.local));
  const names = lang === 'en'
    ? [...dex.moves.all(), ...dex.abilities.all(), ...dex.items.all()].filter(x => x.exists).map(x => x.name)
    : [italian?.moves, italian?.abilities, italian?.items].flatMap(table => Object.values(table ?? {}).map(e => e.name));
  return [...new Set(names.filter(name => name.split(/[\s-]+/).some(word => types.has(word))))];
}

/** I 18 tipi con il nome nella lingua data. */
export const typeNames = (lang: Lang): { english: TypeName; local: string }[] =>
  TYPES.map(english => ({ english, local: typeName(english, lang) }));
