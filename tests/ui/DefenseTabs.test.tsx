import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { metaThreats } from '../../src/engine/attackers';
import { battleSpecies } from '../../src/engine/dex';
import { moveAttackMultiplier } from '../../src/engine/types';
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

  it('Generale: niente tessere sotto la tabella', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(document.querySelector('.def-tile')).toBeNull();
    expect(within(screen.getByRole('tabpanel')).queryByRole('button', { name: /^(Sostenibilità|Coverage tipi|Coverage meta)/ })).toBeNull();
  });

  it('senza meta: nessuna sezione Coverage meta nella guida', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
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
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('Mosse che assorbono');
    // Niente più la riga "Regge poco" né la sezione del voto
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent(/Regge poco|Il voto/);
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
  it('il segno "conta meno" spiega perché (regge pochi colpi), senza numeri', async () => {
    const user = userEvent.setup();
    const zam: TeamSet[] = [{ ...emptySet('Alakazam'), item: 'Life Orb', ability: 'Magic Guard', moves: ['Psychic', 'Recover'], evs: { spa: 252, spe: 252 } }];
    const rating = rateTeam(zam, fixtureData, 'it')!;
    expect(rating.defense.members[0].sustainParts.halved).toBe(true);
    renderIt(<AreaView rating={rating} area="defense" team={zam} analysis={analyzeTeam(zam, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    const chip = document.querySelector('.ad-halved')!;
    expect(chip.getAttribute('title')).toBe('Recupero ridotto: regge pochi colpi');
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
    expect(within(table).getAllByRole('columnheader')).toHaveLength(19); // angolo + 18 tipi, niente colonna Regge
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
      expect(cells).toHaveLength(18);
    });
    // L'etichetta di efficacia in basso a sinistra (non più la seconda riga sotto il %): Great Tusk è debole all'Acqua;
    // Gholdengo resiste all'Erba e non prende Normale né Veleno; niente sui tipi neutri. Ai lettori di schermo per esteso
    const col = (type: string) => rating.defense.coverageTypes.rows.findIndex(r => r.type === type);
    const tusk = within(within(table).getByRole('row', { name: /^Great Tusk/ })).getAllByRole('cell');
    const ghold = within(within(table).getByRole('row', { name: /^Gholdengo/ })).getAllByRole('cell');
    expect(tusk[col('Water')].querySelector('.eff-tag')).toHaveTextContent('×2');
    expect(tusk[col('Water')]).toHaveTextContent('debole ×2');
    expect(ghold[col('Grass')].querySelector('.eff-tag')).toHaveTextContent('×½');
    expect(ghold[col('Grass')]).toHaveTextContent('resiste ×½');
    expect(ghold[col('Normal')].querySelector('.eff-tag')).toHaveTextContent(/^0$/);
    expect(ghold[col('Poison')]).toHaveTextContent('immune');
    expect(tusk[col('Normal')].querySelector('.eff-tag')).toBeNull();
    expect(table.querySelector('.ct-mult')).toBeNull();
    expect(document.querySelector('.ht-mult-note')).toBeNull();
  });

  it('in fondo Regge del motore, con la Copertura del tipo nel suggerimento; niente più Deboli e Resistono; i buchi segnati in testata', async () => {
    const { rating, table } = await openTypes();
    const rows = rating.defense.coverageTypes.rows;
    const held = within(table).getByRole('row', { name: /^Regge/ });
    const pills = within(held).getAllByRole('cell').slice(0, 18).map(c => c.querySelector('.ct-pill')!);
    expect(pills.map(p => p.firstChild!.textContent)).toEqual(rows.map(r => `${r.heldBy.length}`));
    // La Copertura non ha più una riga: sta nel title della pillola e nel testo nascosto
    expect(pills.map(p => p.getAttribute('title'))).toEqual(rows.map(r => `Copertura ${r.level}%`));
    expect(pills.map(p => p.textContent)).toEqual(rows.map(r => `${r.heldBy.length} · Copertura ${r.level}%`));
    expect(within(table).queryByRole('row', { name: /^Copertura/ })).toBeNull();
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
    expect(cells).toHaveLength(18);
    cells.forEach(td => expect(td).toHaveTextContent('—'));
  });

  it('"Solo efficacia" spegne solo le caselle neutre (restano al loro posto); vale anche per Coverage meta', async () => {
    const user = userEvent.setup();
    const { table } = await openTypes();
    const sw = screen.getByRole('switch', { name: 'Solo efficacia' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    // Sta nella casella in alto a sinistra della tabella (al posto di "Pokémon", che resta come nome per i lettori di schermo)
    const corner = table.querySelector('thead th.def-mon-h') as HTMLElement;
    expect(corner).toContainElement(sw);
    expect(corner).toHaveTextContent(/^Pokémon/);
    expect(document.querySelector('.area-problems-row .eff-switch')).toBeNull();
    expect(table.querySelector('.eff-dim')).toBeNull();
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    const cells = Array.from(table.querySelectorAll('tbody tr:not(.ct-sum) td'));
    cells.forEach(td => {
      const tag = td.querySelector('.eff-tag')?.textContent ?? '';
      expect(td.classList.contains('eff-dim')).toBe(!['×4', '×2', '×½', '×¼', '0'].includes(tag));
    });
    expect(cells.filter(td => !td.classList.contains('eff-dim')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const metaSwitch = screen.getByRole('switch', { name: 'Solo efficacia' });
    expect(metaSwitch).toHaveAttribute('aria-checked', 'true');
    // Nel meta accanto alle pagine, sulla stessa riga
    expect(metaSwitch.closest('.eff-corner-row')).toContainElement(screen.getByRole('navigation', { name: 'Pagine delle minacce' }));
    expect(within(screen.getByRole('tabpanel')).getByRole('table').querySelector('.eff-dim')).not.toBeNull();
  });

  it("col puntatore la colonna si accende e sotto l'icona compare il nome del tipo", async () => {
    const user = userEvent.setup();
    const { table } = await openTypes();
    const fire = within(table).getByRole('columnheader', { name: /^Fire/ });
    await user.hover(fire);
    expect(fire.querySelector('.col-name')).toHaveTextContent('Fire');
    expect(fire).toHaveClass('x-col');
  });

  it("Coverage meta: l'etichetta è l'efficacia della mossa che fa più danno al membro (la stessa del %)", async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const threats = new Map(metaThreats(fixtureData).map(t => [t.set.species, t.set]));
    const expected = [...rating.defense.coverageMeta!.rows].sort((a, b) => a.level - b.level || b.weight - a.weight).slice(0, 8);
    const table = within(screen.getByRole('tabpanel')).getByRole('table');
    let checked = 0;
    team.forEach((set, m) => {
      const cells = within(within(table).getAllByRole('row')[m + 1]).getAllByRole('cell');
      expected.forEach((r, k) => {
        const h = r.heldBy.find(x => x.species === set.species);
        if (!h?.move) return;
        const mult = moveAttackMultiplier(threats.get(r.species)!, h.move, battleSpecies(set)!.types, set.ability);
        expect(r.mults[m]).toBe(mult);
        const tag = cells[k].querySelector('.eff-tag');
        if (mult === 1) expect(tag).toBeNull(); else expect(tag).not.toBeNull();
        checked++;
      });
    });
    expect(checked).toBeGreaterThan(0);
  });

  it('Coverage meta: tabella membri × minacce a pagine da 8, dalla meno coperta (a pari livello la più usata); danno colorato e riga Regge', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(screen.getByRole('tabpanel'));
    const rows = rating.defense.coverageMeta!.rows;
    const expected = [...rows].sort((a, b) => a.level - b.level || b.weight - a.weight);
    const names = () => panel.getAllByRole('columnheader').slice(1).map(h => h.getAttribute('aria-label'));
    expect(names()).toEqual(expected.slice(0, 8).map(r => r.species));
    // Ogni casella: il danno di chi regge (verde sotto metà PS, giallo a metà), KO rosso per chi non c'è in heldBy
    const table = panel.getByRole('table');
    team.forEach((set, m) => {
      const cells = within(within(table).getAllByRole('row')[m + 1]).getAllByRole('cell');
      expected.slice(0, 8).forEach((r, k) => {
        const h = r.heldBy.find(x => x.species === set.species);
        if (!h) {
          expect(cells[k]).toHaveTextContent(/^KO/);
          expect(cells[k]).toHaveClass('hold-ohko');
        } else {
          expect(cells[k]).toHaveTextContent(new RegExp(`^${h.pct}%`));
          expect(cells[k]).toHaveClass(h.partial ? 'hold-3' : 'hold-4');
          expect(cells[k].getAttribute('title')).toBe(`${r.species}: ${h.move} ${h.pct}%`);
        }
      });
    });
    const held = within(table).getByRole('row', { name: /^Regge/ });
    expect(within(held).getAllByRole('cell').map(c => c.textContent)).toEqual(expected.slice(0, 8).map(r => `${r.heldBy.filter(h => !h.partial).length}`));
    expect(panel.queryAllByRole('listitem')).toHaveLength(0);
    // Le pagine compatte "‹ 1/N ›" stanno nella casella in alto a sinistra della tabella, al posto di "Pokémon";
    // "successive" mostra le 8 dopo, "precedente" torna alla prima. Sotto la tabella una riga sola: legenda e conteggi
    const corner = table.querySelector('thead th.def-mon-h')!;
    const pages = within(corner as HTMLElement).getByRole('navigation', { name: 'Pagine delle minacce' });
    expect(corner).not.toHaveTextContent('Pokémon');
    const total = Math.ceil(rows.length / 8);
    expect(pages).toHaveTextContent(`1/${total}`);
    expect(pages).toHaveTextContent(`Minacce da 1 a ${Math.min(8, rows.length)}`);
    expect(within(pages).getByRole('button', { name: 'Minacce precedenti' })).toBeDisabled();
    expect(within(pages).getAllByRole('button')).toHaveLength(2);
    expect(document.querySelectorAll('.def-frame > .rob-legend')).toHaveLength(1);
    expect(document.querySelector('.def-frame > .rob-legend .cm-summary')).toHaveTextContent(`${rows.length} minacce`);
    // La legenda dei colori non sta più sotto la tabella
    expect(document.querySelector('.def-frame > .rob-legend')).not.toHaveTextContent('Danno subito');
    if (rows.length > 8) {
      await user.click(within(pages).getByRole('button', { name: 'Minacce successive' }));
      expect(names()).toEqual(expected.slice(8, 16).map(r => r.species));
      expect(pages).toHaveTextContent(`2/${total}`);
      await user.click(within(pages).getByRole('button', { name: 'Minacce precedenti' }));
      expect(names()).toEqual(expected.slice(0, 8).map(r => r.species));
    } else {
      expect(within(pages).getByRole('button', { name: 'Minacce successive' })).toBeDisabled();
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
