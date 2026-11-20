import { describe, expect, it } from 'vitest';
import { handOffOpponent, takeOpponent } from '../../src/ui/duelHandoff';

describe('Sfida: lascialo a un compagno', () => {
  it("l'avversario passa solo al membro giusto, una volta sola", () => {
    handOffOpponent('Great Tusk', 'Raging Bolt');
    expect(takeOpponent('Kingambit')).toBeNull();
    expect(takeOpponent('Great Tusk')).toBe('Raging Bolt');
    expect(takeOpponent('Great Tusk')).toBeNull();
  });
});
