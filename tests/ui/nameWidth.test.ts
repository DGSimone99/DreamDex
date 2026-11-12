import { describe, expect, it } from 'vitest';
import { estimateEm, measureEm } from '../../src/ui/nameWidth';

describe('larghezza dei nomi sulle carte', () => {
  it('senza canvas (jsdom) non misura e usa la stima di prima: lettere della parte più lunga × 0.7', () => {
    expect(measureEm('Corviknight')).toBeNull();
    expect(estimateEm('Corviknight')).toBeCloseTo(11 * 0.7);
    // Va a capo agli spazi e dopo i trattini: conta la parte più lunga
    expect(estimateEm('Ogerpon-Wellspring')).toBeCloseTo(10 * 0.7);
    expect(estimateEm('Great Tusk')).toBeCloseTo(5 * 0.7);
  });
});
