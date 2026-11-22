import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PickButton } from '../../src/ui/candidateParts';
import { renderIt } from '../helpers/italian';

const pick = (species: string) => {
  renderIt(<PickButton rank={1} species={species} selected={false} onSelect={() => {}} />);
  return screen.getByRole('button');
};

describe('nome sulle carte: forme solo nel dettaglio', () => {
  it('una forma qualunque: a vista solo il nome base, il nome intero nel fumetto e per i lettori di schermo', () => {
    const button = pick('Landorus-Therian');
    expect(button).toHaveAccessibleName(/^1\.\s*Landorus-Therian$/);
    expect(button).toHaveAttribute('title', 'Landorus-Therian');
    expect(button.querySelector('.forme')).toBeNull();
    expect(button.querySelector('.pick-name')?.textContent).toBe('Landorus');
    expect(button.querySelector('.mega-mark')).toBeNull();
  });

  it('Mega: il nome base e il simbolo della Mega', () => {
    const button = pick('Latios-Mega');
    expect(button.querySelector('.pick-name b')?.textContent).toBe('Latios');
    expect(button.querySelector('.mega-mark')).not.toBeNull();
    expect(button.querySelector('.mega-mark')?.textContent).toBe('');
  });

  it('Mega X / Y: il simbolo con la lettera', () => {
    expect(pick('Charizard-Mega-X').querySelector('.mega-mark')?.textContent).toBe('X');
  });

  it('Primal: anche lui col simbolo', () => {
    expect(pick('Kyogre-Primal').querySelector('.mega-mark')).not.toBeNull();
  });

  it('senza forma: il nome com’è', () => {
    const button = pick('Victini');
    expect(button.querySelector('.pick-name')).toBeNull();
    expect(button).toHaveAccessibleName(/^1\.\s*Victini$/);
  });
});
