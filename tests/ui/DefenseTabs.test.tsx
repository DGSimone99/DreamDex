import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
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
    expect(within(panel).getAllByRole('button', { name: /Sostenibilità|Coverage tipi|Coverage meta/ })).toHaveLength(3);
    await user.click(within(panel).getByRole('button', { name: /^Sostenibilità/ }));
    const tab = screen.getByRole('tab', { name: /^Sostenibilità/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveFocus();
  });

  it('le tessere hanno come nome il testo visibile, col fatto principale', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: /^Sostenibilità.*Recupero.*\d+\/\d+/ })).toBeInTheDocument();
  });

  it('senza meta: 3 tessere e nessuna sezione Coverage meta nella guida', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(within(screen.getByRole('tabpanel')).getAllByRole('button', { name: /Sostenibilità|Coverage/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(within(screen.getByRole('dialog')).queryByRole('tab', { name: 'Coverage meta' })).toBeNull();
  });

  it('il "?" della sottoscheda aperta apre la guida su quella sezione; Esc riporta il focus al "?"', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    const help = screen.getByRole('button', { name: 'Come funziona Sostenibilità' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Guida: Difesa' });
    expect(within(dialog).getByRole('tab', { name: 'Sostenibilità' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Leech Seed');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('cambiare sezione nella guida non sposta la sottoscheda; alla chiusura il focus torna al "?"', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    await user.click(screen.getByRole('button', { name: 'Come funziona Sostenibilità' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Difesa' });
    await user.click(within(dialog).getByRole('tab', { name: 'Come funziona' }));
    expect(within(dialog).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('tab', { name: /^Sostenibilità/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Come funziona Sostenibilità' })).toHaveFocus();
  });
});

describe('Difesa: Robustezza e Sostenibilità', () => {
  it('Sostenibilità: una riga per membro con perdita, recupero e fonti', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    const panel = screen.getByRole('tabpanel');
    // Gholdengo ha Recover (50%): il recupero è pieno o, se regge poco, vale metà (+25%) e lo dice
    const gholdengo = rating.defense.members[1].sustainParts;
    expect(within(panel).getByText(gholdengo.halved ? '+25%' : '+50%')).toBeInTheDocument();
    if (gholdengo.halved) expect(within(panel).getByText('vale metà')).toBeInTheDocument();
    else expect(within(panel).queryByText('vale metà')).toBeNull();
    expect(within(panel).getAllByText(/Recover/).length).toBeGreaterThan(0);
    expect(within(panel).getAllByRole('row').length).toBeGreaterThanOrEqual(rating.defense.members.length);
  });
});

describe('Difesa: recupero a metà', () => {
  it('il segno "vale metà" spiega la regola nuova (meno del 35% dei colpi di tipo)', async () => {
    const user = userEvent.setup();
    const zam: TeamSet[] = [{ ...emptySet('Alakazam'), item: 'Life Orb', ability: 'Magic Guard', moves: ['Psychic', 'Recover'], evs: { spa: 252, spe: 252 } }];
    const rating = rateTeam(zam, fixtureData, 'it')!;
    expect(rating.defense.members[0].sustainParts.halved).toBe(true);
    renderIt(<AreaView rating={rating} area="defense" team={zam} analysis={analyzeTeam(zam, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    const chip = document.querySelector('.ad-halved')!;
    expect(chip.getAttribute('title')).toMatch(/35%/);
    expect(chip.getAttribute('title')).not.toMatch(/3HKO/);
  });
});

describe('Difesa: Coverage tipi e Coverage meta', () => {
  const openTypes = async (t: TeamSet[] = team) => {
    const user = userEvent.setup();
    const rating = rateTeam(t, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="defense" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    return { rating, table: within(screen.getByRole('tabpanel')).getByRole('table') };
  };
  const TAG = { ohko: 'OHKO', two: '2HKO', three: '3HKO', four: '4HKO+' } as const;
  const CLS = { ohko: 'hold-ohko', two: 'hold-2', three: 'hold-3', four: 'hold-4' } as const;

  it('Coverage tipi: membri × 18 tipi, in ogni casella il danno del colpo forte sul lato peggiore, colorato per quanti colpi regge', async () => {
    const { rating, table } = await openTypes();
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent).slice(-1)).toEqual(['Regge']);
    expect(within(table).getAllByRole('columnheader')).toHaveLength(20); // angolo + 18 tipi + Regge
    const typed = rating.defense.typed;
    team.forEach((_, m) => {
      const row = within(table).getAllByRole('row')[m + 1];
      const cells = within(row).getAllByRole('cell');
      typed[m].cells.forEach((cell, i) => {
        expect(cells[i].querySelector('.hold-pct')!.textContent).toBe(`${cell.pct}%`);
        expect(cells[i]).toHaveClass(CLS[cell.band]);
        expect(cells[i].querySelector('.visually-hidden')!.textContent!.trim()).toBe(TAG[cell.band]);
        expect(cells[i].getAttribute('title')).toContain(`fisico ${cell.physical}% · speciale ${cell.special}%`);
      });
      // A destra quanto regge il membro (solo informazione)
      expect(cells[18]).toHaveTextContent(`${rating.defense.members[m].hold}%`);
    });
    // Il moltiplicatore classico resta in piccolo: Great Tusk è debole all'Acqua
    const water = rating.defense.coverageTypes.rows.findIndex(r => r.type === 'Water');
    const tusk = within(table).getByRole('row', { name: /^Great Tusk/ });
    expect(within(tusk).getAllByRole('cell')[water].querySelector('.ct-mult')).toHaveTextContent('×2');
  });

  it('in fondo Lo reggono e Copertura del motore; niente più Deboli e Resistono; i buchi segnati in testata', async () => {
    const { rating, table } = await openTypes();
    const rows = rating.defense.coverageTypes.rows;
    const held = within(table).getByRole('row', { name: /^Lo reggono/ });
    expect(within(held).getAllByRole('cell').slice(0, 18).map(c => c.textContent)).toEqual(rows.map(r => `${r.heldBy.length}`));
    const level = within(table).getByRole('row', { name: /^Copertura/ });
    expect(within(level).getAllByRole('cell').slice(0, 18).map(c => c.textContent)).toEqual(rows.map(r => `${r.level}%`));
    expect(within(table).queryByRole('row', { name: /^Deboli/ })).toBeNull();
    expect(within(table).queryByRole('row', { name: /^Resistono/ })).toBeNull();
    expect(table.querySelectorAll('thead th.sev-serious')).toHaveLength(rating.defense.coverageTypes.weak.length);
  });

  it('un buco: un team fragile ha tipi che nessuno regge, segnati in testata', async () => {
    const glass = [{ ...emptySet('Weavile'), item: 'Choice Band', ability: 'Pressure', moves: ['Triple Axel', 'Knock Off'], evs: { atk: 252, spe: 252 } }];
    const { rating, table } = await openTypes(glass);
    expect(rating.defense.coverageTypes.weak.length).toBeGreaterThan(0);
    expect(table.querySelectorAll('thead th.sev-serious')).toHaveLength(rating.defense.coverageTypes.weak.length);
  });

  it('un membro che il motore non conosce resta con "—"', async () => {
    const { table } = await openTypes([team[0], { ...emptySet('Notamon'), moves: ['Tackle'] }]);
    const row = within(table).getAllByRole('row')[2];
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(19);
    cells.forEach(td => expect(td).toHaveTextContent('—'));
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

  it('sottoschede nell\'ordine Generale, Coverage tipi, Sostenibilità, Coverage meta (niente Robustezza)', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Sostenibilità', 'Coverage meta']);
    expect(document.body.textContent).not.toMatch(/Robustezza/);
  });

  it('senza meta niente Coverage meta, stesso ordine', () => {
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Sostenibilità']);
  });

  it('le tessere seguono l\'ordine delle sottoschede', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    const names = within(screen.getByRole('tabpanel')).getAllByRole('button').map(b => /^(Coverage tipi|Sostenibilità|Coverage meta)/.exec(b.textContent ?? '')?.[1]);
    expect(names).toEqual(['Coverage tipi', 'Sostenibilità', 'Coverage meta']);
  });

  it('le barre hanno la classe della soglia e l\'anello debole è solo sul più basso, solo sotto 50', () => {
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    const tone = (v: number) => (v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad');
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr'));
    rating.defense.members.forEach((m, i) => {
      const bars = rows[i].querySelectorAll('.def-bar');
      expect(bars[0]).toHaveClass(tone(m.hold));
      expect(bars[1]).toHaveClass(tone(m.metaHold!));
      expect(bars[3]).toHaveClass(tone(m.value));
    });
    const values = rating.defense.members.map(m => m.value);
    const lowest = values.indexOf(Math.min(...values));
    // L'etichetta c'è due volte nel DOM per riga (accanto al nome e alle statistiche): conta le righe
    const marked = rows.filter(r => r.querySelector('.def-weak'));
    if (values[lowest] < 50) {
      expect(marked).toEqual([rows[lowest]]);
      expect(rows[lowest]).toHaveTextContent('Anello debole');
    } else {
      expect(marked).toHaveLength(0);
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

  it('a squadra chiusa compaiono Colpo peggiore (il tipo che fa più male) e Recupero, con un % per ogni riga; altrimenti no', () => {
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} roomy />);
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Pokémon', 'Regge i tipi', 'Regge il meta', 'Sostenibilità', 'Difesa', 'Colpo peggiore', 'Recupero']);
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr'));
    expect(rows).toHaveLength(team.length);
    rows.forEach(row => {
      expect(row.querySelector('.def-hit .hold-chip')).toHaveTextContent(/\d+%/);
      expect(row.querySelector('.def-hit .type-icons')).not.toBeNull();
    });
    unmount();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).not.toContain('Colpo peggiore');
    expect(document.querySelector('.def-hit')).toBeNull();
  });
});
