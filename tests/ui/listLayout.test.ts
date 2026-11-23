import { describe, it, expect } from 'vitest';
import { cardsColumns, cardsLayout, cardsListWidth, cardsMinTile, cardsWidth } from '../../src/ui/listLayout';

// Larghezze di .picker (lista + dettaglio) alle misure di riferimento: 1440 → 1182, 1366 → 1132, 1280 → 1046,
// 1100 compatto → 866, 1920 → 1662
describe('cardsLayout (Box)', () => {
  it('colonne dalla larghezza della scheda: 3 sotto 1000, 4 fino a 1500, 5 fino a 1600, poi 6', () => {
    expect(cardsColumns(866)).toBe(3);
    expect(cardsColumns(999)).toBe(3);
    expect(cardsColumns(1000)).toBe(4);
    expect(cardsColumns(1182)).toBe(4);
    expect(cardsColumns(1499)).toBe(4);
    expect(cardsColumns(1500)).toBe(5);
    expect(cardsColumns(1599)).toBe(5);
    expect(cardsColumns(1662)).toBe(6);
    expect(cardsColumns(0)).toBe(4);
  });
  it('larghezza della carta e della lista', () => {
    expect(cardsWidth(1182)).toBe(150);
    expect(cardsWidth(1149)).toBe(140);
    expect(cardsWidth(1132)).toBe(140);
    // 4 × 150 + 3 × 8 + 2 × 14 + 2
    expect(cardsListWidth(1182)).toBe(654);
    expect(cardsListWidth(1046)).toBe(4 * 140 + 3 * 8 + 28 + 2);
    expect(cardsListWidth(1662)).toBe(6 * 150 + 5 * 8 + 28 + 2);
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
    // 1280×620 col team aperto: 2 file da 3 carte basse senza motivi (la lista larga 3 colonne)
    expect(cardsLayout(278, false, 1046)).toMatchObject({ columns: 3, rows: 2, perPage: 6, reasons: 0, tileHeight: 121, listWidth: 3 * 140 + 2 * 8 + 28 + 2 });
    // 1366×657: 2 file da 139
    expect(cardsLayout(315, false, 1132)).toMatchObject({ columns: 3, rows: 2, reasons: 0, tileHeight: 139 });
    // Troppo basso anche per 2 carte basse: una fila coi motivi
    expect(cardsLayout(260, false, 1046)).toMatchObject({ rows: 1, perPage: 3, reasons: 2 });
    // 1280×620 col team nascosto: 3 colonne come col team aperto, il dettaglio resta largo (1046 − 466 − 16 = 564)
    expect(cardsLayout(404, true, 1046)).toMatchObject({ columns: 3, rows: 2, perPage: 6, tileHeight: 184, listWidth: 466 });
  });
  it('il dettaglio mai sotto 500 px: una colonna in meno', () => {
    // 1280×800: 4 colonne lascerebbero 416 px
    expect(cardsLayout(594, true, 1046).columns).toBe(3);
    // 1366 e 1440 restano a 4 (502 e 512 px)
    expect(cardsLayout(475, true, 1132).columns).toBe(4);
    expect(cardsLayout(694, true, 1182).columns).toBe(4);
  });
  it('mai più di 4 file, mai carte oltre 232 px; la quarta solo con carte da 196 px', () => {
    expect(cardsLayout(2000, true, 1182)).toMatchObject({ rows: 4, tileHeight: 232 });
    // 1920×1080 col team nascosto: 4 file da 205
    expect(cardsLayout(874, true, 1662)).toMatchObject({ rows: 4, perPage: 24, tileHeight: 205 });
    // 4 × 196 + 3 × 8 + 28 = 836: sotto restano 3 file
    expect(cardsLayout(835, true, 1662)).toMatchObject({ rows: 3 });
    expect(cardsLayout(836, true, 1662)).toMatchObject({ rows: 4, tileHeight: 196 });
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
