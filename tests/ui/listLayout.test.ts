import { describe, it, expect } from 'vitest';
import { cardsLayout, menuLayout } from '../../src/ui/listLayout';

describe('cardsLayout', () => {
  it('sempre 6 per pagina (3 × 2), carta dall’altezza della lista', () => {
    // floor((532 − 28 + 8) / 2) − 8 = 248
    expect(cardsLayout(532, false)).toEqual({ columns: 3, rows: 2, perPage: 6, tileHeight: 248, reasons: 2 });
    expect(cardsLayout(400, false).perPage).toBe(6);
    expect(cardsLayout(400, false).tileHeight).toBe(182);
  });
  it('carta al massimo 260 px', () => {
    expect(cardsLayout(556, false).tileHeight).toBe(260);
    expect(cardsLayout(900, true).tileHeight).toBe(260);
  });
  it('motivi: 2 col team aperto, 3 col team nascosto', () => {
    expect(cardsLayout(400, false).reasons).toBe(2);
    expect(cardsLayout(400, true).reasons).toBe(3);
  });
  it('input degeneri restano finiti con perPage 6', () => {
    for (const a of [0, -50, NaN]) {
      const l = cardsLayout(a, false);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBe(6);
      expect(l.tileHeight).toBe(0);
    }
  });
});

describe('menuLayout', () => {
  it('sempre 6 per pagina, la riga riempie l’altezza fino a 84', () => {
    expect(menuLayout(500, false).perPage).toBe(6);
    expect(menuLayout(500, false).rowHeight).toBe(Math.floor((500 - 20 + 10) / 6) - 10);
    expect(menuLayout(2000, false).rowHeight).toBe(84);
  });
  it('liste basse: spazio tra le righe 6 invece di 10, righe più alte', () => {
    expect(menuLayout(400, false)).toMatchObject({ gap: 6, rowHeight: Math.floor((400 - 20 + 6) / 6) - 6 });
    expect(menuLayout(500, false).gap).toBe(10);
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
