import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachProblem } from '../../src/engine/coach';
import type { DashboardData } from '../../src/engine/overviewDashboard';
import { TYPES } from '../../src/engine/types';
import { en } from '../../src/i18n/en';
import { it as itText } from '../../src/i18n/it';
import { densityFor, OverviewDashboard, ROOMY_FROM, TIGHT_BELOW, type Density } from '../../src/ui/OverviewDashboard';
import { renderIt } from '../helpers/italian';

/** Dati costruiti: Terra scoperta in difesa, Normale in offesa, un ruolo mancante, due corsie, tre minacce. */
function sample(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    coverage: {
      cells: TYPES.map(type => ({
        type,
        defense: type === 'Ground' ? 'bad' : type === 'Grass' ? 'minor' : 'ok',
        offense: type === 'Normal' ? 'bad' : 'ok',
        defenseNote: type === 'Ground' ? '3 deboli, 1 resiste' : '1 debole, 2 resistono',
        offenseNote: type === 'Normal' ? 'Nessuno lo colpisce super efficace' : 'Colpito super efficace da 2',
      })),
      defense: '17/18', offense: '17/18',
    },
    roles: {
      chips: [
        { need: 'hazards', level: 'essential', covered: true, owners: ['Great Tusk'] },
        { need: 'removal', level: 'essential', covered: true, owners: ['Great Tusk', 'Corviknight', 'Toxapex'] },
        { need: 'pivot', level: 'important', covered: false, owners: [] },
        { need: 'screens', level: 'minor', covered: false, owners: [] },
      ],
      value: '2/3',
    },
    speed: {
      lanes: [
        { species: 'Dragapult', speed: 421, share: 0.9, above: true, outspeeds: ['Iron Valiant', 'Garchomp'], outspedBy: ['Regieleki'] },
        { species: 'Toxapex', speed: 167, share: 0.1, above: false, outspeeds: ['Dondozo'], outspedBy: ['Corviknight', 'Kingambit'] },
      ],
      median: 300, vsMeta: true, value: '1/2',
      control: [{ condition: 'slow', move: 'Thunder Wave', by: ['Toxapex'] }],
    },
    threats: {
      pods: [{ species: 'Great Tusk', usage: 0.23 }, { species: 'Kyurem', usage: 0.21 }, { species: 'Heatran', usage: 0.17 }],
      total: 20, available: true, metaOff: false,
    },
    ...overrides,
  };
}

const problem = (i: number, severity: CoachProblem['severity'] = 'minor'): CoachProblem =>
  ({ severity, category: i % 2 ? 'defense' : 'roles', text: `Problema numero ${i}`, fixes: [], key: `k${i}` });

function mount({ density = 'normal' as Density, data = sample(), problems = [problem(1, 'serious'), problem(2)], members = 6 } = {}) {
  const onView = vi.fn();
  const onMeta = vi.fn();
  const { unmount } = renderIt(<OverviewDashboard data={data} problems={problems} members={members} onView={onView} onMeta={onMeta} density={density} />);
  return { onView, onMeta, unmount };
}

