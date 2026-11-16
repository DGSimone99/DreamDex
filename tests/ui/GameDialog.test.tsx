import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { initGames } from '../../src/engine/games';
import { fixtureData } from '../fixtures/data';

afterEach(() => initGames(null));
const gameCard = () => screen.getByRole('button', { name: /^Gioco / });

describe('modale del gioco', () => {
  it('la carta Gioco apre il modale con i giochi come loghi; scelto il gioco compaiono le sue opzioni', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(gameCard());
    const dialog = screen.getByRole('dialog', { name: 'Scegli il gioco' });
    expect(within(dialog).getByRole('img', { name: 'Pokémon Scarlatto' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Pokémon Violetto' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Tutto il Pokédex' })).toBeNull();
    await user.click(within(dialog).getByRole('radio', { name: /Scarlatto e Violetto/ }));
    expect(within(dialog).getByRole('checkbox', { name: 'Tutto il Pokédex' })).toBeInTheDocument();
    expect(document.documentElement.dataset.palette).toBe('sv');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(gameCard()).toHaveTextContent('Scarlatto e Violetto');
  });

  it('senza i file dei loghi la tessera mostra il nome scritto', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await user.click(gameCard());
    const dialog = screen.getByRole('dialog');
    for (const img of within(dialog).getAllByRole('img')) fireEvent.error(img);
    expect(within(dialog).queryByRole('img', { name: 'Pokémon Scarlatto' })).toBeNull();
    expect(within(dialog).getByText('Scarlatto', { exact: true })).toBeInTheDocument();
    expect(within(dialog).getByText('Violetto', { exact: true })).toBeInTheDocument();
  });
});
