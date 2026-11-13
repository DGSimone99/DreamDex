import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, type Coaching, type CoachProblem } from '../../src/engine/coach';
import { columnOf, MAX_STEPS, stepNumbers } from '../../src/engine/coachSteps';
import type { MoveFix } from '../../src/engine/moveFixes';
import { needLabel, type Need } from '../../src/engine/needs';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { CoachingView, gainText } from '../../src/ui/CoachingView';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';
import { renderIt } from '../helpers/italian';

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
const three = six.slice(0, 3);
// Per i test delle aggiunte: con Great Tusk, Gholdengo e Toxapex le sostituzioni di Toxapex battono ogni aggiunta e nessuna
// tappa propone "Aggiungi"; con questo trio le prime tappe sono uno scambio (Great Tusk) e due aggiunte (Corviknight, Rotom-Wash)
const trio = ['Gholdengo', 'Toxapex', 'Kingambit'].map(n => mostCommonSet(fixtureStats, n)!);
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };

const analysis = () => screen.getByRole('region', { name: 'Analisi' });
// "Suggerimenti" della scheda Pokémon (anche il Coaching ha una sezione con questo nome, dentro Analisi)
const suggestions = () => screen.getAllByRole('region', { name: 'Suggerimenti' }).find(r => !analysis().contains(r))!;

/** Importa il team, apre Analisi e la scheda Coaching. */
async function openCoaching(team: TeamSet[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(exportShowdown(team));
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
  return user;
}

/** Il pulsante "Vedi alternative" accanto alla proposta `button` (fuori dal pulsante della proposta). */
const alternativesOf = (button: HTMLElement) => within(button.closest<HTMLElement>('.coach-prop')!).getByRole('button', { name: /^Vedi alternative a / });

/** Il "+N" della riga del candidato nella lista di Sostituisci. */
const rowGain = (species: string) => {
  const row = [...suggestions().querySelectorAll<HTMLElement>('.suggestions li')]
    .find(li => li.querySelector('.name-line strong')?.textContent?.replace(/^\d+\. /, '') === species)!;
  expect(row).toBeTruthy();
  return /\(([^)]+)\)$/.exec(within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!)![1];
};

