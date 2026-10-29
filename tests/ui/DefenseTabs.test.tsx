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
    const tab = screen.getByRole('tab', { name: /^Robustezza/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveFocus();
  });

  it('le tessere hanno come nome il testo visibile, col fatto principale', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: /^Robustezza.*Fisica.*Speciale/ })).toBeInTheDocument();
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

  it('cambiare sezione nella guida non sposta la sottoscheda; alla chiusura il focus torna al "?"', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Robustezza/ }));
    await user.click(screen.getByRole('button', { name: 'Come funziona Robustezza' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Difesa' });
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    expect(within(dialog).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: /^Robustezza/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Come funziona Robustezza' })).toHaveFocus();
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
  it('Coverage tipi: una tabella sola, membri in riga e 18 tipi in colonna, in fondo Deboli, Resistono e Sicurezza', async () => {
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
    // Niente legenda e niente tessere "Chi entra": la griglia con i totali basta
    expect(panel.querySelector('.ct-legend, .def-sum')).toBeNull();
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

  it('Coverage meta: pagine da 8 minacce, dalla meno coperta (a pari livello la più usata), livello e chi la regge nel nome accessibile', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(screen.getByRole('tabpanel'));
    const rows = rating.defense.coverageMeta!.rows;
    const expected = [...rows].sort((a, b) => a.level - b.level || b.weight - a.weight);
    const names = () => panel.getAllByRole('listitem').map(tile => tile.getAttribute('aria-label')!.split(':')[0]);
    expect(names()).toEqual(expected.slice(0, 8).map(r => r.species));
    expect(panel.getAllByRole('listitem')[0]).toHaveAccessibleName(new RegExp(`^${expected[0].species}.*${expected[0].level}%`));
    // Una pagina per ogni 8 minacce; la seconda mostra le successive, e "precedente" torna alla prima
    const pages = panel.getByRole('navigation', { name: 'Pagine delle minacce' });
    expect(within(pages).getAllByRole('button', { name: /^Minacce da/ })).toHaveLength(Math.ceil(rows.length / 8));
    expect(within(pages).getByRole('button', { name: 'Minacce precedenti' })).toBeDisabled();
    if (rows.length > 8) {
      await user.click(within(pages).getByRole('button', { name: /^Minacce da 9 / }));
      expect(names()).toEqual(expected.slice(8, 16).map(r => r.species));
      await user.click(within(pages).getByRole('button', { name: 'Minacce precedenti' }));
      expect(names()).toEqual(expected.slice(0, 8).map(r => r.species));
    }
  });
});

describe('Difesa: ordine, barre e Generale a squadra chiusa', () => {
  const subTabs = () => within(screen.getByRole('tablist', { name: /Difesa/ })).getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);

  it('sottoschede nell\'ordine Generale, Coverage tipi, Robustezza, Sostenibilità, Coverage meta', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Robustezza', 'Sostenibilità', 'Coverage meta']);
  });

  it('senza meta niente Coverage meta, stesso ordine', () => {
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Robustezza', 'Sostenibilità']);
  });

  it('le tessere seguono l\'ordine delle sottoschede', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    const names = within(screen.getByRole('tabpanel')).getAllByRole('button').map(b => /^(Coverage tipi|Robustezza|Sostenibilità|Coverage meta)/.exec(b.textContent ?? '')?.[1]);
    expect(names).toEqual(['Coverage tipi', 'Robustezza', 'Sostenibilità', 'Coverage meta']);
  });

  it('le barre hanno la classe della soglia e l\'anello debole è solo sul più basso, solo sotto 50', () => {
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    const tone = (v: number) => (v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad');
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr'));
    rating.defense.members.forEach((m, i) => {
      const bars = rows[i].querySelectorAll('.def-bar');
      expect(bars[0]).toHaveClass(tone(m.physical));
      expect(bars[3]).toHaveClass(tone(m.value));
    });
    const values = rating.defense.members.map(m => m.value);
    const lowest = values.indexOf(Math.min(...values));
    const chips = document.querySelectorAll('.def-weak');
    if (values[lowest] < 50) {
      expect(chips).toHaveLength(1);
      expect(rows[lowest].querySelector('.def-weak')).toHaveTextContent('Anello debole');
    } else {
      expect(chips).toHaveLength(0);
    }
  });

  it('una Difesa bassa dà la barra rossa e l\'anello debole', () => {
    const rating = withMeta();
    const weak = { ...rating, defense: { ...rating.defense, members: rating.defense.members.map((m, i) => (i === 1 ? { ...m, value: 30 } : { ...m, value: 85 })) } };
    renderIt(<AreaView rating={weak} area="defense" team={team} analysis={analysis} problems={[]} />);
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr'));
    expect(rows[1].querySelectorAll('.def-bar')[3]).toHaveClass('bad');
    expect(rows[0].querySelectorAll('.def-bar')[3]).toHaveClass('good');
    // L'etichetta c'è due volte nel DOM (accanto al nome e accanto alle statistiche, il CSS ne mostra una), sempre in un membro solo
    expect(rows.filter(r => r.querySelector('.def-weak'))).toHaveLength(1);
    expect(rows[1].querySelector('.def-weak')).toBeTruthy();
  });

  it('la tessera del meta elenca le minacce senza risposta (nome nascosto) o dice che tutte hanno risposta', () => {
    const rating = withMeta();
    const cm = rating.defense.coverageMeta!;
    const some = { ...rating, defense: { ...rating.defense, coverageMeta: { ...cm, unanswered: ['Garchomp', 'Zapdos'] } } };
    const { unmount } = renderIt(<AreaView rating={some} area="defense" team={team} analysis={analysis} problems={[]} />);
    const tile = within(screen.getByRole('tabpanel')).getByRole('button', { name: /^Coverage meta/ });
    expect(tile).toHaveTextContent('Senza risposta');
    expect(tile).toHaveTextContent('Garchomp');
    expect(tile).toHaveTextContent('Zapdos');
    expect(tile).toHaveTextContent(/2\/\d+/);
    unmount();
    const none = { ...rating, defense: { ...rating.defense, coverageMeta: { ...cm, unanswered: [] } } };
    renderIt(<AreaView rating={none} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: /^Coverage meta/ })).toHaveTextContent('Ogni minaccia ha una risposta');
  });

  it('a squadra chiusa compaiono Colpo peggiore e Recupero, con un % per ogni riga; altrimenti no', () => {
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} roomy />);
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Pokémon', 'Fisica', 'Speciale', 'Sostenibilità', 'Difesa', 'Colpo peggiore', 'Recupero']);
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr'));
    expect(rows).toHaveLength(team.length);
    rows.forEach(row => expect(row.querySelector('.def-hit .hold-chip')).toHaveTextContent(/\d+%/));
    unmount();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).not.toContain('Colpo peggiore');
    expect(document.querySelector('.def-hit')).toBeNull();
  });
});
