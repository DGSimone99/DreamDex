import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';
import { spyClipboard } from '../helpers/clipboard';
import { megaData } from '../fixtures/megaData';

const team = () => screen.getByRole('region', { name: 'Team' });

describe('la megapietra rende il membro una Mega', () => {
  it('card ed editor mostrano nome e abilità della Mega; senza pietra si torna alla forma base', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const slot = () => team().querySelector('.slot.filled')!;
    expect(slot().querySelector('.name')).toHaveTextContent('Garchomp');

    await user.click(within(team()).getByText('Garchomp'));
    const item = within(team()).getByLabelText('Strumento');
    await user.clear(item);
    await user.type(item, 'Garchompite');
    await user.tab();
    expect(slot().querySelector('.name')).toHaveTextContent('Garchomp-Mega');
    expect(slot().querySelector('.ability')).toHaveTextContent('Sand Force');
    const ability = within(team()).getByLabelText('Abilità');
    expect(ability).toHaveValue('Sand Force');
    expect(ability).toBeDisabled();

    await user.clear(item);
    await user.type(item, 'Leftovers');
    await user.tab();
    expect(slot().querySelector('.name')).toHaveTextContent(/^Garchomp$/);
    expect(within(team()).getByLabelText('Abilità')).toHaveValue('Rough Skin');
  });

  it('l\'export resta Showdown: specie base con la pietra', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Garchompite\nAbility: Rough Skin\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const copied = spyClipboard();
    await user.click(screen.getByRole('button', { name: 'Esporta' }));
    expect(copied()).toMatch(/^Garchomp @ Garchompite/);
  });

  it('i testi del coaching nominano la Mega', () => {
    const megas = [{ ...emptySet('Lopunny'), item: 'Lopunnite' }, { ...emptySet('Charizard'), item: 'Charizardite Y' }];
    const problems = coachTeam(megas, DEFAULT_FORMAT, megaData).problems.map(p => p.text);
    expect(problems).toContain('Più Mega nel team (Lopunny-Mega, Charizard-Mega-Y): se ne può usare una sola');
  });
});