describe('scheda Coaching', () => {
  it('la mappa mette i gravi prima dei minori, nella colonna della loro area', async () => {
    await openCoaching(six);
    expect(within(analysis()).getByRole('group', { name: 'Regole' })).toHaveTextContent('Mosse non legali');
    expect(within(analysis()).getByRole('group', { name: 'Difesa' })).toHaveTextContent('In difesa: Scoperti');
  });

  it('clic su un sostituto: scheda Pokémon, quel membro da sostituire, il candidato aperto, stesso +N', async () => {
    const user = await openCoaching(six);
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, member, species, gain] = /^Al posto di (.+): (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(alternativesOf(button));
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
    const type = () => within(suggestions()).getByRole('combobox', { name: 'Tipo di team' }) as HTMLSelectElement;
    const recognised = type().value;
    await user.selectOptions(type(), recognised === 'stall' ? 'hyperOffense' : 'stall');
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, , species, gain] = /^Al posto di (.+): (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(alternativesOf(button));
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(type().value).toBe(recognised);
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('team di 3: un candidato da aggiungere apre Aggiungi con lui nel dettaglio, stesso +N', async () => {
    const user = await openCoaching(trio);
    const button = within(analysis()).getAllByRole('button', { name: /^Aggiungi .+, \+\d+$/ })[0];
    const [, species, gain] = /^Aggiungi (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(alternativesOf(button));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('clic su un sostituto: lo applica subito (stessa scheda), avviso con Annulla che riporta il membro', async () => {
    const user = await openCoaching(six);
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, member, species] = /^Al posto di (.+): (.+), \+\d+$/.exec(button.getAttribute('aria-label')!)!;
    const cards = () => [...document.querySelectorAll('.slot.filled .slot-card')].map(el => el.textContent ?? '');
    expect(cards().some(text => text.includes(member))).toBe(true);
    await user.click(button);
    // Resta su Analisi; il membro è sostituito
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    expect(cards().some(text => text.includes(member))).toBe(false);
    expect(cards().some(text => text.includes(species))).toBe(true);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(member);
    expect(toast).toHaveTextContent(species);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(cards().some(text => text.includes(member))).toBe(true);
    expect(cards().some(text => text.includes(species))).toBe(false);
  });

  it('team di 3: clic su un candidato da aggiungere lo aggiunge, Annulla lo toglie', async () => {
    const user = await openCoaching(trio);
    const button = within(analysis()).getAllByRole('button', { name: /^Aggiungi .+, \+\d+$/ })[0];
    const species = /^Aggiungi (.+), \+\d+$/.exec(button.getAttribute('aria-label')!)![1];
    const filled = () => document.querySelectorAll('.slot.filled').length;
    await user.click(button);
    expect(filled()).toBe(4);
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(`${species} aggiunto`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(filled()).toBe(3);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    // Nella Panoramica: come giudizio e nel "Cosa fare" del cruscotto
    expect(within(analysis()).getAllByText('Aggiungi almeno 2 Pokémon per ricevere il coaching').length).toBeGreaterThan(0);
    // Anche nella scheda Coaching, non "nessun problema"
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
    expect(within(analysis()).getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(within(analysis()).queryByText('Nessun problema: il team è a posto.')).toBeNull();
  });
});

describe('CoachingView', () => {
  const rating = (team: TeamSet[]) => rateTeam(team, data, 'it');
  const noop = { onFix: () => {}, onMoveFix: () => {}, onApplyFix: () => {}, onApplyMove: () => {} };
  const view = (team: TeamSet[], over: Partial<Parameters<typeof CoachingView>[0]> = {}) => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, data);
    const advice = adviceOf(team, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={advice} members={team.length} rating={rating(team)} metaOn {...noop} {...over} />);
    return { coaching, advice };
  };
  const stepsRegion = () => screen.getByRole('region', { name: 'Suggerimenti' });

  it('le tappe: al massimo 3, numerate, nell\'ordine dei consigli', () => {
    const { advice } = view(six);
    const items = within(stepsRegion()).getAllByRole('listitem');
    const shown = advice!.steps.slice(0, MAX_STEPS);
    expect(shown.length).toBeGreaterThan(0);
    expect(items).toHaveLength(shown.length);
    items.forEach((item, i) => {
      expect(item.querySelector('.coach-step-num')).toHaveTextContent(String(i + 1));
      // I ruoli mancanti dicono "Manca …"; la copertura l'etichetta (scudo o spada, "Scoperto" / "Coperto poco") e il soggetto,
      // al posto della frase del problema
      const { problem } = shown[i];
      const missing = (problem.key === 'roles:important' || problem.key === 'roles:essential') && (problem.subjects?.length ?? 0) > 0;
      const cover = ['defense', 'meta', 'coverage', 'metaHit'].includes(problem.category) && problem.subjects?.length === 1;
      const side = problem.category === 'defense' || problem.category === 'meta' ? 'In difesa:' : 'In attacco:';
      const title = missing ? 'Manca' : cover ? problem.subjects![0] : problem.text.replace(/\s+/g, ' ').slice(0, 10);
      const el = item.querySelector('.coach-step-problem');
      expect(el).toHaveTextContent(title);
      if (cover) expect(el!.querySelector('.coach-cover')).toHaveTextContent(new RegExp(`^${side} (Scopert[oi]|Copert[oi] poco)$`));
    });
  });

  it('i pulsanti di ogni tappa hanno il +N: il clic applica il cambio, "Vedi alternative" porta alle alternative', async () => {
    const onFix = vi.fn();
    const onMoveFix = vi.fn();
    const onApplyFix = vi.fn();
    const onApplyMove = vi.fn();
    const { advice } = view(six, { onFix, onMoveFix, onApplyFix, onApplyMove });
    const user = userEvent.setup();
    const shown = advice!.steps.slice(0, MAX_STEPS);
    const items = within(stepsRegion()).getAllByRole('listitem');
    let moves = 0;
    for (const [i, step] of shown.entries()) {
      if (step.swap) {
        const label = step.swap.kind === 'add' ? `Aggiungi ${step.swap.species}, +${step.swap.gain}`
          : `Al posto di ${step.swap.member}: ${step.swap.species}, +${step.swap.gain}`;
        const button = within(items[i]).getByRole('button', { name: label });
        await user.click(button);
        expect(onApplyFix).toHaveBeenLastCalledWith(step.swap);
        expect(onFix).not.toHaveBeenCalledWith(step.swap);
        await user.click(within(items[i]).getByRole('button', { name: `Vedi alternative a ${step.swap.species}` }));
        expect(onFix).toHaveBeenLastCalledWith(step.swap);
        // Niente pulsanti dentro i pulsanti
        expect(button.querySelector('button')).toBeNull();
      }
      if (step.move) {
        moves++;
        const button = within(items[i]).getByRole('button', { name: `Dai ${step.move.to} a ${step.move.member}, +${step.move.gain}` });
        await user.click(button);
        expect(onApplyMove).toHaveBeenLastCalledWith(step.move);
        await user.click(alternativesOf(button));
        expect(onMoveFix).toHaveBeenLastCalledWith(step.move);
      }
    }
    expect(onFix).toHaveBeenCalled();
    expect(onApplyFix).toHaveBeenCalled();
    expect(moves).toBeGreaterThanOrEqual(0);
  });

  it('"risolve anche": i problemi della proposta tranne quello della tappa, niente riga se vuoto', () => {
    const { advice } = view(six);
    const shown = advice!.steps.slice(0, MAX_STEPS);
    const items = within(stepsRegion()).getAllByRole('listitem');
    let any = false;
    shown.forEach((step, i) => {
      const expected = [step.swap, step.move].filter(p => p && p.solves.some(k => k !== step.problem.key)).length;
      if (expected) any = true;
      expect(items[i].querySelectorAll('.coach-also')).toHaveLength(expected);
      items[i].querySelectorAll('.coach-also').forEach(line => expect(line).toHaveTextContent('risolve anche'));
    });
    expect(any).toBe(true);
  });

  it('proposta di mossa: etichetta, "al posto di" (o slot vuoto) e clic con onMoveFix', async () => {
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const advice = adviceOf(six, DEFAULT_FORMAT, data);
    const [p1, p2] = coaching.problems;
    const base = { index: 0, member: 'Great Tusk', set: six[0], reduces: [] };
    const withFrom: MoveFix = { ...base, slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [p1.key] };
    const empty: MoveFix = { ...base, index: 1, member: 'Gholdengo', set: six[1], slot: 3, from: '', to: 'Thunderbolt', gain: 2, solves: [p2.key] };
    const steps = [withFrom, empty].map((move, i) => ({ problem: [p1, p2][i], swap: null, move, alsoSolves: [], group: [[p1, p2][i].key] }));
    const onMoveFix = vi.fn();
    const onApplyMove = vi.fn();
    renderIt(<CoachingView coaching={coaching} advice={{ ...advice, steps }} members={6} rating={rating(six)} metaOn onFix={() => {}} onMoveFix={onMoveFix}
      onApplyFix={() => {}} onApplyMove={onApplyMove} />);
    const user = userEvent.setup();
    const a = within(stepsRegion()).getByRole('button', { name: 'Dai Knock Off a Great Tusk, +4' });
    expect(a).toHaveTextContent('al posto di Rapid Spin');
    const b = within(stepsRegion()).getByRole('button', { name: 'Dai Thunderbolt a Gholdengo, +2' });
    expect(b).not.toHaveTextContent('al posto di');
    await user.click(a);
    expect(onApplyMove).toHaveBeenLastCalledWith(withFrom);
    await user.click(b);
    expect(onApplyMove).toHaveBeenLastCalledWith(empty);
    await user.click(alternativesOf(a));
    expect(onMoveFix).toHaveBeenLastCalledWith(withFrom);
  });

  it('"risolve anche" dice cosa risolve: tipi, ruoli, minacce, membri', () => {
    const problem = (category: CoachProblem['category'], key: string, subjects?: string[]): CoachProblem =>
      ({ severity: 'minor', category, text: key, fixes: [], key, ...(subjects ? { subjects } : {}) });
    const problems = [
      problem('roles', 'roles:x'), problem('defense', 'defense:Ground', ['Ground']), problem('coverage', 'coverage', ['Water', 'Fire']),
      problem('roles', 'roles:essential', ['hazards']), problem('meta', 'meta:Zamazenta', ['Zamazenta']), problem('rules', 'rules:x', ['Dragapult']),
      { ...problem('redundancy', 'redundancy:y', ['Water']), text: '3 membri di tipo Acqua' },
    ];
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
    const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: problems.slice(1).map(p => p.key) };
    const step = { problem: problems[0], swap, move: null, alsoSolves: [], group: [problems[0].key] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [step] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const also = stepsRegion().querySelector('.coach-also')!;
    expect(also.querySelectorAll('.type-icons img')).toHaveLength(3);
    expect(also).toHaveTextContent('Zamazenta');
    expect(also).toHaveTextContent('Dragapult');
    expect(also).toHaveTextContent(needLabel('hazards' as Need, 'it'));
    // Doppioni e simili: il problema detto per intero, non il tipo da solo ("Water")
    expect(also.textContent).toContain('3 membri di tipo Acqua');
    expect(also.textContent).not.toContain('Ridondanza');
    expect([...also.querySelectorAll('.coach-also-name')].map(n => n.textContent)).not.toContain('Water');
  });

  it('nessun nome di candidato compare due volte nelle tappe, nessun membro riceve due mosse', () => {
    const { advice } = view(six);
    const text = stepsRegion().textContent!;
    const shown = advice!.steps.slice(0, MAX_STEPS);
    const names = shown.map(s => s.swap?.species).filter(Boolean) as string[];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(text.split(name).length - 1).toBe(1);
    const members = shown.map(s => s.move?.member).filter(Boolean) as string[];
    expect(new Set(members).size).toBe(members.length);
    const buttons = within(stepsRegion()).queryAllByRole('button', { name: /^Dai / });
    expect(buttons).toHaveLength(members.length);
    for (const member of members) expect(buttons.filter(b => b.getAttribute('aria-label')!.includes(` a ${member}, `))).toHaveLength(1);
  });

  it('a pari voto "±0", mai "+0"', () => {
    expect([gainText(3), gainText(0), gainText(-2)]).toEqual(['+3', '±0', '−2']);
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: six[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 0, solves: [coaching.problems[0].key] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: coaching.problems[0], swap: null, move, alsoSolves: [], group: [coaching.problems[0].key] }] }}
      members={6} rating={rating(six)} metaOn {...noop} />);
    const button = within(stepsRegion()).getByRole('button', { name: 'Dai Knock Off a Great Tusk, ±0' });
    expect(button).toHaveTextContent('±0');
    expect(stepsRegion()).not.toHaveTextContent('+0');
  });

  it('nessuna tappa ma problemi: una riga che lo dice al posto delle tappe', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(stepsRegion()).toHaveTextContent('Nessun cambio singolo risolve questi problemi');
    expect(stepsRegion().querySelector('.coach-steps-none')).not.toBeNull();
    expect(within(stepsRegion()).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('"risolve anche" non mette fra le minacce risolte il candidato stesso', () => {
    const problem = (category: CoachProblem['category'], key: string, subjects: string[]): CoachProblem =>
      ({ severity: 'minor', category, text: key, fixes: [], key, subjects });
    const problems = [problem('defense', 'defense:Fire', ['Fire']), problem('meta', 'meta:Ogerpon-Wellspring', ['Ogerpon-Wellspring']), problem('meta', 'meta:Zapdos', ['Zapdos'])];
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
    const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
    const swap = { ...base, species: 'Ogerpon-Wellspring', solves: problems.map(p => p.key) };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: problems[0], swap, move: null, alsoSolves: [], group: [problems[0].key] }] }}
      members={3} rating={rating(three)} metaOn {...noop} />);
    const also = stepsRegion().querySelector('.coach-also')!;
    expect([...also.querySelectorAll<HTMLElement>('.coach-also-mon')].map(m => m.title)).toEqual(['meta:Zapdos']);
    expect(also).toHaveTextContent('In difesa: Scoperto');
    expect(also).not.toHaveTextContent('Ogerpon-Wellspring');
  });

  it('titolo della tappa: un problema di difesa dice scudo e "Scoperto" col nome del tipo', () => {
    const fire: CoachProblem = { severity: 'serious', category: 'defense', text: 'Scoperto in difesa contro Fire: nessuno regge bene i suoi colpi',
      fixes: [], key: 'defense:Fire', subjects: ['Fire'], counts: { held: 0 } };
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [fire] };
    const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: [fire.key] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: fire, swap, move: null, alsoSolves: [], group: [fire.key] }] }}
      members={3} rating={rating(three)} metaOn {...noop} />);
    const title = stepsRegion().querySelector('.coach-step-problem')!;
    expect(title).toHaveTextContent('In difesa: Scoperto Fire');
    expect(title.querySelector('.coach-cover.is-def .coach-side')).toHaveAttribute('aria-hidden', 'true');
    expect(title.querySelectorAll('.type-icons img')).toHaveLength(1);
    expect(title).not.toHaveTextContent('regge');
  });

  it('"risolve anche" con tante coperture: segmenti con l\'etichetta, al massimo 5 icone, il resto nel +N', () => {
    const p = (over: Partial<CoachProblem> & Pick<CoachProblem, 'key' | 'category'>): CoachProblem =>
      ({ severity: 'minor', text: over.key, fixes: [], ...over });
    const fire = p({ key: 'defense:Fire', category: 'defense', severity: 'serious', subjects: ['Fire'] });
    const weak = ['Water', 'Ice', 'Ground', 'Psychic'].map(type =>
      p({ key: `defense:${type}`, category: 'defense', subjects: [type], text: `Coperto poco in difesa contro ${type}: pochi reggono bene i suoi colpi` }));
    const threats = ['Zapdos', 'Kingambit', 'Garchomp'].map(species =>
      p({ key: `meta:${species}`, category: 'meta', subjects: [species], text: `Scoperto in difesa contro ${species}: nessuno regge bene i suoi colpi` }));
    const role = p({ key: 'roles:important', category: 'roles', subjects: ['pivot'], text: 'Ruoli importanti mancanti: Pivot' });
    const problems = [fire, ...weak, ...threats, role];
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
    const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], species: 'Rotom-Wash', solves: problems.map(x => x.key) };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: fire, swap, move: null, alsoSolves: [], group: [fire.key] }] }}
      members={3} rating={rating(three)} metaOn {...noop} />);
    const also = stepsRegion().querySelector('.coach-also')!;
    // Prima gli scoperti (le 3 minacce), poi i coperti poco (2 dei 4 tipi): 5 icone in tutto
    const segments = [...also.querySelectorAll<HTMLElement>('.coach-also-cover')];
    expect(segments.map(s => s.querySelector('.coach-cover')!.textContent)).toEqual(['In difesa: Scoperti', 'In difesa: Coperti poco']);
    expect([...segments[0].querySelectorAll<HTMLElement>('.coach-also-mon')].map(m => m.title)).toEqual(threats.map(t => t.text));
    expect([...segments[1].querySelectorAll<HTMLElement>('.coach-also-type')].map(t => t.title)).toEqual(weak.slice(0, 2).map(w => w.text));
    expect(also.querySelectorAll('.coach-also-mon, .coach-also-type')).toHaveLength(5);
    // Il ruolo come nome; i 2 tipi che non stanno nel "+2", col testo intero nel title
    expect(also.querySelector('.coach-also-name')).toHaveTextContent('Pivot');
    const more = also.querySelector<HTMLElement>('.coach-also-more')!;
    expect(more).toHaveTextContent('+2');
    expect(more.title).toContain(weak[2].text);
    expect(more.title).toContain(weak[3].text);
    // Il problema della tappa non torna in "risolve anche"
    expect(also.querySelector('[title^="defense:Fire"]')).toBeNull();
  });

  describe('strisce dei suggerimenti', () => {
    const strip = (over: { swap?: boolean; move?: boolean; add?: boolean; from?: string }) => {
      const coaching = coachTeam(three, DEFAULT_FORMAT, data);
      const problem = coaching.problems[0];
      const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
      const swap = over.swap === false ? null
        : over.add ? { ...base, kind: 'add' as const, member: null, species: 'Rotom-Wash', solves: [problem.key] }
        : { ...base, kind: 'swap' as const, member: 'Great Tusk', species: 'Rotom-Wash', solves: [problem.key] };
      const move: MoveFix | null = over.move ? { index: 1, member: 'Gholdengo', set: three[1], reduces: [], slot: 1, from: over.from ?? '', to: 'Thunderbolt', gain: 1, solves: [problem.key] } : null;
      const step = { problem, swap, move, alsoSolves: [], group: [problem.key] };
      const handlers = { onFix: vi.fn(), onMoveFix: vi.fn(), onApplyFix: vi.fn(), onApplyMove: vi.fn() };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [step] }} members={3} rating={rating(three)} metaOn {...handlers} />);
      return { step, handlers, li: within(stepsRegion()).getByRole('listitem') };
    };

    it('una sola proposta principale per striscia: il suo pulsante applica lo scambio', async () => {
      const { step, handlers, li } = strip({ move: true });
      expect(li).toHaveClass('coach-strip');
      expect(li.querySelectorAll('.coach-prop.is-main')).toHaveLength(1);
      await userEvent.setup().click(within(li.querySelector<HTMLElement>('.coach-prop.is-main')!).getByRole('button', { name: /^Al posto di Great Tusk: Rotom-Wash/ }));
      expect(handlers.onApplyFix).toHaveBeenLastCalledWith(step.swap);
    });

    it('il pulsante principale dice nel title chi esce (lo sprite spento è sotto il pulsante)', () => {
      const { li } = strip({});
      const main = within(li.querySelector<HTMLElement>('.coach-prop.is-main')!).getByRole('button', { name: /^Al posto di Great Tusk/ });
      expect(main.getAttribute('title')).toContain('Great Tusk');
      expect(main.getAttribute('title')).toContain('Rotom-Wash');
    });

    it('clic nella colonna "risolve anche" applica la proposta principale; il pulsante "oppure" solo la mossa', async () => {
      const { step, handlers, li } = strip({ move: true });
      const user = userEvent.setup();
      await user.click(li.querySelector<HTMLElement>('.coach-strip-extras')!);
      expect(handlers.onApplyFix).toHaveBeenLastCalledWith(step.swap);
      expect(handlers.onApplyMove).not.toHaveBeenCalled();
      await user.click(within(li.querySelector<HTMLElement>('.coach-prop.is-side')!).getByRole('button', { name: /^Dai Thunderbolt/ }));
      expect(handlers.onApplyMove).toHaveBeenLastCalledWith(step.move);
      expect(handlers.onApplyFix).toHaveBeenCalledTimes(1);
    });

    it('tappa sui ruoli mancanti: "Manca" coi ruoli, senza "Ruoli importanti mancanti"', () => {
      const problem: CoachProblem = { severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot, Rimozione Strumenti', fixes: [],
        key: 'roles:important', subjects: ['pivot', 'itemRemoval'] };
      const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [problem] };
      const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: [problem.key] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem, swap, move: null, alsoSolves: [], group: [problem.key] }] }} members={3}
        rating={rating(three)} metaOn {...noop} />);
      const title = stepsRegion().querySelector('.coach-step-problem')!;
      expect(title).toHaveTextContent(`Manca ${needLabel('pivot' as Need, 'it')}, ${needLabel('itemRemoval' as Need, 'it')}`);
      expect(title).not.toHaveTextContent('Ruoli importanti mancanti');
    });

    it('tappa con sola mossa: la mossa è la proposta principale', async () => {
      const { step, handlers, li } = strip({ swap: false, move: true });
      const main = li.querySelector<HTMLElement>('.coach-prop.is-main')!;
      const button = within(main).getByRole('button', { name: /^Dai / });
      await userEvent.setup().click(button);
      expect(handlers.onApplyMove).toHaveBeenLastCalledWith(step.move);
      expect(li.querySelectorAll('.coach-alt')).toHaveLength(1);
      expect(li.querySelector('.coach-strip-extras .coach-prop')).toBeNull();
    });

    it('tappa con scambio e mossa: "oppure" dentro la barra principale, col membro, la mossa vecchia e la nuova, senza +N suo', () => {
      const { li } = strip({ move: true, from: 'Shadow Ball' });
      const or = li.querySelector<HTMLElement>('.coach-prop.is-main .coach-prop.is-side')!;
      expect(or.querySelector('.coach-gain')).toBeNull();
      expect(or).toHaveAttribute('data-or', 'oppure');
      expect(li.querySelector('.coach-strip-extras .coach-prop')).toBeNull();
      expect(within(or).getByRole('button', { name: /^Dai Thunderbolt/ })).toBeInTheDocument();
      expect(or.querySelector('.coach-move-old')).toHaveTextContent('Shadow Ball');
      expect(or.querySelector('.coach-move-new')).toHaveTextContent('Thunderbolt');
      expect(or.querySelector('.sprite, img')).not.toBeNull();
      expect(li.querySelectorAll('.coach-alt')).toHaveLength(2);
    });

    it('passando sull\'alternativa la mappa resta com\'è e "risolve anche" si svuota; uscendo torna quello dello scambio', () => {
      const coaching = coachTeam(three, DEFAULT_FORMAT, data);
      const [p1, p2, p3] = coaching.problems;
      const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
      const swap = { ...base, kind: 'swap' as const, member: 'Great Tusk', species: 'Rotom-Wash', solves: [p1.key, p2.key] };
      const move: MoveFix = { index: 1, member: 'Gholdengo', set: three[1], reduces: [], slot: 1, from: '', to: 'Thunderbolt', gain: 1, solves: [p1.key, p3.key] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: p1, swap, move, alsoSolves: [], group: [p1.key] }] }} members={3}
        rating={rating(three)} metaOn {...noop} />);
      const li = within(stepsRegion()).getByRole('listitem');
      const also = () => li.querySelector('.coach-strip-extras')!.textContent;
      const before = also();
      // Il +N grande della barra: quello dello scambio, sulla mossa quello della mossa
      const gain = () => li.querySelector('.coach-strip-gain')!.textContent;
      expect(gain()).toBe(`+${swap.gain}`);
      const lit = () => [...document.querySelectorAll<HTMLElement>('.is-solved-preview[data-key]')].map(e => e.dataset.key).sort();
      fireEvent.mouseEnter(li.querySelector('.coach-prop.is-main')!);
      const onSwap = lit();
      fireEvent.mouseEnter(li.querySelector('.coach-prop.is-side')!);
      expect(also()).toBe('');
      expect(lit()).toEqual(onSwap);
      expect(li.querySelector('.coach-strip-extras')).toHaveClass('is-alt');
      expect(li).toHaveClass('is-alt-hot');
      expect(gain()).toBe('+1');
      fireEvent.mouseLeave(li.querySelector('.coach-prop.is-side')!);
      expect(also()).toBe(before);
      expect(gain()).toBe(`+${swap.gain}`);
    });

    it('puntatore sul pulsante principale (che copre la striscia): anteprima di tutta la tappa; sulla mossa "oppure" la mappa non cambia', async () => {
      const coaching = coachTeam(three, DEFAULT_FORMAT, data);
      const [p1, p2] = coaching.problems;
      const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
      const swap = { ...base, kind: 'swap' as const, member: 'Great Tusk', species: 'Rotom-Wash', solves: [p1.key] };
      const move: MoveFix = { index: 1, member: 'Gholdengo', set: three[1], reduces: [], slot: 1, from: '', to: 'Thunderbolt', gain: 1, solves: [p2.key] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: p1, swap, move, alsoSolves: [], group: [p1.key] }] }} members={3}
        rating={rating(three)} metaOn {...noop} />);
      const lit = () => [...document.querySelectorAll<HTMLElement>('.is-solved-preview[data-key]')].map(li => li.dataset.key).sort();
      const user = userEvent.setup();
      await user.hover(within(stepsRegion()).getByRole('button', { name: /^Al posto di Great Tusk: Rotom-Wash/ }));
      expect(lit()).toEqual([p1.key, p2.key].sort());
      await user.hover(within(stepsRegion()).getByRole('button', { name: /^Dai Thunderbolt/ }));
      expect(lit()).toEqual([p1.key, p2.key].sort());
    });

    it('scambio: chi esce in piccolo, chi entra fermo anche col puntatore (o il fuoco) sulla striscia', async () => {
      const { li } = strip({});
      expect(li.querySelector('.coach-strip-out .sprite')).not.toBeNull();
      expect(li.querySelector('.coach-strip-in .sprite-ani')).toBeNull();
      const user = userEvent.setup();
      await user.hover(li);
      expect(li.querySelector('.coach-strip-in .sprite-ani')).toBeNull();
      act(() => within(li).getByRole('button', { name: /^Al posto di Great Tusk/ }).focus());
      expect(li.querySelector('.coach-strip-in .sprite-ani')).toBeNull();
    });

    it('aggiunta: nessuno esce, resta "Aggiungi"', () => {
      const { li } = strip({ add: true });
      expect(li.querySelector('.coach-strip-out')).toBeNull();
      expect(li.querySelector('.coach-prop.is-main')).toHaveTextContent('Aggiungi');
    });
  });

  it('le tessere dei problemi vengono prima dei suggerimenti', () => {
    view(six);
    const map = screen.getByRole('region', { name: 'Problemi per area' });
    expect(map.compareDocumentPosition(stepsRegion()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('difesa: i tipi in righe per "Scoperti" / "Coperti poco" e gravità (non per quanti reggono), un\'icona per tipo col testo intero nel title', () => {
    const text = 'Coperto poco in difesa contro Ground: pochi reggono bene i suoi colpi';
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [
        { severity: 'minor', category: 'defense', text, fixes: [], key: 'defense:Ground', subjects: ['Ground'], counts: { held: 1 } },
        { severity: 'serious', category: 'defense', text: 'Scoperto in difesa contro Ice: nessuno regge bene i suoi colpi', fixes: [], key: 'defense:Ice', subjects: ['Ice'], counts: { held: 0 } },
        { severity: 'serious', category: 'defense', text: 'Scoperto in difesa contro Fire: nessuno regge bene i suoi colpi', fixes: [], key: 'defense:Fire', subjects: ['Fire'], counts: { held: 1 } },
      ] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const group = screen.getByRole('group', { name: 'Difesa' });
    const rows = [...group.querySelectorAll<HTMLElement>('li.coach-group')];
    // Fire è retto da 1 come Ground, ma è grave: sta con Ice fra gli scoperti
    expect(rows.map(r => r.querySelector('.coach-group-label')!.textContent)).toEqual(['In difesa: Scoperti', 'In difesa: Coperti poco']);
    expect(rows.map(r => r.dataset.group)).toEqual(['defense:def:uncovered:serious', 'defense:def:half:minor']);
    expect(rows[0].querySelector('.coach-cover.is-def .coach-side')).toHaveAttribute('aria-hidden', 'true');
    expect([...rows[0].querySelectorAll<HTMLElement>('[data-key]')].map(c => c.dataset.key)).toEqual(['defense:Ice', 'defense:Fire']);
    expect(rows[0]).toHaveClass('serious');
    const ground = rows[1].querySelector<HTMLElement>('[data-key="defense:Ground"]')!;
    expect(ground.querySelectorAll('.type-icons img')).toHaveLength(1);
    expect(ground).toHaveAttribute('title', text);
  });

  it('ruoli mancanti nella tessera: una pillola per ruolo con la ×, senza "Ruoli importanti mancanti"', () => {
    const text = 'Ruoli importanti mancanti: Rimozione Strumenti, Pivot';
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'roles', text, fixes: [], key: 'roles:important', subjects: ['itemRemoval', 'pivot'] }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const pills = [...screen.getByRole('group', { name: 'Ruoli' }).querySelectorAll<HTMLElement>('li[data-key="roles:important"]')];
    expect(pills).toHaveLength(2);
    expect(pills.map(p => p.querySelector('.coach-miss')?.textContent)).toEqual([needLabel('itemRemoval' as Need, 'it'), needLabel('pivot' as Need, 'it')]);
    for (const pill of pills) {
      expect(pill.querySelectorAll('.coach-miss')).toHaveLength(1);
      expect(pill.querySelector('.coach-miss .icon')).not.toBeNull();
      expect(pill.getAttribute('title')).toContain(text);
    }
  });

  it('pillola lunga: title col testo intero', () => {
    const text = 'Great Tusk non è legale in National Dex OU perché la sua abilità è vietata dal formato scelto';
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'serious', category: 'rules', text, fixes: [], key: 'rules:x' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(screen.getByRole('group', { name: 'Regole' }).querySelector('li.coach-prob[data-key="rules:x"]')).toHaveAttribute('title', text);
  });

  it('mappa: le pillole che non stanno nella tessera vanno nel "+N"; restano prima le risolvibili, poi le gravi', () => {
    // Misura finta: la tessera è alta 130px, testata 40px, ogni pillola (e il "+N") 30px
    const tall = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return this.classList.contains('coach-tile') ? 130 : 0; });
    const scroll = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('coach-tile') ? 40 + 30 * this.querySelectorAll('li.coach-prob, .coach-more').length : 0;
    });
    try {
      const p = (name: string, fixes: string[] = []): CoachProblem =>
        ({ severity: 'minor', category: 'roles', text: `Manca ${name}`, fixes, key: `roles:${name}` });
      const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
        problems: [p('Zapdos'), p('Kyurem'), p('Heatran', ['Rotom-Wash']), p('Garchomp')] };
      const onOpen = vi.fn();
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn onOpen={onOpen} {...noop} />);
      const tile = screen.getByRole('group', { name: 'Ruoli' });
      // Prima la risolvibile (Heatran), poi l'ordine di partenza
      expect([...tile.querySelectorAll('li.coach-prob')].map(li => li.getAttribute('data-key'))).toEqual(['roles:Zapdos', 'roles:Heatran']);
      const more = within(tile).getByRole('button', { name: /^e altri 2/ });
      expect(more).toHaveClass('coach-more');
      expect(more).toHaveAttribute('title', 'Manca Kyurem\nManca Garchomp');
      expect(more.querySelector('.visually-hidden')).toHaveTextContent('Altri 2 problemi: Manca Kyurem; Manca Garchomp');
      fireEvent.click(more);
      expect(onOpen).toHaveBeenCalledWith('roles');
    } finally {
      tall.mockRestore();
      scroll.mockRestore();
    }
  });

  it('mappa: le righe di coverage hanno le icone dei tipi, i nomi senza colore', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [
        { severity: 'serious', category: 'coverage', text: 'Scoperto Water: nessun colpo super efficace', fixes: [], key: 'coverage:Water', size: 2, subjects: ['Water'] },
        { severity: 'minor', category: 'coverage', text: 'Coperto a metà Fire: 1 solo in tre colpi', fixes: [], key: 'coverage:Fire', size: 1, subjects: ['Fire'] },
      ] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    // Una riga per problema (spada e "Scoperti", "Coperti poco") con un'icona per tipo, senza nomi colorati
    const offense = screen.getByRole('group', { name: 'Offesa' });
    expect([...offense.querySelectorAll('.coach-group-label')].map(l => l.textContent)).toEqual(['In attacco: Scoperti', 'In attacco: Coperti poco']);
    expect(offense.querySelectorAll('.coach-group-label .coach-cover.is-atk')).toHaveLength(2);
    for (const type of ['Water', 'Fire']) {
      const chip = offense.querySelector(`[data-key="coverage:${type}"]`)!;
      expect(chip.querySelectorAll('.type-icons img')).toHaveLength(1);
      expect(chip.querySelector('.type-name, .type-dot')).toBeNull();
    }
  });

  it("mappa: l'icona della minaccia dice la % d'uso nel title, senza dato resta com'è", () => {
    const problem = (species: string): CoachProblem => ({ severity: 'minor', category: 'meta', text: `meta:${species}`, fixes: [], key: `meta:${species}`, subjects: [species] });
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [problem('Zapdos'), problem('Ogerpon-Wellspring')] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn threatUsage={{ Zapdos: 0.142 }} {...noop} />);
    const group = screen.getByRole('group', { name: 'Difesa' });
    expect(group.querySelector('[data-key="meta:Zapdos"]')!.getAttribute('title')).toMatch(/14%$/);
    expect(group.querySelector('[data-key="meta:Ogerpon-Wellspring"]')!.getAttribute('title')).not.toMatch(/%/);
  });

  it('la mappa: le aree col loro voto, le Regole col numero dei problemi', () => {
    const r = rating(six)!;
    view(six);
    for (const [name, key] of [['Difesa', 'defense'], ['Offesa', 'strength']] as const) {
      const group = screen.getByRole('group', { name });
      expect(group.querySelector('.dash-meta')).toHaveTextContent(String(Math.round(r.areas.find(a => a.key === key)!.value!)));
    }
    // I Ruoli non hanno un voto: coperti sul totale, senza barretta
    const roles = screen.getByRole('group', { name: 'Ruoli' });
    expect(roles.querySelector('.dash-meta')).toHaveTextContent(`${r.roles.covered}/${r.roles.total}`);
    expect(roles.querySelector('.coach-tile-bar')).toBeNull();
    // Regole: nessun voto, al suo posto quanti problemi ha
    const rules = screen.getByRole('group', { name: 'Regole' });
    expect(rules.querySelector('.dash-meta')).toHaveTextContent(String(rules.querySelectorAll('li.coach-prob').length + Number(rules.querySelector('.coach-more')?.textContent?.match(/\d+/)?.[0] ?? 0)));
    expect(rules.querySelector('.coach-tile-bar')).toBeNull();
  });

  it('le Regole stanno da sole e si chiamano Regole', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'serious', category: 'rules', text: 'x non è legale', fixes: [], key: 'rules:x' }, threat('Zapdos')] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(screen.getByRole('group', { name: 'Regole' })).not.toHaveTextContent('Zapdos');
    expect(screen.getByRole('group', { name: 'Difesa' })).toHaveTextContent('Zapdos');
    expect(screen.queryByRole('group', { name: 'Regole · Meta' })).toBeNull();
  });

  it("chi nessuno manda KO sta nell'Offesa, nella riga Scoperti con lo sprite", () => {
    const hit = (name: string): CoachProblem => ({ severity: 'minor', category: 'metaHit', text: `Nessuno manda KO ${name} del meta in due colpi`, fixes: [], key: `metaHit:${name}`, subjects: [name] });
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'coverage', text: 'Acciaio colpito poco', fixes: [], key: 'coverage:Steel', subjects: ['Steel'] }, hit('Corviknight')] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn threatUsage={{ Corviknight: 0.2 }} {...noop} />);
    const offense = screen.getByRole('group', { name: 'Offesa' });
    const chip = offense.querySelector<HTMLElement>('.coach-chip.is-mon[data-key="metaHit:Corviknight"]')!;
    expect(chip.closest('li')!.querySelector('.coach-group-label')).toHaveTextContent('Scoperti');
    expect(chip.getAttribute('title')).toMatch(/Corviknight.*20%/);
  });

  it('ogni problema compare una volta nella colonna di columnOf, gravi prima; i coperti sono is-covered', () => {
    const { coaching, advice } = view(six);
    const names = { defense: 'Difesa', offense: 'Offesa', roles: 'Ruoli', rules: 'Regole' };
    const numbers = stepNumbers(advice!.steps);
    const unique = [...new Map(coaching.problems.map(p => [`${p.key}|${p.text}`, p])).values()];
    let total = 0;
    for (const col of ['defense', 'offense', 'roles', 'rules'] as const) {
      // Un'area senza problemi non ha tessera (sta nella riga verde)
      const group = screen.queryByRole('group', { name: names[col] });
      if (!group) { expect(unique.filter(p => columnOf(p.category) === col)).toHaveLength(0); continue; }
      // I ruoli mancanti hanno una pillola per ruolo, tutte con la chiave del problema: una riga per chiave
      // Una riga, o un'icona in una riga di tipi, per chiave
      const rows = [...group.querySelectorAll<HTMLElement>('[data-key]')].filter((li, i, all) => all.findIndex(o => o.dataset.key === li.dataset.key) === i);
      const expected = unique.filter(p => columnOf(p.category) === col);
      expect(rows).toHaveLength(expected.length);
      total += rows.length;
      for (const row of rows) {
        const p = expected.find(e => e.key === row.dataset.key)!;
        expect(p).toBeTruthy();
        expect(row.classList.contains('is-covered')).toBe(numbers.has(p.key));
        if (numbers.has(p.key)) expect(row.closest('li')!.querySelector('.coach-by')?.textContent ?? row.closest('li')!.textContent).toContain(String(numbers.get(p.key)));
      }
      const sev = [...group.querySelectorAll<HTMLElement>('li.coach-prob')].map(r => r.classList.contains('serious'));
      expect(sev).toEqual([...sev].sort((x, y) => Number(y) - Number(x)));
    }
    expect(total).toBe(unique.length);
  });

  const threat = (name: string): CoachProblem => ({ severity: 'minor', category: 'meta', text: `Scoperto in difesa contro ${name}: nessuno regge bene i suoi colpi`, fixes: [], key: `meta:${name}`, subjects: [name] });
  /** Tessera alta 130px, testata 40px, ogni pillola (e il "+N") 30px: ci stanno 2 pillole e il "+N". */
  const smallTiles = () => {
    const tall = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) { return this.classList.contains('coach-tile') ? 130 : 0; });
    const scroll = vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('coach-tile') ? 40 + 30 * this.querySelectorAll('li.coach-prob, .coach-more').length : 0;
    });
    return () => { tall.mockRestore(); scroll.mockRestore(); };
  };

  it('minacce: lo sprite, col nome e l\'uso nel title e per i lettori di schermo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [threat('Latios-Mega')] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn threatUsage={{ 'Latios-Mega': 0.05 }} {...noop} />);
    const chip = document.querySelector<HTMLElement>('.coach-chip.is-mon[data-key="meta:Latios-Mega"]')!;
    expect(chip.getAttribute('title')).toMatch(/Latios-Mega.*5%/);
    expect(chip.querySelector('.visually-hidden')).toHaveTextContent(/Latios-Mega.*5%/);
  });

  it('minacce che nessuno regge: una riga sola, scudo e "Scoperti", con gli sprite in fila, dal più usato', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: ['A', 'B', 'C', 'D'].map(threat) };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn
      threatUsage={{ A: 0.1, B: 0.3, C: 0.2, D: 0.05 }} {...noop} />);
    const rows = screen.getByRole('group', { name: 'Difesa' }).querySelectorAll('li.coach-group');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.coach-group-label')).toHaveTextContent('In difesa: Scoperti');
    expect(rows[0].querySelector('.coach-cover.is-def')).not.toBeNull();
    expect([...rows[0].querySelectorAll<HTMLElement>('[data-key]')].map(c => c.dataset.key)).toEqual(['meta:B', 'meta:C', 'meta:A', 'meta:D']);
  });

  it('meta spento: il +N di Regole resta una nota', () => {
    const restore = smallTiles();
    try {
      const rule = (n: string): CoachProblem => ({ severity: 'serious', category: 'rules', text: `${n} non è legale`, fixes: [], key: `rules:${n}`, subjects: [n] });
      const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: ['A', 'B', 'C', 'D'].map(rule) };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn={false} onOpen={vi.fn()} {...noop} />);
      const tile = screen.getByRole('group', { name: 'Regole' });
      expect(tile.querySelector('.coach-more')).not.toBeNull();
      expect(within(tile).queryByRole('button', { name: /^e altri/ })).toBeNull();
    } finally { restore(); }
  });

  it('il +N è un link solo se la scheda che apre contiene quei problemi (ridondanze nei Ruoli: resta una nota)', () => {
    const restore = smallTiles();
    try {
      const red = (n: string): CoachProblem => ({ severity: 'minor', category: 'redundancy', text: `${n} doppio`, fixes: [], key: `redundancy:${n}` });
      const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: ['A', 'B', 'C', 'D'].map(red) };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn onOpen={vi.fn()} {...noop} />);
      const tile = screen.getByRole('group', { name: 'Ruoli' });
      expect(tile.querySelector('.coach-more')).not.toBeNull();
      expect(within(tile).queryByRole('button', { name: /^e altri/ })).toBeNull();
    } finally { restore(); }
  });

  it('passando su un suggerimento, i problemi che risolve salgono in cima alla tessera (anche quelli nel +N)', () => {
    const restore = smallTiles();
    try {
      const own: CoachProblem = { severity: 'serious', category: 'rules', text: 'x non è legale', fixes: [], key: 'rules:x' };
      const role = (n: string): CoachProblem => ({ severity: 'minor', category: 'roles', text: `Manca ${n}`, fixes: [], key: `roles:${n}` });
      const problems = [own, ...['A', 'B', 'C', 'D'].map(role), threat('Zapdos')];
      const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
      const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: ['rules:x', 'roles:D', 'meta:Zapdos'] };
      const step = { problem: own, swap, move: null, alsoSolves: [], group: [own.key] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [step] }} members={3} rating={rating(three)} metaOn {...noop} />);
      const keys = () => [...screen.getByRole('group', { name: 'Ruoli' }).querySelectorAll('li.coach-prob')].map(li => li.getAttribute('data-key'));
      expect(keys()).toEqual(['roles:A', 'roles:B']);
      fireEvent.mouseEnter(stepsRegion().querySelector('li.coach-step')!);
      expect(keys()[0]).toBe('roles:D');
      // Le minacce: si accende l'icona di quella che risolve
      expect(document.querySelector('[data-key="meta:Zapdos"]')).toHaveClass('is-solved-preview');
      fireEvent.mouseLeave(stepsRegion().querySelector('li.coach-step')!);
      expect(keys()).toEqual(['roles:A', 'roles:B']);
    } finally { restore(); }
  });

  it("tessera: la barra del titolo apre la scheda dell'area; le Regole no", () => {
    const onOpen = vi.fn();
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [threat('Zapdos'), { severity: 'serious', category: 'rules', text: 'x non è legale', fixes: [], key: 'rules:x' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn onOpen={onOpen} {...noop} />);
    const head = screen.getByRole('group', { name: 'Difesa' }).querySelector<HTMLElement>('.coach-tile-head')!;
    expect(head).toHaveClass('dash-head', 'is-link');
    fireEvent.click(within(head).getByRole('button', { name: 'Apri la scheda Difesa' }));
    expect(onOpen).toHaveBeenCalledWith('defense');
    const rules = screen.getByRole('group', { name: 'Regole' }).querySelector<HTMLElement>('.coach-tile-head')!;
    expect(rules).toHaveClass('dash-head');
    expect(rules).not.toHaveClass('is-link');
  });

  it('le debolezze in comune non stanno nella mappa (lo dice già la Difesa); gli altri doppioni sì', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [
      { severity: 'minor', category: 'redundancy', text: '2 deboli a Ghost, 0 resistono', fixes: [], key: 'redundancy:sharedWeak:Ghost' },
      { severity: 'minor', category: 'redundancy', text: '3 membri di tipo Acciaio', fixes: [], key: 'redundancy:sameType:Steel' },
    ] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const roles = screen.getByRole('group', { name: 'Ruoli' });
    expect(roles).not.toHaveTextContent('deboli a Ghost');
    expect(roles).toHaveTextContent('3 membri di tipo Acciaio');
  });

  it('"risolve anche" non ripete le debolezze in comune: basta l\'icona del tipo', () => {
    const own: CoachProblem = { severity: 'serious', category: 'rules', text: 'x non è legale', fixes: [], key: 'rules:x' };
    const ghost: CoachProblem = { severity: 'serious', category: 'defense', text: 'Spettro', fixes: [], key: 'defense:Ghost', subjects: ['Ghost'] };
    const shared: CoachProblem = { severity: 'minor', category: 'redundancy', text: '2 deboli a Ghost, 0 resistono', fixes: [], key: 'redundancy:sharedWeak:Ghost' };
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [own, ghost, shared] };
    const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: [own.key, ghost.key, shared.key] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [{ problem: own, swap, move: null, alsoSolves: [], group: [own.key] }] }}
      members={3} rating={rating(three)} metaOn {...noop} />);
    const extras = stepsRegion().querySelector('.coach-strip-extras')!;
    expect(extras.querySelectorAll('.coach-also-item')).toHaveLength(1);
    expect(extras).not.toHaveTextContent('deboli a Ghost');
  });

  it('aree senza problemi: una riga verde, niente tessera', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: [], key: 'roles:important' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(screen.queryByRole('group', { name: 'Difesa' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Ruoli' })).toBeInTheDocument();
    const clean = document.querySelector('.coach-clean')!;
    expect(clean).toHaveTextContent(/Nessun problema in.*Difesa.*Offesa/);
    expect(clean).not.toHaveTextContent('Ruoli');
    expect(document.querySelector('.coach-map')).toHaveAttribute('data-tiles', '1');
  });

  it('solo minacce del meta: Offesa e Ruoli nella riga verde, la tessera Difesa', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems: [threat('Latios-Mega'), threat('Tapu Koko')] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(document.querySelector('.coach-clean')).toHaveTextContent(/Offesa.*Ruoli/);
    expect(document.querySelector('.coach-clean')).not.toHaveTextContent('Difesa');
    expect(document.querySelector('.coach-map')).toHaveAttribute('data-tiles', '1');
    expect(screen.getByRole('group', { name: 'Difesa' })).toBeInTheDocument();
  });

  it('senza voto la riga verde dice solo i nomi delle aree', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: [], key: 'roles:important' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={null} metaOn {...noop} />);
    expect(document.querySelector('.coach-clean')!.textContent).not.toMatch(/\d/);
  });

  it('ridondanze: sotto un separatore nella colonna Ruoli', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'redundancy', text: '2 rimozioni hazard', fixes: [], key: 'redundancy:x' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const roles = screen.getByRole('group', { name: 'Ruoli' });
    expect(roles).toHaveTextContent('Ridondanze');
    expect(roles).toHaveTextContent('2 rimozioni hazard');
  });

  it('consigli in calcolo: scheletro delle tappe (aria-busy) e mappa già piena', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(stepsRegion().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('group', { name: 'Difesa' })).toHaveTextContent('In difesa: Scoperti');
  });

  it('team di 3: la proposta di Pokémon è "Aggiungi …"', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    const advice = adviceOf(three, DEFAULT_FORMAT, data);
    const add = advice.fixes.find(f => f.kind === 'add')!;
    expect(add).toBeTruthy();
    const problem = coaching.problems.find(p => add.solves.includes(p.key)) ?? coaching.problems[0];
    const step = { problem, swap: add, move: null, alsoSolves: [], group: [problem.key] };
    renderIt(<CoachingView coaching={coaching} advice={{ ...advice, steps: [step] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const button = within(stepsRegion()).getByRole('button', { name: `Aggiungi ${add.species}, +${add.gain}` });
    expect(button).toHaveTextContent(`Aggiungi ${add.species}`);
  });

  it('con meno di 2 membri: solo l\'invito ad aggiungere', () => {
    const coaching = coachTeam([six[0]], DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={1} rating={null} metaOn {...noop} />);
    expect(screen.getByText('Aggiungi almeno 2 Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('senza meta nessuna minaccia del meta scoperta', () => {
    const coaching = coachTeam(three, { ...DEFAULT_FORMAT, meta: false }, { ...data, ignoreMeta: true });
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} rating={rating(three)} metaOn={false} {...noop} />);
    expect(coaching.problems.some(p => p.category === 'meta')).toBe(false);
    expect(document.querySelector('[data-key^="meta:"]')).toBeNull();
  });

  it('col meta le minacce che nessuno regge stanno nella colonna Difesa', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} rating={rating(three)} metaOn {...noop} />);
    const open = coaching.problems.filter(p => p.category === 'meta');
    expect(open.length).toBeGreaterThan(0);
    for (const p of open) expect(screen.getByRole('group', { name: 'Difesa' })).toHaveTextContent(p.text);
  });

  it('nessun problema: un messaggio positivo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {} };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={6} rating={rating(six)} metaOn {...noop} />);
    expect(screen.getByText('Nessun problema: il team è a posto.')).toBeInTheDocument();
  });

  describe('tappa con debolezze raggruppate e anteprima nella mappa', () => {
    const weak = (type: string): CoachProblem => ({ severity: 'minor', category: 'defense', text: `Coperto poco in difesa contro ${type}: pochi reggono bene i suoi colpi`,
      fixes: [], key: `defense:${type}`, subjects: [type], size: 1, counts: { held: 0 } });
    const problems: CoachProblem[] = [weak('Water'), weak('Ice'), weak('Ghost'),
      { severity: 'minor', category: 'meta', text: 'Scoperto in difesa contro Zapdos: nessuno regge bene i suoi colpi', fixes: [], key: 'meta:Zapdos', subjects: ['Zapdos'] }];
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
    const setup = () => {
      const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
      const swap = { ...base, species: 'Rotom-Wash', solves: ['defense:Water', 'defense:Ice', 'meta:Zapdos'] };
      const move: MoveFix = { index: 0, member: 'Great Tusk', set: three[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 1,
        solves: ['defense:Ghost'] };
      const step = { problem: problems[0], swap, move: null, alsoSolves: ['defense:Ice', 'meta:Zapdos'], group: ['defense:Water', 'defense:Ice'] };
      const step2 = { problem: problems[2], swap: null, move, alsoSolves: [], group: ['defense:Ghost'] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [step, step2] }} members={3} rating={rating(three)} metaOn {...noop} />);
    };
    const previewed = () => [...document.querySelectorAll<HTMLElement>('.is-solved-preview[data-key]')].map(li => li.dataset.key);

    it('titolo: scudo e "Coperti poco" coi tipi raggruppati, senza conteggi; i raggruppati non sono in "risolve anche"', () => {
      setup();
      const [first, second] = within(stepsRegion()).getAllByRole('listitem');
      const title = first.querySelector('.coach-step-problem')!;
      expect(title).toHaveTextContent('In difesa: Coperti poco Water, Ice');
      expect(title).not.toHaveTextContent('regg');
      expect(title.querySelectorAll('.type-icons img')).toHaveLength(2);
      const also = first.querySelector('.coach-also')!;
      expect(also.querySelectorAll('.type-icons img')).toHaveLength(0);
      expect(also).toHaveTextContent('In difesa: Scoperto');
      expect(also.querySelector('.coach-also-mon')).toHaveAttribute('title', 'Scoperto in difesa contro Zapdos: nessuno regge bene i suoi colpi');
      expect(second.querySelector('.coach-step-problem')).toHaveTextContent('In difesa: Coperto poco Ghost');
      expect(second.querySelector('.coach-also')).toBeNull();
    });

    it('di base nessun problema è barrato; puntatore sopra una proposta: solo quelli che risolve, via all\'uscita', async () => {
      setup();
      const user = userEvent.setup();
      expect(previewed()).toEqual([]);
      const swapButton = within(stepsRegion()).getByRole('button', { name: /^(Al posto di .+: |Aggiungi )Rotom-Wash/ });
      await user.hover(swapButton);
      expect(previewed().sort()).toEqual(['defense:Ice', 'defense:Water', 'meta:Zapdos']);
      await user.unhover(swapButton);
      expect(previewed()).toEqual([]);
    });

    it("puntatore sulla tappa: tutto quello che risolvono le sue proposte; sull'alternativa la mappa resta uguale", async () => {
      const base = adviceOf(three, DEFAULT_FORMAT, data).fixes[0];
      const swap = { ...base, kind: 'swap' as const, member: 'Great Tusk', species: 'Rotom-Wash', solves: ['defense:Water', 'defense:Ice'] };
      const move: MoveFix = { index: 1, member: 'Gholdengo', set: three[1], reduces: [], slot: 1, from: '', to: 'Thunderbolt', gain: 1,
        solves: ['defense:Water', 'meta:Zapdos'] };
      const step = { problem: problems[0], swap, move, alsoSolves: ['defense:Ice', 'meta:Zapdos'], group: ['defense:Water'] };
      renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [step] }} members={3} rating={rating(three)} metaOn {...noop} />);
      const user = userEvent.setup();
      const card = within(stepsRegion()).getByRole('listitem');
      await user.hover(card.querySelector('.coach-step-problem')!);
      expect(previewed().sort()).toEqual(['defense:Ice', 'defense:Water', 'meta:Zapdos']);
      await user.hover(within(card).getByRole('button', { name: /^Dai Thunderbolt/ }));
      expect(previewed().sort()).toEqual(['defense:Ice', 'defense:Water', 'meta:Zapdos']);
      await user.hover(card.querySelector('.coach-step-num')!);
      expect(previewed().sort()).toEqual(['defense:Ice', 'defense:Water', 'meta:Zapdos']);
      await user.unhover(card);
      expect(previewed()).toEqual([]);
    });

    it('fuoco da tastiera su una proposta: anteprima; fuori fuoco: niente', () => {
      setup();
      const moveButton = within(stepsRegion()).getByRole('button', { name: /^Dai Knock Off/ });
      act(() => moveButton.focus());
      expect(previewed()).toEqual(['defense:Ghost']);
      act(() => moveButton.blur());
      expect(previewed()).toEqual([]);
    });
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {}, bannedCount: 1 };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], steps: [] }} members={6} rating={rating(six)} metaOn {...noop} />);
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });
});


