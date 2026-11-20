import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { EngineData } from '../../src/engine/data';
import { PROPOSALS_PER_ROUND, type Proposal } from '../../src/engine/fillProposals';
import type { TournamentTeam } from '../../src/engine/tournamentTeams';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { FillPanel } from '../../src/ui/FillPanel';
import { effectiveLists, EMPTY_LISTS } from '../../src/engine/lists';
import { LangProvider } from '../../src/i18n/react';
import { fillData } from '../fixtures/fillData';
import { renderIt } from '../helpers/italian';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

const WAIT = { timeout: 10000 };
const attackers = () => ['Dragapult', 'Weavile', 'Cinderace', 'Iron Valiant', 'Gholdengo'].map(name => ({ ...emptySet(name), moves: ['Protect'] }));
const panel = (team: TeamSet[] = [], onApply = vi.fn(), onClose = vi.fn(), data: EngineData = fillData, onLoadTeam = vi.fn()) =>
  renderIt(<FillPanel team={team} format={DEFAULT_FORMAT} data={data} onApply={onApply} onClose={onClose} onLoadTeam={onLoadTeam} />);
const addButtons = () => screen.findAllByRole('button', { name: /^Usa la proposta \d$/ }, WAIT);
// Solo i Pokémon nuovi delle proposte (quelli del team sono spenti, si ripetono in ogni riga)
const shownNames = () => [...document.querySelectorAll('.fill-proposal .fill-mon.is-new .fill-mon-name')].map(n => n.textContent);
const idle = () => expect(screen.queryByText('Calcolo delle proposte…')).toBeNull();

