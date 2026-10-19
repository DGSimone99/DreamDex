import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';
import { renderIt } from '../helpers/italian';

function Editor({ initial }: { initial: TeamSet }) {
  const [set, setSet] = useState(initial);
  return <SetEditor set={set} genLimit={9} onChange={setSet} />;
}

describe('mosse ripetute nell’editor', () => {
  it('una mossa già scelta è grigia negli altri slot e non si sceglie', async () => {
    const user = userEvent.setup();
    renderIt(<Editor initial={{ ...emptySet('Garchomp'), moves: ['Earthquake', 'Outrage', '', ''] }} />);
    const third = screen.getByLabelText('Mossa 3');
    await user.click(third);
    await user.type(third, 'Earthq');
    const list = screen.getByRole('listbox');
    const quake = within(list).getByRole('option', { name: /Earthquake/ });
    expect(quake).toHaveAttribute('aria-disabled', 'true');
    await user.click(quake);
    expect(screen.getByLabelText('Mossa 3')).not.toHaveValue('Earthquake');
    // Nel suo slot resta scelta normalmente
    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText('Mossa 1'));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: /Earthquake/ })).not.toHaveAttribute('aria-disabled');
  });
});
