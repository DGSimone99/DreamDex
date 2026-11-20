import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { importShowdown } from '../../src/engine/sets';
import { GradeBadge } from '../../src/ui/RatingPanel';
import { setEditing } from '../../src/ui/editing';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const A = 'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Body Press\n- Iron Defense\n- Roost\n- Defog';
const B = 'Zapdos @ Heavy-Duty Boots\nAbility: Static\nEVs: 248 HP / 8 SpA / 252 Spe\nTimid Nature\n- Thunderbolt\n- Hurricane\n- Taunt\n- Roost';
const small = rateTeam(importShowdown(A).sets, fixtureData)!;
const big = rateTeam(importShowdown(`${A}\n\n${B}`).sets, fixtureData)!;
const chip = () => document.querySelector('.grade-delta');

afterEach(() => { act(() => setEditing(null)); vi.useRealTimers(); });

describe('voto: il cambio alla chiusura dell\'editor', () => {
  it('mentre modifichi il cambio è a vista anche col team ridotto, attaccato al punteggio', () => {
    act(() => setEditing(0));
    const { rerender } = renderIt(<GradeBadge rating={small} collapsed />);
    expect(chip()).toBeNull();
    rerender(<GradeBadge rating={big} collapsed />);
    const delta = big.overall - small.overall;
    expect(delta).not.toBe(0);
    expect(document.querySelector('.grade-pop-toggle .grade-delta.in-strip')).toHaveTextContent(`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`);
  });

  it('chiudendo l\'editor il cambio resta un attimo, lo dice ai lettori di schermo, poi sparisce', () => {
    vi.useFakeTimers();
    act(() => setEditing(0));
    const { rerender } = renderIt(<GradeBadge rating={small} />);
    rerender(<GradeBadge rating={big} />);
    act(() => setEditing(null));
    expect(chip()).toHaveClass('flash');
    expect(document.querySelector('.grade-change-sr')).toHaveTextContent(`Voto passato da ${small.overall} a ${big.overall}`);
    act(() => { vi.advanceTimersByTime(2700); });
    expect(chip()).toBeNull();
    expect(document.querySelector('.grade-change-sr')).toHaveTextContent('');
  });

  it('senza cambi alla chiusura non compare niente', () => {
    act(() => setEditing(0));
    renderIt(<GradeBadge rating={small} />);
    act(() => setEditing(null));
    expect(chip()).toBeNull();
  });
});
