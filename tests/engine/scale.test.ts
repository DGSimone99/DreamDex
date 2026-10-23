import { describe, expect, it } from 'vitest';
import { SCALE_KNEE, softScore } from '../../src/engine/scale';

describe('softScore: scala lineare fino al ginocchio, poi sempre più piano verso 100 senza toccarlo', () => {
  it('lineare fino a 80', () => {
    expect(SCALE_KNEE).toBe(0.8);
    expect(softScore(0)).toBe(0);
    expect(softScore(0.5)).toBe(50);
    expect(softScore(0.8)).toBe(80);
  });

  it('oltre il ginocchio rallenta: il riferimento vale circa 93', () => {
    expect(softScore(0.9)).toBe(88);
    expect(softScore(1)).toBe(93);
    expect(softScore(1.2)).toBe(97);
  });

  it('il 100 non si raggiunge mai', () => {
    for (const x of [1.5, 2, 5, 100]) expect(softScore(x)).toBeLessThan(100);
  });
});
