import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '../../src/engine/overviewDashboard';
import type { TeamSummary } from '../../src/engine/teamSummary';
import { TYPES } from '../../src/engine/types';
import { en } from '../../src/i18n/en';
import { it as itText } from '../../src/i18n/it';
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

/** Il Riassunto costruito: due attaccanti, un muro, Stealth Rock, tutto colpito, due debolezze, ruoli a posto, tre minacce. */
function summaryOf(overrides: Partial<TeamSummary> = {}): TeamSummary {
  return {
    archetype: 'hyperOffense', styles: [],
    attackers: ['Garchomp', 'Zapdos'], walls: ['Toxapex'],
    field: [{ member: 'Garchomp', items: ['Stealth Rock'] }],
    hits: { covered: 18, total: 18 },
    weak: [{ type: 'Ground', serious: true, resist: 0 }, { type: 'Ice', serious: false, resist: 1 }],
    missingRoles: [],
    keyRoles: [{ need: 'hazards', covered: true }, { need: 'removal', covered: true }],
    hitsMissing: [],
    offenseOf: { Garchomp: 92, Zapdos: 86 },
    defenseOf: { Toxapex: 88 },
    threats: [{ species: 'Great Tusk', usage: 0.23 }, { species: 'Kyurem', usage: 0.21 }, { species: 'Heatran', usage: 0.17 }],
    ...overrides,
  };
}

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

/** Le righe del Riassunto per etichetta. */
const sumRow = (label: string) => within(screen.getByRole('region', { name: 'Riassunto' })).queryByRole('button', { name: new RegExp('^' + label) });

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
    expect(screen.getByRole('region', { name: 'Copertura' }).querySelector('.dash-meta')).toHaveTextContent('difesa 17/18 · offesa 17/18');
    expect(screen.queryByText('Chi')).toBeNull();
  });

  it('Copertura in inglese: righe Defense e Offense, anche in testata', () => {
    render(<LangProvider lang="en"><OverviewDashboard data={sample()} summary={summaryOf()} members={6} onView={vi.fn()} density="normal" /></LangProvider>);
    const table = screen.getByRole('table', { name: 'Coverage' });
    expect(within(table).getByRole('rowheader', { name: 'Defense' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Offense' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coverage' }).querySelector('.dash-meta')).toHaveTextContent('defense 17/18 · offense 17/18');
    // La riga Colpisce del Riassunto resta "Hits"
    expect(screen.getByRole('region', { name: 'Summary' }).querySelectorAll('.sum-k')[4]).toHaveTextContent('Hits');
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

  it('normale: il controllo con chi lo porta', () => {
    mount();
    expect(screen.getByRole('region', { name: 'Velocità' }).querySelector('.dash-ctrl')).toHaveTextContent(/Controllo:.*\(Toxapex\)/);
  });

});

