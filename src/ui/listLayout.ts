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

// Carte: griglia; righe dal contenitore a team aperto, altezza tessera da quello attuale.
export function cardsLayout(width: number, openHeight: number, height: number): CardsLayout {
  const w = num(width);
  const open = num(openHeight);
  const h = num(height);
  const columns = Math.max(2, Math.floor((w - 20 + 8) / 146));
  const minTile = open < 460 ? 104 : 120;
  const rows = Math.max(1, Math.floor((open - 20 + 8) / (minTile + 8)));
  const tileHeight = Math.max(0, Math.floor((h - 20 + 8) / rows) - 8);
  const reasons = clamp(Math.floor((tileHeight - 93) / 16), 1, 4);
  return { columns, rows, perPage: columns * rows, tileHeight, reasons };
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
