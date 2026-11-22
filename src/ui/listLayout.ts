// Calcolo puro del layout della lista candidati a "Box" (le carte Pedana).
// Gli input sono altezze/larghezze in px; valori non validi (0, negativi, NaN) sono portati a 0 così nulla diventa
// NaN/Infinity.

const num = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export interface CardsLayout {
  columns: number;
  rows: number;
  perPage: number;
  tileHeight: number;
  reasons: number;
  /** Larghezza fissa della lista (bordo compreso): il dettaglio prende il resto. */
  listWidth: number;
}

/** Spazio fra le carte e margine interno della griglia (CSS .suggestions.cards): lo spazio per la carta che si alza. */
export const CARDS_GAP = 8;
export const CARDS_PAD = 14;
/** Carta più alta: oltre, le carte non si allungano e la griglia si centra. */
export const CARDS_MAX_TILE = 232;
export const CARDS_MAX_ROWS = 4;
/** La quarta fila (schermi alti, team nascosto) solo se le carte restano almeno così alte: niente carte schiacciate. */
export const CARDS_FOURTH_ROW_TILE = 196;
/** Larghezza della carta: 150 px sugli schermi normali, 140 su quelli compatti. */
export const CARDS_WIDE_W = 150;
export const CARDS_NARROW_W = 140;

/** Motivi sotto il nome delle carte: 2 col team aperto, 3 col team nascosto. */
export const cardsReasons = (teamCollapsed: boolean): number => (teamCollapsed ? 3 : 2);

/** Altezza minima di una carta: 18 sopra + sprite 72 + pedana 16 + nome 20 + 8 sotto, più 16 per motivo. */
export const cardsMinTile = (reasons: number): number => 134 + 16 * reasons;

/** Colonne dalla larghezza della scheda (lista + dettaglio): 3 sotto 1000 px, 4 fino a 1500, 5 fino a 1600, poi 6
 *  (anche senza misura 4). Da 1600 il dettaglio resta sui 650-800 px (come a 1440) e lo spazio in più va alla lista,
 *  invece di una scheda larga e vuota. */
export function cardsColumns(pickerWidth: number): number {
  const w = num(pickerWidth);
  if (!w) return 4;
  return w < 1000 ? 3 : w < 1500 ? 4 : w < 1600 ? 5 : 6;
}

/** Larghezza di una carta: 150 da 1150 px di scheda, sennò 140. */
export const cardsWidth = (pickerWidth: number): number => (num(pickerWidth) >= 1150 ? CARDS_WIDE_W : CARDS_NARROW_W);

/** Larghezza della lista: le colonne, gli spazi, il margine interno e il bordo di 1 px per lato. */
export function cardsListWidth(pickerWidth: number): number {
  const cols = cardsColumns(pickerWidth);
  return cols * cardsWidth(pickerWidth) + (cols - 1) * CARDS_GAP + 2 * CARDS_PAD + 2;
}

/** Da 1 a 4 file che riempiono l'altezza della lista (la quarta solo con carte da 196 px in su); le carte fino a 232 px.
 *  Senza misura 2 file e l'altezza al CSS. */
export function cardsLayout(height: number, teamCollapsed: boolean, pickerWidth = 0): CardsLayout {
  const h = num(height);
  const reasons = cardsReasons(teamCollapsed);
  const columns = cardsColumns(pickerWidth);
  const fit = (tile: number) => Math.floor((h - 2 * CARDS_PAD + CARDS_GAP) / (tile + CARDS_GAP));
  const rows = h ? (fit(CARDS_FOURTH_ROW_TILE) >= 4 ? CARDS_MAX_ROWS : clamp(fit(cardsMinTile(reasons)), 1, 3)) : 2;
  const tileHeight = h ? clamp(Math.floor((h - 2 * CARDS_PAD - (rows - 1) * CARDS_GAP) / rows), 0, CARDS_MAX_TILE) : 0;
  return { columns, rows, perPage: columns * rows, tileHeight, reasons, listWidth: cardsListWidth(pickerWidth) };
}
