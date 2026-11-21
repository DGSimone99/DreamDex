import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { confirmFormat, openFormat } from '../helpers/format';

describe('interruttore "Più Mega ammesse"', () => {
  const WARNING = 'Seconda Mega: in National Dex se ne può usare una sola, il voto la conta senza pietra';

  it('si attiva e si disattiva dalla finestra del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Lopunny-Mega', 'Charizard-Mega-Y']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const toggle = () => screen.getByRole('checkbox', { name: 'Più Mega ammesse' });
    await openFormat(user);
    expect(toggle()).not.toBeChecked();
    await user.click(toggle());
    await confirmFormat(user);
    expect(screen.queryByText(WARNING)).toBeNull();
    await openFormat(user);
    await user.click(toggle());
    await confirmFormat(user);
    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('"Lo so, tengo un\'altra Mega" spunta l\'interruttore', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Lopunny-Mega', 'Charizard-Mega-Y']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('button', { name: "Lo so, tengo un'altra Mega" }));
    await openFormat(user);
    expect(screen.getByRole('checkbox', { name: 'Più Mega ammesse' })).toBeChecked();
  });
});

describe('tipo di team', () => {
  it('senza team completo non compare', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    expect(within(screen.getByRole('region', { name: 'Analisi' })).queryByText('Tipo di team')).toBeNull();
  });
});
