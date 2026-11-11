import type { FormatId } from '../engine/format';
import { dexOf } from '../engine/formats';

/** Coppie di colori di versione: cambiano solo i due accenti, mai fondi, stato e colori dei tipi. */
export type PaletteId = 'swsh' | 'sv';
/** "auto" segue il gioco del formato; altrimenti una palette fissa scelta nelle impostazioni. */
export type PaletteSetting = 'auto' | PaletteId;

/** Sprite nella lista candidati: normale o icona box. */
export type ListSprite = 'normal' | 'box';

export const PALETTES: PaletteId[] = ['swsh', 'sv'];

/** Finché non c'è la scelta del gioco: il Pokédex Gen 9 è Scarlatto e Violetto, il resto Spada e Scudo. */
export function paletteFor(setting: PaletteSetting, formatId: FormatId): PaletteId {
  if (setting !== 'auto') return setting;
  return dexOf(formatId) === 'gen9' ? 'sv' : 'swsh';
}
