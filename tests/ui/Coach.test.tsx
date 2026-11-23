import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { coachTeam, type CoachAdvice, type Coaching, type CoachProblem } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { proposalGroups } from '../../src/engine/coachProposals';
import type { MoveFix } from '../../src/engine/moveFixes';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { areaSnapshot, type AreaSnapshot } from '../../src/engine/teamGain';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { CoachingView, gainText } from '../../src/ui/CoachingView';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';
import { renderIt } from '../helpers/italian';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

// Due membri deboli lasciano spazio ai sostituti delle statistiche di prova (come nei test del motore)
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
// Un Balance completo senza controllo hazard: il coach propone Rapid Spin o Defog (per i test delle proposte di mossa)
const mk = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet => ({ ...emptySet(species), item, ability, moves, nature, evs });
const fixable = [...['Gholdengo', 'Toxapex'].map(n => mostCommonSet(fixtureStats, n)!),
  mk('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Knock Off'], 'Jolly', { atk: 252, spe: 252 }),
  mk('Corviknight', 'Leftovers', 'Pressure', ['Roost', 'Brave Bird', 'U-turn', 'Iron Defense'], 'Impish', { hp: 248, def: 168, spd: 92 }),
  mk('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant', { atk: 252, spe: 252 }),
  mk('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 })];
// Per i test delle aggiunte: con questo trio il Coaching propone anche aggiunte (un posto libero)
const trio = ['Gholdengo', 'Toxapex', 'Kingambit'].map(n => mostCommonSet(fixtureStats, n)!);
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };

const analysis = () => screen.getByRole('region', { name: 'Analisi' });
const suggestions = () => screen.getAllByRole('region', { name: 'Suggerimenti' }).find(r => !analysis().contains(r))!;
const proposals = () => within(analysis()).getByRole('region', { name: 'Proposte, dalla più utile' });

/** Importa il team, apre Analisi e la scheda Coaching (e aspetta le proposte). */
async function openCoaching(team: TeamSet[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(exportShowdown(team));
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
  await within(proposals()).findAllByRole('listitem', {}, { timeout: 5000 });
  return user;
}

/** La prima riga (sfogliando le pagine) il cui nome rispetta `pattern`. */
async function findRow(user: ReturnType<typeof userEvent.setup>, pattern: RegExp): Promise<HTMLElement> {
  for (let page = 0; page < 30; page++) {
    const row = within(proposals()).queryAllByRole('listitem').find(li => pattern.test(li.getAttribute('aria-label') ?? ''));
    if (row) return row;
    const next = within(proposals()).queryByRole('button', { name: 'Proposte successive' });
    if (!next || (next as HTMLButtonElement).disabled) break;
    await user.click(next);
  }
  throw new Error(`nessuna riga ${pattern}`);
}

const SWAP = /^(.+) al posto di (.+), voto \+(\d+)$/;
const ADD = /^(.+) in un posto libero, voto \+(\d+)$/;
const MOVE = /^(.+?) (?:al posto di .+?|in uno slot libero) su (.+), voto (\+\d+|±0)$/;

/** Il "+N" della riga del candidato nella lista di Sostituisci. */
const rowGain = (species: string) => {
  const row = [...suggestions().querySelectorAll<HTMLElement>('.suggestions li')]
    .find(li => li.querySelector('.name-line strong')?.textContent?.replace(/^\d+\. /, '') === species)!;
  expect(row).toBeTruthy();
  return /\(([^)]+)\)$/.exec(within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!)![1];
};

