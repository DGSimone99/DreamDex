import { describe, expect, it } from 'vitest';
import { SLANT, slantOffset, slantShift } from '../../src/ui/slant';

describe('righe della card lungo la diagonale', () => {
  it('pendenza di 8°, come la card', () => {
    expect(SLANT).toBeCloseTo(Math.tan((8 * Math.PI) / 180));
  });

  it('in fondo alla card il bordo è al margine sinistro: si sposta solo della distanza voluta', () => {
    // card alta 200 inclinata attorno al lato in basso: una riga centrata sul fondo, già a 14px, resta a 14
    expect(slantOffset({ cardHeight: 200, top: 190, height: 20, left: 14 }, 14)).toBeCloseTo(0);
  });

  it('più in alto più a destra, in proporzione', () => {
    const at = (top: number) => slantOffset({ cardHeight: 200, top, height: 20, left: 14 }, 14);
    expect(at(-10)).toBeCloseTo(200 * SLANT);
    expect(at(40) - at(140)).toBeCloseTo(100 * SLANT);
  });

  it('sprite, stella e ×: seguono il bordo restando dove sono rispetto alla card (sprite centrato)', () => {
    expect(slantShift({ cardHeight: 200, top: 190, height: 20 })).toBeCloseTo(0);
    expect(slantShift({ cardHeight: 200, top: 40, height: 20 })).toBeCloseTo(150 * SLANT);
  });
});
