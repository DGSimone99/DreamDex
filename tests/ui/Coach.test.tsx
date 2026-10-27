import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, type Coaching, type CoachProblem } from '../../src/engine/coach';
import { columnOf, coveredKeys, MAX_STEPS } from '../../src/engine/coachSteps';
import type { MoveFix } from '../../src/engine/moveFixes';
import { needLabel, type Need } from '../../src/engine/needs';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { AnalysisPanel } from '../../src/ui/AnalysisPanel';
import { CoachingView } from '../../src/ui/CoachingView';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';
import { renderIt } from '../helpers/italian';

// Due membri deboli lasciano spazio ai sostituti delle statistiche di prova (come nei test del motore)
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
const three = six.slice(0, 3);
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };

const analysis = () => screen.getByRole('region', { name: 'Analisi' });
const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });

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

/** Il "+N" della riga del candidato nella lista di Migliora team. */
const rowGain = (species: string) => {
  const row = [...suggestions().querySelectorAll<HTMLElement>('.suggestions li')]
    .find(li => li.querySelector('.name-line strong')?.textContent?.replace(/^\d+\. /, '') === species)!;
  expect(row).toBeTruthy();
  return /\(([^)]+)\)$/.exec(within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!)![1];
};

describe('scheda Coaching', () => {
  it('la mappa mette i gravi prima dei minori, nella colonna della loro area', async () => {
    await openCoaching(six);
    expect(within(analysis()).getByRole('group', { name: 'Regole · Meta' })).toHaveTextContent('Mosse non legali');
    expect(within(analysis()).getByRole('group', { name: 'Difesa' })).toHaveTextContent('Debole a');
  });

  it('clic su un sostituto: scheda Pokémon, quel membro da sostituire, il candidato aperto, stesso +N', async () => {
    const user = await openCoaching(six);
    const button = within(analysis()).getAllByRole('button', { name: /^Al posto di .+: .+, \+\d+$/ })[0];
    const [, member, species, gain] = /^Al posto di (.+): (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(button);
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
    await user.click(button);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(type().value).toBe(recognised);
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('team di 3: un candidato da aggiungere apre Aggiungi con lui nel dettaglio, stesso +N', async () => {
    const user = await openCoaching(three);
    const button = within(analysis()).getAllByRole('button', { name: /^Aggiungi .+, \+\d+$/ })[0];
    const [, species, gain] = /^Aggiungi (.+), \+(\d+)$/.exec(button.getAttribute('aria-label')!)!;
    await user.click(button);
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
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
  const noop = { onFix: () => {}, onMoveFix: () => {} };
  const view = (team: TeamSet[], over: Partial<Parameters<typeof CoachingView>[0]> = {}) => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, data);
    const advice = adviceOf(team, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={advice} members={team.length} rating={rating(team)} metaOn {...noop} {...over} />);
    return { coaching, advice };
  };
  const stepsRegion = () => screen.getByRole('region', { name: 'Cosa farei io' });

  it('le tappe: al massimo 3, numerate, nell\'ordine dei consigli', () => {
    const { advice } = view(six);
    const items = within(stepsRegion()).getAllByRole('listitem');
    const shown = advice!.steps.slice(0, MAX_STEPS);
    expect(shown.length).toBeGreaterThan(0);
    expect(items).toHaveLength(shown.length);
    items.forEach((item, i) => {
      expect(item.querySelector('.coach-step-num')).toHaveTextContent(String(i + 1));
      expect(item.querySelector('.coach-step-problem')).toHaveTextContent(shown[i].problem.text.replace(/\s+/g, ' ').slice(0, 10));
    });
  });

  it('i pulsanti di ogni tappa hanno il +N e portano al cambio', async () => {
    const onFix = vi.fn();
    const onMoveFix = vi.fn();
    const { advice } = view(six, { onFix, onMoveFix });
    const user = userEvent.setup();
    const shown = advice!.steps.slice(0, MAX_STEPS);
    const items = within(stepsRegion()).getAllByRole('listitem');
    let moves = 0;
    for (const [i, step] of shown.entries()) {
      if (step.swap) {
        const label = step.swap.kind === 'add' ? `Aggiungi ${step.swap.species}, +${step.swap.gain}`
          : `Al posto di ${step.swap.member}: ${step.swap.species}, +${step.swap.gain}`;
        await user.click(within(items[i]).getByRole('button', { name: label }));
        expect(onFix).toHaveBeenLastCalledWith(step.swap);
      }
      if (step.move) {
        moves++;
        await user.click(within(items[i]).getByRole('button', { name: `Dai ${step.move.to} a ${step.move.member}, +${step.move.gain}` }));
        expect(onMoveFix).toHaveBeenLastCalledWith(step.move);
      }
    }
    expect(onFix).toHaveBeenCalled();
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
    const steps = [withFrom, empty].map((move, i) => ({ problem: [p1, p2][i], swap: null, move, alsoSolves: [] }));
    const onMoveFix = vi.fn();
    renderIt(<CoachingView coaching={coaching} advice={{ ...advice, steps }} members={6} rating={rating(six)} metaOn onFix={() => {}} onMoveFix={onMoveFix} />);
    const user = userEvent.setup();
    const a = within(stepsRegion()).getByRole('button', { name: 'Dai Knock Off a Great Tusk, +4' });
    expect(a).toHaveTextContent('al posto di Rapid Spin');
    const b = within(stepsRegion()).getByRole('button', { name: 'Dai Thunderbolt a Gholdengo, +2' });
    expect(b).not.toHaveTextContent('al posto di');
    await user.click(a);
    expect(onMoveFix).toHaveBeenLastCalledWith(withFrom);
    await user.click(b);
    expect(onMoveFix).toHaveBeenLastCalledWith(empty);
  });

  it('"risolve anche" dice cosa risolve: tipi, ruoli, minacce, membri', () => {
    const problem = (category: CoachProblem['category'], key: string, subjects?: string[]): CoachProblem =>
      ({ severity: 'minor', category, text: key, fixes: [], key, ...(subjects ? { subjects } : {}) });
    const problems = [
      problem('roles', 'roles:x'), problem('defense', 'defense:Ground', ['Ground']), problem('coverage', 'coverage', ['Water', 'Fire']),
      problem('roles', 'roles:essential', ['fieldSetup']), problem('meta', 'meta:Zamazenta', ['Zamazenta']), problem('rules', 'rules:x', ['Dragapult']),
      problem('redundancy', 'redundancy:y'),
    ];
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems };
    const swap = { ...adviceOf(three, DEFAULT_FORMAT, data).fixes[0], solves: problems.slice(1).map(p => p.key) };
    const step = { problem: problems[0], swap, move: null, alsoSolves: [] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [step] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const also = stepsRegion().querySelector('.coach-also')!;
    expect(also.querySelectorAll('.type-icons img')).toHaveLength(3);
    expect(also).toHaveTextContent('Zamazenta');
    expect(also).toHaveTextContent('Dragapult');
    expect(also).toHaveTextContent(needLabel('fieldSetup' as Need, 'it'));
    // Senza soggetti: il nome breve dell'area
    expect(also).toHaveTextContent('Ridondanza');
  });

  it('nessun nome di candidato compare due volte nelle tappe', () => {
    const { advice } = view(six);
    const text = stepsRegion().textContent!;
    const names = advice!.steps.slice(0, MAX_STEPS).map(s => s.swap?.species).filter(Boolean) as string[];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(text.split(name).length - 1).toBe(1);
  });

  it('la mappa: quattro gruppi col voto dell\'area, nessun voto per Regole · Meta', () => {
    const r = rating(six)!;
    view(six);
    for (const [name, key] of [['Difesa', 'defense'], ['Offesa', 'strength'], ['Ruoli', 'roles']] as const) {
      const group = screen.getByRole('group', { name });
      expect(group.querySelector('.dash-meta')).toHaveTextContent(String(Math.round(r.areas.find(a => a.key === key)!.value!)));
    }
    expect(screen.getByRole('group', { name: 'Regole · Meta' }).querySelector('.dash-meta')).toBeNull();
  });

  it('senza meta il gruppo si chiama Regole', () => {
    view(three, { metaOn: false });
    expect(screen.getByRole('group', { name: 'Regole' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Regole · Meta' })).toBeNull();
  });

  it('ogni problema compare una volta nella colonna di columnOf, gravi prima; i coperti sono is-covered', () => {
    const { coaching, advice } = view(six);
    const names = { defense: 'Difesa', offense: 'Offesa', roles: 'Ruoli', rules: 'Regole · Meta' };
    const covered = coveredKeys(advice!.steps);
    const unique = [...new Map(coaching.problems.map(p => [`${p.key}|${p.text}`, p])).values()];
    let total = 0;
    for (const col of ['defense', 'offense', 'roles', 'rules'] as const) {
      const group = screen.getByRole('group', { name: names[col] });
      const rows = [...group.querySelectorAll<HTMLElement>('li[data-key]')];
      const expected = unique.filter(p => columnOf(p.category) === col);
      expect(rows).toHaveLength(expected.length);
      total += rows.length;
      for (const row of rows) {
        const p = expected.find(e => e.key === row.dataset.key)!;
        expect(p).toBeTruthy();
        expect(row.classList.contains('is-covered')).toBe(covered.has(p.key));
      }
      const sev = rows.map(r => r.classList.contains('serious'));
      expect(sev).toEqual([...sev].sort((x, y) => Number(y) - Number(x)));
    }
    expect(total).toBe(unique.length);
  });

  it('colonna senza problemi: "Nessun problema"', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: [], key: 'roles:important' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(within(screen.getByRole('group', { name: 'Difesa' })).getByText('Nessun problema')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Ruoli' })).queryByText('Nessun problema')).toBeNull();
  });

  it('ridondanze: sotto un separatore nella colonna Ruoli', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], threatFixes: {},
      problems: [{ severity: 'minor', category: 'redundancy', text: '2 rimozioni hazard', fixes: [], key: 'redundancy:x' }] };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={3} rating={rating(three)} metaOn {...noop} />);
    const roles = screen.getByRole('group', { name: 'Ruoli' });
    expect(roles).toHaveTextContent('Ridondanze');
    expect(roles).toHaveTextContent('2 rimozioni hazard');
  });

  it('consigli in calcolo: scheletro delle tappe (aria-busy) e mappa già piena', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} rating={rating(three)} metaOn {...noop} />);
    expect(stepsRegion().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('group', { name: 'Difesa' })).toHaveTextContent('Debole a');
  });

  it('team di 3: la proposta di Pokémon è "Aggiungi …"', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    const advice = adviceOf(three, DEFAULT_FORMAT, data);
    const add = advice.fixes.find(f => f.kind === 'add')!;
    expect(add).toBeTruthy();
    const step = { problem: coaching.problems.find(p => add.solves.includes(p.key)) ?? coaching.problems[0], swap: add, move: null, alsoSolves: [] };
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

  it('senza meta nessun problema "senza un check"', () => {
    const coaching = coachTeam(three, { ...DEFAULT_FORMAT, meta: false }, { ...data, ignoreMeta: true });
    renderIt(<CoachingView coaching={coaching} advice={null} members={3} rating={rating(three)} metaOn={false} {...noop} />);
    expect(screen.queryByText(/senza un check/)).toBeNull();
  });

  it('nessun problema: un messaggio positivo', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {} };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={6} rating={rating(six)} metaOn {...noop} />);
    expect(screen.getByText('Nessun problema: il team è a posto.')).toBeInTheDocument();
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    const coaching: Coaching = { verdict: 'x', teamType: null, strengths: [], problems: [], threatFixes: {}, bannedCount: 1 };
    renderIt(<CoachingView coaching={coaching} advice={{ fixes: [], moves: [], steps: [] }} members={6} rating={rating(six)} metaOn {...noop} />);
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });
});

