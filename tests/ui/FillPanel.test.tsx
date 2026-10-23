import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { Proposal } from '../../src/engine/fillProposals';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { FillPanel } from '../../src/ui/FillPanel';
import { effectiveLists, EMPTY_LISTS } from '../../src/engine/lists';
import { LangProvider } from '../../src/i18n/react';
import { fillData } from '../fixtures/fillData';
import { renderIt } from '../helpers/italian';

const WAIT = { timeout: 5000 };
const attackers = () => ['Dragapult', 'Weavile', 'Cinderace', 'Iron Valiant', 'Gholdengo'].map(name => ({ ...emptySet(name), moves: ['Protect'] }));
const panel = (team: TeamSet[] = [], onApply = vi.fn(), onClose = vi.fn()) =>
  renderIt(<FillPanel team={team} format={DEFAULT_FORMAT} data={fillData} onApply={onApply} onClose={onClose} />);
const addButtons = () => screen.findAllByRole('button', { name: /^Aggiungi la proposta \d$/ }, WAIT);
const shownNames = () => [...document.querySelectorAll('.fill-proposal .fill-mon-name')].map(n => n.textContent);
const idle = () => expect(screen.queryByText('Calcolo delle proposte…')).toBeNull();

describe('pannello Completa team', () => {
  it('all’apertura è scelto "Il migliore" e arrivano fino a 5 proposte', async () => {
    panel();
    expect(screen.getByRole('radio', { name: 'Il migliore' })).toHaveAttribute('aria-checked', 'true');
    const buttons = await addButtons();
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons.length).toBeLessThanOrEqual(5);
  });

  it('Aggiungi passa la proposta a onApply', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    panel([], onApply);
    await user.click((await addButtons())[0]);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect((onApply.mock.calls[0][0] as Proposal).team).toHaveLength(6);
  });

  it('cambiare tipo ricalcola: nessuna proposta del tipo vecchio resta', async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole('radio', { name: 'Stall' }));
    await user.click(screen.getByRole('radio', { name: 'Hyper Offense' }));
    await vi.waitFor(idle, WAIT);
    const rows = document.querySelectorAll('.fill-proposal');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveTextContent('Hyper Offense');
  });

  it('Altre proposte non ripete Pokémon già mostrati', async () => {
    const user = userEvent.setup();
    panel();
    await addButtons();
    await vi.waitFor(idle, WAIT);
    const first = shownNames();
    const more = screen.getByRole('button', { name: 'Altre proposte' });
    // Il fixture ha solo 10 specie: con meno di 5 proposte il giro è finito e il pulsante lo dice
    if (first.length < 6 * 5 && document.querySelectorAll('.fill-proposal').length < 5) {
      expect(more).toBeDisabled();
      expect(screen.getByText('Non ci sono altri Pokémon nuovi per questa scelta')).toBeInTheDocument();
      return;
    }
    await user.click(more);
    await vi.waitFor(idle, WAIT);
    for (const name of shownNames()) expect(first).not.toContain(name);
  });

  it('cambiando team le proposte si rifanno per il team nuovo', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    const { rerender } = panel([], onApply);
    await addButtons();
    const team = [{ ...emptySet('Garchomp'), moves: ['Earthquake'] }];
    rerender(<LangProvider lang="it"><FillPanel team={team} format={DEFAULT_FORMAT} data={fillData} onApply={onApply} onClose={() => undefined} /></LangProvider>);
    await vi.waitFor(idle, WAIT);
    await user.click((await addButtons())[0]);
    expect((onApply.mock.calls[0][0] as Proposal).team[0]).toBe(team[0]);
  });

  it('Esc chiude, anche subito dopo l’apertura', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    panel([], vi.fn(), onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('i tipi senza proposte si oscurano e non si scelgono', async () => {
    // Cinque attaccanti: Stall e Semi-Stall (almeno 4 muri) non possono esistere
    const user = userEvent.setup();
    panel(attackers());
    const SLOW = { timeout: 25000 };
    await vi.waitFor(() => expect(screen.getByRole('radio', { name: 'Stall' })).toBeDisabled(), SLOW);
    await vi.waitFor(() => expect(screen.getByRole('radio', { name: 'Semi-stall' })).toBeDisabled(), SLOW);
    expect(screen.getByRole('radio', { name: 'Il migliore' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'Stall' }));
    expect(screen.getByRole('radio', { name: 'Il migliore' })).toHaveAttribute('aria-checked', 'true');
  }, 40000);

  it('la lista ha sempre 5 posti: scheletri durante il calcolo, righe vuote dopo', async () => {
    const user = userEvent.setup();
    panel();
    const rows = () => document.querySelectorAll('.fill-proposals > li');
    expect(rows()).toHaveLength(5);
    expect(document.querySelectorAll('.fill-proposals > li.fill-skeleton').length).toBeGreaterThan(0);
    await vi.waitFor(idle, WAIT);
    expect(rows()).toHaveLength(5);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Stile' })).getByRole('radio', { name: 'Neve' }));
    await vi.waitFor(idle, WAIT);
    expect(rows()).toHaveLength(5);
    expect(document.querySelectorAll('.fill-proposals > li.fill-skeleton')).toHaveLength(0);
  }, 30000);

  it('le proposte non si riordinano mentre arrivano: prima in coda, a giro finito per voto', async () => {
    panel();
    await vi.waitFor(idle, WAIT);
    const grades = [...document.querySelectorAll('.fill-proposal .fill-grade')].map(g => Number(g.textContent!.replace(/\D/g, '')));
    expect(grades).toEqual([...grades].sort((a, b) => b - a));
  });

  it('scelta senza risultati: messaggio, nessuna proposta', async () => {
    // Il tipo scelto resta selezionabile anche se vuoto: lo si sceglie prima che la verifica lo oscuri
    const user = userEvent.setup();
    panel(attackers());
    await user.click(screen.getByRole('radio', { name: 'Stall' }));
    expect(await screen.findByText('Nessun completamento con questo tipo e questo stile', undefined, { timeout: 20000 })).toBeInTheDocument();
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(0);
  }, 30000);
});

describe('Completa team: bannati dell\'utente', () => {
  it('dice quanti bannati restano fuori', async () => {
    const userLists = effectiveLists({ ...EMPTY_LISTS, byFormat: { ou: { favorites: [], bans: ['Toxapex', 'Blissey'] } } }, 'ou');
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={{ ...fillData, userLists }} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText('2 bannati esclusi')).toBeInTheDocument();
  });

  it('senza bannati nessuna riga', () => {
    panel();
    expect(screen.queryByText(/bannat[oi] esclus/)).toBeNull();
  });
});
