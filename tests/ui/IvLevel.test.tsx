import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { SetEditor } from '../../src/ui/SetEditor';
import { renderIt } from '../helpers/italian';

let latest: TeamSet | null = null;
function Editor({ initial }: { initial: TeamSet }) {
  const [set, setSet] = useState(initial);
  latest = set;
  return <SetEditor set={set} genLimit={9} onChange={setSet} />;
}
const chomp: TeamSet = { ...emptySet('Garchomp'), nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 } };
const finalOf = (stat: string) => within(screen.getByRole('group', { name: 'Statistiche' })).getByTestId(`final-${stat}`).textContent;

describe('IV e livello nel blocco statistiche', () => {
  it('l’IV cambia il valore finale e resta nel set', async () => {
    const user = userEvent.setup();
    renderIt(<Editor initial={chomp} />);
    expect(finalOf('spe')).toBe('333');
    const iv = screen.getByLabelText('IV VEL');
    expect(iv).toHaveValue(31);
    await user.clear(iv);
    await user.type(iv, '0');
    expect(finalOf('spe')).toBe('299');
    expect(latest?.ivs).toEqual({ spe: 0 });
    // Tornando a 31 l'IV sparisce dal set
    await user.clear(iv);
    await user.type(iv, '31');
    expect(latest?.ivs).toBeUndefined();
  });

  it('Lv. 50 mostra i valori del livello 50; il set non cambia', async () => {
    const user = userEvent.setup();
    renderIt(<Editor initial={chomp} />);
    await user.click(screen.getByRole('button', { name: 'Lv. 50' }));
    expect(screen.getByRole('button', { name: 'Lv. 50' })).toHaveAttribute('aria-pressed', 'true');
    expect(finalOf('spe')).toBe('169');
    expect(finalOf('hp')).toBe('184');
    expect(latest).toEqual(chomp);
    await user.click(screen.getByRole('button', { name: 'Lv. 100' }));
    expect(finalOf('spe')).toBe('333');
  });
});