describe('Cruscotto della Panoramica', () => {
  it('cinque sezioni coi loro titoli', () => {
    mount();
    for (const title of ['Copertura', 'Ruoli', 'Velocità', 'Cosa fare', 'Minacce non gestite']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('Copertura: 18 colonne, caselle col nome di tipo, riga e dettaglio', () => {
    mount();
    const table = screen.getByRole('table', { name: 'Copertura' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(18);
    expect(within(table).getByRole('cell', { name: /^(Terra|Ground), regge: 3 deboli, 1 resiste$/ })).toHaveClass('bad');
    expect(within(table).getByRole('cell', { name: /^(Erba|Grass), regge: 1 debole, 2 resistono$/ })).toHaveClass('minor');
    expect(within(table).getByRole('cell', { name: /^(Normale|Normal), colpisce: nessuno lo colpisce super efficace$/ })).toHaveClass('bad');
    expect(within(table).getByRole('rowheader', { name: 'Regge' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Colpisce' })).toBeInTheDocument();
    expect(screen.queryByText('Chi')).toBeNull();
  });

  it('i link aprono le schede', async () => {
    const user = userEvent.setup();
    const { onView, onMeta } = mount();
    await user.click(screen.getByRole('button', { name: /^Difesa/ }));
    await user.click(screen.getByRole('button', { name: /^Offesa/ }));
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Ruoli' }));
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Velocità' }));
    expect(onView.mock.calls.map(c => c[0])).toEqual(['defense', 'strength', 'roles', 'speed']);
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Meta' }));
    expect(onMeta).toHaveBeenCalled();
  });

  it('densityFor: sotto TIGHT_BELOW stretto, da ROOMY_FROM ampio', () => {
    expect(densityFor(TIGHT_BELOW - 1)).toBe('tight');
    expect(densityFor(TIGHT_BELOW)).toBe('normal');
    expect(densityFor(ROOMY_FROM - 1)).toBe('normal');
    expect(densityFor(ROOMY_FROM)).toBe('roomy');
  });

  it('ampio: Velocità con "supera" e "superato da", Ruoli per livello coi membri', () => {
    mount({ density: 'roomy' });
    const speed = screen.getByRole('region', { name: 'Velocità' });
    expect(within(speed).getByText(/supera Iron Valiant, Garchomp/)).toBeInTheDocument();
    expect(within(speed).getByText(/superato da Regieleki/)).toBeInTheDocument();
    expect(speed).toHaveTextContent(/nessun Trick Room o Tailwind/);
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).getByText('Essenziali')).toBeInTheDocument();
    expect(within(roles).getByText('Minori')).toBeInTheDocument();
    // Rimozione: tre membri, si vedono due icone e "+1"
    expect(within(roles).getByText('+1')).toBeInTheDocument();
  });

  it('stretto: niente "supera", livelli né controllo visibile; minori in coda, tenui', () => {
    mount({ density: 'tight' });
    const speed = screen.getByRole('region', { name: 'Velocità' });
    expect(within(speed).queryByText(/supera /)).toBeNull();
    expect(speed.querySelector('.dash-ctrl')).toBeNull();
    expect(speed).toHaveAttribute('title', expect.stringMatching(/^Controllo:/));
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).queryByText('Essenziali')).toBeNull();
    // Senza layout stanno tutti: essenziali, importanti e in coda il minore (tenue)
    const chips = roles.querySelectorAll('.dash-chip');
    expect(chips).toHaveLength(4);
    expect(chips[3]).toHaveClass('minor');
  });

  it('normale: Ruoli per livello, minori compresi, senza icone dei membri', () => {
    mount();
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).getByText('Essenziali')).toBeInTheDocument();
    expect(within(roles).getByText('Minori')).toBeInTheDocument();
    expect(roles.querySelectorAll('.dash-chip')).toHaveLength(4);
    expect(roles.querySelector('.dash-owners')).toBeNull();
  });

  it('normale: sotto le barre "supera" e "superato da", quante ne stanno', () => {
    mount();
    expect(within(screen.getByRole('region', { name: 'Velocità' })).getByText(/supera Iron Valiant, Garchomp/)).toBeInTheDocument();
  });

  it('ogni corsia della Velocità ha il nome del Pokémon per i lettori di schermo', () => {
    mount({ density: 'tight' });
    const lanes = screen.getByRole('region', { name: 'Velocità' }).querySelectorAll('.dash-lane');
    expect(lanes[0]).toHaveTextContent(/Dragapult.*421/);
    expect(lanes[1]).toHaveTextContent(/Toxapex.*167/);
  });

  it('Cosa fare: la freccia in testata apre il Coaching, anche senza problemi o con un membro', async () => {
    const user = userEvent.setup();
    for (const props of [{}, { problems: [] }, { members: 1, problems: [] }]) {
      const { onView, unmount } = mount(props);
      await user.click(within(screen.getByRole('region', { name: 'Cosa fare' })).getByRole('button', { name: 'Apri la scheda Coaching' }));
      expect(onView).toHaveBeenCalledWith('coaching');
      unmount();
    }
  });

  it('il "?" della Panoramica descrive il cruscotto, non i riquadri', () => {
    expect(itText['help.view.overview']).toMatch(/copertura dei tipi, ruoli, velocità.*cosa fare.*minacce/);
    expect(itText['help.view.overview']).not.toMatch(/riquadr/);
    expect(en['help.view.overview']).toMatch(/type coverage, roles, speed.*what to do.*threats/);
    expect(en['help.view.overview']).not.toMatch(/tile/);
  });

  it('normale: il controllo con chi lo porta', () => {
    mount();
    expect(screen.getByRole('region', { name: 'Velocità' }).querySelector('.dash-ctrl')).toHaveTextContent(/Controllo:.*\(Toxapex\)/);
  });

  it('12 problemi in stretto: "Tutti i 12 nel Coaching" c\'è e porta al Coaching', async () => {
    const user = userEvent.setup();
    const { onView } = mount({ density: 'tight', problems: Array.from({ length: 12 }, (_, i) => problem(i, i < 2 ? 'serious' : 'minor')) });
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    expect(todo).toHaveTextContent(/2 gravi\s*·\s*10 minori/);
    await user.click(within(todo).getByRole('button', { name: /^Tutti i 12 nel Coaching/ }));
    expect(onView).toHaveBeenCalledWith('coaching');
  });

  it('"gli" davanti a 8 e 11', () => {
    mount({ problems: Array.from({ length: 11 }, (_, i) => problem(i)) });
    expect(screen.getByRole('button', { name: /^Tutti gli 11 nel Coaching/ })).toBeInTheDocument();
  });

  it('problema: targhetta di gravità e area come icona col nome', () => {
    mount();
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    const rows = within(todo).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(/grave/i);
    expect(within(rows[0]).getByRole('img', { name: 'Difesa' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('img', { name: 'Ruoli' })).toBeInTheDocument();
  });

  it('un membro: nessun "nessun problema", l\'invito ad aggiungere', () => {
    mount({ members: 1, problems: [] });
    expect(screen.queryByText('Nessun problema da sistemare')).toBeNull();
    expect(screen.getByRole('region', { name: 'Cosa fare' })).toHaveTextContent(/Aggiungi almeno 2 Pokémon/);
  });

  it('nessun problema con sei membri: riga positiva', () => {
    mount({ problems: [] });
    expect(screen.getByText('Nessun problema da sistemare')).toBeInTheDocument();
  });

  it('Minacce: titolo con "N su M", nomi e uso', () => {
    mount();
    const threats = screen.getByRole('region', { name: 'Minacce non gestite' });
    expect(threats).toHaveTextContent(/3 su 20/);
    expect(threats).toHaveTextContent(/Great Tusk.*23\s?%/);
  });

  it('meta spento: "Meta spento" e "media del tier"', () => {
    const base = sample();
    mount({ data: { ...base, speed: { ...base.speed, vsMeta: false }, threats: { pods: [], total: 0, available: false, metaOff: true } } });
    expect(screen.getByRole('region', { name: 'Minacce non gestite' })).toHaveTextContent('Meta spento');
    expect(screen.getByRole('region', { name: 'Velocità' })).toHaveTextContent(/media del tier/);
  });

  it('senza statistiche: "Statistiche non disponibili"', () => {
    mount({ data: { ...sample(), threats: { pods: [], total: 0, available: false, metaOff: false } } });
    expect(screen.getByRole('region', { name: 'Minacce non gestite' })).toHaveTextContent('Statistiche non disponibili');
  });
});

/** ResizeObserver finto: si tengono le callback per lanciarle a mano. */
function stubObservers() {
  const callbacks: (() => void)[] = [];
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: () => void) { callbacks.push(cb); }
    observe() {}
    disconnect() {}
  });
  return () => act(() => { for (const cb of [...callbacks]) cb(); });
}

/** Altezza di ogni elemento (clientHeight) presa da una variabile. */
function stubHeight() {
  const size = { height: 0 };
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => size.height);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => (size.height ? 500 : 0));
  return size;
}

