import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../../src/engine/overviewDashboard';
import type { Core } from '../../src/engine/cores';
import type { TeamLink } from '../../src/engine/teamLinks';
import type { TeamSummary } from '../../src/engine/teamSummary';
import { TYPES } from '../../src/engine/types';
import { en } from '../../src/i18n/en';
import { it as itText } from '../../src/i18n/it';
import { initGameNames } from '../../src/i18n/game';
import { LangProvider } from '../../src/i18n/react';
import { densityFor, OverviewDashboard, RICH_FROM, TIGHT_BELOW, type Density } from '../../src/ui/OverviewDashboard';
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
        resist: type === 'Ground' ? 1 : 2,
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

/** Il Riassunto costruito: Hyper Offense, due attaccanti, un muro, nessun meteo, Stealth Rock. */
function summaryOf(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    archetype: 'hyperOffense', nearType: null, typeRule: 'recoverySpeed', styles: [],
    attackers: ['Garchomp', 'Zapdos'], walls: ['Toxapex'],
    offenseOf: { Garchomp: 92, Zapdos: 86 },
    defenseOf: { Toxapex: 88 },
    conditions: [],
    hazards: [{ member: 'Garchomp', moves: ['Stealth Rock'] }],
    cores: [],
    links: [],
    ...overrides,
  };
}

/** Il core del team di prova: Garchomp para il Fuoco a Scizor, Scizor l'Acciaio a Iron Valiant, Iron Valiant il Drago a Garchomp. */
const trio: Core = {
  members: ['Garchomp', 'Scizor', 'Iron Valiant'],
  sides: [
    { from: 'Garchomp', to: 'Scizor', type: 'Fire', types: ['Fire'] },
    { from: 'Scizor', to: 'Iron Valiant', type: 'Steel', types: ['Steel'] },
    { from: 'Iron Valiant', to: 'Garchomp', type: 'Dragon', types: ['Dragon'] },
  ],
  names: [['Dragon'], ['Steel'], ['Fairy']],
  strength: 4,
};
/** Una coppia: Pelipper e Ferrothorn si parano a vicenda. */
const pair: Core = {
  members: ['Pelipper', 'Ferrothorn'],
  sides: [{ from: 'Pelipper', to: 'Ferrothorn', type: 'Fire', types: ['Fire', 'Fighting'] }, { from: 'Ferrothorn', to: 'Pelipper', type: 'Electric', types: ['Electric', 'Rock'] }],
  names: [['Water', 'Flying'], ['Grass', 'Steel']],
  strength: 3,
};
const pivotLink: TeamLink = { kind: 'pivot', from: ['Scizor', 'Landorus-Therian'], to: ['Iron Valiant'], move: 'U-turn' };
const wishLink: TeamLink = { kind: 'wish', from: ['Clefable'], to: [], move: 'Wish' };
/** Nomi italiani dei tipi, delle mosse e delle abilità usati nel Riassunto. */
const italianNames = () => initGameNames({
  moves: { uturn: { name: 'U-turn' }, wish: { name: 'Desiderio' } }, abilities: { swiftswim: { name: 'Nuotovelox' } }, items: {},
  types: { fire: 'Fuoco', steel: 'Acciaio', dragon: 'Drago', fairy: 'Folletto', water: 'Acqua', flying: 'Volante', grass: 'Erba', electric: 'Elettro', fighting: 'Lotta', rock: 'Roccia' },
  natures: {},
});

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

function mount({ density = 'normal' as Density, data = sample(), summary = summaryOf(), members = 6 } = {}) {
  const onView = vi.fn();
  const { unmount } = renderIt(<OverviewDashboard data={data} summary={summary} members={members} onView={onView} density={density} />);
  return { onView, unmount };
}

