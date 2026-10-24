import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { AreaDetail } from '../../src/ui/AreaDetail';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import type { TeamRoles } from '../../src/engine/rolesArea';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const ROLES_TEAM = [
  'Corviknight @ Leftovers\nAbility: Pressure\nEVs: 252 HP / 4 Def / 252 SpD\nCareful Nature\n- Body Press\n- Iron Defense\n- Roost\n- Defog',
  'Gliscor @ Toxic Orb\nAbility: Poison Heal\nEVs: 244 HP / 248 Def / 16 Spe\nImpish Nature\n- Earthquake\n- Toxic\n- Protect\n- Stealth Rock',
  'Zapdos @ Heavy-Duty Boots\nAbility: Static\nEVs: 248 HP / 8 SpA / 252 Spe\nTimid Nature\n- Thunderbolt\n- Hurricane\n- Taunt\n- Roost',
].join('\n\n');

async function importRolesTeam(lang: 'it' | 'en' = 'it') {
  const user = userEvent.setup();
  render(<App initialLang={lang} data={fixtureData} />);
  await user.click(screen.getByLabelText(lang === 'it' ? 'Testo Showdown' : 'Showdown text'));
  await user.paste(ROLES_TEAM);
  await user.click(screen.getByRole('button', { name: lang === 'it' ? 'Importa' : 'Import' }));
  return { user, rating: screen.getByRole('group', { name: lang === 'it' ? 'Valutazione team' : 'Team rating' }) };
}

async function openRoles(lang: 'it' | 'en' = 'it') {
  const { user, rating } = await importRolesTeam(lang);
  const bar = within(rating).getByRole('button', { name: lang === 'it' ? /^Ruoli \d+$/ : /^Roles \d+$/ });
  expect(bar).toHaveAttribute('aria-haspopup', 'dialog');
  await user.click(bar);
  const dialog = screen.getByRole('dialog', { name: bar.textContent! });
  return { user, bar, dialog };
}

describe('dettaglio dei Ruoli a schede', () => {
  it('la barra dei Ruoli apre il dettaglio: Generale e una scheda per famiglia', async () => {
    const { dialog } = await openRoles();
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent!.replace(/\s*[\d/]+$/, ''))).toEqual(['Generale', 'Attacco', 'Difesa', 'Campo', 'Disturbo']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    // Le famiglie mostrano quante voci il team copre
    for (const tab of tabs.slice(1)) expect(tab.textContent).toMatch(/\d+\/\d+$/);
  });

  it('una famiglia: ogni sotto-ruolo con chi lo porta, il valore e il motivo', async () => {
    const { user, dialog } = await openRoles();
    await user.click(within(dialog).getByRole('tab', { name: /^Disturbo/ }));
    const panel = within(dialog).getByRole('tabpanel');
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Motivo', 'Valore']);
    // Taunt: la quota del meta superata in velocità
    const taunt = within(table).getAllByRole('row').find(r => /Zapdos/.test(r.textContent!) && /Taunt/.test(r.textContent!))!;
    expect(taunt).toHaveTextContent(/Taunt, più veloce del \d+% del (meta|tier)/);
    expect(within(taunt).getAllByRole('cell').at(-1)).toHaveTextContent(/^\d+$/);
    // Toxic: la quota del meta che non ne è immune
    expect(table).toHaveTextContent(/Toxic: \d+% del (meta|tier) non immune/);
    // Ogni sotto-ruolo della famiglia ha la sua riga di gruppo, anche se nessuno lo porta
    const groups = [...table.querySelectorAll('.ad-group th')].map(th => th.textContent!);
    expect(groups.some(g => g.startsWith('Encore'))).toBe(true);
  });

  it('il tooltip della barra elenca ogni membro coi suoi sotto-ruoli brevi', async () => {
    const { rating } = await importRolesTeam();
    const tip = within(rating).getByRole('button', { name: /^Ruoli \d+$/ }).getAttribute('data-tip')!;
    const lines = tip.split('\n');
    expect(lines).toHaveLength(3);
    // Gliscor con Stealth Rock: l'hazard col nome breve
    expect(lines.find(l => l.startsWith('Gliscor '))).toMatch(/Hazard/);
    expect(lines.find(l => l.startsWith('Corviknight '))).toMatch(/Rimozione/);
  });

  it('Esc chiude e il focus torna alla barra', async () => {
    const { user, bar } = await openRoles();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bar).toHaveFocus();
  });

  it('in inglese', async () => {
    const { dialog } = await openRoles('en');
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*[\d/]+$/, ''))).toEqual(['General', 'Attack', 'Defense', 'Field', 'Disruption']);
  });
});

