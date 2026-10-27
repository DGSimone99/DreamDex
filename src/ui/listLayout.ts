// Calcolo puro del layout della lista candidati (stili Carte e Menu).
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

/** Carte per pagina: sempre 3 × 2, una pagina = un team possibile. */
export const CARDS_COLUMNS = 3;
export const CARDS_ROWS = 2;
/** Altezza massima di una carta: oltre, la griglia resta a questa misura e si centra in verticale. */
export const CARDS_MAX_TILE = 260;

/** Motivi sotto il nome delle carte: 2 col team aperto, 3 col team nascosto. */
export const cardsReasons = (teamCollapsed: boolean): number => (teamCollapsed ? 3 : 2);

/** Margine interno della griglia delle carte (CSS .suggestions.cards): lo spazio per la carta inclinata sotto il mouse. */
export const CARDS_PAD = 14;

// Carte: 6 carte verticali (3 colonne × 2 righe) che riempiono l'altezza attuale della lista, al massimo 260 px.
export function cardsLayout(height: number, teamCollapsed: boolean): CardsLayout {
  const h = num(height);
  const tileHeight = clamp(Math.floor((h - 2 * CARDS_PAD + 8) / CARDS_ROWS) - 8, 0, CARDS_MAX_TILE);
  return { columns: CARDS_COLUMNS, rows: CARDS_ROWS, perPage: CARDS_COLUMNS * CARDS_ROWS, tileHeight, reasons: cardsReasons(teamCollapsed) };
}

export interface MenuLayout {
  perPage: number;
  rowHeight: number;
  reasons: number;
}

// Menu: una colonna; perPage dal team aperto, riga al massimo 76 px.
export function menuLayout(openHeight: number, height: number, windowHeight: number): MenuLayout {
  const open = num(openHeight);
  const h = num(height);
  const minRow = num(windowHeight) < 820 ? 42 : 48;
  const perPage = Math.max(1, Math.floor((open - 20 + 6) / (minRow + 6)));
  const rowHeight = Math.max(0, Math.min(76, Math.floor((h - 20 + 6) / perPage) - 6));
  return { perPage, rowHeight, reasons: rowHeight >= 60 ? 3 : 1 };
}
