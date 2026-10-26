import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CoachProblem } from '../../src/engine/coach';
import type { DashboardData } from '../../src/engine/overviewDashboard';
import { TYPES } from '../../src/engine/types';
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
  renderIt(<OverviewDashboard data={data} problems={problems} members={members} onView={onView} onMeta={onMeta} density={density} />);
  return { onView, onMeta };
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

  it('stretto: niente "supera", livelli, minori né controllo visibile', () => {
    mount({ density: 'tight' });
    const speed = screen.getByRole('region', { name: 'Velocità' });
    expect(within(speed).queryByText(/supera /)).toBeNull();
    expect(speed.querySelector('.dash-ctrl')).toBeNull();
    expect(speed).toHaveAttribute('title', expect.stringMatching(/^Controllo:/));
    const roles = screen.getByRole('region', { name: 'Ruoli' });
    expect(within(roles).queryByText('Essenziali')).toBeNull();
    expect(roles.querySelectorAll('.dash-chip')).toHaveLength(3); // essenziali e importanti
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
