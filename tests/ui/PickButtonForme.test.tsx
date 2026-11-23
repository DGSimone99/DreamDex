import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PickButton } from '../../src/ui/candidateParts';
import { renderIt } from '../helpers/italian';

const pick = (species: string) => {
  renderIt(<PickButton rank={1} species={species} selected={false} onSelect={() => {}} />);
  return screen.getByRole('button');
};

describe('nome sulle carte: la forma accanto al nome', () => {
  it('una forma qualunque: il nome base e la forma accanto, il nome intero nel fumetto e per i lettori di schermo', () => {
    const button = pick('Landorus-Therian');
    expect(button).toHaveAccessibleName(/^1\.\s*Landorus-Therian$/);
    expect(button).toHaveAttribute('data-hint', 'Landorus-Therian');
    expect(button.querySelector('.pick-name b')?.textContent).toBe('Landorus');
    expect(button.querySelector('.pick-forme')?.textContent).toBe('Therian');
    expect(button.querySelector('.mega-mark')).toBeNull();
  });

  it('due carte con lo stesso nome base si distinguono a vista (Zapdos e Zapdos di Galar)', () => {
    expect(pick('Zapdos-Galar').querySelector('.pick-forme')?.textContent).toBe('Galar');
  });

  it('forma di più parole: senza trattini', () => {
    expect(pick('Urshifu-Rapid-Strike').querySelector('.pick-forme')?.textContent).toBe('Rapid Strike');
  });

  it('Mega: il nome base e il simbolo della Mega', () => {
    const button = pick('Latios-Mega');
    expect(button.querySelector('.pick-name b')?.textContent).toBe('Latios');
    expect(button.querySelector('.mega-mark')).not.toBeNull();
    expect(button.querySelector('.mega-mark')?.textContent).toBe('');
    expect(button.querySelector('.pick-forme')).toBeNull();
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

describe('nome di chi esce nelle frasi (Metti al posto di X, Esce X)', () => {
  it('come sulla carta del team: la Mega con la pietra resta il nome base; il soprannome vince; le altre forme intere', async () => {
    const { memberLabel } = await import('../../src/ui/candidateParts');
    const base = { ability: '', moves: [], nature: 'Hardy', evs: {} };
    expect(memberLabel({ ...base, species: 'Garchomp', item: 'Garchompite' } as never)).toBe('Garchomp');
    expect(memberLabel({ ...base, species: 'Garchomp', item: 'Garchompite', name: 'Squalo' } as never)).toBe('Squalo');
    expect(memberLabel({ ...base, species: 'Landorus-Therian', item: '' } as never)).toBe('Landorus-Therian');
  });
});
