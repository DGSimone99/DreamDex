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
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
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
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Formato'), 'ou');
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it('fonte non scaricata: banner con il nome del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => NO_DATA} />);
    await user.selectOptions(screen.getByLabelText('Formato'), 'uu');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex UU non scaricate');
  });

  it('un caricamento vecchio non sovrascrive il formato attuale', async () => {
    const pending: Record<string, (d: EngineData) => void> = {};
    const loadSource = vi.fn((source: string) => new Promise<EngineData>(r => { pending[source] = r; }));
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Formato'), 'uu');
    await act(async () => pending.gen9nationaldexuu(fixtureData));
    await act(async () => pending.gen9nationaldexubers(NO_DATA));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText(/Statistiche: 2026-09/)).toBeInTheDocument();
  });

  it('banner del Monotype col nome giusto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => NO_DATA} />);
    await user.click(screen.getByRole('checkbox', { name: 'Monotype' }));
    await user.selectOptions(screen.getByLabelText('Tipo del team'), 'Water');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex Monotype non scaricate');
  });

  it('non c\'è più l\'etichetta fissa del formato', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(screen.getByLabelText('Formato')).toHaveValue('ou');
    expect(screen.getAllByRole('option', { name: /National Dex/ }).length).toBe(3);
    expect(screen.getByRole('option', { name: 'Tutti i Pokémon (senza limiti)' })).toBeInTheDocument();
  });
});

describe('pannello Avanzate', () => {
  const team = () => screen.getByRole('region', { name: 'Team' });
  const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
  const cardNames = () => [...suggestions().querySelectorAll('details.suggestion summary .name-line > strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));
  const add = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);

  it('contatore delle opzioni attive e tipo del Monotype solo quando serve', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    expect(screen.getByText('Avanzate')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo del team')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Monotype' }));
    await user.selectOptions(screen.getByLabelText('Tipo del team'), 'Steel');
    await user.click(screen.getByRole('checkbox', { name: 'Ignora ban' }));
    expect(screen.getByText('Avanzate (2)')).toBeInTheDocument();
  });

  it('Monotype: avviso negli slot e suggerimenti solo del tipo scelto', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await add(user, 'Great Tusk');
    await user.click(screen.getByRole('checkbox', { name: 'Monotype' }));
    await user.selectOptions(screen.getByLabelText('Tipo del team'), 'Steel');
    expect(await within(team()).findByText((_, el) => el?.textContent === 'Non è di tipo Steel', { selector: '.alert-line' })).toBeInTheDocument();
    expect(cardNames().length).toBeGreaterThan(0);
    expect([...cardNames()].sort()).toEqual(['Corviknight', 'Gholdengo', 'Kingambit']);
  });

  it('cambiando formato i membri illegali vengono segnalati, non rimossi', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} loadSource={async () => fixtureData} />);
    await add(user, 'Great Tusk');
    await user.selectOptions(screen.getByLabelText('Formato'), 'uu');
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
