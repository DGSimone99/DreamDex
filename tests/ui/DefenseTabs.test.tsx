import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { weaknessSeverity } from '../../src/engine/coach';
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
const withMeta = () => rateTeam(team, fixtureData, 'it')!;
const noMeta = () => rateTeam(team, { ...fixtureData, ignoreMeta: true }, 'it')!;

describe('Difesa: Generale e guida', () => {
  it('la Difesa si apre su Generale, senza spiegazioni sulla pagina', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.ad-how')).toBeNull();
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(/potenza 100/);
  });

  it('Generale: una tessera per sottostatistica, cliccandola si apre la sottoscheda', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('button', { name: /Robustezza|Sostenibilità|Coverage tipi|Coverage meta/ })).toHaveLength(4);
    await user.click(within(panel).getByRole('button', { name: /^Robustezza/ }));
    expect(screen.getByRole('tab', { name: /^Robustezza/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('senza meta: 3 tessere e nessuna sezione Coverage meta nella guida', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button', { name: /Robustezza|Sostenibilità|Coverage/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(within(screen.getByRole('dialog')).queryByRole('tab', { name: 'Coverage meta' })).toBeNull();
  });

  it('il "?" della sottoscheda aperta apre la guida su quella sezione; Esc riporta il focus al "?"', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Robustezza/ }));
    const help = screen.getByRole('button', { name: 'Come funziona Robustezza' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Guida: Difesa' });
    expect(within(dialog).getByRole('tab', { name: 'Robustezza' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('OHKO');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });
});

describe('Difesa: Robustezza e Sostenibilità', () => {
  it('Robustezza: membri in riga, attaccanti in colonna, fisici poi speciali, valore del lato in fondo a ogni gruppo', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Robustezza/ }));
    const table = within(screen.getByRole('tabpanel')).getByRole('table');
    const rows = within(table).getAllByRole('row').filter(r => within(r).queryAllByRole('rowheader').length);
    expect(rows).toHaveLength(rating.defense.members.length);
    const atk = rating.defense.matrix.length;
    expect(within(rows[0]).getAllByRole('cell')).toHaveLength(atk + 2); // + Fisica e Speciale
    expect(within(table).getByRole('columnheader', { name: rating.defense.matrix[0].species })).toBeInTheDocument();
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent(/\d+%\s*(OHKO|2HKO|3HKO|4HKO\+)/);
  });

  it('Sostenibilità: una riga per membro con perdita, recupero e fonti', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    const panel = screen.getByRole('tabpanel');
    // Gholdengo ha Recover (50%) ma con questo team non regge un 3HKO: il recupero vale metà (+25%) e lo dice
    const gholdengo = rating.defense.members[1].sustainParts;
    expect(gholdengo.halved).toBe(true);
    expect(within(panel).getByText('+25%')).toBeInTheDocument();
    expect(within(panel).getByText('vale metà')).toBeInTheDocument();
    expect(within(panel).getAllByText(/Recover/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByRole('row').length).toBeGreaterThanOrEqual(rating.defense.members.length);
  });
});

describe('Difesa: Coverage tipi e Coverage meta', () => {
  it('Coverage tipi: una tabella sola, membri in riga e 18 tipi in colonna, poi Deboli/Resistono/Sicurezza', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const panel = screen.getByRole('tabpanel');
    const tables = within(panel).getAllByRole('table');
    expect(tables).toHaveLength(1);
    expect(within(tables[0]).getAllByRole('columnheader').length).toBe(19); // angolo + 18 tipi
    const tusk = within(tables[0]).getByRole('row', { name: /^Great Tusk/ });
    // Great Tusk è debole a più tipi: la cella dell'Acqua dice ×2
    const water = analysis.weakness.findIndex(row => row.type === 'Water');
    expect(within(tusk).getAllByRole('cell')[water]).toHaveTextContent('×2');
    for (const name of ['Deboli', 'Resistono', 'Sicurezza']) expect(within(tables[0]).getByRole('row', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    // I conteggi gravi + minori della vecchia tabella restano
    const counts = [...panel.querySelectorAll('.issue [aria-hidden="true"]')].map(el => Number(el.textContent));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(analysis.weakness.filter(row => weaknessSeverity(row)).length);
  });

  it('Coverage tipi: i tipi in difetto hanno il segno in testata, la Sicurezza è quella del motore', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const table = within(screen.getByRole('tabpanel')).getByRole('table');
    const marked = [...table.querySelectorAll('thead th.sev-serious, thead th.sev-minor')];
    expect(marked).toHaveLength(analysis.weakness.filter(row => weaknessSeverity(row)).length);
    const safety = within(table).getByRole('row', { name: /^Sicurezza/ });
    expect(within(safety).getAllByRole('cell').map(c => c.textContent))
      .toEqual(rating.defense.coverageTypes.rows.map(row => `${row.safety}%`));
  });

  it('Coverage meta: una tessera per minaccia, con livello e chi la regge nel nome accessibile', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const tiles = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    expect(tiles).toHaveLength(rating.defense.coverageMeta!.rows.length);
    const top = [...rating.defense.coverageMeta!.rows].sort((a, b) => b.weight - a.weight)[0];
    expect(tiles[0]).toHaveAccessibleName(new RegExp(`^${top.species}.*${top.level}%`));
  });
});
