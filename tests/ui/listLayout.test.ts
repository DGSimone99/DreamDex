import { describe, it, expect } from 'vitest';
import { cardsColumns, cardsLayout, cardsListWidth, cardsMinTile, cardsWidth } from '../../src/ui/listLayout';

// Larghezze di .picker (lista + dettaglio) alle misure di riferimento: 1440 → 1182, 1366 → 1132, 1280 → 1046,
// 1100 compatto → 866, 1920 → 1662
describe('cardsLayout (Box)', () => {
  it('colonne dalla larghezza della scheda: 3 sotto 1000, 5 da 1500, sennò 4', () => {
    expect(cardsColumns(866)).toBe(3);
    expect(cardsColumns(999)).toBe(3);
    expect(cardsColumns(1000)).toBe(4);
    expect(cardsColumns(1182)).toBe(4);
    expect(cardsColumns(1499)).toBe(4);
    expect(cardsColumns(1500)).toBe(5);
    expect(cardsColumns(0)).toBe(4);
  });
  it('larghezza della carta e della lista', () => {
    expect(cardsWidth(1182)).toBe(150);
    expect(cardsWidth(1149)).toBe(140);
    expect(cardsWidth(1132)).toBe(140);
    // 4 × 150 + 3 × 8 + 2 × 14 + 2
    expect(cardsListWidth(1182)).toBe(654);
    expect(cardsListWidth(1046)).toBe(4 * 140 + 3 * 8 + 28 + 2);
    expect(cardsListWidth(1662)).toBe(5 * 150 + 4 * 8 + 28 + 2);
  });
  it('carta minima: 166 px con 2 motivi, 182 con 3', () => {
    expect(cardsMinTile(2)).toBe(166);
    expect(cardsMinTile(3)).toBe(182);
  });
  it('le misure di riferimento: 8/12, 8/8, 4/8 carte', () => {
    expect(cardsLayout(456, false, 1182)).toMatchObject({ columns: 4, rows: 2, perPage: 8, tileHeight: 210, listWidth: 654 });
    expect(cardsLayout(656, true, 1182)).toMatchObject({ rows: 3, perPage: 12, tileHeight: 204 });
    expect(cardsLayout(408, false, 1132)).toMatchObject({ rows: 2, perPage: 8, tileHeight: 186 });
    expect(cardsLayout(552, true, 1132)).toMatchObject({ rows: 2, perPage: 8, tileHeight: 232 });
    expect(cardsLayout(260, false, 1046)).toMatchObject({ rows: 1, perPage: 4 });
    expect(cardsLayout(404, true, 1046)).toMatchObject({ rows: 2, perPage: 8, tileHeight: 184 });
  });
  it('mai più di 3 file, mai carte oltre 232 px', () => {
    expect(cardsLayout(2000, true, 1182)).toMatchObject({ rows: 3, tileHeight: 232 });
  });
  it('motivi: 2 col team aperto, 3 col team nascosto', () => {
    expect(cardsLayout(400, false).reasons).toBe(2);
    expect(cardsLayout(400, true).reasons).toBe(3);
  });
  it('input degeneri restano finiti con 8 per pagina', () => {
    for (const a of [0, -50, NaN]) {
      const l = cardsLayout(a, false, a);
      expect(Object.values(l).every(Number.isFinite)).toBe(true);
      expect(l.perPage).toBe(8);
      expect(l.tileHeight).toBe(0);
    }
  });
});