describe('Generale dei Ruoli', () => {
  it('voci importanti con valore e chi le porta, extra delle minori, mancanze essenziali coi punti', () => {
    const base = rateTeam([{ ...emptySet('Gliscor'), moves: ['Stealth Rock'] }], fixtureData, 'it')!;
    const roles: TeamRoles = {
      value: 64, base: 0.5, extra: 0.03,
      rows: [
        { key: 'attacker', level: 'essential', value: 0, by: [] },
        { key: 'hazards', level: 'important', value: 1, by: [{ species: 'Gliscor', value: 1, source: 'Stealth Rock' }] },
        { key: 'removal', level: 'important', value: 0, by: [] },
        { key: 'taunt', level: 'minor', value: 1, by: [{ species: 'Zapdos', value: 1, source: 'Taunt' }] },
      ],
      failures: [{ text: 'Nessun attaccante nel team', points: 2 }],
      members: [
        { species: 'Gliscor', values: { hazards: 1 }, reasons: [{ role: 'hazards', value: 1, source: 'Stealth Rock' }] },
        { species: 'Zapdos', values: { taunt: 1 }, reasons: [{ role: 'taunt', value: 1, source: 'Taunt', share: 1 }] },
        // Team di 6: solo allora le essenziali mancanti danno malus
        ...['Clefable', 'Toxapex', 'Corviknight', 'Dondozo'].map(species => ({ species, values: {}, reasons: [] })),
      ],
    };
    const rating = { ...base, roles, areas: base.areas.map(a => (a.key === 'roles' ? { ...a, value: 64 } : a)) };
    renderIt(<AreaDetail rating={rating} area="roles" onClose={() => {}} />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('term').map(term => term.textContent)).toEqual(['Voci importanti', 'Voci minori', 'Voci essenziali']);
    // Base 50, extra +3, malus −2
    expect(within(panel).getAllByRole('definition').map(d => d.querySelector('strong')!.textContent)).toEqual(['50', '+3', '−2']);
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Voce', 'Valore', 'Chi la porta']);
    const row = (name: string) => within(table).getByRole('row', { name: new RegExp(`^${name}`) });
    expect(within(row('Hazard')).getAllByRole('cell')[0]).toHaveTextContent('100');
    expect(row('Hazard')).toHaveTextContent('Gliscor (Stealth Rock)');
    expect(within(row('Rimozione hazard')).getAllByRole('cell')[0]).toHaveTextContent('0');
    expect(row('Taunt')).toHaveTextContent('Zapdos (Taunt)');
    // L'essenziale mancante: il suo malus al posto del valore, e il motivo nella voce
    expect(within(row('Minaccia offensiva')).getAllByRole('cell')[0]).toHaveTextContent('−2');
    expect(panel).toHaveTextContent('Nessun attaccante nel team (−2)');
    expect([...table.querySelectorAll('.ad-group th')].map(th => th.textContent)).toEqual(['Essenziali', 'Importanti', 'Minori']);
  });
});

describe('setup difensivo nel dettaglio della Difesa', () => {
  it('chi ha Iron Defense mostra tra parentesi quanto guadagna, col setup nel tooltip', async () => {
    const { user, rating } = await importRolesTeam();
    await user.click(within(rating).getByRole('button', { name: /^Difesa \d+$/ }));
    const dialog = screen.getByRole('dialog');
    const row = within(dialog).getByRole('row', { name: /^Corviknight/ });
    const gain = row.querySelector('.ad-gain')!;
    expect(gain).toHaveTextContent(/^\(\+\d+\)$/);
    expect(gain).toHaveAttribute('title', 'Con il setup: Iron Defense');
  });
});
