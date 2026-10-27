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
  it('perPage dal team aperto', () => {
    expect(menuLayout(500, 500, 900).perPage).toBe(9);
  });
  it('team chiuso: perPage invariato, riga <= 76, 3 motivi', () => {
    const l = menuLayout(500, 700, 900);
    expect(l.perPage).toBe(9);
    expect(l.rowHeight).toBeLessThanOrEqual(76);
    expect(l.reasons).toBe(3);
  });
  it('windowHeight 768 usa riga minima 42', () => {
    expect(menuLayout(500, 500, 768).perPage).toBe(Math.floor((500 - 20 + 6) / 48));
  });
  it('input degeneri restano finiti con perPage >= 1', () => {
    for (const a of [0, -50, NaN]) {
      const l = menuLayout(a, a, a);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBeGreaterThanOrEqual(1);
    }
  });
});
