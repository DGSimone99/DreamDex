import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const withMeta = () => rateTeam(team, fixtureData, 'it')!;
const noMeta = () => rateTeam(team, { ...fixtureData, ignoreMeta: true }, 'it')!;
const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*[\d.,%n/d–]+$/, '').trim());

describe('vista di un\'area sulla pagina', () => {
  it('Difesa: sottostatistiche calcolate, Coverage tipi aperta di default', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" problems={[]} />);
    expect(tabs()).toEqual(expect.arrayContaining(['Robustezza', 'Sostenibilità', 'Coverage tipi', 'Coverage meta']));
    expect(screen.getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('senza meta niente Coverage meta', () => {
    renderIt(<AreaView rating={noMeta()} area="defense" problems={[]} />);
    expect(screen.queryByRole('tab', { name: /^Coverage meta/ })).toBeNull();
  });

  it('nessuna finestra', () => {
    renderIt(<AreaView rating={withMeta()} area="strength" problems={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('Bonus/Malus mostra il catalogo con le voci attive', () => {
    renderIt(<AreaView rating={withMeta()} area="bonusMalus" problems={[]} />);
    expect(screen.getAllByRole('tab').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('tabpanel').textContent!.length).toBeGreaterThan(0);
  });

  it("i problemi dell'area stanno sotto le sottostatistiche", () => {
    renderIt(<AreaView rating={withMeta()} area="defense" problems={[{ severity: 'minor', category: 'defense', text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' }]} />);
    const nav = screen.getByRole('tablist').parentElement!;
    expect(within(nav).getByText('Debole a Fuoco')).toBeInTheDocument();
  });

  it('le frecce su e giù cambiano sottostatistica', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" problems={[]} />);
    const selected = screen.getByRole('tab', { selected: true });
    selected.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('tab', { selected: true })).not.toBe(selected);
  });
});

describe('vista di un\'area: casi particolari', () => {
  it('un\'area che non conta lo dice nel titolo (Velocità nello stall)', () => {
    const rating = { ...withMeta(), areas: withMeta().areas.map(a => (a.key === 'speed' ? { ...a, inactive: true } : a)) };
    renderIt(<AreaView rating={rating} area="speed" problems={[]} />);
    expect(screen.getByRole('note')).toHaveTextContent(/Non conta nello Stall/);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
