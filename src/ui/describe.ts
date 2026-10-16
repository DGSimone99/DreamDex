import { dex, getMove } from '../engine/dex';
import type { Lang } from '../i18n';
import { gameDesc } from '../i18n/game';

/** Descrizioni: quelle dei giochi in italiano, altrimenti quelle di Showdown (in inglese). */
export const describe = {
  item: (name: string, lang: Lang) => (name ? gameDesc('item', name, lang, dex.items.get(name).shortDesc || undefined) : undefined),
  ability: (name: string, lang: Lang) => (name ? gameDesc('ability', name, lang, dex.abilities.get(name).shortDesc || undefined) : undefined),
  move: (name: string, lang: Lang) => {
    const move = getMove(name);
    return move ? gameDesc('move', move.name, lang, move.shortDesc || move.desc || undefined) : undefined;
  },
};