const rect = (top: number, height: number) =>
  ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON() {} }) as DOMRect;

/** Layout finto: per sezione l'altezza del contenitore .dash-fit e quella di ogni voce [data-fit], una sotto l'altra. */
function stubLayout(sizes: Record<string, { box: number; item: number }>, visible = () => true) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // Scheda nascosta (display: none): tutto a zero
    if (!visible()) return rect(0, 0);
    const box = this.closest('.dash-fit');
    const card = box?.closest('.dash-card');
    const size = card && Object.entries(sizes).find(([name]) => card.classList.contains(name))?.[1];
    if (!box || !size) return rect(0, 0);
    if (this === box) return rect(0, size.box);
    const index = [...box.querySelectorAll('[data-fit]')].indexOf(this);
    return index < 0 ? rect(0, 0) : rect(0, (index + 1) * size.item);
  });
}

describe('Cruscotto: misure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("densità dall'altezza; una misura a 0 (scheda nascosta) non la cambia", () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 700;
    renderIt(<OverviewDashboard data={sample()} problems={[]} members={6} onView={vi.fn()} onMeta={vi.fn()} />);
    const dash = document.querySelector('.dash')!;
    expect(dash).toHaveAttribute('data-density', 'roomy');
    size.height = 0;
    fire();
    expect(dash).toHaveAttribute('data-density', 'roomy');
    size.height = 300;
    fire();
    expect(dash).toHaveAttribute('data-density', 'tight');
  });

  it('una misura a 0×0 non rimette tutte le voci: resta l\'ultimo "+N"', () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 400;
    stubLayout({ 'dash-roles': { box: 60, item: 30 } }, () => size.height > 0);
    mount({ density: 'tight' });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).getByText('+3')).toBeInTheDocument();
    size.height = 0;
    fire();
    expect(within(roles).getByText('+3')).toBeInTheDocument();
  });

  it('Ruoli: le chip che non stanno vanno nel "+N"', () => {
    stubLayout({ 'dash-roles': { box: 60, item: 30 } });
    mount({ density: 'tight' });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    // Ne stanno 2, una lascia posto al "+N": 1 chip e "+3"
    expect(roles.querySelectorAll('.dash-chip:not(.more)')).toHaveLength(1);
    expect(within(roles).getByText('+3')).toHaveClass('more');
  });

  it('Minacce: quelle che non stanno nel "+X", che apre la scheda Meta', async () => {
    const user = userEvent.setup();
    stubLayout({ 'dash-threats': { box: 150, item: 50 } });
    const pods = ['Great Tusk', 'Kyurem', 'Heatran', 'Gholdengo', 'Dragonite'].map((species, i) => ({ species, usage: 0.3 - i / 20 }));
    const { onMeta } = mount({ data: sample({ threats: { pods, total: 20, available: true, metaOff: false } }) });
    const threats = screen.getByRole('region', { name: 'Minacce non gestite' });
    expect(threats.querySelectorAll('.dash-pod:not(.more)')).toHaveLength(2);
    const more = within(threats).getByRole('button', { name: /3/ });
    expect(more).toHaveTextContent('+3');
    await user.click(more);
    expect(onMeta).toHaveBeenCalledTimes(1);
  });

  it('Cosa fare: mai meno di 2 problemi, e "Tutti i 12 nel Coaching" resta', () => {
    stubLayout({ 'dash-todo': { box: 30, item: 40 } });
    mount({ density: 'tight', problems: Array.from({ length: 12 }, (_, i) => problem(i)) });
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    expect(todo.querySelectorAll('.dash-problems li')).toHaveLength(2);
    expect(within(todo).getByRole('button', { name: /^Tutti i 12 nel Coaching/ })).toBeVisible();
  });

  it('Cosa fare: quanti ne stanno, se sono più di 2', () => {
    stubLayout({ 'dash-todo': { box: 130, item: 40 } });
    mount({ problems: Array.from({ length: 12 }, (_, i) => problem(i)) });
    expect(screen.getByRole('region', { name: 'Cosa fare' }).querySelectorAll('.dash-problems li')).toHaveLength(3);
  });
});
