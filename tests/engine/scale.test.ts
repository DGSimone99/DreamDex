import { describe, expect, it } from 'vitest';
import { softScore } from '../../src/engine/scale';

describe('softScore: scala lineare, il riferimento vale 100', () => {
  it('lineare da 0 al riferimento', () => {
    expect(softScore(0)).toBe(0);
    expect(softScore(0.5)).toBe(50);
    expect(softScore(0.8)).toBe(80);
    expect(softScore(1)).toBe(100);
  });

  it('oltre il riferimento resta 100, sotto zero resta 0', () => {
    for (const x of [1.2, 2, 100]) expect(softScore(x)).toBe(100);
    expect(softScore(-1)).toBe(0);
  });
});