describe('pannello Completa team', () => {
  it('all’apertura è scelto "Il migliore" e arrivano fino a PROPOSALS_PER_ROUND proposte', async () => {
    panel();
    expect(screen.getByRole('radio', { name: 'Il migliore' })).toHaveAttribute('aria-checked', 'true');
    const buttons = await addButtons();
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons.length).toBeLessThanOrEqual(PROPOSALS_PER_ROUND);
  });

  it('Usa passa la proposta a onApply', async () => {
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

  it('Altre proposte: ogni proposta nuova cambia almeno metà dei Pokémon nuovi rispetto a ognuna di prima', async () => {
    const user = userEvent.setup();
    panel();
    await addButtons();
    await vi.waitFor(idle, WAIT);
    const first = shownNames();
    const more = screen.getByRole('button', { name: 'Altre proposte' });
    // Il primo giro del fixture si ferma prima di PROPOSALS_PER_ROUND per i tentativi, non perché i Pokémon sono finiti: si può chiedere ancora
    expect(more).toBeEnabled();
    expect(screen.queryByText('Non ci sono altri Pokémon nuovi per questa scelta')).toBeNull();
    await user.click(more);
    await vi.waitFor(idle, WAIT);
    // Pagina 1 senza ripetizioni; dalla pagina 2 al massimo metà dei nuovi (per difetto) in comune con ogni proposta di prima
    expect(new Set(first).size).toBe(first.length);
    const rows = (names: (string | null)[]) => Array.from({ length: names.length / 6 }, (_, i) => names.slice(6 * i, 6 * i + 6));
    for (const row of rows(shownNames())) for (const earlier of rows(first)) {
      expect(row.filter(name => earlier.includes(name)).length).toBeLessThanOrEqual(3);
    }
    // Se il giro dopo non trova più nessuno, il pulsante si spegne e lo dice
    if (!document.querySelector('.fill-proposal')) {
      expect(more).toBeDisabled();
      expect(screen.getByText('Non ci sono altri Pokémon nuovi per questa scelta')).toBeInTheDocument();
    }
  });

  it('cambiando team le proposte si rifanno per il team nuovo', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    const { rerender } = panel([], onApply);
    await addButtons();
    const team = [{ ...emptySet('Garchomp'), moves: ['Earthquake'] }];
    rerender(<LangProvider lang="it"><FillPanel team={team} format={DEFAULT_FORMAT} data={fillData} onApply={onApply} onClose={() => undefined} onLoadTeam={vi.fn()} /></LangProvider>);
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

  it('la lista ha sempre PROPOSALS_PER_ROUND posti: scheletri durante il calcolo, righe vuote dopo', async () => {
    const user = userEvent.setup();
    panel();
    const rows = () => document.querySelectorAll('.fill-proposals > li');
    expect(rows()).toHaveLength(PROPOSALS_PER_ROUND);
    expect(document.querySelectorAll('.fill-proposals > li.fill-skeleton').length).toBeGreaterThan(0);
    await vi.waitFor(idle, WAIT);
    expect(rows()).toHaveLength(PROPOSALS_PER_ROUND);
    await user.click(within(screen.getByRole('radiogroup', { name: 'Condizione' })).getByRole('radio', { name: 'Neve' }));
    await vi.waitFor(idle, WAIT);
    expect(rows()).toHaveLength(PROPOSALS_PER_ROUND);
    expect(document.querySelectorAll('.fill-proposals > li.fill-skeleton')).toHaveLength(0);
  }, 60000);

  it('mentre calcola le righe restano PROPOSALS_PER_ROUND: ogni proposta prende il posto di uno scheletro', async () => {
    panel([{ ...emptySet('Garchomp'), moves: ['Earthquake'] }]);
    const list = document.querySelector('.fill-proposals')!;
    const kinds = () => [...list.children].map(row => row.matches('.fill-skeleton') ? 'skeleton' : row.matches('.fill-proposal') ? 'proposal' : 'other');
    // Le proposte già arrivate stanno sopra, gli scheletri occupano il resto dei posti
    expect(list.children).toHaveLength(PROPOSALS_PER_ROUND);
    expect(kinds()).not.toContain('other');
    expect(kinds()).toContain('skeleton');
    // Lo scheletro ha le parti di una riga vera: il tuo team già al suo posto, i nuovi come sagome
    const skeleton = list.querySelector('.fill-skeleton')!;
    expect(skeleton.querySelector('.fill-mon.is-mine')).toHaveTextContent('Garchomp');
    expect(skeleton.querySelectorAll('.fill-mon.is-new')).toHaveLength(5);
    const counts: number[] = [];
    const observer = new MutationObserver(() => counts.push(list.children.length));
    observer.observe(list, { childList: true });
    await vi.waitFor(idle, WAIT);
    observer.disconnect();
    expect([...list.children].filter(row => row.matches('.fill-proposal')).length).toBeGreaterThan(0);
    for (const n of counts) expect(n).toBe(PROPOSALS_PER_ROUND);
    expect(list.children).toHaveLength(PROPOSALS_PER_ROUND);
  });

  it('ogni proposta entra al suo posto: la lista è sempre in ordine di voto', async () => {
    // Senza preferiti l'ordine è solo il voto (proposalOrder)
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
    expect(await screen.findByText('Nessun completamento con questo tipo e questa condizione', undefined, { timeout: 20000 })).toBeInTheDocument();
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(0);
  }, 60000);
});

describe('Completa team: bannati dell\'utente', () => {
  it('dice quanti bannati restano fuori', async () => {
    const userLists = effectiveLists({ ...EMPTY_LISTS, byContext: { ou: { favorites: [], bans: ['Toxapex', 'Blissey'] } } }, 'ou');
    panel([], vi.fn(), vi.fn(), { ...fillData, userLists });
    expect(await screen.findByText('2 bannati esclusi')).toBeInTheDocument();
  });

  it('senza bannati nessuna riga', () => {
    panel();
    expect(screen.queryByText(/bannat[oi] esclus/)).toBeNull();
  });
});

const favorites = (names: string[]) => ({
  ...fillData, userLists: effectiveLists({ ...EMPTY_LISTS, byContext: { ou: { favorites: names, bans: [] } } }, 'ou'),
});

describe('Completa team: Tieni il set e preferiti', () => {
  it('ogni membro ha il lucchetto "Fissa il set", aperto; fissandolo le proposte si rifanno', async () => {
    const user = userEvent.setup();
    panel([{ ...emptySet('Great Tusk'), moves: ['Headlong Rush'] }]);
    const keep = screen.getByRole('checkbox', { name: 'Fissa il set di Great Tusk' });
    expect(keep).not.toBeChecked();
    await addButtons();
    await user.click(keep);
    expect(keep).toBeChecked();
    expect(screen.getByText('Calcolo delle proposte…')).toBeInTheDocument();
    await vi.waitFor(idle, WAIT);
    expect((await addButtons()).length).toBeGreaterThan(0);
  }, 60000);

  it('il menu dei preferiti ha tre voci e parte da "Priorità ai preferiti"', () => {
    panel();
    const select = screen.getByRole('combobox', { name: 'Pokémon preferiti' });
    expect(within(select).getAllByRole('option').map(o => o.textContent)).toEqual(['Disattivato', 'Priorità ai preferiti', 'Solo preferiti']);
    expect(select).toHaveValue('priority');
  });

  it('"Solo preferiti" senza preferiti lo dice, nessuna proposta', async () => {
    const user = userEvent.setup();
    panel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Pokémon preferiti' }), 'only');
    expect(await screen.findByText('I tuoi preferiti non bastano per un team buono con queste scelte', undefined, WAIT)).toBeInTheDocument();
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(0);
  });

  it('i preferiti nuovi di una proposta hanno il cuore sullo sprite', async () => {
    panel([], vi.fn(), vi.fn(), favorites(['Garchomp']));
    await addButtons();
    await vi.waitFor(idle, WAIT);
    const marked = [...document.querySelectorAll('.fill-proposal .fill-mon.is-favorite')];
    expect(marked.length).toBeGreaterThan(0);
    for (const mon of marked) {
      expect(mon).toHaveTextContent('Garchomp');
      expect(within(mon as HTMLElement).getByRole('img', { name: 'Garchomp, nei tuoi preferiti' })).toBeInTheDocument();
    }
  });
});

const tournament = (name: string, species: string[]): TournamentTeam =>
  ({ name, author: 'Lameflame', team: species.map(s => ({ ...emptySet(s), moves: ['Protect'] })) });

describe('Completa team: Team da torneo', () => {
  const teams = [
    tournament('Rain Offense', ['Pelipper', 'Barraskewda', 'Kingdra', 'Great Tusk', 'Gholdengo', 'Dragapult']),
    tournament('Kingambit Balance', ['Kingambit', 'Toxapex', 'Corviknight', 'Garchomp', 'Blissey', 'Iron Valiant']),
  ];

  it('le schede si cambiano; Carica passa quel team a onLoadTeam', async () => {
    const onLoadTeam = vi.fn();
    const user = userEvent.setup();
    panel([{ ...emptySet('Garchomp'), moves: ['Earthquake'] }], vi.fn(), vi.fn(), { ...fillData, tournamentTeams: teams }, onLoadTeam);
    const tab = screen.getByRole('tab', { name: /Team da torneo/ });
    expect(tab).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: /Proposte/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(tab);
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const load = screen.getAllByRole('button', { name: /^Carica/ });
    expect(load).toHaveLength(2);
    // Prima quello con Garchomp, il Pokémon in comune
    expect(screen.getByText('1 dei tuoi Pokémon')).toBeInTheDocument();
    expect(screen.getByText('nessuno in comune')).toBeInTheDocument();
    await user.click(load[0]);
    expect(onLoadTeam).toHaveBeenCalledWith(teams[1].team);
  });

  it('ogni scheda dice il tipo del team; un preferito ha il cuore', async () => {
    const user = userEvent.setup();
    panel([], vi.fn(), vi.fn(), { ...favorites(['Garchomp']), tournamentTeams: teams });
    await user.click(screen.getByRole('tab', { name: /Team da torneo/ }));
    const cards = document.querySelectorAll<HTMLElement>('.fill-card');
    expect(cards).toHaveLength(2);
    for (const card of cards) expect(within(card).getByText(/^(Hyper Offense|Bulky Offense|Balance|Semi-stall|Stall)( · .+)?$/)).toBeInTheDocument();
    expect(within(cards[1]).getByRole('img', { name: 'Garchomp, nei tuoi preferiti' })).toBeInTheDocument();
    expect(within(cards[0]).getByRole('img', { name: 'Pelipper' })).toBeInTheDocument();
  });

  it('un team senza nome prende quello del suo autore', async () => {
    const user = userEvent.setup();
    panel([], vi.fn(), vi.fn(), { ...fillData, tournamentTeams: [tournament('', ['Kingambit', 'Toxapex'])] });
    await user.click(screen.getByRole('tab', { name: /Team da torneo/ }));
    expect(screen.getByText('Team di Lameflame')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carica Team di Lameflame' })).toBeInTheDocument();
  });

  it('senza team da torneo per il formato lo dice', async () => {
    const user = userEvent.setup();
    panel([], vi.fn(), vi.fn(), { ...fillData, tournamentTeams: null });
    await user.click(screen.getByRole('tab', { name: /Team da torneo/ }));
    expect(screen.getByText('Nessun team da torneo per questo formato')).toBeInTheDocument();
  });
});
