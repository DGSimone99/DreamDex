import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const analysis = analyzeTeam(team, fixtureData);
const view = (area: 'strength' | 'defense' | 'speed' = 'strength') => renderIt(<AreaView rating={rateTeam(team, fixtureData, 'it')!} area={area} team={team} analysis={analysis} problems={[]} />);

// Telefono e tablet piccolo (fino a 767 px): niente da scorrere di lato
describe('Offesa sullo schermo stretto', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: ['(max-width: 767px)', '(max-width: 599px)', '(max-width: 1099px)'].includes(query), media: query, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Generale: per ogni membro il nome e quanto porta, sotto la barra Tipi e la barra Meta', () => {
    view();
    const groups = document.querySelectorAll('.og-stack-table tbody.og-stack-mon:not(.og-stack-team)');
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('.og-mon-row')).toHaveTextContent('Great Tusk');
    expect(groups[0].querySelector('.og-share-num')).toHaveTextContent(/^\+\d+$/);
    expect([...groups[0].querySelectorAll('.og-bar-label')].map(th => th.textContent)).toEqual(['Tipi', 'Meta']);
    expect(document.querySelector('.og-stack-team')).toHaveTextContent('Team Coverage');
  });

  it('Coverage tipi girata: 18 tipi in riga, i membri in colonna, senza la colonna Team (il filo sotto il tipo dice se è coperto)', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const table = screen.getByRole('table', { name: 'Offesa: Coverage tipi' });
    expect(table).toHaveClass('ct-flip-table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(18);
    expect([...table.querySelectorAll('thead th.ct-mon-h')].map(th => th.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    for (const row of table.querySelectorAll('tbody tr')) expect(row.querySelectorAll('td')).toHaveLength(2);
    expect(table.querySelector('.ct-level')).toBeNull();
  });

  it('Coverage meta girata: le minacce in riga, i membri in colonna, senza la colonna Team', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const table = screen.getByRole('table', { name: 'Offesa: Coverage meta' });
    expect(table).toHaveClass('ct-flip-table');
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(8);
    for (const row of rows) expect(row.querySelectorAll('td')).toHaveLength(2);
    expect(screen.getByRole('navigation', { name: /pagine/i })).toBeInTheDocument();
  });

  it('Difesa: Generale a barre impilate, Coverage tipi e meta girate, Recupero una riga per voce', async () => {
    const user = userEvent.setup();
    view('defense');
    const groups = document.querySelectorAll('.og-stack-table tbody.og-stack-mon:not(.og-stack-team)');
    expect(groups).toHaveLength(2);
    expect([...groups[0].querySelectorAll('.og-bar-label')].map(th => th.textContent)).toEqual(['Tipi', 'Meta']);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const types = screen.getByRole('table', { name: 'Difesa: Coverage tipi' });
    expect(types).toHaveClass('ct-flip-table');
    expect(types.querySelectorAll('tbody tr')).toHaveLength(18);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const meta = screen.getByRole('table', { name: 'Difesa: Coverage meta' });
    expect(meta).toHaveClass('ct-flip-table');
    for (const row of meta.querySelectorAll('tbody tr')) expect(row.querySelectorAll('td')).toHaveLength(2);
    await user.click(screen.getByRole('tab', { name: /^Recupero/ }));
    const sus = screen.getByRole('table', { name: 'Difesa: Recupero' });
    expect(sus).toHaveClass('sus-stack');
    expect([...sus.querySelectorAll('tbody.og-stack-mon')[0].querySelectorAll('.og-bar-label')].map(th => th.textContent)).toEqual(['Perde', 'Recupera', 'Netto']);
  });

  it('Velocità: per ogni membro una fascia col nome e sotto la barra che apre i dettagli; in fondo il team', () => {
    view('speed');
    const table = screen.getByRole('table', { name: 'Velocità: Generale' });
    expect(table).toHaveClass('sp-stack-table');
    const groups = table.querySelectorAll('tbody.og-stack-mon:not(.og-stack-team)');
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('.og-mon-row')).toHaveTextContent('Great Tusk');
    expect(groups[0].querySelector('.og-bar-row button.sp-bar-btn')).toHaveAccessibleName(/Great Tusk/);
    expect(table.querySelector('.og-stack-team .sp-team')).not.toBeNull();
  });
});
