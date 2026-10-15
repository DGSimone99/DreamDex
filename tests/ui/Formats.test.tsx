import { act, render, screen } from '@testing-library/react';
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
    render(<App data={fixtureData} loadSource={loadSource} />);
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
    render(<App data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Formato'), 'ou');
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    expect(loadSource).toHaveBeenCalledTimes(1);
  });

  it('fonte non scaricata: banner con il nome del formato', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} loadSource={async () => NO_DATA} />);
    await user.selectOptions(screen.getByLabelText('Formato'), 'uu');
    expect(await screen.findByRole('alert')).toHaveTextContent('Statistiche National Dex UU non scaricate');
  });

  it('un caricamento vecchio non sovrascrive il formato attuale', async () => {
    const pending: Record<string, (d: EngineData) => void> = {};
    const loadSource = vi.fn((source: string) => new Promise<EngineData>(r => { pending[source] = r; }));
    const user = userEvent.setup();
    render(<App data={fixtureData} loadSource={loadSource} />);
    await user.selectOptions(screen.getByLabelText('Formato'), 'ubers');
    await user.selectOptions(screen.getByLabelText('Formato'), 'uu');
    await act(async () => pending.gen9nationaldexuu(fixtureData));
    await act(async () => pending.gen9nationaldexubers(NO_DATA));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Caricamento statistiche…')).toBeNull();
    expect(screen.getByText(/Statistiche: 2026-09/)).toBeInTheDocument();
  });

  it('non c\'è più l\'etichetta fissa del formato', () => {
    render(<App data={fixtureData} />);
    expect(screen.getByLabelText('Formato')).toHaveValue('ou');
    expect(screen.getAllByRole('option', { name: /National Dex/ }).length).toBe(3);
    expect(screen.getByRole('option', { name: 'Tutti i Pokémon (senza limiti)' })).toBeInTheDocument();
  });
});
