import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { TYPES } from '../../src/engine/types';
import { typeName } from '../../src/i18n/game';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const analysis = analyzeTeam(team, fixtureData);
const rating = () => rateTeam(team, fixtureData, 'it')!;
const heads = () => [...within(screen.getByRole('tabpanel')).getByRole('table').querySelectorAll('thead th[aria-label]')].map(th => th.getAttribute('aria-label'));
const byUsage = <R extends { species: string; weight: number }>(rows: R[]) => [...rows].sort((a, b) => b.weight - a.weight || a.species.localeCompare(b.species));

async function openMeta(area: 'strength' | 'defense') {
  const user = userEvent.setup();
  const r = rating();
  renderIt(<AreaView rating={r} area={area} team={team} analysis={analysis} problems={[]} />);
  await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
  return { user, r };
}

describe('Coverage meta: ordine Uso · Minaccia', () => {
  for (const area of ['strength', 'defense'] as const) {
    const label = area === 'strength' ? 'Offesa' : 'Difesa';
    it(`${label}: parte da Minaccia; Uso mette prima i più usati e torna alla prima pagina`, async () => {
      const { user, r } = await openMeta(area);
      const rows = (area === 'strength' ? r.offense.coverageMeta! : r.defense.coverageMeta!).rows as { species: string; weight: number }[];
      const order = screen.getByRole('group', { name: 'Ordine' });
      const usage = within(order).getByRole('button', { name: 'Uso' });
      const threat = within(order).getByRole('button', { name: 'Minaccia' });
      expect(threat).toHaveAttribute('aria-pressed', 'true');
      expect(usage).toHaveAttribute('aria-pressed', 'false');
      const threatHeads = heads();
      // Pagina 2 (se c'è), poi Uso: si torna alla prima pagina, nell'ordine dell'uso
      const pages = screen.getByRole('navigation', { name: /^Pagine / });
      const next = within(pages).getAllByRole('button')[1];
      if (!next.hasAttribute('disabled')) {
        await user.click(next);
        expect(pages).toHaveTextContent('2/');
      }
      await user.click(usage);
      expect(usage).toHaveAttribute('aria-pressed', 'true');
      expect(pages).toHaveTextContent('1/');
      expect(heads()).toEqual(byUsage(rows).slice(0, 8).map(row => row.species));
      // Il fuoco resta sul pulsante (la tabella non si rimonta)
      expect(usage).toHaveFocus();
      await user.click(threat);
      expect(heads()).toEqual(threatHeads);
    });
  }

  it('aperta da una minaccia (Evidenziato): la sua colonna resta per prima in tutti e due gli ordini', async () => {
    const user = userEvent.setup();
    const r = rating();
    const rows = r.offense.coverageMeta!.rows;
    const species = byUsage(rows).at(-1)!.species;
    renderIt(<AreaView rating={r} area="strength" team={team} analysis={analysis} problems={[]}
      picked="coverageMeta" initialFocus={{ kind: 'threat', side: 'offense', species }} />);
    expect(heads()[0]).toBe(species);
    expect(screen.getByText(`Evidenziato: ${species}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Uso' }));
    expect(heads()[0]).toBe(species);
    expect(heads().slice(1)).toEqual(byUsage(rows).filter(row => row.species !== species).slice(0, 7).map(row => row.species));
    expect(screen.getByText(`Evidenziato: ${species}`)).toBeInTheDocument();
  });
});

describe('Riga riassuntiva per i lettori di schermo prima delle griglie', () => {
  it('Coverage tipi dell\'Offesa: i tipi che nessuno manda KO in due colpi', async () => {
    const user = userEvent.setup();
    const r = rating();
    renderIt(<AreaView rating={r} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const holes = TYPES.filter(type => r.offense.types.holes.includes(type)).map(type => typeName(type, 'it'));
    expect(screen.getByRole('table', { name: 'Offesa: Coverage tipi' })).toHaveAccessibleDescription(
      holes.length ? `Non colpiti in due colpi: ${holes.join(', ')}` : 'Ogni tipo va KO in due colpi con almeno un membro');
  });

  it('Coverage tipi della Difesa: i tipi che nessuno regge', async () => {
    const user = userEvent.setup();
    const r = rating();
    renderIt(<AreaView rating={r} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const { rows, weak } = r.defense.coverageTypes;
    const names = rows.filter(row => weak.includes(row.type)).map(row => typeName(row.type, 'it'));
    expect(screen.getByRole('table', { name: 'Difesa: Coverage tipi' })).toHaveAccessibleDescription(
      new RegExp(`^${names.length ? `Non retti: ${names.join(', ')}` : 'Ogni tipo è retto da almeno un membro'}`));
  });

  it('Coverage meta: chi nessuno manda KO in due colpi (Offesa), chi nessuno regge (Difesa), di tutte le pagine', async () => {
    const r = rating();
    const list = (rows: { species: string; weight: number }[]) => byUsage(rows).map(row => row.species).join(', ');
    const { unmount } = renderIt(<AreaView rating={r} area="strength" team={team} analysis={analysis} problems={[]} picked="coverageMeta" />);
    const offOpen = r.offense.coverageMeta!.rows.filter(row => !(row.cells ?? []).some(c => c.pct >= 50));
    expect(screen.getByRole('table', { name: 'Offesa: Coverage meta' })).toHaveAccessibleDescription(offOpen.length
      ? `Nessuno li manda KO in due colpi: ${list(offOpen)}` : 'Ogni Pokémon del meta va KO in due colpi con almeno un membro');
    unmount();
    renderIt(<AreaView rating={r} area="defense" team={team} analysis={analysis} problems={[]} picked="coverageMeta" />);
    const defOpen = r.defense.coverageMeta!.rows.filter(row => !row.heldBy.some(h => !h.partial));
    expect(defOpen.length).toBeGreaterThan(0);
    expect(screen.getByRole('table', { name: 'Difesa: Coverage meta' })).toHaveAccessibleDescription(`Nessuno li regge: ${list(defOpen)}`);
  });
});