describe('Cruscotto della Panoramica', () => {
  it('quattro sezioni coi loro titoli, senza "Cosa fare" e "Minacce non gestite"', () => {
    mount();
    for (const title of ['Riassunto', 'Copertura', 'Ruoli', 'Velocità']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Cosa fare' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Minacce non gestite' })).toBeNull();
  });

  it('Copertura: 18 colonne, caselle col nome di tipo, riga e dettaglio', () => {
    mount();
    const table = screen.getByRole('table', { name: 'Copertura' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(18);
    expect(within(table).getByRole('cell', { name: /^(Terra|Ground), difesa: 3 deboli, 1 resiste$/ })).toHaveClass('bad');
    expect(within(table).getByRole('cell', { name: /^(Erba|Grass), difesa: 1 debole, 2 resistono$/ })).toHaveClass('minor');
    expect(within(table).getByRole('cell', { name: /^(Normale|Normal), offesa: nessuno lo colpisce super efficace$/ })).toHaveClass('bad');
    expect(within(table).getByRole('rowheader', { name: 'Difesa' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Offesa' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Copertura' }).querySelector('.dash-meta')).toHaveTextContent('offesa 17/18 · difesa 17/18');
    expect(screen.queryByText('Chi')).toBeNull();
  });

  it('Copertura in inglese: righe Defense e Offense, anche in testata', () => {
    render(<LangProvider lang="en"><OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} density="normal" /></LangProvider>);
    const table = screen.getByRole('table', { name: 'Coverage' });
    expect(within(table).getByRole('rowheader', { name: 'Defense' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Offense' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coverage' }).querySelector('.dash-meta')).toHaveTextContent('offense 17/18 · defense 17/18');
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
    const { onView } = mount();
    await user.click(screen.getByRole('button', { name: /^Difesa/ }));
    await user.click(screen.getByRole('button', { name: /^Offesa/ }));
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Ruoli' }));
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Velocità' }));
    expect(onView.mock.calls.map(c => c[0])).toEqual(['defense', 'strength', 'roles', 'speed']);
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
      'Hazard, coperto da Great Tusk', 'Controllo Hazard, coperto da Great Tusk, Corviknight, Toxapex', 'Pivot, mancante', 'Screen Setter, mancante',
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
    expect(rows[1]).toHaveAttribute('title', 'Controllo Hazard: Great Tusk, Corviknight, Toxapex');
    expect(rows[1].querySelectorAll('td')[1]).toHaveAttribute('title', 'Controllo Hazard: Corviknight');
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
    expect(removal).toHaveTextContent(/^Controllo Hazard, coperto da Great Tusk, Corviknight, Toxapex$/);
    expect(removal).toHaveAttribute('title', 'Controllo Hazard: Great Tusk, Corviknight, Toxapex');
  });

  it('ogni corsia della Velocità ha il nome del Pokémon per i lettori di schermo', () => {
    mount({ density: 'tight' });
    const lanes = screen.getByRole('region', { name: 'Velocità' }).querySelectorAll('.dash-lane');
    expect(lanes[0]).toHaveTextContent(/Dragapult.*421/);
    expect(lanes[1]).toHaveTextContent(/Toxapex.*167/);
  });

  it('normale: il controllo con chi lo porta', () => {
    mount();
    expect(screen.getByRole('region', { name: 'Velocità' }).querySelector('.dash-ctrl')).toHaveTextContent(/Controllo:.*\(Toxapex\)/);
  });

});

