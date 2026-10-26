import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoachProblem } from '../../src/engine/coach';
import type { DashboardData } from '../../src/engine/overviewDashboard';
import { TYPES } from '../../src/engine/types';
import { en } from '../../src/i18n/en';
import { it as itText } from '../../src/i18n/it';
import { densityFor, OverviewDashboard, TIGHT_BELOW, type Density } from '../../src/ui/OverviewDashboard';
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
      members: ['Great Tusk', 'Corviknight', 'Toxapex', 'Dragapult'],
      value: '2/3',
    },
    speed: {
      lanes: [
        { species: 'Dragapult', speed: 421, share: 0.9, above: true },
        { species: 'Toxapex', speed: 167, share: 0.1, above: false },
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

/** Problemi che restano righe singole (Offesa e Ruoli senza gruppo). */
const problem = (i: number, severity: CoachProblem['severity'] = 'minor'): CoachProblem =>
  ({ severity, category: i % 2 ? 'coverage' : 'roles', text: `Problema numero ${i}`, fixes: [], key: `k${i}` });

const weak = (type: string, severity: CoachProblem['severity'] = 'minor'): CoachProblem =>
  ({ severity, category: 'defense', text: `Debole a ${type}: 3 Deboli – 1 Resistono`, fixes: [], key: `defense:${type}`, subjects: [type] });

/** Le righe della tabella dei Ruoli (ampio, senza le intestazioni delle fasce). */
const roleRows = (roles: HTMLElement) => [...roles.querySelectorAll<HTMLElement>('tr.dash-role-row')];

/** La fascia di un livello dei Ruoli (la lista col suo titoletto). */
function roleBand(roles: HTMLElement, title: string) {
  return within(roles).getAllByRole('list').find(list => document.getElementById(list.getAttribute('aria-labelledby') ?? '')?.textContent === title)!;
}

/** Quattro essenziali, due importanti, un minore: per il "+N" per fascia. */
const manyRoles: DashboardData['roles'] = {
  chips: [
    ...(['hazards', 'removal', 'pivot', 'recovery'] as const).map(need => ({ need, level: 'essential' as const, covered: true, owners: ['Great Tusk'] })),
    ...(['screens', 'phazer'] as const).map(need => ({ need, level: 'important' as const, covered: false, owners: [] })),
    { need: 'taunt', level: 'minor', covered: false, owners: [] },
  ],
  members: ['Great Tusk'],
  value: '4/6',
};

/** Solo i quattro essenziali coperti di manyRoles. */
const essentialsOnly: DashboardData['roles'] = { chips: manyRoles.chips.filter(c => c.level === 'essential'), members: ['Great Tusk'], value: '4/4' };

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

  it('Copertura: in testata l\'icona ufficiale di ogni tipo, decorativa, col nome nel tooltip', () => {
    mount();
    const headers = within(screen.getByRole('table', { name: 'Copertura' })).getAllByRole('columnheader');
    headers.forEach((th, i) => {
      const img = th.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toMatch(new RegExp(`${TYPES[i].toLowerCase()}\\.png`));
      expect(img).toHaveAttribute('alt', '');
    });
    expect(headers[TYPES.indexOf('Ground')].getAttribute('title')).toMatch(/^(Terra|Ground)$/);
    expect(headers[TYPES.indexOf('Ground')]).toHaveAccessibleName(/^(Terra|Ground)$/);
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

  it('densityFor (team aperto): sotto TIGHT_BELOW stretto, poi normale a ogni altezza, mai ampio', () => {
    expect(densityFor(TIGHT_BELOW - 1)).toBe('tight');
    expect(densityFor(TIGHT_BELOW)).toBe('normal');
    expect(densityFor(700)).toBe('normal');
    expect(densityFor(2000)).toBe('normal');
  });

  it('Velocità: niente "supera" né "superato da" a nessuna densità', () => {
    for (const density of ['tight', 'normal', 'roomy'] as const) {
      const { unmount } = mount({ density });
      const speed = screen.getByRole('region', { name: 'Velocità' });
      expect(within(speed).queryByText(/supera/)).toBeNull();
      expect(speed.querySelector('.dash-near')).toBeNull();
      unmount();
    }
  });

  it('Velocità: la media a vista è solo il numero, per intero ai lettori di schermo', () => {
    mount();
    const avg = screen.getByRole('region', { name: 'Velocità' }).querySelector('.dash-avg')!;
    expect(avg.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^300$/);
    expect(avg.querySelector('.visually-hidden')).toHaveTextContent(/^media meta 300$/);
  });

  it('Velocità: senza controllo niente riga né tooltip; con il controllo solo quello che c\'è', () => {
    for (const density of ['tight', 'normal', 'roomy'] as const) {
      const { unmount } = mount({ density, data: sample({ speed: { ...sample().speed, control: [] } }) });
      const speed = screen.getByRole('region', { name: 'Velocità' });
      expect(speed.querySelector('.dash-ctrl')).toBeNull();
      expect(speed).not.toHaveTextContent(/Controllo/);
      expect(speed).not.toHaveAttribute('title');
      unmount();
    }
    mount({ density: 'roomy' });
    expect(screen.getByRole('region', { name: 'Velocità' }).querySelector('.dash-ctrl')).toHaveTextContent(/^Controllo: (Thunder Wave|Onda Tuono) \(Toxapex\)$/);
  });

  it('ampio: Ruoli come tabella ruoli × membri con tutti i livelli, un pallino sotto chi copre il ruolo', () => {
    mount({ density: 'roomy' });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    const table = within(roles).getByRole('table', { name: 'Ruoli' });
    expect(within(table).getAllByRole('columnheader').map(th => th.textContent)).toEqual(['Great Tusk', 'Corviknight', 'Toxapex', 'Dragapult']);
    // Le fasce sono intestazioni tra le righe, minori compresi
    expect([...table.querySelectorAll('.dash-role-sep')].map(x => x.textContent)).toEqual(['Essenziali', 'Importanti', 'Minori']);
    const rows = roleRows(roles);
    expect(rows.map(r => r.querySelector('th')!.textContent)).toEqual([
      'Hazard, coperto da Great Tusk', 'Rimozione Hazard, coperto da Great Tusk, Corviknight, Toxapex', 'Pivot, mancante', 'Schermi, mancante',
    ]);
    // Rimozione: pallini sotto Great Tusk, Corviknight, Toxapex, non sotto Dragapult
    expect([...rows[1].querySelectorAll('td')].map(td => !!td.querySelector('.dash-dot'))).toEqual([true, true, true, false]);
    // Importante mancante: riga rossa senza pallini; minore mancante: tenue, non rosso
    expect(rows[2]).toHaveClass('bad');
    expect(rows[2].querySelector('.dash-dot')).toBeNull();
    expect(rows[3]).toHaveClass('soft', 'is-minor');
    expect(rows[3]).not.toHaveClass('bad');
    // Niente chip nell'ampio
    expect(roles.querySelector('.dash-role')).toBeNull();
    // Chi copre il ruolo è nel tooltip della riga, il membro in quello della casella
    expect(rows[1]).toHaveAttribute('title', 'Rimozione Hazard: Great Tusk, Corviknight, Toxapex');
    expect(rows[1].querySelectorAll('td')[1]).toHaveAttribute('title', 'Rimozione Hazard: Corviknight');
  });

  it('Ruoli: tre fasce una sotto l\'altra, Essenziali, Importanti, Minori, con l\'etichetta a sinistra', () => {
    for (const density of ['tight', 'normal'] as const) {
      const { unmount } = mount({ density });
      const roles = screen.getByRole('region', { name: 'Ruoli' });
      // Ogni fascia: l'etichetta del livello, poi i ruoli in fila
      const bands = [...roles.querySelectorAll('.dash-role-band')];
      expect(bands.map(band => band.firstElementChild?.textContent)).toEqual(['Essenziali', 'Importanti', 'Minori']);
      expect(bands.map(band => band.lastElementChild?.tagName)).toEqual(['UL', 'UL', 'UL']);
      const lists = within(roles).getAllByRole('list');
      expect(lists.map(list => document.getElementById(list.getAttribute('aria-labelledby') ?? '')?.textContent))
        .toEqual(['Essenziali', 'Importanti', 'Minori']);
      expect(lists.map(list => within(list).getAllByRole('listitem').length)).toEqual([2, 1, 1]);
      // Mancante rosso pieno solo per essenziali e importanti; il minore resta tenue
      expect(within(lists[1]).getByRole('listitem')).toHaveClass('bad');
      expect(within(lists[2]).getByRole('listitem')).toHaveClass('minor', 'soft');
      unmount();
    }
  });

  it('Ruoli: in ogni fascia prima i mancanti, così il "+N" non nasconde mai un problema', () => {
    stubLayout({ 'dash-roles': { box: 75, item: 30 } });
    const chips = [
      { need: 'hazards', level: 'essential', covered: true, owners: ['Great Tusk'] },
      { need: 'pivot', level: 'essential', covered: true, owners: ['Corviknight'] },
      { need: 'removal', level: 'essential', covered: false, owners: [] },
    ] as const;
    mount({ density: 'tight', data: sample({ roles: { chips: chips.map(c => ({ ...c, owners: [...c.owners] })), members: ['Great Tusk', 'Corviknight'], value: '2/3' } }) });
    const rows = within(roleBand(screen.getByRole('region', { name: 'Ruoli' }), 'Essenziali')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('bad');
    expect(rows[1]).toHaveTextContent('+2');
    vi.restoreAllMocks();
  });

  it('Ruoli: ogni riga si legge intera, coi nomi di chi la copre o "mancante"', () => {
    for (const density of ['tight', 'normal'] as const) {
      const { unmount } = mount({ density });
      const roles = screen.getByRole('region', { name: 'Ruoli' });
      const [hazards, removal] = within(roleBand(roles, 'Essenziali')).getAllByRole('listitem');
      expect(hazards.querySelector('.visually-hidden')).toHaveTextContent(/^, coperto da Great Tusk$/);
      expect(removal.querySelector('.visually-hidden')).toHaveTextContent(/^, coperto da Great Tusk, Corviknight, Toxapex$/);
      expect(within(roleBand(roles, 'Importanti')).getByRole('listitem').querySelector('.visually-hidden')).toHaveTextContent(/^, mancante$/);
      unmount();
    }
  });

  it('stretto: niente controllo visibile (resta nel tooltip), Ruoli senza icone dei membri', () => {
    mount({ density: 'tight' });
    const speed = screen.getByRole('region', { name: 'Velocità' });
    expect(speed.querySelector('.dash-ctrl')).toBeNull();
    expect(speed).toHaveAttribute('title', expect.stringMatching(/^Controllo:/));
    // Ruoli: ogni chip ha solo il segno e il nome
    for (const chip of screen.getByRole('region', { name: 'Ruoli' }).querySelectorAll('.dash-role:not(.more)')) {
      expect([...chip.children].map(x => x.className)).toEqual(['dash-role-tag']);
    }
  });

  it('normale e stretto: Ruoli come chip in fila, senza i nomi scritti', () => {
    for (const density of ['normal', 'tight'] as const) {
      const { unmount } = mount({ density });
      const roles = screen.getByRole('region', { name: 'Ruoli' });
      expect(roles.querySelector('.dash-role.line')).toBeNull();
      expect(roles.querySelector('.dash-role-who')).toBeNull();
      unmount();
    }
  });

  it('normale: chip senza icone dei membri; chi copre il ruolo resta nel nome accessibile e nel tooltip', () => {
    mount();
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    for (const chip of roles.querySelectorAll('.dash-role:not(.more)')) expect([...chip.children].map(x => x.className)).toEqual(['dash-role-tag']);
    const removal = within(roleBand(roles, 'Essenziali')).getAllByRole('listitem')[1];
    expect(removal).toHaveTextContent(/^Rimozione Hazard, coperto da Great Tusk, Corviknight, Toxapex$/);
    expect(removal).toHaveAttribute('title', 'Rimozione Hazard: Great Tusk, Corviknight, Toxapex');
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
    expect(within(rows[0]).getByRole('img', { name: 'Offesa' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('img', { name: 'Ruoli' })).toBeInTheDocument();
  });

  it('Cosa fare: le debolezze in una riga "Debole a" coi tipi, gravi prima, e il numerino', () => {
    mount({ problems: [problem(2), weak('Fire'), weak('Ground', 'serious'), weak('Ghost')] });
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    const rows = [...todo.querySelectorAll('.dash-problems > li')];
    expect(rows).toHaveLength(2);
    const [group] = rows;
    expect(group).toHaveClass('serious');
    expect(group.querySelector('.dash-todo-title')).toHaveTextContent(/^Debole a:$/);
    expect(group.querySelector('.dash-count')).toHaveTextContent(/^3$/);
    expect([...group.querySelectorAll('.dash-todo-item')].map(x => x.textContent)).toEqual(['Ground', 'Fire', 'Ghost']);
    expect(group.querySelector('.dash-todo-item')).toHaveClass('serious');
    // Niente "Deboli – Resiste" nel testo visibile: resta nel tooltip, una riga per tipo
    const visible = group.querySelector('.dash-problem')!.textContent;
    expect(visible).not.toMatch(/Deboli|–|Resist/);
    expect(group.getAttribute('title')).toBe(['Ground', 'Fire', 'Ghost'].map(x => `Debole a ${x}: 3 Deboli – 1 Resistono`).join('\n'));
    // Si legge intero
    expect(group.querySelector('.visually-hidden')).toHaveTextContent('Grave. Debole a: Ground, Fire, Ghost. 3 problemi');
    // L'intestazione conta i problemi singoli
    expect(todo).toHaveTextContent(/1 grave\s*·\s*3 minori/);
  });

  it('Cosa fare normale e ampio: sotto i gruppi i testi interi dei problemi; stretto no; minacce e ruoli no', () => {
    const threat = (species: string): CoachProblem => ({ severity: 'minor', category: 'meta', text: `Nessun check per ${species} dal meta`, fixes: [], key: `meta:${species}`, subjects: [species] });
    const roles: CoachProblem = { severity: 'minor', category: 'roles', text: 'Ruoli mancanti: Hazard', fixes: [], key: 'roles:essential', subjects: ['hazards'] };
    const problems = [weak('Fire'), weak('Ground', 'serious'), threat('Kyurem'), threat('Heatran'), roles, problem(2)];
    const { unmount } = mount({ density: 'roomy', problems });
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    const [weakRow, threatRow, rolesRow, single] = [...todo.querySelectorAll('.dash-problems > li')];
    // Ruoli mancanti: niente dettaglio, ripeterebbe i nomi
    expect(rolesRow).toHaveTextContent(/Ruoli mancanti/);
    expect(rolesRow.querySelector('.dash-sub')).toBeNull();
    expect([...weakRow.querySelectorAll('.dash-sub li')].map(li => li.textContent)).toEqual(['Debole a Ground: 3 Deboli – 1 Resistono', 'Debole a Fire: 3 Deboli – 1 Resistono']);
    expect(threatRow.querySelector('.dash-sub')).toBeNull();
    expect(single.querySelector('.dash-sub')).toBeNull();
    unmount();
    // Normale: gli stessi dettagli (se ci stanno); stretto: nessuno
    const { unmount: offNormal } = mount({ density: 'normal', problems });
    expect(screen.getByRole('region', { name: 'Cosa fare' }).querySelectorAll('.dash-sub li')).toHaveLength(2);
    offNormal();
    mount({ density: 'tight', problems });
    expect(screen.getByRole('region', { name: 'Cosa fare' }).querySelector('.dash-sub')).toBeNull();
  });

  it('Cosa fare: un gruppo con un elemento solo non ha il numerino', () => {
    mount({ problems: [weak('Fire'), problem(2)] });
    const [group] = within(screen.getByRole('region', { name: 'Cosa fare' })).getAllByRole('listitem');
    expect(group.querySelector('.dash-count')).toBeNull();
    expect(group.querySelector('.visually-hidden')).toHaveTextContent(/^Minore\. Debole a: Fire\.$/);
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

/**
 * Layout finto: per sezione l'altezza del contenitore .dash-fit e quella di ogni voce [data-fit], una sotto l'altra;
 * il "+N" ([data-fit-more]) dopo l'ultima voce, o sulla sua stessa riga con `inline`.
 */
function stubLayout(sizes: Record<string, { box: number; item: number; inline?: boolean }>, visible = () => true) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    // Scheda nascosta (display: none): tutto a zero
    if (!visible()) return rect(0, 0);
    const box = this.closest('.dash-fit');
    const card = box?.closest('.dash-card');
    const size = card && Object.entries(sizes).find(([name]) => card.classList.contains(name))?.[1];
    if (!box || !size) return rect(0, 0);
    if (this === box) return rect(0, size.box);
    const items = [...box.querySelectorAll('[data-fit], [data-fit-more], [data-fit-sub]')];
    let index = items.indexOf(this);
    if (index > 0 && size.inline && this.hasAttribute('data-fit-more')) index--;
    return index < 0 ? rect(0, 0) : rect(0, (index + 1) * size.item);
  });
}

describe('Cruscotto: misure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("team aperto: densità dall'altezza, anche alto resta normale; una misura a 0 (scheda nascosta) non la cambia", () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 700;
    renderIt(<OverviewDashboard data={sample()} problems={[]} members={6} onView={vi.fn()} onMeta={vi.fn()} />);
    const dash = document.querySelector('.dash')!;
    expect(dash).toHaveAttribute('data-density', 'normal');
    size.height = 300;
    fire();
    expect(dash).toHaveAttribute('data-density', 'tight');
    size.height = 0;
    fire();
    expect(dash).toHaveAttribute('data-density', 'tight');
  });

  it('team ridotto: sempre ampio, a ogni altezza', () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 300;
    renderIt(<OverviewDashboard data={sample()} problems={[]} members={6} onView={vi.fn()} onMeta={vi.fn()} teamCollapsed />);
    const dash = document.querySelector('.dash')!;
    expect(dash).toHaveAttribute('data-density', 'roomy');
    size.height = 1500;
    fire();
    expect(dash).toHaveAttribute('data-density', 'roomy');
  });

  it('una misura a 0×0 non rimette tutte le voci: resta l\'ultimo "+N"', () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 400;
    stubLayout({ 'dash-roles': { box: 75, item: 30 } }, () => size.height > 0);
    mount({ density: 'tight', data: sample({ roles: essentialsOnly }) });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).getByText('+3')).toBeInTheDocument();
    size.height = 0;
    fire();
    expect(within(roles).getByText('+3')).toBeInTheDocument();
  });

  it('Ruoli: i ruoli che non stanno vanno nel "+N" a fine fascia', () => {
    stubLayout({ 'dash-roles': { box: 75, item: 30 } });
    mount({ density: 'tight', data: sample({ roles: essentialsOnly }) });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    // Ne stanno 2 su 4, ma il "+N" vuole il suo posto: 1 ruolo e "+3" in fondo
    const essential = within(roleBand(roles, 'Essenziali')).getAllByRole('listitem');
    expect(essential).toHaveLength(2);
    expect(essential[1]).toHaveTextContent('+3');
    expect(essential[1]).toHaveClass('more');
    expect(essential[1]).toHaveAttribute('title', 'Altri 3 ruoli');
    // Il significato del "+N" anche per i lettori di schermo
    expect(essential[1].querySelector('.visually-hidden')).toHaveTextContent(/^Altri 3 ruoli$/);
    expect(essential[1].querySelector('[aria-hidden="true"]')).toHaveTextContent(/^[+]3$/);
    expect(roles.querySelectorAll('.more')).toHaveLength(1);
  });

  it('Ruoli (regressione 2K): si misura tutta la card, una fascia piena non taglia mentre le altre hanno spazio', () => {
    // Una voce essenziale, una importante, sette minori: 9 righe in una card da 9 righe stanno tutte.
    // Con le fasce alte un terzo ciascuna i minori finivano in un "+N" accanto a fasce vuote.
    stubLayout({ 'dash-roles': { box: 270, item: 30 } });
    const minors = (['screens', 'dot', 'debuff', 'phazer', 'taunt', 'encore', 'itemRemoval'] as const).map(need => ({ need, level: 'minor' as const, covered: false, owners: [] }));
    const chips: DashboardData['roles']['chips'] = [
      { need: 'hazards', level: 'essential', covered: true, owners: ['Great Tusk'] },
      { need: 'pivot', level: 'important', covered: true, owners: ['Corviknight'] },
      ...minors,
    ];
    mount({ density: 'normal', data: sample({ roles: { chips, members: ['Great Tusk', 'Corviknight'], value: '2/2' } }) });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(roles.querySelector('.more')).toBeNull();
    expect(within(roleBand(roles, 'Minori')).getAllByRole('listitem')).toHaveLength(7);
  });

  it('Ruoli: se manca spazio cedono prima le ultime fasce, ognuna col suo "+N"', () => {
    stubLayout({ 'dash-roles': { box: 180, item: 30 } });
    mount({ density: 'tight', data: sample({ roles: manyRoles }) });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    // 6 posti: 4 essenziali, poi i "+N" di Importanti (2) e Minori (1)
    expect(within(roleBand(roles, 'Essenziali')).getAllByRole('listitem')).toHaveLength(4);
    expect(within(roleBand(roles, 'Importanti')).getByRole('listitem')).toHaveTextContent('+2');
    expect(within(roleBand(roles, 'Minori')).getByRole('listitem')).toHaveTextContent('+1');
  });

  it('Ruoli: un contenitore che si stringe dopo il taglio non fa rimostrare tutto (niente rimbalzi)', () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 400;
    stubLayout({ 'dash-roles': { box: 75, item: 30 } });
    mount({ density: 'tight', data: sample({ roles: essentialsOnly }) });
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).getByText('+3')).toBeInTheDocument();
    // Il ResizeObserver vero misura appena osserva
    fire();
    expect(within(roles).getByText('+3')).toBeInTheDocument();
    // Fasce alte quanto il contenuto: dopo il taglio si stringono. Non si devono rimettere tutte le voci per rimisurare
    const added: Node[] = [];
    const watch = new MutationObserver(records => records.forEach(r => added.push(...r.addedNodes)));
    watch.observe(roles, { childList: true, subtree: true });
    size.height = 300;
    fire();
    watch.takeRecords().forEach(r => added.push(...r.addedNodes));
    watch.disconnect();
    expect(added.filter(n => n instanceof HTMLElement && n.matches('[data-fit]'))).toHaveLength(0);
    expect(within(roles).getByText('+3')).toBeInTheDocument();
    // Se cresce, si rimisura da capo
    size.height = 500;
    fire();
    expect(within(roles).getByText('+3')).toBeInTheDocument();
  });

  it('Ruoli: le fasce non si stirano (CSS): compatte in alto, alte quanto il contenuto', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/analysis.css'), 'utf8');
    const rule = (selector: string) => css.split(/\r?\n/).find(line => line.startsWith(selector + ' {')) ?? '';
    expect(rule('.dash-role-band')).toMatch(/flex: none/);
    expect(rule('.dash-role-bands, .dash-role-bands.dash-fit')).toMatch(/flex: 0 1 auto/);
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

  it('Cosa fare ampio: i dettagli solo finché ci stanno, mai a spese di un gruppo', () => {
    stubLayout({ 'dash-todo': { box: 130, item: 30 } });
    mount({ density: 'roomy', problems: [weak('Fire'), weak('Ground', 'serious'), weak('Ghost'), problem(2)] });
    const todo = screen.getByRole('region', { name: 'Cosa fare' });
    expect(todo.querySelectorAll('.dash-problems > li')).toHaveLength(2);
    // Gruppo (30) + 2 dettagli (90) + riga singola (120): il terzo dettaglio non ci sta
    expect(todo.querySelectorAll('.dash-sub li')).toHaveLength(2);
  });

  it('Ruoli: se il "+N" sta sulla stessa riga non si toglie nessun ruolo', () => {
    stubLayout({ 'dash-roles': { box: 75, item: 30, inline: true } });
    mount({ density: 'tight', data: sample({ roles: essentialsOnly }) });
    const essential = within(roleBand(screen.getByRole('region', { name: 'Ruoli' }), 'Essenziali')).getAllByRole('listitem');
    expect(essential).toHaveLength(3);
    expect(essential[2]).toHaveTextContent('+2');
  });

  it('Cosa fare: quanti ne stanno, se sono più di 2', () => {
    stubLayout({ 'dash-todo': { box: 130, item: 40 } });
    mount({ problems: Array.from({ length: 12 }, (_, i) => problem(i)) });
    expect(screen.getByRole('region', { name: 'Cosa fare' }).querySelectorAll('.dash-problems li')).toHaveLength(3);
  });
});