describe('AnalysisPanel: Coaching e profilo di un membro', () => {
  it('la vista Coaching vince sul membro aperto', () => {
    const coaching = coachTeam(three, DEFAULT_FORMAT, data);
    renderIt(<AnalysisPanel team={three} analysis={analyzeTeam(three, data)} rating={rateTeam(three, data, 'it')} data={data} coaching={coaching}
      view="coaching" onView={() => {}} member={0} onMember={() => {}} />);
    expect(screen.getByRole('group', { name: 'Difesa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Panoramica/ })).toBeNull();
  });
});

describe('proposta di mossa nell\'editor', () => {
  const moveButton = () => within(analysis()).getAllByRole('button', { name: /^Dai .+ a .+, \+\d+$/ })[0];

  it('clic: si apre l\'editor del membro con la proposta; Applica cambia la mossa, Annulla del toast la riporta', async () => {
    const user = await openCoaching(six);
    const [, to, member, gain] = /^Dai (.+) a (.+), \+(\d+)$/.exec(moveButton().getAttribute('aria-label')!)!;
    await user.click(moveButton());
    const card = document.querySelector<HTMLDetailsElement>('details.slot[open]')!;
    expect(card).toBeTruthy();
    const note = within(card).getByText(/^Proposta del coach: /);
    expect(note).toHaveTextContent(`${to}`);
    expect(note).toHaveTextContent(`+${gain}`);
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

  it('Annulla della proposta: nessun cambio, la proposta sparisce, l\'editor resta aperto', async () => {
    const user = await openCoaching(six);
    await user.click(moveButton());
    const card = document.querySelector<HTMLDetailsElement>('details.slot[open]')!;
    await user.click(within(card).getByRole('button', { name: 'Annulla' }));
    expect(card.querySelector('.move-proposal')).toBeNull();
    expect(card.querySelector('.is-proposed')).toBeNull();
    expect(document.querySelector('details.slot[open]')).toBe(card);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('rimosso il membro, nessuna proposta resta aperta', async () => {
    const user = await openCoaching(six);
    const stale = moveButton();
    // Cambia la mossa dell'unico slot proposto prima del clic: il pulsante resta ma la proposta è vecchia
    const member = /^Dai .+ a (.+), \+\d+$/.exec(stale.getAttribute('aria-label')!)![1];
    await user.click(screen.getByRole('button', { name: new RegExp(`^Rimuovi ${member}`) }));
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(document.querySelector('.move-proposal')).toBeNull();
  });
});
