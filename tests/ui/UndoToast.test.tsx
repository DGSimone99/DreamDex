import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { UndoToast } from '../../src/ui/UndoToast';
import { renderIt } from '../helpers/italian';
import { fixtureData } from '../fixtures/data';

afterEach(() => vi.useRealTimers());

describe('avviso con Annulla', () => {
  it('dura 5 secondi; fermo finché ci sei sopra; × lo chiude', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderIt(<UndoToast action={{ id: 1, kind: 'remove', from: 'Garchomp' }} onUndo={vi.fn()} onClose={onClose} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Garchomp rimosso');
    act(() => { vi.advanceTimersByTime(3000); });
    fireEvent.mouseEnter(toast);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseLeave(toast);
    act(() => { vi.advanceTimersByTime(1999); });
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sostituzione: "Sostituito con" il nuovo Pokémon; Annulla e × chiamano le loro azioni', () => {
    const onUndo = vi.fn();
    const onClose = vi.fn();
    renderIt(<UndoToast action={{ id: 2, kind: 'replace', from: 'Gholdengo', to: 'Kingambit' }} onUndo={onUndo} onClose={onClose} />);
    expect(screen.getByRole('status')).toHaveTextContent('Gholdengo Sostituito con Kingambit');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onUndo).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Annulla nel team', () => {
  const team = () => screen.getByRole('region', { name: 'Team' });
  const names = () => [...team().querySelectorAll('.slot .name')].map(n => n.textContent);

  it('rimozione annullata: il membro torna al suo posto con il suo set', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Great Tusk @ Leftovers\nAbility: Protosynthesis\n- Rapid Spin\n\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake\n\nGholdengo @ Choice Scarf\nAbility: Good as Gold\n- Make It Rain');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    await user.click(screen.getByRole('button', { name: 'Rimuovi Garchomp' }));
    expect(names()).toEqual(['Great Tusk', 'Gholdengo']);
    expect(screen.getByRole('status')).toHaveTextContent('Garchomp rimosso');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(names()).toEqual(['Great Tusk', 'Garchomp', 'Gholdengo']);
    expect(team().querySelectorAll('.slot .held')[1]).toHaveTextContent('Rocky Helmet');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sostituzione dai suggerimenti annullata', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('button', { name: 'Sostituisci Gholdengo' }));
    const quick = screen.getAllByRole('button', { name: /^Sostituisci con / })[0];
    const replacement = quick.getAttribute('aria-label')!.replace('Sostituisci con ', '');
    await user.click(quick);
    expect(names()).toContain(replacement);
    expect(screen.getByRole('status')).toHaveTextContent(`Sostituito con ${replacement}`);
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(names()).toEqual(['Great Tusk', 'Gholdengo']);
  });

  it('un’altra modifica del team chiude l’avviso (Annulla non la cancellerebbe)', async () => {
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    await user.click(screen.getByRole('button', { name: 'Rimuovi Gholdengo' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kingambit{Enter}');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
