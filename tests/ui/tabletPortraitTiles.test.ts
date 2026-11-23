import { describe, expect, it } from 'vitest';
import { tabletPortraitTiles } from '../../src/ui/usePerPage';

describe('tablet in verticale: la pagina sono le file che si vedono', () => {
  it('due file quando le carte restano almeno 150 px (820×1180, team aperto)', () => {
    expect(tabletPortraitTiles(350)).toEqual({ rows: 2, tileHeight: 157 });
  });
  it('mai più alte di 232', () => {
    expect(tabletPortraitTiles(900)).toEqual({ rows: 2, tileHeight: 232 });
  });
  it('poco spazio: una fila sola', () => {
    expect(tabletPortraitTiles(200)).toEqual({ rows: 1, tileHeight: 172 });
  });
  it('senza misura: niente', () => {
    expect(tabletPortraitTiles(0)).toBeNull();
    expect(tabletPortraitTiles(Number.NaN)).toBeNull();
  });
});
