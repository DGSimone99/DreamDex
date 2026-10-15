import { describe, expect, it } from 'vitest';
import { SLANT, slantOffset } from '../../src/ui/slant';

describe('righe della card lungo la diagonale', () => {
  it('pendenza di 8°, come la card', () => {
    expect(SLANT).toBeCloseTo(Math.tan((8 * Math.PI) / 180));
  });

  it('a metà altezza il bordo è al margine sinistro: si sposta solo della distanza voluta', () => {
    // card alta 200, riga centrata a 100, larga 20, già a 14px: resta a 14
    expect(slantOffset({ cardHeight: 200, top: 90, height: 20, left: 14 }, 14)).toBeCloseTo(0);
  });

  it('più in alto verso destra, più in basso verso sinistra, in proporzione', () => {
    const at = (top: number) => slantOffset({ cardHeight: 200, top, height: 20, left: 14 }, 14);
    expect(at(0)).toBeCloseTo(90 * SLANT);
    expect(at(180)).toBeCloseTo(-90 * SLANT);
    expect(at(40) - at(140)).toBeCloseTo(100 * SLANT);
  });
});
