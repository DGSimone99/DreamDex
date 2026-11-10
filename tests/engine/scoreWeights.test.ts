import { describe, expect, it } from 'vitest';
import { SCORE_WEIGHTS } from '../../src/engine/weights';

describe('pesi del punteggio dei candidati', () => {
  it('sommano a 1 e la forza del membro pesa di più', () => {
    const values = Object.values(SCORE_WEIGHTS);
    expect(values.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(SCORE_WEIGHTS.power).toBe(Math.max(...values));
  });
});
