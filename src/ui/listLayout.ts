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

/** Carte per pagina: al massimo 3 × 2 (una pagina = un team possibile); meno colonne o una riga sola quando non entrano. */
export const CARDS_COLUMNS = 3;
export const CARDS_ROWS = 2;
/** Altezza massima di una carta: oltre, la griglia resta a questa misura e si centra in verticale. */
export const CARDS_MAX_TILE = 260;
/** Larghezza minima di una carta (CSS .suggestions.cards, minmax(130px, 1fr)) e spazio fra le carte. */
export const CARDS_MIN_WIDTH = 130;
export const CARDS_GAP = 8;
/** Lo sprite più piccolo che si accetta sulla carta: sotto, la targhetta lo coprirebbe e non si leggerebbe bene. */
export const CARDS_MIN_SPRITE = 64;

/** Motivi sotto il nome delle carte: 2 col team aperto, 3 col team nascosto. */
export const cardsReasons = (teamCollapsed: boolean): number => (teamCollapsed ? 3 : 2);

/** Margine interno della griglia delle carte (CSS .suggestions.cards): lo spazio per la carta inclinata sotto il mouse. */
export const CARDS_PAD = 14;

/** Altezza minima di una carta: bordo e margini (11) + targhetta (CSS --plate-h: 37 + 16 per motivo) + sprite minimo.
 *  Con 2 motivi 144 px. */
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

export interface MenuLayout {
  perPage: number;
  rowHeight: number;
  /** Spazio tra le righe (CSS --menu-gap): 10, 6 nelle liste basse perché le righe non si schiaccino. */
  gap: number;
  reasons: number;
}

/** Righe del Menu per pagina: al massimo 6, come le Carte (una pagina = un team possibile); meno se non entrano alte almeno
 *  MENU_MIN_ROW px (nome e un motivo dentro la pillola, il tondo dello sprite che non tocca la riga vicina). */
export const MENU_ROWS = 6;
export const MENU_MIN_ROW = 40;
/** Spazio tra le righe del Menu (CSS --menu-gap): ci sta lo sprite che sporge dal tondo; 6 sotto MENU_TIGHT px. */
export const MENU_GAP = 10;
export const MENU_TIGHT = 450;
/** Altezza massima di una riga del Menu: oltre, la colonna resta a questa misura e si centra in verticale. */
export const MENU_MAX_ROW = 84;

// Menu: fino a 6 righe che riempiono l'altezza attuale della lista (margine 10 sopra e sotto), al massimo 84 px; nelle liste
// basse lo spazio tra le righe scende a 6 e, se 6 righe sarebbero più basse di 40 px, le righe sono meno.
// Motivi: 2 se la riga è alta almeno 56 px (sennò 1), 3 col team nascosto da 76.
export function menuLayout(height: number, teamCollapsed: boolean): MenuLayout {
  const h = num(height);
  const gap = h < MENU_TIGHT ? 6 : MENU_GAP;
  const rows = h ? clamp(Math.floor((h - 20 + gap) / (MENU_MIN_ROW + gap)), 1, MENU_ROWS) : MENU_ROWS;
  const rowHeight = clamp(Math.floor((h - 20 + gap) / rows) - gap, 0, MENU_MAX_ROW);
  const reasons = rowHeight >= 76 && teamCollapsed ? 3 : rowHeight >= 56 ? 2 : 1;
  return { perPage: rows, rowHeight, gap, reasons };
}
