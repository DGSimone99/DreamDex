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
  it('campo disattivato con la nota, valore conservato', async () => {
    const user = await importGarchomp();
    await user.click(within(team()).getByText('Garchomp', { selector: '.name' }));
    const tera = within(team()).getByLabelText('Tera');
    expect(tera).toBeDisabled();
    expect(within(team()).getByText('Tera non ammesso in National Dex OU')).toBeInTheDocument();
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
