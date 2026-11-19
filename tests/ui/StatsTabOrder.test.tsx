import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';
import { renderIt } from '../helpers/italian';

const chomp: TeamSet = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } };
const ev = (stat: string) => screen.getByLabelText(stat, { selector: 'input.ev-input' });

describe('statistiche da tastiera', () => {
  it('il Tab passa da un EV all\'altro: gli IV a 31 sono fuori dal giro', async () => {
    const user = userEvent.setup();
    renderIt(<SetEditor set={chomp} genLimit={9} onChange={() => undefined} />);
    ev('PS').focus();
    await user.tab();
    expect(document.activeElement).toBe(ev('ATT'));
    expect(screen.getByLabelText('IV PS')).toHaveAttribute('tabindex', '-1');
  });

  it('un IV diverso da 31 resta nel giro del Tab', async () => {
    const user = userEvent.setup();
    renderIt(<SetEditor set={{ ...chomp, ivs: { atk: 0 } }} genLimit={9} onChange={() => undefined} />);
    ev('ATT').focus();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('IV ATT'));
  });

  it('freccia destra dall\'EV va all\'IV della riga, freccia sinistra torna indietro', async () => {
    const user = userEvent.setup();
    renderIt(<SetEditor set={chomp} genLimit={9} onChange={() => undefined} />);
    ev('VEL').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByLabelText('IV VEL'));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(ev('VEL'));
  });
});
