import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import type { EngineData } from '../../src/engine/data';
import { fixtureData } from '../fixtures/data';

const NO_DATA: EngineData = { stats: null, sets: null };

describe('dati per formato', () => {
  it('cambiando formato carica la sua fonte, con il messaggio di caricamento', async () => {
    let resolve!: (d: EngineData) => void;
    const loadSource = vi.fn(() => new Promise<EngineData>(r => { resolve = r; }));
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'ubers');
    expect(loadSource).toHaveBeenCalledWith('gen9nationaldexubers');
    expect(screen.getByText('Caricamento statistiche…')).toBeInTheDocument();
    await act(async () => resolve(fixtureData));
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText(/Statistiche: 2026-09/)).toBeInTheDocument();
  });

  it('i dati già caricati restano in memoria', async () => {
    const loadSource = vi.fn(async () => fixtureData);
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'ou');
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'ubers');
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it('fonte non scaricata: banner con il nome del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => NO_DATA} />);
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'uu');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex UU non scaricate');
  });

  it('un caricamento vecchio non sovrascrive il formato attuale', async () => {
    const pending: Record<string, (d: EngineData) => void> = {};
    const loadSource = vi.fn((source: string) => new Promise<EngineData>(r => { pending[source] = r; }));
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'uu');
    await act(async () => pending.gen9nationaldexuu(fixtureData));
    await act(async () => pending.gen9nationaldexubers(NO_DATA));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText(/Statistiche: 2026-09/)).toBeInTheDocument();
  });

  it('menu Pokédex e Tier: Gen 9 con OU, Ubers, UU e AG; Senza limiti senza tier', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.getByLabelText('Pokédex')).toHaveValue('natdex');
    expect(screen.getByLabelText('Tier del formato')).toHaveValue('ou');
    expect(within(screen.getByLabelText('Tier del formato')).getAllByRole('option').map(o => o.textContent)).toEqual(['OU', 'Ubers', 'UU']);
    await user.selectOptions(screen.getByLabelText('Pokédex'), 'gen9');
    expect(screen.getByLabelText('Tier del formato')).toHaveValue('gen9ou');
    expect(within(screen.getByLabelText('Tier del formato')).getAllByRole('option').map(o => o.textContent)).toEqual(['OU', 'Ubers', 'UU', 'Anything Goes']);
    await user.selectOptions(screen.getByLabelText('Pokédex'), 'nolimits');
    expect(screen.queryByLabelText('Tier del formato')).toBeNull();
    // Tornando a National Dex si riparte da OU
    await user.selectOptions(screen.getByLabelText('Pokédex'), 'natdex');
    expect(screen.getByLabelText('Tier del formato')).toHaveValue('ou');
  });

  it('l\'uso minimo dei suggerimenti sta in Avanzate', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.getByLabelText('Uso minimo').closest('details')).toHaveTextContent('Avanzate');
  });
});

describe('pannello Avanzate', () => {
  const team = () => screen.getByRole('region', { name: 'Team' });
  const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
  const cardNames = () => [...suggestions().querySelectorAll('.suggestions .name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));
  const add = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);

  it('contatore delle opzioni attive, senza Monotype', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.getByText('Avanzate')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Monotype' })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Ignora ban' }));
    await user.click(screen.getByRole('checkbox', { name: 'Più Mega ammesse' }));
    expect(screen.getByText('Avanzate (2)')).toBeInTheDocument();
  });

  it('cambiando formato i membri illegali vengono segnalati, non rimossi', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await add(user, 'Great Tusk');
    await user.selectOptions(screen.getByLabelText('Tier del formato'), 'uu');
    expect(await within(team()).findByText('Non legale in National Dex UU')).toBeInTheDocument();
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
