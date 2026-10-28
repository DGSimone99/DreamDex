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

/** Righe del Menu per pagina: sempre 6, come le Carte (una pagina = un team possibile). */
export const MENU_ROWS = 6;
/** Spazio tra le righe del Menu (CSS .suggestions.menu gap): ci sta lo sprite che sporge dal tondo. */
export const MENU_GAP = 10;
/** Altezza massima di una riga del Menu: oltre, la colonna resta a questa misura e si centra in verticale. */
export const MENU_MAX_ROW = 84;

// Menu: 6 righe che riempiono l'altezza attuale della lista (margine 10 sopra e sotto), al massimo 84 px.
// Motivi: col team aperto 2 se la riga è alta almeno 58 px (sennò 1), col team nascosto fino a 3.
export function menuLayout(height: number, teamCollapsed: boolean): MenuLayout {
  const h = num(height);
  const rowHeight = clamp(Math.floor((h - 20 + MENU_GAP) / MENU_ROWS) - MENU_GAP, 0, MENU_MAX_ROW);
  const reasons = rowHeight >= 76 && teamCollapsed ? 3 : rowHeight >= 58 ? 2 : 1;
  return { perPage: MENU_ROWS, rowHeight, reasons };
}
