import type { Format } from './format';

/** Giochi della serie principale che si possono scegliere (per ora Scarlatto e Violetto, in coppia). */
export type GameId = 'sv';
export const GAME_IDS: GameId[] = ['sv'];

/** Pokédex del gioco preparato da fetch-data (`data/_games/<gioco>.json`): id delle specie dei Pokédex regionali. */
export interface GameDexFile { dex: string[] }

type Locked = Pick<Format, 'formatId' | 'meta' | 'genLimit' | 'ignoreBans' | 'allowMultipleMegas'>;

/** Il formato che ogni gioco impone: Scarlatto e Violetto = Gen 9 senza meta (Anything Goes, senza ban per tier). */
export const GAME_LOCK: Record<GameId, Locked> = {
  sv: { formatId: 'gen9ag', meta: false, genLimit: 9, ignoreBans: false, allowMultipleMegas: false },
};

/** Il formato col gioco scelto (e il suo blocco), o senza gioco (opzioni del gioco spente). */
export function withGame(format: Format, game: GameId | null): Format {
  if (!game) return { ...format, game: null, allPokedex: false, legendaries: false };
  return { ...format, ...GAME_LOCK[game], game };
}

export const gameOf = (format: Format): GameId | null => format.game ?? null;