describe('scheda Coaching', () => {
  it('una lista di proposte dalla più utile: il +N non sale scendendo, la prima pagina ha al più 4 righe', async () => {
    const user = await openCoaching(six);
    const gains: number[] = [];
    for (let page = 0; page < 30; page++) {
      const rows = within(proposals()).getAllByRole('listitem');
      expect(rows.length).toBeLessThanOrEqual(4);
      gains.push(...rows.map(li => Number(/voto ([+−±]\d+)/.exec(li.getAttribute('aria-label')!)![1].replace('−', '-').replace('±', ''))));
      const next = within(proposals()).queryByRole('button', { name: 'Proposte successive' });
      if (!next || (next as HTMLButtonElement).disabled) break;
      await user.click(next);
    }
    expect(gains.length).toBeGreaterThan(1);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
    // Niente più mappa dei problemi né tappe numerate
    expect(within(analysis()).queryByText('Problemi per area')).toBeNull();
    expect(analysis().querySelector('.coach-step-num, .coach-map')).toBeNull();
  });

  it('"Vedi nella scheda Pokémon": scheda Pokémon, quel membro da sostituire, il candidato aperto, stesso +N', async () => {
    const user = await openCoaching(six);
    const row = await findRow(user, SWAP);
    const [, species, member, gain] = SWAP.exec(row.getAttribute('aria-label')!)!;
    await user.click(within(row).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveTextContent(`Sostituisci ${member}`);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('una ricerca rimasta nella scheda Pokémon non nasconde il candidato: impostazioni predefinite, stesso +N', async () => {
    const user = await openCoaching(six);
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    const search = within(suggestions()).getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'Zap');
    // Anche un tipo di team scelto a mano torna quello riconosciuto
    const type = () => within(suggestions()).getByRole('button', { name: /^Tipo di team:/ });
    const recognised = type().getAttribute('aria-label');
    await user.click(type());
    await user.click(within(screen.getByRole('listbox', { name: 'Tipo di team' })).getByRole('option', { name: recognised === 'Tipo di team: Stall' ? /^Hyper Offense/ : /^Stall/ }));
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const row = await findRow(user, SWAP);
    const [, species, , gain] = SWAP.exec(row.getAttribute('aria-label')!)!;
    await user.click(within(row).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(type().getAttribute('aria-label')).toBe(recognised);
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('team di 3: un candidato da aggiungere apre Aggiungi con lui nel dettaglio, stesso +N', async () => {
    const user = await openCoaching(trio);
    const row = await findRow(user, ADD);
    const [, species, gain] = ADD.exec(row.getAttribute('aria-label')!)!;
    await user.click(within(row).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('Applica su un sostituto: lo applica subito (stessa scheda), avviso con Annulla che riporta il membro', async () => {
    const user = await openCoaching(six);
    const row = await findRow(user, SWAP);
    const [, species, member] = SWAP.exec(row.getAttribute('aria-label')!)!;
    const cards = () => [...document.querySelectorAll('.slot.filled .slot-card')].map(el => el.textContent ?? '');
    expect(cards().some(text => text.includes(member))).toBe(true);
    await user.click(within(row).getByRole('button', { name: /^Applica: / }));
    // Resta su Analisi; il membro è sostituito
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    expect(cards().some(text => text.includes(member))).toBe(false);
    expect(cards().some(text => text.includes(species))).toBe(true);
    const undo = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(undo).toHaveTextContent(member);
    expect(undo).toHaveTextContent(species);
    await user.click(within(undo).getByRole('button', { name: 'Annulla' }));
    expect(cards().some(text => text.includes(member))).toBe(true);
    expect(cards().some(text => text.includes(species))).toBe(false);
  });

  it('team di 3: Applica su un candidato da aggiungere lo aggiunge, Annulla lo toglie', async () => {
    const user = await openCoaching(trio);
    const row = await findRow(user, ADD);
    const species = ADD.exec(row.getAttribute('aria-label')!)![1];
    const filled = () => document.querySelectorAll('.slot.filled').length;
    await user.click(within(row).getByRole('button', { name: /^Applica: / }));
    expect(filled()).toBe(4);
    const undo = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(undo).toHaveTextContent(`${species} aggiunto`);
    await user.click(within(undo).getByRole('button', { name: 'Annulla' }));
    expect(filled()).toBe(3);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    // Nella Panoramica: come giudizio e nel "Cosa fare" del cruscotto
    expect(within(analysis()).getAllByText('Aggiungi almeno 2 Pokémon per ricevere il coaching').length).toBeGreaterThan(0);
    // Anche nella scheda Coaching, non "il team è a posto"
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(within(analysis()).queryByText('Il team è a posto')).toBeNull();
  });
});

describe('CoachingView', () => {
  const rating = rateTeam(six, data, 'it')!;
  const before = areaSnapshot(rating);
  const noop = { onFix: () => {}, onMoveFix: () => {}, onApplyFix: () => {}, onApplyMove: () => {} };
  const coachingOf = (problems: CoachProblem[], over: Partial<Coaching> = {}): Coaching => ({ verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems, ...over });
  const fire: CoachProblem = { severity: 'serious', category: 'defense', text: 'Scoperto in difesa contro Fire: nessuno regge bene i suoi colpi',
    fixes: [], key: 'defense:Fire', subjects: ['Fire'], counts: { held: 0 } };
  const zapdos: CoachProblem = { severity: 'minor', category: 'meta', text: 'Scoperto in difesa contro Zapdos', fixes: [], key: 'meta:Zapdos', subjects: ['Zapdos'] };
  const pivot: CoachProblem = { severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: [], key: 'roles:important', subjects: ['pivot'] };
  const steel: CoachProblem = { severity: 'minor', category: 'redundancy', text: '3 membri di tipo Acciaio', fixes: [], key: 'redundancy:3 membri di tipo Acciaio' };
  const problems = [fire, zapdos, pivot, steel];
  const swap = (species: string, index: number, gain: number, solves: string[], after?: Partial<AreaSnapshot>): CoachFix => ({
    kind: 'swap', species, set: mostCommonSet(fixtureStats, species) ?? emptySet(species), index, member: six[index].species, gain, solves, reduces: [],
    after: { ...before, ...after },
  });
  const advice = (fixes: CoachFix[], moves: MoveFix[] = []): CoachAdvice => ({ fixes, moves, steps: [] });
  const view = (adv: CoachAdvice | null, over: Partial<Parameters<typeof CoachingView>[0]> = {}) => {
    const handlers = { onFix: vi.fn(), onMoveFix: vi.fn(), onApplyFix: vi.fn(), onApplyMove: vi.fn(), onExport: vi.fn(async () => true), onImproveSets: vi.fn(), onOverview: vi.fn() };
    renderIt(<CoachingView coaching={coachingOf(problems)} advice={adv} members={6} rating={rating} {...handlers} {...over} />);
    return handlers;
  };
  const list = () => screen.getByRole('region', { name: 'Proposte, dalla più utile' });
  const rows = () => within(list()).getAllByRole('listitem');

  it('a pari voto "±0", mai "+0"', () => {
    expect([gainText(3), gainText(0), gainText(-2)]).toEqual(['+3', '±0', '−2']);
  });

  it('una riga per proposta, dalla più utile; nome accessibile "X al posto di Y, voto +N"; il numero delle proposte nel titolo', () => {
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    expect(rows().map(li => li.getAttribute('aria-label'))).toEqual([
      'Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2',
    ]);
    expect(list().querySelector('.coach-count')).toHaveTextContent('3');
    // Pochi: nessuna pagina
    expect(within(list()).queryByRole('navigation')).toBeNull();
  });

  it('il magenta solo su Applica della prima proposta della prima pagina', async () => {
    view(advice(Array.from({ length: 6 }, (_, i) => swap(['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'][i], i, 9 - i, [fire.key]))));
    const primary = () => list().querySelectorAll('.coach-apply.is-primary');
    expect(primary()).toHaveLength(1);
    expect(rows()[0].contains(primary()[0])).toBe(true);
    expect(list().querySelectorAll('.coach-apply')).toHaveLength(4);
    await userEvent.setup().click(within(list()).getByRole('button', { name: 'Proposte successive' }));
    expect(primary()).toHaveLength(0);
  });

  it('pagine da 4 righe: "‹ 1/2 ›" coi nomi per lo screen reader, avanti e indietro', async () => {
    const user = userEvent.setup();
    view(advice(Array.from({ length: 6 }, (_, i) => swap(['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'][i], i, 9 - i, [fire.key]))));
    const pages = within(list()).getByRole('navigation', { name: 'Pagine delle proposte' });
    expect(pages).toHaveTextContent('1/2');
    expect(pages).toHaveTextContent('Proposte da 1 a 4');
    expect(within(pages).getByRole('button', { name: 'Proposte precedenti' })).toBeDisabled();
    expect(rows()).toHaveLength(4);
    await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
    expect(rows().map(li => li.getAttribute('aria-label')!.split(' ')[0])).toEqual(['Clefable', 'Dragonite']);
    expect(pages).toHaveTextContent('Proposte da 5 a 6');
    expect(within(pages).getByRole('button', { name: 'Proposte successive' })).toBeDisabled();
  });

  it('cosa cambia, per area: "da → a" del valore e le pillole dei problemi risolti; le aree che non cambiano non ci sono', () => {
    const def = Math.round(before.defense!);
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key, steel.key], { defense: def + 5, bonusMalus: before.bonusMalus + 1 })]));
    const lines = [...rows()[0].querySelectorAll<HTMLElement>('.coach-ar')];
    const label = (l: HTMLElement) => l.querySelector('.coach-ar-who b')!.textContent;
    expect(lines.map(label)).toEqual(['Difesa', 'Bonus/Malus']);
    expect(lines[0].querySelector('.coach-change')).toHaveTextContent(`${def} →${def + 5}da ${def} a ${def + 5}`);
    expect(lines[0].querySelector('.coach-to')).toHaveTextContent(String(def + 5));
    // Le pillole sono quelle della testata delle aree: Fuoco (tipo) e Zapdos (minaccia), col tooltip col fuoco
    expect([...lines[0].querySelectorAll('.area-chip')].map(c => c.getAttribute('data-key'))).toEqual([fire.key, zapdos.key]);
    expect(lines[0].querySelector('.area-chip')).toHaveAttribute('tabindex', '0');
    expect(lines[1].querySelector('.coach-change')).toHaveTextContent(`${gainText(before.bonusMalus)} →${gainText(before.bonusMalus + 1)}`);
    expect(lines[1].querySelector('.area-chip')).toHaveAttribute('data-key', steel.key);
  });

  it('un\'area che sale senza problemi risolti ha la sua riga, senza pillole', () => {
    const off = Math.round(before.strength!);
    view(advice([swap('Zapdos', 4, 2, [], { strength: off + 2 })]));
    const [line] = rows()[0].querySelectorAll<HTMLElement>('.coach-ar');
    expect(line.querySelector('.coach-ar-who b')).toHaveTextContent('Offesa');
    expect(line.querySelector('.coach-to')).toHaveTextContent(String(off + 2));
    expect(line.querySelector('.area-chip')).toBeNull();
  });

  it('Applica applica la proposta, "Vedi nella scheda Pokémon" la apre; il nome dice cosa applica', async () => {
    const user = userEvent.setup();
    const fix = swap('Rotom-Wash', 4, 3, [fire.key]);
    const h = view(advice([fix]));
    await user.click(within(rows()[0]).getByRole('button', { name: 'Applica: Rotom-Wash al posto di Magikarp, voto +3' }));
    expect(h.onApplyFix).toHaveBeenLastCalledWith(fix);
    await user.click(within(rows()[0]).getByRole('button', { name: 'Vedi nella scheda Pokémon: Rotom-Wash' }));
    expect(h.onFix).toHaveBeenLastCalledWith(fix);
  });

  describe('alternative', () => {
    const best = swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]);
    const second = swap('Heatran', 4, 3, [fire.key]);
    const third = swap('Volcanion', 4, 2, [fire.key, zapdos.key]);
    const other = swap('Zapdos', 5, 1, [pivot.key]);

    it('stesso membro e stesso problema principale: una riga con "Altre N", le altre sotto il pulsante', () => {
      const adv = advice([second, best, third, other]);
      expect(proposalGroups(problems, adv).map(g => g.options.length)).toEqual([3, 1]);
      view(adv);
      expect(rows()).toHaveLength(2);
      const button = within(rows()[0]).getByRole('button', { name: 'Altre 2' });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(within(rows()[1]).queryByRole('button', { name: /^Altre/ })).toBeNull();
    });

    it('scegliere un\'alternativa la mette nella riga (nome, +N) e Applica applica quella', async () => {
      const user = userEvent.setup();
      const h = view(advice([second, best, third, other]));
      const button = within(rows()[0]).getByRole('button', { name: 'Altre 2' });
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const listbox = screen.getByRole('listbox');
      expect(button).toHaveAttribute('aria-controls', listbox.id);
      expect(screen.getByText('Al posto di Magikarp, per gli stessi problemi · dalla più utile')).toBeInTheDocument();
      const options = within(listbox).getAllByRole('option');
      expect(options.map(o => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
      expect(options[0]).toHaveTextContent('Scelta');
      expect(options[1]).toHaveTextContent('Heatran');
      expect(options[1]).toHaveTextContent('1 problema su 2');
      expect(options[2]).toHaveTextContent('stessi problemi');
      await user.click(options[1]);
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(rows()[0]).toHaveAttribute('aria-label', 'Heatran al posto di Magikarp, voto +3');
      expect(rows()[0].querySelector('.coach-gain')).toHaveTextContent('+3');
      // La prima riga resta la prima (il gruppo è lo stesso): Applica applica Heatran
      await user.click(within(rows()[0]).getByRole('button', { name: /^Applica: Heatran/ }));
      expect(h.onApplyFix).toHaveBeenLastCalledWith(second);
      // Riaperta: la scelta per prima
      await user.click(within(rows()[0]).getByRole('button', { name: 'Altre 2' }));
      expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]).toHaveTextContent('Heatran');
    });

    it('tastiera: il fuoco sulla scelta, frecce per muoversi, Invio sceglie, Esc chiude e torna sul pulsante', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      const button = within(rows()[0]).getByRole('button', { name: 'Altre 2' });
      button.focus();
      await user.keyboard('{Enter}');
      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options[0]).toHaveFocus();
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(options[2]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(options[0]).toHaveFocus();
      await user.keyboard('{End}{Enter}');
      expect(rows()[0]).toHaveAttribute('aria-label', 'Volcanion al posto di Magikarp, voto +2');
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('un clic fuori chiude la tendina', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      await user.click(within(rows()[0]).getByRole('button', { name: 'Altre 2' }));
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('la scelta si dimentica quando cambiano i consigli', async () => {
      const user = userEvent.setup();
      const adv = advice([second, best, third, other]);
      const h = { onFix: vi.fn(), onMoveFix: vi.fn(), onApplyFix: vi.fn(), onApplyMove: vi.fn() };
      const { rerender } = renderIt(<CoachingView coaching={coachingOf(problems)} advice={adv} members={6} rating={rating} {...h} />);
      await user.click(within(rows()[0]).getByRole('button', { name: 'Altre 2' }));
      await user.click(within(screen.getByRole('listbox')).getAllByRole('option')[1]);
      expect(rows()[0]).toHaveAttribute('aria-label', 'Heatran al posto di Magikarp, voto +3');
      rerender(<CoachingView coaching={coachingOf(problems)} advice={{ ...adv }} members={6} rating={rating} {...h} />);
      expect(rows()[0]).toHaveAttribute('aria-label', 'Rotom-Wash al posto di Magikarp, voto +4');
    });
  });

  it('cambio di mossa: una riga della stessa lista, "Su X", mossa vecchia barrata → nuova, Applica e "Apri il set"', async () => {
    const user = userEvent.setup();
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: six[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [zapdos.key], after: before };
    const empty: MoveFix = { ...move, index: 1, member: 'Gholdengo', set: six[1], slot: 3, from: '', to: 'Thunderbolt', gain: 1, solves: [pivot.key] };
    const h = view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move, empty]));
    expect(rows().map(li => li.getAttribute('aria-label'))).toEqual([
      'Knock Off al posto di Rapid Spin su Great Tusk, voto +4', 'Rotom-Wash al posto di Magikarp, voto +2', 'Thunderbolt in uno slot libero su Gholdengo, voto +1',
    ]);
    const row = rows()[0];
    expect(row).toHaveClass('is-move');
    expect(row.querySelector('.coach-art')).toHaveTextContent('Su Great Tusk');
    expect(row.querySelector('.coach-art s')).toHaveTextContent('Rapid Spin');
    expect(row.querySelector('.coach-art-moves .coach-move-in')).toHaveTextContent('Knock Off');
    expect(row.querySelector('.coach-art')).toHaveTextContent('cambio di mossa');
    expect(rows()[2].querySelector('.coach-art')).toHaveTextContent('slot libero');
    await user.click(within(row).getByRole('button', { name: /^Applica: Knock Off/ }));
    expect(h.onApplyMove).toHaveBeenLastCalledWith(move);
    await user.click(within(row).getByRole('button', { name: 'Apri il set: Great Tusk' }));
    expect(h.onMoveFix).toHaveBeenLastCalledWith(move);
  });

  it('un cambio che lascia il team senza un ruolo d\'aiuto lo dice sulla riga: "Perdi Danno nel Tempo"; gli altri no', () => {
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: six[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 6, solves: [zapdos.key], after: before,
      lostHelpers: ['dot', 'phazer'], penalty: 2 };
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move]));
    const [lossy, clean] = rows();
    expect(lossy).toHaveClass('is-move');
    expect(lossy.querySelector('.coach-lost')).toHaveTextContent('PerdiDanno nel Tempo, Anti-setup');
    // Il voto mostrato resta quello vero
    expect(lossy.querySelector('.coach-gain')).toHaveTextContent('+6');
    expect(clean.querySelector('.coach-lost')).toBeNull();
  });

  it('aperto su un problema dalla testata di un\'area: la pagina della prima riga che lo risolve, in vista e accesa per 2 secondi', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.useFakeTimers();
    try {
      const fixes = Array.from({ length: 6 }, (_, i) => swap(['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'][i], i, 9 - i, i === 5 ? [pivot.key] : [fire.key]));
      renderIt(<CoachingView coaching={coachingOf(problems)} advice={advice(fixes)} members={6} rating={rating} {...noop} focus={{ key: pivot.key, nonce: 1 }} />);
      const row = rows().find(li => li.getAttribute('aria-label')!.startsWith('Dragonite'))!;
      expect(row).toBeTruthy();
      expect(within(list()).getByRole('navigation')).toHaveTextContent('2/2');
      expect(row).toHaveClass('is-flash');
      expect(scroll.mock.contexts[0]).toBe(row);
      act(() => { vi.advanceTimersByTime(2100); });
      expect(row).not.toHaveClass('is-flash');
    } finally {
      vi.useRealTimers();
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('consigli in calcolo: righe scheletro (aria-busy) e un avviso per lo screen reader', () => {
    view(null);
    const busy = list().querySelector('ol[aria-busy="true"]')!;
    expect(busy.querySelectorAll('.coach-row.skeleton')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('Calcolo dei consigli…');
  });

  it('le aree senza problemi in una riga verde sopra la lista', () => {
    renderIt(<CoachingView coaching={coachingOf([zapdos])} advice={advice([swap('Rotom-Wash', 4, 2, [zapdos.key])])} members={6} rating={rating} {...noop} />);
    const clean = document.querySelector('.coach-clean')!;
    expect(clean).toHaveTextContent(`Nessun problema in Offesa ${Math.round(before.strength!)} · Ruoli`);
    expect(clean).not.toHaveTextContent('Difesa');
  });

  it('nessun problema: Eevee contento, "Il team è a posto", i valori delle aree, Esporta per Showdown e la Panoramica', async () => {
    const user = userEvent.setup();
    const h = view(advice([]), { coaching: coachingOf([]) });
    expect(screen.getByRole('heading', { name: 'Il team è a posto' })).toBeInTheDocument();
    expect(screen.getByText('Nessun problema da sistemare: il Coaching non ha niente da suggerire.')).toBeInTheDocument();
    expect(document.querySelector('.coach-empty .eevee-moment.happy')).not.toBeNull();
    expect(document.querySelector('.coach-empty-areas')).toHaveTextContent(`Offesa ${Math.round(before.strength!)} · Difesa ${Math.round(before.defense!)}`);
    await user.click(screen.getByRole('button', { name: 'Esporta per Showdown' }));
    expect(h.onExport).toHaveBeenCalledTimes(1);
    // "Team copiato per Showdown" lo dice l'avviso dell'app (DoneToast, in App): qui la spunta sul pulsante
    expect(await screen.findByRole('button', { name: 'Esporta per Showdown' })).toContainElement(document.querySelector('.coach-btn .icon'));
    await user.click(screen.getByRole('button', { name: 'Vedi la Panoramica' }));
    expect(h.onOverview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Proposte, dalla più utile' })).toBeNull();
  });

  it('problemi che nessuna proposta risolve: Eevee pensieroso, i problemi che restano e Migliora i set', async () => {
    const user = userEvent.setup();
    const h = view(advice([]));
    expect(screen.getByRole('heading', { name: 'Nessuna sostituzione singola li risolve' })).toBeInTheDocument();
    expect(screen.getByText('Restano questi problemi, ma cambiare un solo Pokémon non basta.')).toBeInTheDocument();
    expect(document.querySelector('.coach-empty .eevee-moment.thinking')).not.toBeNull();
    const chips = within(screen.getByRole('list', { name: 'Problemi che restano' })).getAllByRole('listitem');
    // Il ruolo mancante ha la sua pillola
    expect(chips.map(c => c.querySelector('.area-chip')!.getAttribute('data-key'))).toEqual([fire.key, zapdos.key, pivot.key, steel.key]);
    expect(screen.getByText(/Migliora i set cerca le versioni migliori/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    expect(h.onImproveSets).toHaveBeenCalledTimes(1);
  });

  it('con meno di 2 membri: solo l\'invito ad aggiungere', () => {
    view(null, { members: 1, coaching: coachingOf([]) });
    expect(screen.getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(screen.queryByText('Il team è a posto')).toBeNull();
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    view(advice([]), { coaching: coachingOf([], { bannedCount: 1 }) });
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });

  it('coi consigli veri: ogni proposta del motore compare (fra righe e alternative), il +N di ogni riga è quello del motore', () => {
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const adv = adviceOf(six, DEFAULT_FORMAT, data);
    const groups = proposalGroups(coaching.problems, adv);
    expect(groups.length).toBeGreaterThan(0);
    renderIt(<CoachingView coaching={coaching} advice={adv} members={6} rating={rateTeam(six, data, 'it')} {...noop} />);
    expect(list().querySelector('.coach-count')).toHaveTextContent(String(groups.length));
    rows().forEach((li, i) => expect(li.querySelector('.coach-gain b')).toHaveTextContent(gainText(groups[i].options[0].fix.gain)));
  });
});

describe('proposta di mossa nell\'editor', () => {
  it('"Apri il set": si apre l\'editor del membro con la proposta; Applica cambia la mossa, Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const row = await findRow(user, MOVE);
    const [, to, member, gain] = MOVE.exec(row.getAttribute('aria-label')!)!;
    await user.click(within(row).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    expect(card).toBeTruthy();
    // Il fuoco va su Applica
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Applica' }));
    const note = within(card).getByText(/^Proposta del coach: /);
    expect(note).toHaveTextContent(`${to}`);
    expect(note).toHaveTextContent(gain);
    const field = card.querySelector('.field.is-proposed')!;
    expect(field).toBeTruthy();
    const slot = [...card.querySelectorAll('.editor-group.moves .field')].indexOf(field);
    const input = () => within(card).getAllByRole('combobox', { name: /^Mossa \d$/ })[slot] as HTMLInputElement;
    const before = input().value;
    expect(before).not.toBe(to);
    await user.click(within(card).getByRole('button', { name: 'Applica' }));
    expect(input().value).toBe(to);
    expect(card.querySelector('.move-proposal')).toBeNull();
    const toast = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(toast).toHaveTextContent(`${member}: ${before || '—'} → ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(input().value).toBe(before);
  });

  it('Applica sulla riga: la mossa cambia subito, senza editor; Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const row = await findRow(user, MOVE);
    const [, to, member] = MOVE.exec(row.getAttribute('aria-label')!)!;
    await user.click(within(row).getByRole('button', { name: /^Applica: / }));
    expect(document.querySelector('.slot.open')).toBeNull();
    const toast = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(toast).toHaveTextContent(`${member}: `);
    expect(toast).toHaveTextContent(`→ ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(document.querySelector('.undo-toast')).toBeNull();
  });

  it('Annulla della proposta: nessun cambio, la proposta sparisce, l\'editor resta aperto', async () => {
    const user = await openCoaching(fixable);
    const row = await findRow(user, MOVE);
    const member = MOVE.exec(row.getAttribute('aria-label')!)![2];
    await user.click(within(row).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    await user.click(within(card).getByRole('button', { name: 'Annulla' }));
    expect(card.querySelector('.move-proposal')).toBeNull();
    expect(card.querySelector('.is-proposed')).toBeNull();
    expect(document.querySelector('.slot.open')).toBe(card);
    expect(document.querySelector('.undo-toast')).toBeNull();
  });

  it('team compresso: "Apri il set" apre comunque l\'editor con la proposta e lo slot evidenziato', async () => {
    const user = await openCoaching(fixable);
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    const row = await findRow(user, MOVE);
    const member = MOVE.exec(row.getAttribute('aria-label')!)![2];
    await user.click(within(row).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    expect(card).toBeTruthy();
    expect(card.querySelector('.move-proposal')).not.toBeNull();
    expect(card.querySelector('.field.is-proposed')).not.toBeNull();
  });

  // Il clic su una proposta vecchia (membro uscito o slot cambiato) non è raggiungibile dalla UI: dopo ogni modifica
  // i consigli si ricalcolano e la riga sparisce; la guardia in App.openMoveFix non ha un punto d'ingresso nei test.
  it('rimosso il membro, nessuna proposta resta aperta', async () => {
    const user = await openCoaching(fixable);
    const row = await findRow(user, MOVE);
    const member = MOVE.exec(row.getAttribute('aria-label')!)![2];
    await user.click(screen.getByRole('button', { name: new RegExp(`^Rimuovi ${member}`) }));
    expect(document.querySelector('.move-proposal')).toBeNull();
    expect(document.querySelector('.undo-toast')).toHaveTextContent('rimosso');
  });
});
