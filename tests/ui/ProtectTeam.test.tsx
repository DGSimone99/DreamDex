import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { UndoToast } from '../../src/ui/UndoToast';
import { renderIt } from '../helpers/italian';
import { fixtureData } from '../fixtures/data';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

const team = () => screen.getByRole('region', { name: 'Team' });
const names = () => [...team().querySelectorAll('.slot .name')].map(n => n.textContent);
const plate = () => document.querySelector('.plate-menu > summary') as HTMLElement;

async function importText(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.clear(screen.getByLabelText('Testo Showdown'));
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(text);
  await user.click(screen.getByRole('button', { name: 'Importa' }));
}

describe('Annulla dopo Importa e dopo un team salvato', () => {
  it('import sopra un team: "Team importato" e Annulla riporta il team di prima', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await importText(user, 'Garchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake');
    expect(names()).toEqual(['Garchomp']);
    expect(screen.getByRole('status')).toHaveTextContent('Team importato');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(names()).toEqual(['Great Tusk', 'Gholdengo']);
  });

  it('import a team vuoto: niente avviso', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await importText(user, 'Garchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake');
    expect(names()).toEqual(['Garchomp']);
    expect(screen.queryByRole('button', { name: 'Annulla' })).toBeNull();
  });

  it('team salvato caricato: "Caricato «nome»", Annulla riporta team e nome della targa di prima', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Uno{Enter}');
    await user.click(screen.getByRole('button', { name: 'Rimuovi Great Tusk' }));
    for (const name of ['Garchomp', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.type(screen.getByLabelText('Nome team'), 'Due{Enter}');
    expect(plate().querySelector('.plate-name')).toHaveTextContent('Due');

    await user.click(screen.getByRole('button', { name: 'Uno' }));
    expect(names()).toEqual(['Great Tusk']);
    expect(plate().querySelector('.plate-name')).toHaveTextContent('Uno');
    // Anche il fumetto "Team salvato" di poco prima è un avviso: si cerca quello dell'Annulla
    expect(screen.getAllByRole('status').map(s => s.textContent).join(' ')).toContain('Caricato «Uno»');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(names()).toEqual(['Garchomp', 'Gholdengo']);
    expect(plate().querySelector('.plate-name')).toHaveTextContent('Due');
    expect(plate().querySelector('.plate-dot')).toBeNull();
  });
});

describe('team salvati: modifiche non salvate', () => {
  it('col pallino una riga in cima al menu lo dice; senza modifiche no', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.type(screen.getByLabelText('Nome team'), 'Prova{Enter}');
    expect(screen.queryByText('Il team attuale ha modifiche non salvate')).toBeNull();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gholdengo{Enter}');
    expect(screen.getByText('Il team attuale ha modifiche non salvate')).toBeInTheDocument();
  });
});

describe('Svuota team', () => {
  it('cestino col fumetto al fuoco; da tastiera il fuoco va su Annulla', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const clear = within(team()).getByRole('button', { name: 'Svuota team' });
    act(() => clear.focus());
    expect(clear).toHaveAccessibleDescription('Svuota il team');
    await user.keyboard('{Enter}');
    expect(names()).toEqual([]);
    await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))));
    expect(screen.getByRole('button', { name: 'Annulla' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(names()).toEqual(['Great Tusk', 'Gholdengo']);
  });
});

describe('durata dell’avviso', () => {
  it('10 secondi per le azioni su tutto il team, 5 per un membro', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { unmount } = renderIt(<UndoToast action={{ id: 1, kind: 'clear', from: '' }} onUndo={vi.fn()} onClose={onClose} />);
    act(() => { vi.advanceTimersByTime(9999); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    const onCloseOne = vi.fn();
    renderIt(<UndoToast action={{ id: 2, kind: 'remove', from: 'Garchomp' }} onUndo={vi.fn()} onClose={onCloseOne} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onCloseOne).toHaveBeenCalledTimes(1);
  });
});

describe('targa del team per i lettori di schermo', () => {
  it('un titolo vero "Team (n/6)" fuori dal menu; il menu si chiama "Team salvati (n)"', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const heading = within(team()).getByRole('heading', { name: 'Team (1/6)' });
    expect(heading.closest('summary')).toBeNull();
    expect(plate()).toHaveAccessibleName('Team salvati (0)');
  });
});
