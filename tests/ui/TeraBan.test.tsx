import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { spyClipboard } from '../helpers/clipboard';

const team = () => screen.getByRole('region', { name: 'Team' });

async function importGarchomp() {
  const user = userEvent.setup();
  render(<App data={fixtureData} initialLang="it" />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\nTera Type: Steel\n- Earthquake');
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  return user;
}

describe('Tera vietato nel formato (National Dex OU)', () => {
  it('niente lastra del Tera (la Natura prende la riga); il valore resta nel set', async () => {
    const user = await importGarchomp();
    await user.click(within(team()).getByText('Garchomp', { selector: '.name' }));
    expect(within(team()).queryByLabelText('Tera')).toBeNull();
    expect(within(team()).getByLabelText('Natura').closest('.field')).toHaveClass('full');
  });

  it('export Showdown senza Tera', async () => {
    const user = await importGarchomp();
    const copied = spyClipboard();
    await user.click(screen.getByRole('button', { name: 'Esporta' }));
    const text = copied();
    expect(text).toContain('Garchomp @ Rocky Helmet');
    expect(text).not.toContain('Tera Type');
  });
});
