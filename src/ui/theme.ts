import type { FormatId } from '../engine/format';
import { dexOf } from '../engine/formats';
import type { GameId } from '../engine/games';

/** Coppie di colori di versione: cambiano solo i due accenti, mai fondi, stato e colori dei tipi. */
export type PaletteId = 'swsh' | 'sv';
/** "auto" segue il gioco del formato; altrimenti una palette fissa scelta nelle impostazioni. */
export type PaletteSetting = 'auto' | PaletteId;

export const PALETTES: PaletteId[] = ['swsh', 'sv'];

/** I colori di ogni gioco. */
const GAME_PALETTE: Record<GameId, PaletteId> = { sv: 'sv' };

/** Col gioco scelto i suoi colori; senza gioco il Pokédex Gen 9 è Scarlatto e Violetto, il resto Spada e Scudo. */
export function paletteFor(setting: PaletteSetting, formatId: FormatId, game: GameId | null = null): PaletteId {
  if (setting !== 'auto') return setting;
  if (game) return GAME_PALETTE[game];
  return dexOf(formatId) === 'gen9' ? 'sv' : 'swsh';
}