describe('proposta di mossa nell\'editor', () => {
  const moveButton = () => within(analysis()).getAllByRole('button', { name: /^Dai .+ a .+, (?:\+\d+|±0)$/ })[0];

  it('clic: si apre l\'editor del membro con la proposta; Applica cambia la mossa, Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const [, to, member, gain] = /^Dai (.+) a (.+), (\+\d+|±0)$/.exec(moveButton().getAttribute('aria-label')!)!;
    await user.click(alternativesOf(moveButton()));
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
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(`${member}: ${before || '—'} → ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(input().value).toBe(before);
  });

  it('clic sulla proposta: la mossa cambia subito, senza editor; Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const [, to, member] = /^Dai (.+) a (.+), (?:\+\d+|±0)$/.exec(moveButton().getAttribute('aria-label')!)!;
    await user.click(moveButton());
    expect(document.querySelector('.slot.open')).toBeNull();
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent(`${member}: `);
    expect(toast).toHaveTextContent(`→ ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Annulla della proposta: nessun cambio, la proposta sparisce, l\'editor resta aperto', async () => {
    const user = await openCoaching(fixable);
    await user.click(alternativesOf(moveButton()));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    await user.click(within(card).getByRole('button', { name: 'Annulla' }));
    expect(card.querySelector('.move-proposal')).toBeNull();
    expect(card.querySelector('.is-proposed')).toBeNull();
    expect(document.querySelector('.slot.open')).toBe(card);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('team compresso: il clic apre comunque l editor con la proposta e lo slot evidenziato', async () => {
    const user = await openCoaching(fixable);
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    await user.click(alternativesOf(moveButton()));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    expect(card).toBeTruthy();
    expect(card.querySelector('.move-proposal')).not.toBeNull();
    expect(card.querySelector('.field.is-proposed')).not.toBeNull();
  });

  // Il clic su una proposta vecchia (membro uscito o slot cambiato) non è raggiungibile dalla UI: dopo ogni modifica
  // i consigli si ricalcolano e il pulsante sparisce; la guardia in App.openMoveFix non ha un punto d'ingresso nei test.
  it('rimosso il membro, nessuna proposta resta aperta', async () => {
    const user = await openCoaching(fixable);
    const member = /^Dai .+ a (.+), (?:\+\d+|±0)$/.exec(moveButton().getAttribute('aria-label')!)![1];
    await user.click(screen.getByRole('button', { name: new RegExp(`^Rimuovi ${member}`) }));
    expect(document.querySelector('.move-proposal')).toBeNull();
    expect(screen.queryByRole('status')).toHaveTextContent('rimosso');
  });
});
