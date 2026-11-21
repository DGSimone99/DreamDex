import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { initGames } from '../../src/engine/games';
import { chooseGame, chooseTier, chosen, openFormat } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

/** Sceglie un gioco nella finestra del formato e la chiude (Esc). */
async function pickGame(user: ReturnType<typeof userEvent.setup>, id: string) {
  await chooseGame(user, id);
  await user.keyboard('{Escape}');
}
/** Torna a Competitivo (all'ultima scelta di quella famiglia) e chiude. */
async function backToCompetitive(user: ReturnType<typeof userEvent.setup>) {
  await openFormat(user);
  await user.click(document.querySelector<HTMLInputElement>('input[name="format-family"][value="competitive"]')!);
  await user.keyboard('{Escape}');
}
const formatButton = () => screen.getByRole('button', { name: /^Formato / });
const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k), clear: () => map.clear(), key: () => null, get length() { return map.size; } };
};

afterEach(() => initGames(null));

describe('scelta del gioco', () => {
  it('Scarlatto e Violetto impone le sue regole, cambia i colori e mostra le opzioni del gioco', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await pickGame(user, 'sv');
    expect(document.documentElement.dataset.palette).toBe('sv');
    expect(formatButton()).toHaveAccessibleName('Formato Scarlatto e Violetto, Gen 9: cambia');
    expect(screen.getByRole('button', { name: 'Giochi' })).toHaveAttribute('aria-current', 'true');
    await openFormat(user);
    expect(document.querySelector('input[name="format-tier"]')).toBeNull();
    const all = screen.getByRole('checkbox', { name: 'Tutto il Pokédex' });
    expect(all).not.toBeChecked();
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: 'Tutto il Pokédex' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Leggendari e post-game' })).not.toBeChecked();
  });

  it('la barra non mostra Confronto', () => {
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.queryByRole('tab', { name: /Confronto/ })).toBeNull();
  });

  it('tornando a Competitivo si ritrova il formato di prima, col meta', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await chooseTier(user, 'ubers');
    await user.keyboard('{Escape}');
    await pickGame(user, 'sv');
    await backToCompetitive(user);
    expect(formatButton()).toHaveAccessibleName(/^Formato National Dex Ubers/);
    expect(screen.getByRole('tab', { name: /Meta/ })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('senza i dati del gioco la linguetta Giochi è spenta e una sessione col gioco riparte dal formato di base', async () => {
    const storage = memoryStorage();
    storage.setItem('dreamdex.session', JSON.stringify({ team: [], choice: { family: 'game', game: 'sv', allPokedex: false, legendaries: false } }));
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} storage={storage} />);
    expect(formatButton()).toHaveAccessibleName(/^Formato National Dex OU/);
    await openFormat(userEvent.setup());
    expect(document.querySelector<HTMLInputElement>('input[name="format-family"][value="game"]')).toBeDisabled();
  });

  it('un team salvato col gioco mostra il nome del gioco', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await pickGame(user, 'sv');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Storia{Enter}');
    expect(document.querySelector('.saved-format')).toHaveTextContent('Scarlatto e Violetto');
  });

  it('caricare un team salvato col gioco rimette il gioco; tornando a Competitivo si ritrova il formato di prima', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    window.localStorage.clear();
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} storage={window.localStorage} />);
    await pickGame(user, 'sv');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Storia{Enter}');
    await backToCompetitive(user);
    await chooseTier(user, 'ubers');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Storia' }));
    expect(formatButton()).toHaveAccessibleName(/^Formato Scarlatto e Violetto/);
    expect(screen.getByRole('tab', { name: /Meta/ })).toHaveAttribute('aria-disabled', 'true');
    await backToCompetitive(user);
    await openFormat(user);
    expect(chosen('format-tier')).toBe('ubers');
  });

  it('a team vuoto nel gioco niente uso nel meta sulle schede né nel dettaglio', async () => {
    initGames({ sv: { dex: ['greattusk', 'gholdengo'] } });
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    // Senza gioco a team vuoto le schede mostrano l'uso nel meta
    expect(await screen.findAllByText(/%/)).not.toHaveLength(0);
    await pickGame(user, 'sv');
    // Al posto dell'uso, il voto che il Pokémon mette da solo: "+N" sulla scheda e nel dettaglio
    await waitFor(() => expect(document.querySelector('.card .result strong')?.textContent).toMatch(/^\+\d+$/));
    const first = document.querySelector('.card .result strong')!.textContent;
    expect(document.querySelector('.detail-score strong')?.textContent).toBe(first);
    expect(document.querySelector('.card .result')?.textContent).not.toMatch(/%/);
    expect(screen.queryByText(/uso nel meta/i)).toBeNull();
  });
});