describe('Riassunto', () => {
  afterEach(() => initGameNames(null));
  const region = () => screen.getByRole('region', { name: 'Riassunto' });
  /** La sezione per titolo (l'intestazione e le sue righe). */
  const section = (title: string) => within(region()).getByRole('heading', { name: title }).closest<HTMLElement>('.sum-sec')!;

  it('eroe: il tipo di team, lo stile e il "?" che apre la guida ai tipi; "—" senza tipo', async () => {
    const user = userEvent.setup();
    mount({ summary: summaryOf({ styles: ['rain'] }) });
    const arch = region().querySelector('.sum-arch')!;
    expect(arch).toHaveTextContent('Hyper Offense');
    expect(arch).toHaveAttribute('title', 'Tutto attacco');
    expect(region().querySelector('.sum-style')).toHaveTextContent('Pioggia');
    // Lontano dai confini niente "quasi…"
    expect(region().querySelector('.sum-near')).toBeNull();
    cleanup();
    mount({ summary: summaryOf({ nearType: 'bulkyOffense' }) });
    expect(region().querySelector('.sum-near')).toHaveTextContent('quasi Bulky Offense');
    expect(region().querySelector('.sum-near')).toHaveAttribute('title', 'Il team sta vicino al confine col tipo accanto: una parte del voto viene da quel tipo');
    await user.click(within(region()).getByRole('button', { name: 'Tipi di team: come si riconoscono' }));
    const dialog = screen.getByRole('dialog', { name: 'Tipi di team' });
    // National Dex OU: come si riconosce il tipo (recupero, velocità, Focus Sash)
    expect(within(dialog).getByRole('heading', { name: 'Come si riconosce in National Dex OU' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Ogni Focus Sash su un attaccante spinge verso Hyper Offense (su un muro non conta)');
    await user.keyboard('{Escape}');
    cleanup();
    // Gli altri formati riconoscono il tipo dai muri: la sezione non c'è
    mount({ summary: summaryOf({ typeRule: 'walls' }) });
    await user.click(within(region()).getByRole('button', { name: 'Tipi di team: come si riconoscono' }));
    expect(within(screen.getByRole('dialog', { name: 'Tipi di team' })).queryByRole('heading', { name: 'Come si riconosce in National Dex OU' })).toBeNull();
    await user.keyboard('{Escape}');
    cleanup();
    mount({ summary: summaryOf({ archetype: null }) });
    expect(region().querySelector('.sum-arch')).toHaveTextContent('—');
  });

  it('eroe: chi rende il team tale, prima gli attaccanti (Offesa) poi i muri (Difesa)', () => {
    mount();
    const attack = within(region()).getByRole('group', { name: 'Attaccano' });
    const hold = within(region()).getByRole('group', { name: 'Reggono' });
    expect(within(attack).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Garchomp, Offesa 92', 'Zapdos, Offesa 86']);
    expect(within(hold).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Toxapex, Difesa 88']);
    // Nell'ordine del documento: attaccanti, poi muri
    expect([...region().querySelectorAll('.sum-mon')].map(b => b.getAttribute('title'))).toEqual(['Garchomp', 'Zapdos', 'Toxapex']);
    expect(region().querySelectorAll('.sum-hero .sprite')).toHaveLength(3);
  });

  it('eroe: clic su un attaccante porta a Offesa, su un muro a Difesa', async () => {
    const user = userEvent.setup();
    const { onView } = mount();
    await user.click(within(region()).getByRole('button', { name: 'Garchomp, Offesa 92' }));
    await user.click(within(region()).getByRole('button', { name: 'Toxapex, Difesa 88' }));
    expect(onView.mock.calls.map(c => c[0])).toEqual(['strength', 'defense']);
  });

  it('con un solo Pokémon niente riga del tipo di team; attaccanti e muri restano', () => {
    mount({ members: 1 });
    expect(region().querySelector('.sum-arch')).toBeNull();
    expect(within(region()).queryByRole('button', { name: 'Tipi di team: come si riconoscono' })).toBeNull();
    expect(within(region()).getByRole('button', { name: 'Garchomp, Offesa 92' })).toBeInTheDocument();
  });

  it('Meteo e campo: chi lo porta, la condizione e chi ne approfitta; clic a Ruoli', async () => {
    const user = userEvent.setup();
    italianNames();
    const { onView } = mount({ summary: summaryOf({ conditions: [{ member: 'Pelipper', label: 'Pioggia', key: 'rain', users: [{ name: 'Barraskewda', via: 'Swift Swim' }, { name: 'Zapdos' }] }] }) });
    const row = within(section('Meteo e campo')).getByRole('button');
    expect(row).toHaveTextContent('Pelipper');
    expect(row.querySelector('.sum-tag')).toHaveTextContent('Pioggia');
    const users = [...row.querySelectorAll<HTMLElement>('.sum-user')];
    // Nel tooltip anche l'abilità o la mossa con cui la sfrutta, nella lingua dell'interfaccia
    expect(users.map(u => u.getAttribute('title'))).toEqual(['Barraskewda · Nuotovelox', 'Zapdos']);
    expect(users[0].querySelector('.sprite')).not.toBeNull();
    // I nomi letti anche dai lettori di schermo
    expect(row).toHaveAccessibleName(/Pelipper.*Pioggia.*Barraskewda · Nuotovelox.*Zapdos/);
    await user.click(row);
    expect(onView).toHaveBeenCalledWith('roles');
  });

  it('Meteo e campo vuoto: "Nessuno"', () => {
    mount();
    expect(section('Meteo e campo')).toHaveTextContent(/^Meteo e campoNessuno$/);
    expect(within(section('Meteo e campo')).queryByRole('button')).toBeNull();
  });

  it('Trappole: una chip per mossa, nella lingua dell\'interfaccia; vuoto: "Nessuna"', async () => {
    initGameNames({ moves: { stealthrock: { name: 'Levitoroccia' }, spikes: { name: 'Punte' } }, abilities: {}, items: {}, types: {}, natures: {} });
    const user = userEvent.setup();
    const { onView } = mount({ summary: summaryOf({ hazards: [{ member: 'Ferrothorn', moves: ['Stealth Rock', 'Spikes'] }] }) });
    const row = within(section('Trappole')).getByRole('button');
    expect(row).toHaveTextContent('Ferrothorn');
    expect([...row.querySelectorAll('.sum-tag')].map(c => c.textContent)).toEqual(['Levitoroccia', 'Punte']);
    await user.click(row);
    expect(onView).toHaveBeenCalledWith('roles');
    cleanup();
    mount({ summary: summaryOf({ hazards: [] }) });
    expect(section('Trappole')).toHaveTextContent(/^TrappoleNessuna$/);
  });

  it('le vecchie righe non ci sono più: niente Colpisce, Debole a, Ruoli, Minacce', () => {
    mount();
    for (const label of ['Colpisce', 'Debole a', 'Ruoli', 'Minacce']) expect(within(region()).queryByText(label)).toBeNull();
    expect(within(region()).getAllByRole('heading').map(h => h.textContent)).toEqual(['Riassunto', 'Meteo e campo', 'Trappole', 'Sinergie']);
  });

  it('in inglese: Offense / Defense, Weather & field, Hazards, None', () => {
    render(<LangProvider lang="en"><OverviewDashboard data={sample()} summary={summaryOf({ hazards: [] })} members={6} onView={vi.fn()} density="normal" /></LangProvider>);
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(summary).getByRole('group', { name: 'Attack' })).toBeInTheDocument();
    expect(within(summary).getByRole('group', { name: 'Hold' })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: 'Garchomp, Offense 92' })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: 'Toxapex, Defense 88' })).toBeInTheDocument();
    expect(within(summary).getByRole('heading', { name: 'Weather & field' }).closest('.sum-sec')).toHaveTextContent(/None$/);
    expect(within(summary).getByRole('heading', { name: 'Hazards' }).closest('.sum-sec')).toHaveTextContent(/None$/);
  });

  it('Sinergie: il core da 3 è un triangolo (tre sprite, tre icone di tipo sui lati) col giro letto in parole', () => {
    italianNames();
    mount({ summary: summaryOf({ cores: [trio] }) });
    const row = within(section('Sinergie')).getByRole('button');
    const tri = row.querySelector<HTMLElement>('.sum-tri')!;
    expect(tri.querySelectorAll('.sprite')).toHaveLength(3);
    expect(tri.querySelectorAll('.sum-tri-badge img')).toHaveLength(3);
    expect(row.querySelector('.sum-syn-title')).toHaveTextContent('Drago / Acciaio / Folletto');
    expect(row.querySelector('.sum-syn-tag')).toHaveTextContent('Core');
    expect([...row.querySelectorAll('.sum-cover > span')].map(l => l.textContent)).toEqual(['Garchomp para Fuoco', 'Scizor para Acciaio', 'Iron Valiant para Drago']);
    expect(row).toHaveAccessibleName('Core Drago / Acciaio / Folletto');
    expect(row).toHaveAccessibleDescription('Garchomp para Fuoco a Scizor, Scizor para Acciaio a Iron Valiant, Iron Valiant para Drago a Garchomp');
  });

  it('Sinergie: il core da 2 (senza core da 3) è una riga a due sprite con etichetta, titolo e frase; i pivot non compaiono', () => {
    italianNames();
    mount({ summary: summaryOf({ cores: [pair], links: [pivotLink] }) });
    const rows = within(section('Sinergie')).getAllByRole('button');
    expect(rows).toHaveLength(1);
    const [core] = rows;
    expect(core.querySelector('.sum-syn-tag')).toHaveTextContent('Core');
    expect(core.querySelector('.sum-syn-title')).toHaveTextContent('Acqua-Volante / Erba-Acciaio');
    expect(core.querySelectorAll('.sum-pair .sprite')).toHaveLength(2);
    expect(core.querySelector('.sum-syn-text')).toHaveTextContent('Pelipper para Fuoco e Lotta, Ferrothorn para Elettro e Roccia');
    expect(section('Sinergie')).not.toHaveTextContent('Giro di U-turn');
  });

  it('Sinergie: col triangolo la coppia non compare; poi i legami nel loro ordine, senza pivot; clic: core a Difesa, legami a Ruoli', async () => {
    italianNames();
    const user = userEvent.setup();
    const { onView } = mount({ summary: summaryOf({ cores: [pair, trio], links: [pivotLink, wishLink] }) });
    const rows = within(section('Sinergie')).getAllByRole('button');
    expect(rows.map(r => r.querySelector('.sum-syn-title')!.textContent)).toEqual(['Drago / Acciaio / Folletto', 'Cure al team']);
    expect(rows[1].querySelector('.sum-syn-tag')).toHaveTextContent('Desiderio');
    for (const row of rows) await user.click(row);
    expect(onView.mock.calls.map(c => c[0])).toEqual(['defense', 'roles']);
  });

  it('Sinergie vuote: una frase attenuata', () => {
    mount();
    expect(section('Sinergie')).toHaveTextContent(/^SinergieNessuna sinergia: ognuno lavora da solo$/);
    expect(within(section('Sinergie')).queryByRole('button')).toBeNull();
  });

  it('Sinergie in inglese: nomi dei tipi e frasi', () => {
    render(<LangProvider lang="en"><OverviewDashboard data={sample()} summary={summaryOf({ cores: [trio], links: [pivotLink] })} members={6} onView={vi.fn()} density="normal" /></LangProvider>);
    const syn = within(screen.getByRole('region', { name: 'Summary' })).getByRole('heading', { name: 'Synergies' }).closest<HTMLElement>('.sum-sec')!;
    const [core, ...rest] = within(syn).getAllByRole('button');
    expect(rest).toHaveLength(0);
    expect(core.querySelector('.sum-syn-title')).toHaveTextContent('Dragon / Steel / Fairy');
    expect(core).toHaveAccessibleDescription('Garchomp blocks Fire for Scizor, Scizor blocks Steel for Iron Valiant, Iron Valiant blocks Dragon for Garchomp');
  });

  it('ricco (team ridotto): sprite più grandi nell\'eroe', () => {
    mount({ density: 'roomy' });
    expect(region().querySelector('.sum-hero .sprite')).toHaveAttribute('width', '56');
    cleanup();
    mount();
    expect(region().querySelector('.sum-hero .sprite')).toHaveAttribute('width', '40');
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

/**
 * Layout finto delle righe a misura del Riassunto (.sum-fit, alto 20px): le prime `fits(mostrate)` voci stanno nella riga,
 * le altre vanno a capo; il "+N" sta nella riga, o va a capo con `moreWraps` quando le voci mostrate sono già `fits`.
 */
function stubSumFit(fits: (shown: number) => number, moreWraps = false) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = this.closest('.sum-fit');
    if (!box) return rect(0, 0);
    if (this === box) return rect(0, 20);
    const items = [...box.querySelectorAll('[data-fit]')];
    const room = fits(items.length);
    if (this.hasAttribute('data-fit-more')) return rect(0, moreWraps && items.length >= room ? 40 : 20);
    const index = items.indexOf(this);
    return index < 0 ? rect(0, 0) : rect(0, index < room ? 20 : 40);
  });
}

describe('Cruscotto: misure', () => {
  afterEach(() => {
    initGameNames(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("team aperto: densità dall'altezza, anche alto resta normale; una misura a 0 (scheda nascosta) non la cambia", () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = 700;
    renderIt(<OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} />);
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
    renderIt(<OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} teamCollapsed />);
    const dash = document.querySelector('.dash')!;
    expect(dash).toHaveAttribute('data-density', 'roomy');
    size.height = 1500;
    fire();
    expect(dash).toHaveAttribute('data-density', 'roomy');
  });

  it('Riassunto ricco solo col team ridotto e abbastanza alto (RICH_FROM), altrimenti compatto', () => {
    const fire = stubObservers();
    const size = stubHeight();
    size.height = RICH_FROM;
    renderIt(<OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} teamCollapsed />);
    const dash = document.querySelector('.dash')!;
    expect(dash).toHaveClass('rich');
    expect(dash.querySelector('.sum-hero .sprite')).toHaveAttribute('width', '56');
    size.height = RICH_FROM - 1;
    fire();
    expect(dash).not.toHaveClass('rich');
    expect(dash).toHaveAttribute('data-density', 'roomy');
    expect(dash.querySelector('.sum-hero .sprite')).toHaveAttribute('width', '40');
    cleanup();
    // Team aperto: mai ricco, a ogni altezza
    size.height = 2000;
    renderIt(<OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} />);
    expect(document.querySelector('.dash')).not.toHaveClass('rich');
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

  it('Riassunto: chi non sta nella riga dell\'eroe va nel "+N", letto per intero', () => {
    stubSumFit(() => 2);
    const six = ['Garchomp', 'Zapdos', 'Kingambit', 'Dragapult', 'Gholdengo', 'Great Tusk'];
    mount({ summary: summaryOf({ attackers: six, walls: ['Toxapex', 'Corviknight', 'Skarmory'] }) });
    const crew = screen.getByRole('region', { name: 'Riassunto' }).querySelector<HTMLElement>('.sum-crew')!;
    expect(crew.querySelectorAll('.sprite')).toHaveLength(2);
    expect(crew.querySelector('.sum-more')).toHaveTextContent('+7');
    expect(crew.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Altri 7 Pokémon$/);
    // I muri sono tutti nel "+N": il loro gruppo non c'è
    expect(within(crew).queryByRole('group', { name: 'Reggono' })).toBeNull();
  });

  it('Riassunto: le righe di una sezione che non stanno vanno nel "+N" (al singolare per una)', () => {
    stubSumFit(() => 1);
    mount({ summary: summaryOf({ conditions: [
      { member: 'Pelipper', label: 'Pioggia', key: 'rain', users: [] },
      { member: 'Indeedee', label: 'Campo Psichico', key: 'psychicterrain', users: [] },
    ] }) });
    const weather = within(screen.getByRole('region', { name: 'Riassunto' })).getByRole('heading', { name: 'Meteo e campo' }).closest<HTMLElement>('.sum-sec')!;
    expect(within(weather).getAllByRole('button')).toHaveLength(1);
    expect(weather.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Un altro che prepara il campo$/);
  });

  it('Riassunto: le sinergie che non stanno vanno nel "+N", con l\'elenco per intero', () => {
    italianNames();
    stubSumFit(() => 2);
    const links: TeamLink[] = [
      pivotLink, wishLink,
      { kind: 'batonpass', from: ['Hatterene'], to: ['Iron Valiant'], move: 'Baton Pass' },
      { kind: 'phazer', from: ['Landorus-Therian'], to: ['Skarmory'], move: 'Whirlwind' },
    ];
    mount({ summary: summaryOf({ cores: [trio, pair], links }) });
    const syn = within(screen.getByRole('region', { name: 'Riassunto' })).getByRole('heading', { name: 'Sinergie' }).closest<HTMLElement>('.sum-sec')!;
    expect(within(syn).getAllByRole('button')).toHaveLength(2);
    const more = syn.querySelector('.sum-more')!;
    // Il core da 3 e Desiderio in riga (niente coppia né pivot), gli altri due nel "+N"
    expect(more).toHaveTextContent('+2');
    expect(more.querySelector('.visually-hidden')!.textContent).toBe('Altre 2 sinergie: '
      + 'Baton Pass Passaggio con Baton Pass: Hatterene fa entrare Iron Valiant senza perdere i vantaggi; '
      + 'Trappole + cambio Avversari sulle trappole: Skarmory con Whirlwind trascina gli avversari sulle trappole di Landorus-Therian');
    // Dopo la lista nell'ordine di lettura
    expect(syn.querySelector('.sum-lines')!.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(more).toHaveAttribute('title', more.querySelector('.visually-hidden')!.textContent);
  });

  it('Ruoli: le fasce non si stirano (CSS): compatte in alto, alte quanto il contenuto', () => {
    const css = readFileSync(resolve(__dirname, '../../src/styles/analysis.css'), 'utf8');
    const rule = (selector: string) => css.split(/\r?\n/).find(line => line.startsWith(selector + ' {')) ?? '';
    expect(rule('.dash-role-band')).toMatch(/flex: none/);
    expect(rule('.dash-role-bands, .dash-role-bands.dash-fit')).toMatch(/flex: 0 1 auto/);
  });

  it('Ruoli: se il "+N" sta sulla stessa riga non si toglie nessun ruolo', () => {
    stubLayout({ 'dash-roles': { box: 75, item: 30, inline: true } });
    mount({ density: 'tight', data: sample({ roles: essentialsOnly }) });
    const essential = within(roleBand(screen.getByRole('region', { name: 'Ruoli' }), 'Essenziali')).getAllByRole('listitem');
    expect(essential).toHaveLength(3);
    expect(essential[2]).toHaveTextContent('+2');
  });

});
