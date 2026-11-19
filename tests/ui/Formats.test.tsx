import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { EngineData } from '../../src/engine/data';
import { chooseBattle, chooseDex, chooseTier, chosen, tierNames } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

const NO_DATA: EngineData = { stats: null, sets: null };

describe('dati per formato', () => {
  it('cambiando formato carica la sua fonte, con il messaggio di caricamento', async () => {
    let resolve!: (d: EngineData) => void;
    const loadSource = vi.fn(() => new Promise<EngineData>(r => { resolve = r; }));
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await chooseTier(user, 'ubers');
    expect(loadSource).toHaveBeenCalledWith('gen9nationaldexubers');
    expect(screen.getByText('Caricamento statistiche…')).toBeInTheDocument();
    await act(async () => resolve(fixtureData));
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText('Dati Smogon: 09/2026')).toBeInTheDocument();
  });

  it('i dati già caricati restano in memoria', async () => {
    const loadSource = vi.fn(async () => fixtureData);
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await chooseTier(user, 'ubers');
    await chooseTier(user, 'ou');
    await chooseTier(user, 'ubers');
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it('fonte non scaricata: banner con il nome del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => NO_DATA} />);
    await chooseTier(user, 'uu');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex UU non scaricate');
  });

  it('un caricamento vecchio non sovrascrive il formato attuale', async () => {
    const pending: Record<string, (d: EngineData) => void> = {};
    const loadSource = vi.fn((source: string) => new Promise<EngineData>(r => { pending[source] = r; }));
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await chooseTier(user, 'ubers');
    await chooseTier(user, 'uu');
    await act(async () => pending.gen9nationaldexuu(fixtureData));
    await act(async () => pending.gen9nationaldexubers(NO_DATA));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText('Dati Smogon: 09/2026')).toBeInTheDocument();
  });

  it('menu Pokédex e Tier: Gen 9 con OU, Ubers, UU e AG; Senza limiti senza tier', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(chosen('format-dex')).toBe('natdex');
    expect(chosen('format-tier')).toBe('ou');
    expect(tierNames()).toEqual(['OU', 'Ubers', 'UU']);
    await chooseDex(user, 'gen9');
    expect(chosen('format-tier')).toBe('gen9ou');
    expect(tierNames()).toEqual(['OU', 'Ubers', 'UU', 'Anything Goes']);
    await chooseDex(user, 'nolimits');
    expect(screen.queryByLabelText('Tier del formato')).toBeNull();
    // Tornando a National Dex si riparte da OU
    await chooseDex(user, 'natdex');
    expect(chosen('format-tier')).toBe('ou');
  });

  it('Lotta: Doppio in National Dex carica National Dex Doubles e mostra la pastiglia Doppio', async () => {
    const loadSource = vi.fn(async () => fixtureData);
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    expect(chosen('format-battle')).toBe('singles');
    await chooseBattle(user, 'doubles');
    expect(chosen('format-battle')).toBe('doubles');
    expect(chosen('format-tier')).toBe('natdexdoubles');
    expect(tierNames()).toEqual(['OU']);
    expect(loadSource).toHaveBeenCalledWith('gen9nationaldexdoubles');
    expect(document.querySelector('.format-pills')).toHaveTextContent(/^Doppio/);
    // Tornando al Singolo si riparte da National Dex OU
    await chooseBattle(user, 'singles');
    expect(chosen('format-tier')).toBe('ou');
  });

  it('Lotta: Doppio grigio in Gen 9; da Doppio a Gen 9 si va a Gen 9 OU in Singolo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await chooseBattle(user, 'doubles');
    await chooseDex(user, 'gen9');
    expect(chosen('format-tier')).toBe('gen9ou');
    expect(chosen('format-battle')).toBe('singles');
    expect(document.querySelector<HTMLInputElement>('input[name="format-battle"][value="doubles"]')!.disabled).toBe(true);
  });

  it('Doppio senza dati: il banner col nome del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => NO_DATA} />);
    await chooseBattle(user, 'doubles');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex Doubles non scaricate');
  });

  it('interruttore spento: niente scelta Lotta', () => {
    vi.stubEnv('DEV', false);
    try {
      render(<App initialLang="it" data={fixtureData} />);
      expect(document.querySelector('input[name="format-battle"]')).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });

  it("l'uso minimo dei suggerimenti non si sceglie più", () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.queryByLabelText('Uso minimo')).toBeNull();
  });
});

describe('pannello Avanzate', () => {
  const team = () => screen.getByRole('region', { name: 'Team' });
  const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
  const cardNames = () => [...suggestions().querySelectorAll('.suggestions .name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));
  const add = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);

  it('le opzioni avanzate accese compaiono come pastiglie sulla carta del formato; niente Monotype', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.getByText('Avanzate')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Monotype' })).toBeNull();
    expect(document.querySelector('.format-pills')).toHaveTextContent(/^MetaGen 9$/);
    await user.click(screen.getByRole('checkbox', { name: 'Ignora ban' }));
    await user.click(screen.getByRole('checkbox', { name: 'Più Mega ammesse' }));
    expect(document.querySelector('.format-pills')).toHaveTextContent(/^MetaGen 9Ban ignoratiPiù Mega$/);
  });

  it('cambiando formato i membri illegali vengono segnalati, non rimossi', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await add(user, 'Great Tusk');
    await chooseTier(user, 'uu');
    expect(await within(team()).findByText(/^Tier troppo alto per National Dex UU$/)).toBeInTheDocument();
    expect(within(team()).getByText('Great Tusk')).toBeInTheDocument();
  });

  it('Ignora ban: gli Uber non hanno più il tag rosso', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('checkbox', { name: 'Ignora ban' }));
    await add(user, 'Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    expect(within(suggestions()).queryByText(/bannato/)).toBeNull();
  });

  it('"Più Mega ammesse" sta nel pannello', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.getByRole('checkbox', { name: 'Più Mega ammesse' }).closest('details')).toHaveTextContent('Avanzate');
  });
});
