import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PROPOSALS_PER_ROUND, type FillChoice, type Proposal } from '../../src/engine/fillProposals';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { FillPanel } from '../../src/ui/FillPanel';
import { fillData } from '../fixtures/fillData';
import { renderIt } from '../helpers/italian';

/** streamFill finto: le richieste restano aperte finché il test non manda le proposte e la fine. */
const calls = vi.hoisted(() => [] as {
  choice: FillChoice; shown: string[][]; max?: number; cancelled: boolean;
  push: (p: Proposal) => void; end: (exhausted?: boolean) => void;
}[]);
vi.mock('../../src/ui/useRanking', () => ({
  streamFill: (_team: unknown, choice: FillChoice, shown: string[][], _format: unknown, _data: unknown,
    onProposal: (p: Proposal) => void, options: { max?: number } = {}) => {
    type Done = { shown: string[][]; failed: boolean; exhausted: boolean };
    let resolve!: (done: Done) => void;
    const done = new Promise<Done>(r => { resolve = r; });
    // La storia dopo il giro: quella ricevuta più le forme dei nuovi di ogni proposta consegnata (come streamFill)
    const delivered: string[][] = [];
    const after = () => [...shown, ...delivered];
    const call = { choice, shown: [...shown], max: options.max, cancelled: false,
      push: (p: Proposal) => { delivered.push(p.added.map(s => s.species.toLowerCase())); onProposal(p); },
      end: (exhausted = false) => resolve({ shown: after(), failed: false, exhausted }) };
    calls.push(call);
    return { done, cancel: () => { call.cancelled = true; resolve({ shown: after(), failed: false, exhausted: false }); } };
  },
}));

const proposal = (n: number): Proposal => {
  const added = Array.from({ length: 6 }, (_, i) => ({ ...emptySet(['Garchomp', 'Toxapex', 'Kingambit', 'Blissey', 'Dragapult', 'Corviknight'][i]), item: `x${n}` }));
  return { added, team: added, overall: 90 - n, grade: 'A', archetype: 'balance', styles: [], gaps: [], changed: [], favorites: 0, areas: [], roles: { covered: 0, total: 0 } };
};
const live = () => calls.filter(c => !c.cancelled);
const main = () => live().filter(c => c.max === undefined);
const checks = () => calls.filter(c => c.max === 1);

