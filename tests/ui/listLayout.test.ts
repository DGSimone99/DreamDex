import { describe, it, expect } from 'vitest';
import { cardsColumns, cardsLayout, cardsMinTile, menuLayout } from '../../src/ui/listLayout';

describe('cardsLayout', () => {
  it('6 per pagina (3 × 2) quando due righe entrano, carta dall’altezza della lista', () => {
    // floor((532 − 28 + 8) / 2) − 8 = 248
    expect(cardsLayout(532, false, 460)).toEqual({ columns: 3, rows: 2, perPage: 6, tileHeight: 248, reasons: 2 });
    expect(cardsLayout(400, false).perPage).toBe(6);
    expect(cardsLayout(400, false).tileHeight).toBe(182);
  });
  it('carta al massimo 260 px', () => {
    expect(cardsLayout(556, false).tileHeight).toBe(260);
    expect(cardsLayout(900, true).tileHeight).toBe(260);
  });
  it('carta minima: sprite di almeno 60 px sopra la targhetta (140 px con 2 motivi, 156 con 3)', () => {
    expect(cardsMinTile(2)).toBe(140);
    expect(cardsMinTile(3)).toBe(156);
  });
  it('lista bassa: se due righe sarebbero sotto il minimo, una riga sola (3 per pagina)', () => {
    // 2 righe: floor((329 − 20) / 2) − 8 = 146 ≥ 140
    expect(cardsLayout(329, false)).toMatchObject({ rows: 2, perPage: 6, tileHeight: 146 });
    // 2 righe: floor((300 − 20) / 2) − 8 = 132 < 140 → 1 riga alta 272, al massimo 260
    expect(cardsLayout(300, false)).toMatchObject({ rows: 1, perPage: 3, tileHeight: 260 });
    expect(cardsLayout(250, false)).toMatchObject({ rows: 1, perPage: 3, tileHeight: 222 });
    // Col team nascosto i motivi sono 3: serve una carta più alta
    expect(cardsLayout(340, true)).toMatchObject({ rows: 1, reasons: 3 });
  });
  it('colonne dalla larghezza: 3 se ci stanno da 130 px, sennò 2 (le pagine seguono)', () => {
    // 3 × 130 + 2 × 8 + 2 × 14 = 434
    expect(cardsColumns(434)).toBe(3);
    expect(cardsColumns(433)).toBe(2);
    expect(cardsColumns(0)).toBe(3);
    expect(cardsLayout(400, false, 360)).toMatchObject({ columns: 2, rows: 2, perPage: 4 });
    expect(cardsLayout(260, false, 360)).toMatchObject({ columns: 2, rows: 1, perPage: 2 });
  });
  it('motivi: 2 col team aperto, 3 col team nascosto', () => {
    expect(cardsLayout(400, false).reasons).toBe(2);
    expect(cardsLayout(400, true).reasons).toBe(3);
  });
  it('input degeneri restano finiti con perPage 6', () => {
    for (const a of [0, -50, NaN]) {
      const l = cardsLayout(a, false, a);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBe(6);
      expect(l.tileHeight).toBe(0);
    }
  });
});

describe('menuLayout', () => {
  it('6 per pagina quando entrano, la riga riempie l’altezza fino a 84', () => {
    expect(menuLayout(500, false).perPage).toBe(6);
    expect(menuLayout(500, false).rowHeight).toBe(Math.floor((500 - 20 + 10) / 6) - 10);
    expect(menuLayout(2000, false).rowHeight).toBe(84);
  });
  it('liste basse: spazio tra le righe 6 invece di 10, righe più alte', () => {
    expect(menuLayout(400, false)).toMatchObject({ gap: 6, rowHeight: Math.floor((400 - 20 + 6) / 6) - 6 });
    expect(menuLayout(500, false).gap).toBe(10);
  });
  it('righe mai sotto 40 px: nelle liste molto basse meno righe per pagina', () => {
    // 6 righe in 249 px sarebbero alte 33: ne entrano 5 da 40 (floor(235 / 46) = 5)
    expect(menuLayout(249, false)).toMatchObject({ perPage: 5, rowHeight: Math.floor((249 - 20 + 6) / 5) - 6 });
    expect(menuLayout(212, false).perPage).toBe(4);
    for (const h of [120, 212, 249, 300, 340]) expect(menuLayout(h, false).rowHeight).toBeGreaterThanOrEqual(40);
  });
  it('motivi: 1 nelle righe basse, 2 da 56 px, 3 solo col team nascosto e righe da 76', () => {
    expect(menuLayout(340, false).reasons).toBe(1);
    expect(menuLayout(500, false).reasons).toBe(2);
    expect(menuLayout(600, false).reasons).toBe(2);
    expect(menuLayout(600, true).reasons).toBe(3);
  });
  it('input degeneri restano finiti con perPage >= 1', () => {
    for (const a of [0, -50, NaN]) {
      const l = menuLayout(a, false);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBeGreaterThanOrEqual(1);
    }
  });
});
