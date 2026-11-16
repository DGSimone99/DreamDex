import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { initGames, withGame } from '../../src/engine/games';
import { chooseTier, chosen } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

/** Apre il modale del gioco dalla carta, sceglie e lo chiude (Esc). */
async function chooseGame(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(screen.getByRole('button', { name: /^Gioco / }));
  await user.click(document.querySelector<HTMLInputElement>(`input[name="game"][value="${id}"]`)!);
  await user.keyboard('{Escape}');
}
/** Apre il modale del gioco e lascia aperto (per gli interruttori). */
const openGame = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /^Gioco / }));
const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k), clear: () => map.clear(), key: () => null, get length() { return map.size; } };
};

afterEach(() => initGames(null));

describe('scelta del gioco', () => {
  it('Scarlatto e Violetto blocca il formato, cambia i colori e mostra le opzioni del gioco', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await chooseGame(user, 'sv');
    expect(document.documentElement.dataset.palette).toBe('sv');
    expect(screen.getByText('Lo decide il gioco')).toBeInTheDocument();
    expect(document.querySelector('input[name="format-tier"]')).toBeNull();
    await openGame(user);
    const all = screen.getByRole('checkbox', { name: 'Tutto il Pokédex' });
    expect(all).not.toBeChecked();
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'Tutto il Pokédex' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Leggendari e post-game' })).not.toBeChecked();
  });

  it('"Nessun gioco" rimette il formato di prima, col meta', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await chooseTier(user, 'ubers');
    await chooseGame(user, 'sv');
    await chooseGame(user, 'none');
    expect(chosen('format-tier')).toBe('ubers');
    expect(document.querySelector('.format-card:not(.game-card) .format-pills')).toHaveTextContent('Meta');
    expect(screen.queryByText('Lo decide il gioco')).toBeNull();
  });

  it('senza i dati del gioco la voce è spenta e una sessione col gioco riparte senza', async () => {
    const storage = memoryStorage();
    storage.setItem('dreamdex.session', JSON.stringify({ team: [], format: withGame(DEFAULT_FORMAT, 'sv') }));
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} storage={storage} />);
    await openGame(userEvent.setup());
    expect(document.querySelector<HTMLInputElement>('input[name="game"][value="sv"]')).toBeDisabled();
    expect(document.querySelector<HTMLInputElement>('input[name="game"][value="none"]')).toBeChecked();
    expect(screen.queryByText('Lo decide il gioco')).toBeNull();
  });

  it('un team salvato col gioco mostra il nome del gioco', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await chooseGame(user, 'sv');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Storia{Enter}');
    expect(document.querySelector('.saved-format')).toHaveTextContent('Scarlatto e Violetto');
  });

  it('caricare un team salvato col gioco rimette il gioco col suo blocco; "Nessun gioco" torna al formato di prima', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} storage={window.localStorage} />);
    await chooseGame(user, 'sv');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Storia{Enter}');
    await chooseGame(user, 'none');
    await chooseTier(user, 'ubers');
    await user.click(screen.getByRole('button', { name: 'Storia' }));
    const pills = () => [...document.querySelectorAll('.format-card.locked .format-pills > span')].map(el => el.textContent);
    expect(screen.getByText('Lo decide il gioco')).toBeInTheDocument();
    expect(pills()).toContain('Senza meta');
    expect(pills()).not.toContain('Meta');
    await chooseGame(user, 'none');
    expect(chosen('format-tier')).toBe('ubers');
  });

  it('a team vuoto nel gioco niente uso nel meta sulle schede né nel dettaglio', async () => {
    initGames({ sv: { dex: ['greattusk', 'gholdengo'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    // Senza gioco a team vuoto le schede mostrano l'uso nel meta
    expect(await screen.findAllByText(/%/)).not.toHaveLength(0);
    await chooseGame(user, 'sv');
    // Al posto dell'uso, il voto che il Pokémon mette da solo: "+N" sulla scheda e nel dettaglio
    await waitFor(() => expect(document.querySelector('.card .result strong')?.textContent).toMatch(/^\+\d+$/));
    const first = document.querySelector('.card .result strong')!.textContent;
    expect(document.querySelector('.detail-score strong')?.textContent).toBe(first);
    expect(document.querySelector('.card .result')?.textContent).not.toMatch(/%/);
    expect(screen.queryByText(/uso nel meta/i)).toBeNull();
  });
});