describe('Completa team: ordine dei calcoli e proposta migliore', () => {
  it('i controlli "questo tipo ha proposte?" partono solo dopo la prima proposta del giro', async () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    expect(main()).toHaveLength(1);
    expect(checks()).toHaveLength(0);
    await act(async () => { main()[0].push(proposal(0)); });
    expect(checks().length).toBeGreaterThanOrEqual(1);
  });

  it('la migliore del primo giro: riga segnata e Usa magenta solo lì', async () => {
    calls.length = 0;
    const user = userEvent.setup();
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {
      for (let i = 0; i < PROPOSALS_PER_ROUND; i++) main()[0].push(proposal(i));
      main()[0].end();
    });
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(1);
    expect(document.querySelectorAll('.fill-add.primary')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    const next = main()[main().length - 1];
    await act(async () => { next.push(proposal(7)); });
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(1);
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(0);
    expect(document.querySelectorAll('.fill-add.primary')).toHaveLength(0);
  });

  it('un giro corto fermato dai tentativi lascia attivo "Altre proposte", senza dire che sono finiti', async () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {
      for (let i = 0; i < 3; i++) main()[0].push(proposal(i));
      main()[0].end(false);
    });
    expect(screen.getByRole('button', { name: 'Altre proposte' })).toBeEnabled();
    expect(screen.queryByText('Non ci sono altri Pokémon nuovi per questa scelta')).toBeNull();
  });

  it('quando i Pokémon nuovi sono finiti "Altre proposte" si spegne e lo si dice', async () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => {
      for (let i = 0; i < 3; i++) main()[0].push(proposal(i));
      main()[0].end(true);
    });
    expect(screen.getByRole('button', { name: 'Altre proposte' })).toBeDisabled();
    expect(screen.getByText('Non ci sono altri Pokémon nuovi per questa scelta')).toBeInTheDocument();
  });

  it('frecce dei giri: spente all’inizio, Altre proposte apre la pagina 2, ‹ torna alla 1 senza ricalcolare', async () => {
    calls.length = 0;
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={onApply} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    const prev = () => screen.getByRole('button', { name: 'Proposte precedenti' });
    const next = () => screen.getByRole('button', { name: 'Proposte successive' });
    const pageText = () => screen.getByRole('navigation', { name: 'Giri di proposte' }).querySelector('[aria-live]')!;
    expect(prev()).toBeDisabled();
    expect(next()).toBeDisabled();
    expect(pageText()).toHaveTextContent('Pagina 1 di 1');
    await act(async () => {
      for (let i = 0; i < PROPOSALS_PER_ROUND; i++) main()[0].push(proposal(i));
      main()[0].end();
    });
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(PROPOSALS_PER_ROUND);
    expect(prev()).toBeDisabled();
    expect(next()).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    const second = main()[main().length - 1];
    await act(async () => { second.push(proposal(20)); second.push(proposal(21)); second.end(); });
    expect(pageText()).toHaveTextContent('Pagina 2 di 2');
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(2);
    // Pagina 2: posti vuoti al posto degli scheletri, nessun magenta
    expect(document.querySelectorAll('.fill-proposals > li')).toHaveLength(PROPOSALS_PER_ROUND);
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(0);
    expect(prev()).toBeEnabled();
    expect(next()).toBeDisabled();
    const before = calls.length;
    await user.click(prev());
    expect(calls.length).toBe(before);
    expect(pageText()).toHaveTextContent('Pagina 1 di 2');
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(PROPOSALS_PER_ROUND);
    expect(document.querySelectorAll('.fill-proposal.is-best')).toHaveLength(1);
    expect(document.querySelectorAll('.fill-skeleton')).toHaveLength(0);
    // "Usa" funziona anche sulle pagine di prima
    await user.click(screen.getByRole('button', { name: 'Usa la proposta 2' }));
    expect((onApply.mock.calls[0][0] as Proposal).overall).toBe(89);
    expect(next()).toBeEnabled();
    await user.click(next());
    expect(calls.length).toBe(before);
    expect(document.querySelectorAll('.fill-proposal')).toHaveLength(2);
    expect(next()).toBeDisabled();
  });

  it('Altre proposte passa la storia delle proposte già mostrate; cambiando scelta riparte vuota', async () => {
    calls.length = 0;
    const user = userEvent.setup();
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    expect(main()[0].shown).toEqual([]);
    await act(async () => { main()[0].push(proposal(0)); main()[0].push(proposal(1)); main()[0].end(); });
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    const second = main()[main().length - 1];
    const ids = ['garchomp', 'toxapex', 'kingambit', 'blissey', 'dragapult', 'corviknight'];
    expect(second.shown).toEqual([ids, ids]);
    await act(async () => { second.push(proposal(2)); second.end(); });
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    expect(main()[main().length - 1].shown).toEqual([ids, ids, ids]);
    await user.click(screen.getByRole('radio', { name: 'Balance' }));
    expect(main()[main().length - 1].shown).toEqual([]);
  });

  it('cambiando scelta le pagine ripartono da 1', async () => {
    calls.length = 0;
    const user = userEvent.setup();
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => { main()[0].push(proposal(0)); main()[0].end(); });
    await user.click(screen.getByRole('button', { name: 'Altre proposte' }));
    await act(async () => { const c = main()[main().length - 1]; c.push(proposal(5)); c.end(); });
    expect(screen.getByRole('button', { name: 'Proposte precedenti' })).toBeEnabled();
    await user.click(screen.getByRole('radio', { name: 'Balance' }));
    expect(screen.getByRole('button', { name: 'Proposte precedenti' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Proposte successive' })).toBeDisabled();
    expect(screen.getByRole('navigation', { name: 'Giri di proposte' })).toHaveTextContent('1/1');
    expect(document.querySelectorAll('.fill-proposals > li')).toHaveLength(PROPOSALS_PER_ROUND);
  });

  it('la condizione "Qualsiasi" (nessun requisito) è la prima e parte scelta', () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    const any = within(screen.getByRole('radiogroup', { name: 'Condizione' })).getAllByRole('radio')[0];
    expect(any).toHaveAccessibleName('Qualsiasi');
    expect(any).toHaveAttribute('aria-checked', 'true');
    expect(any).toHaveAccessibleDescription('Va bene ogni condizione, anche nessuna');
    expect(screen.queryByRole('radio', { name: 'Nessuna' })).toBeNull();
  });
});

describe('Completa team: voto di adesso e perché delle proposte', () => {
  const withAreas = (n: number, areas: [string, number][], covered: number): Proposal => ({
    ...proposal(n),
    areas: areas.map(([key, value]) => ({ key: key as Proposal['areas'][number]['key'], label: key, value })),
    roles: { covered, total: 14 },
  });

  it('col team vuoto niente voto di adesso, e il perché dice le due aree più forti', async () => {
    calls.length = 0;
    renderIt(<FillPanel team={[]} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    await act(async () => { main()[0].push(withAreas(0, [['defense', 80], ['strength', 71], ['speed', 60]], 12)); });
    expect(document.querySelector('.fill-now')).toBeNull();
    const why = document.querySelector('.fill-proposal .fill-why')!;
    expect(why).toHaveTextContent('Difesa 80');
    expect(why).toHaveTextContent('Offesa 71');
    expect(why).not.toHaveTextContent('Velocità');
  });

  it('col team il voto di adesso sta in testa e il perché dice il guadagno più grande e i Ruoli in più', async () => {
    calls.length = 0;
    const team = [{ ...emptySet('Garchomp'), moves: ['Earthquake', 'Dragon Claw', 'Swords Dance', 'Fire Fang'] }];
    renderIt(<FillPanel team={team} format={DEFAULT_FORMAT} data={fillData} onApply={vi.fn()} onLoadTeam={vi.fn()} onClose={vi.fn()} />);
    // Per i lettori di schermo la frase intera, a vista "Ora D 25"
    expect(screen.getByText(/^Il voto del tuo team adesso: [SABCD] \d+$/)).toBeInTheDocument();
    expect(document.querySelector('.fill-now [aria-hidden="true"]')).toHaveTextContent(/^Ora [SABCD] \d+$/);
    await act(async () => { main()[0].push(withAreas(0, [['defense', 100], ['strength', 100], ['speed', 100]], 14)); });
    const why = document.querySelector('.fill-proposal .fill-why')!;
    expect(why.querySelectorAll(':scope > span')).toHaveLength(2);
    expect(why).toHaveTextContent(/(Difesa|Offesa|Velocità) \+\d+/);
    expect(why).toHaveTextContent('Ruoli 14/14');
  });
});
