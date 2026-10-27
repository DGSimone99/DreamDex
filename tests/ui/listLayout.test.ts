import { describe, it, expect } from 'vitest';
import { cardsLayout, menuLayout } from '../../src/ui/listLayout';

describe('cardsLayout', () => {
  it('numeri del riepilogo (team aperto)', () => {
    expect(cardsLayout(460, 532, 532)).toEqual({ columns: 3, rows: 4, perPage: 12, tileHeight: 122, reasons: 1 });
  });
  it('team chiuso: stessa pagina, tessere piu alte', () => {
    const l = cardsLayout(460, 532, 712);
    expect(l.perPage).toBe(12);
    expect(l.tileHeight).toBe(167);
    expect(l.reasons).toBe(3);
  });
  it('colonne minime 2', () => {
    expect(cardsLayout(200, 532, 532).columns).toBe(2);
  });
  it('openHeight < 460 usa tessera minima 104', () => {
    // 380: con 104 entrano 3 righe (368/112), con 120 solo 2 (368/128)
    expect(cardsLayout(460, 380, 380).rows).toBe(3);
  });
  it('confine 460: sotto tessera minima 104, da 460 tessera minima 120', () => {
    // 395 (il valore più alto sotto 460 dove le due minime danno righe diverse): con 104 3 righe (383/112), con 120 solo 2 (383/128)
    expect(cardsLayout(460, 395, 395).rows).toBe(3);
    // 460: con 104 sarebbero 4 righe (448/112), con 120 sono 3
    expect(cardsLayout(460, 460, 460).rows).toBe(3);
  });
  it('input degeneri restano finiti con perPage >= 1', () => {
    for (const a of [0, -50, NaN]) {
      const l = cardsLayout(a, a, a);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBeGreaterThanOrEqual(1);
      expect(l.reasons).toBeGreaterThanOrEqual(1);
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