describe('Riassunto', () => {
  const labels = () => [...screen.getByRole('region', { name: 'Riassunto' }).querySelectorAll('.sum-k')].map(k => k.textContent);

  it("le righe nell'ordine della spec", () => {
    mount();
    expect(labels()).toEqual(['Tipo', 'Attaccanti', 'Muri', 'Campo', 'Colpisce', 'Debole a', 'Ruoli', 'Minacce']);
  });

  it('righe vuote assenti: niente Muri, Campo, Minacce; restano Tipo, Colpisce, Debole a, Ruoli', () => {
    mount({ summary: summaryOf({ walls: [], field: [], threats: null }) });
    expect(labels()).toEqual(['Tipo', 'Attaccanti', 'Colpisce', 'Debole a', 'Ruoli']);
    cleanup();
    mount({ summary: summaryOf({ attackers: [], walls: [], field: [], threats: null }) });
    expect(labels()).toEqual(['Tipo', 'Colpisce', 'Debole a', 'Ruoli']);
  });

  it("con un solo Pokémon la riga Tipo non c'è, le altre sì", () => {
    mount({ members: 1 });
    expect(labels()).toEqual(['Attaccanti', 'Muri', 'Campo', 'Colpisce', 'Debole a', 'Ruoli', 'Minacce']);
  });

  it('Tipo: nome del tipo e stili, "—" senza tipo, e il "?" apre la guida ai tipi di team', async () => {
    const user = userEvent.setup();
    mount({ summary: summaryOf({ styles: ['rain'] }) });
    const region = screen.getByRole('region', { name: 'Riassunto' });
    expect(region).toHaveTextContent('Hyper Offense');
    expect(region.querySelector('.sum-arch')).toHaveAttribute('title', 'Tutto attacco, pochi o nessun muro');
    expect(region).toHaveTextContent('Pioggia');
    await user.click(within(region).getByRole('button', { name: 'Tipi di team: come si riconoscono' }));
    expect(screen.getByRole('dialog', { name: 'Tipi di team' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    cleanup();
    mount({ summary: summaryOf({ archetype: null }) });
    expect(screen.getByRole('region', { name: 'Riassunto' }).querySelector('.sum-arch')).toHaveTextContent('—');
  });

  it('Attaccanti: numero, "top" e sprite; Muri: numero e sprite', () => {
    mount();
    const attackers = sumRow('Attaccanti')!;
    expect(attackers).toHaveTextContent(/2\s*top/);
    expect(attackers.querySelectorAll('.sprite')).toHaveLength(2);
    expect(attackers).toHaveTextContent('Garchomp');
    expect(sumRow('Muri')).toHaveTextContent(/^Muri\s*1/);
  });

  it("Campo: il membro con le sue mosse nella lingua dell'interfaccia", () => {
    mount({ summary: summaryOf({ field: [{ member: 'Garchomp', items: ['Stealth Rock', 'Reflect'], weather: 'Pioggia' }] }) });
    const field = sumRow('Campo')!;
    expect(field.querySelectorAll('.sprite')).toHaveLength(1);
    expect(field).toHaveTextContent(/Lanciarocce|Stealth Rock/);
    expect(field.querySelectorAll('.sum-pill')).toHaveLength(3);
    expect(field).toHaveTextContent('Pioggia');
  });

  it('Colpisce: N/18 tipi e pill verde se tutti, altrimenti "N mancanti" (1 mancante)', () => {
    mount();
    expect(sumRow('Colpisce')).toHaveTextContent(/18\s*\/18 tipi/);
    expect(sumRow('Colpisce')).toHaveTextContent('✓ tutti');
    expect(sumRow('Colpisce')!.querySelector('.sum-pill')).toHaveClass('ok');
    cleanup();
    mount({ summary: summaryOf({ hits: { covered: 16, total: 18 } }) });
    expect(sumRow('Colpisce')).toHaveTextContent(/16\s*\/18 tipi/);
    expect(sumRow('Colpisce')!.querySelector('.sum-pill')).toHaveTextContent(/^2 mancanti$/);
    expect(sumRow('Colpisce')!.querySelector('.sum-pill')).toHaveClass('bad');
    cleanup();
    mount({ summary: summaryOf({ hits: { covered: 17, total: 18 } }) });
    expect(sumRow('Colpisce')!.querySelector('.sum-pill')).toHaveTextContent(/^1 mancante$/);
  });

  it('Debole a: 6 debolezze + 2 sono 6 icone e "+2"; le gravi hanno is-serious; nessuna debolezza è "✓ nessuna"', () => {
    const types = ['Ground', 'Ice', 'Fire', 'Water', 'Rock', 'Fairy', 'Dark', 'Bug'];
    mount({ summary: summaryOf({ weak: types.map((type, i) => ({ type, serious: i < 2, resist: 1 })) }) });
    const weak = sumRow('Debole a')!;
    expect(weak.querySelectorAll('.type-icons')).toHaveLength(6);
    expect(weak).toHaveTextContent('+2');
    // Il "+N" letto per intero ai lettori di schermo
    expect(weak.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Altri 2 tipi$/);
    expect(weak.querySelectorAll('.is-serious')).toHaveLength(2);
    expect(weak.querySelectorAll('.sum-weak:not(.is-serious)')).toHaveLength(4);
    expect(weak).toHaveTextContent('8 tipi');
    cleanup();
    mount({ summary: summaryOf({ weak: [] }) });
    expect(sumRow('Debole a')).toHaveTextContent('✓ nessuna');
    cleanup();
    mount({ summary: summaryOf({ weak: [{ type: 'Ice', serious: false, resist: 1 }] }) });
    expect(sumRow('Debole a')!.querySelector('.sum-pill')).toHaveTextContent(/^1 tipo$/);
  });

  it('Ruoli: "✓ importanti coperti" oppure "N mancanti"', () => {
    mount();
    expect(sumRow('Ruoli')).toHaveTextContent('✓ importanti coperti');
    cleanup();
    mount({ summary: summaryOf({ missingRoles: ['hazards', 'pivot'] }) });
    expect(sumRow('Ruoli')).toHaveTextContent('2 mancanti');
    expect(sumRow('Ruoli')!.querySelector('.sum-names')).toHaveTextContent(/Hazard.*Pivot/i);
    expect(sumRow('Ruoli')!.querySelector('.sum-pill')).toHaveClass('bad');
    cleanup();
    mount({ summary: summaryOf({ missingRoles: ['pivot'] }) });
    expect(sumRow('Ruoli')!.querySelector('.sum-pill')).toHaveTextContent(/^1 mancante$/);
  });

  it('Minacce: 6 minacce sono 4 sprite e "+2"; "N senza check"; nessuna è "✓ tutte gestite"', () => {
    const threats = ['Great Tusk', 'Kyurem', 'Heatran', 'Gholdengo', 'Dragonite', 'Zapdos'].map((species, i) => ({ species, usage: 0.3 - i / 20 }));
    mount({ summary: summaryOf({ threats }) });
    const row = sumRow('Minacce')!;
    expect(row.querySelectorAll('.sprite')).toHaveLength(4);
    expect(row).toHaveTextContent('+2');
    expect(row).toHaveTextContent('6 senza check');
    expect(row.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Altre 2 minacce$/);
    cleanup();
    mount({ summary: summaryOf({ threats: [] }) });
    expect(sumRow('Minacce')).toHaveTextContent('✓ tutte gestite');
  });

  it('clic: Attaccanti e Colpisce a Offesa, Muri e Debole a a Difesa, Campo e Ruoli a Ruoli, Minacce al Coaching', async () => {
    const user = userEvent.setup();
    const { onView } = mount();
    for (const label of ['Attaccanti', 'Colpisce', 'Muri', 'Debole a', 'Campo', 'Ruoli', 'Minacce']) await user.click(sumRow(label)!);
    expect(onView.mock.calls.map(c => c[0])).toEqual(['strength', 'strength', 'defense', 'defense', 'roles', 'roles', 'coaching']);
  });
});

describe('Riassunto ampio (team ridotto): righe più ricche', () => {
  const chips = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('.sum-chip')].map(c => c.textContent);

  it('normale e stretto: righe compatte, niente schede coi nomi', () => {
    mount({ density: 'normal' });
    expect(screen.getByRole('region', { name: 'Riassunto' }).querySelectorAll('.sum-chip')).toHaveLength(0);
  });

  it('Attaccanti con nome e Offesa, Muri con nome e Difesa', () => {
    mount({ density: 'roomy' });
    expect(chips(sumRow('Attaccanti')!)).toEqual(['Garchomp92', 'Zapdos86']);
    expect(sumRow('Attaccanti')!.querySelectorAll('.sprite')).toHaveLength(2);
    expect(chips(sumRow('Muri')!)).toEqual(['Toxapex88']);
  });

  it('Campo: sprite, nome e quello che prepara', () => {
    mount({ density: 'roomy', summary: summaryOf({ field: [{ member: 'Garchomp', items: ['Stealth Rock'], weather: 'Pioggia' }] }) });
    const [chip] = sumRow('Campo')!.querySelectorAll<HTMLElement>('.sum-chip');
    expect(chip).toHaveTextContent(/^Garchomp(Lanciarocce|Stealth Rock)Pioggia$/);
    expect(chip.querySelector('.sprite')).not.toBeNull();
  });

  it('Colpisce: i tipi non colpiti per nome', () => {
    mount({ density: 'roomy', summary: summaryOf({ hits: { covered: 16, total: 18 }, hitsMissing: ['Normal', 'Ghost'] }) });
    expect(chips(sumRow('Colpisce')!).join('|')).toMatch(/^(Normale|Normal)\|(Spettro|Ghost)$/);
  });

  it('Debole a: icona e nome del tipo; le gravi senza resistenze segnate "nessuno resiste"', () => {
    mount({ density: 'roomy' });
    const row = sumRow('Debole a')!;
    expect(chips(row).join('|')).toMatch(/^(Terra|Ground)nessuno resiste\|(Ghiaccio|Ice)$/);
    expect(row.querySelectorAll('.sum-chip.bad')).toHaveLength(1);
  });

  it('Ruoli: i ruoli chiave coperti (✓) e mancanti (✕) per nome', () => {
    mount({ density: 'roomy', summary: summaryOf({ keyRoles: [{ need: 'hazards', covered: true }, { need: 'pivot', covered: false }], missingRoles: ['pivot'] }) });
    const row = sumRow('Ruoli')!;
    expect(row.querySelectorAll('.sum-chip.ok')).toHaveLength(1);
    expect(row.querySelectorAll('.sum-chip.bad')).toHaveLength(1);
    expect(row.querySelector('.sum-chip.bad')).toHaveTextContent(/Pivot/);
  });

  it('Minacce: sprite, nome e uso', () => {
    mount({ density: 'roomy' });
    expect(chips(sumRow('Minacce')!)).toEqual(['Great Tusk23%', 'Kyurem21%', 'Heatran17%']);
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
    expect(dash.querySelectorAll('.sum-chip').length).toBeGreaterThan(0);
    size.height = RICH_FROM - 1;
    fire();
    expect(dash).not.toHaveClass('rich');
    expect(dash).toHaveAttribute('data-density', 'roomy');
    expect(dash.querySelectorAll('.sum-chip')).toHaveLength(0);
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

  it('Riassunto: gli sprite che non stanno in una riga vanno nel "+N" (Attaccanti, Muri), letto per intero', () => {
    stubSumFit(() => 2);
    const six = ['Garchomp', 'Zapdos', 'Kingambit', 'Dragapult', 'Gholdengo', 'Great Tusk'];
    mount({ summary: summaryOf({ attackers: six, walls: ['Toxapex', 'Corviknight', 'Skarmory'] }) });
    const attackers = sumRow('Attaccanti')!;
    expect(attackers).toHaveTextContent(/6\s*top/);
    expect(attackers.querySelectorAll('.sprite')).toHaveLength(2);
    expect(attackers.querySelector('.sum-more')).toHaveTextContent('+4');
    expect(attackers.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Altri 4 Pokémon$/);
    expect(sumRow('Muri')!.querySelectorAll('.sprite')).toHaveLength(2);
    expect(sumRow('Muri')!.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Un altro Pokémon$/);
  });

  it('Riassunto: con il tetto (6 debolezze) il "+N" che non sta toglie ancora un\'icona', () => {
    // Le 6 icone stanno, ma il "+N" accanto alla sesta va a capo
    stubSumFit(shown => (shown >= 6 ? 6 : 99), true);
    const types = ['Ground', 'Ice', 'Fire', 'Water', 'Rock', 'Fairy', 'Dark', 'Bug'];
    mount({ summary: summaryOf({ weak: types.map(type => ({ type, serious: false, resist: 1 })) }) });
    const weak = sumRow('Debole a')!;
    expect(weak.querySelectorAll('.type-icons')).toHaveLength(5);
    expect(weak.querySelector('.sum-more')).toHaveTextContent('+3');
  });

  it('Campo: il "+N" al singolare per un solo piazzatore nascosto', () => {
    stubSumFit(() => 1);
    mount({ summary: summaryOf({ field: [{ member: 'Garchomp', items: ['Stealth Rock'] }, { member: 'Ting-Lu', items: ['Spikes'] }] }) });
    expect(sumRow('Campo')!.querySelector('.sum-more .visually-hidden')).toHaveTextContent(/^Un altro che prepara il campo$/);
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
