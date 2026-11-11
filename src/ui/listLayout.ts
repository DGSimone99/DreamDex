// Calcolo puro del layout della lista candidati (le carte).
// Gli input sono altezze/larghezze in px del contenitore; valori non validi
// (0, negativi, NaN) sono portati a 0 cosi nulla diventa NaN/Infinity.

const num = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export interface CardsLayout {
  columns: number;
  rows: number;
  perPage: number;
  tileHeight: number;
  reasons: number;
}

/** Carte per pagina: al massimo 3 × 2 (una pagina = un team possibile); meno colonne o una riga sola quando non entrano. */
export const CARDS_COLUMNS = 3;
export const CARDS_ROWS = 2;
/** Altezza massima di una carta: oltre, la griglia resta a questa misura e si centra in verticale. */
export const CARDS_MAX_TILE = 260;
/** Larghezza minima di una carta (CSS .suggestions.cards, minmax(130px, 1fr)) e spazio fra le carte. */
export const CARDS_MIN_WIDTH = 130;
export const CARDS_GAP = 8;
/** Lo sprite più piccolo che si accetta sulla carta: sotto, la targhetta lo coprirebbe e non si leggerebbe bene. */
export const CARDS_MIN_SPRITE = 60;

/** Motivi sotto il nome delle carte: 2 col team aperto, 3 col team nascosto. */
export const cardsReasons = (teamCollapsed: boolean): number => (teamCollapsed ? 3 : 2);

/** Margine interno della griglia delle carte (CSS .suggestions.cards): lo spazio per la carta inclinata sotto il mouse. */
export const CARDS_PAD = 14;

/** Altezza minima di una carta: bordo e margini (11) + targhetta (CSS --plate-h: 37 + 16 per motivo) + sprite minimo.
 *  Con 2 motivi 140 px. */
export const cardsMinTile = (reasons: number): number => 11 + 37 + 16 * reasons + CARDS_MIN_SPRITE;

/** Colonne che entrano nella larghezza della lista (padding compreso), da 1 a 3; senza misura 3. */
export function cardsColumns(width: number): number {
  const w = num(width);
  if (!w) return CARDS_COLUMNS;
  return clamp(Math.floor((w - 2 * CARDS_PAD + CARDS_GAP) / (CARDS_MIN_WIDTH + CARDS_GAP)), 1, CARDS_COLUMNS);
}

// Carte: 2 righe che riempiono l'altezza attuale della lista (al massimo 260 px); se due righe farebbero carte più basse
// del minimo (sprite coperto dalla targhetta), una riga sola. Le colonne vengono dalla larghezza (3, o 2 se non entrano).
export function cardsLayout(height: number, teamCollapsed: boolean, width = 0): CardsLayout {
  const h = num(height);
  const reasons = cardsReasons(teamCollapsed);
  const columns = cardsColumns(width);
  const fit = (rows: number) => Math.floor((h - 2 * CARDS_PAD + CARDS_GAP) / rows) - CARDS_GAP;
  // Senza misura (0) restano 2 righe: l'altezza della carta la decide il CSS
  const rows = !h || fit(CARDS_ROWS) >= cardsMinTile(reasons) ? CARDS_ROWS : 1;
  const tileHeight = clamp(fit(rows), 0, CARDS_MAX_TILE);
  return { columns, rows, perPage: columns * rows, tileHeight, reasons };
}
