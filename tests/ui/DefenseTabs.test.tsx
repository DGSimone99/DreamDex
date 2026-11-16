import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { metaThreats } from '../../src/engine/attackers';
import { battleSpecies } from '../../src/engine/dex';
import { holdBand } from '../../src/engine/defense';

const HOLD = { ohko: 'OHKO', two: '2HKO', three: '3HKO', four: '4HKO+' } as const;
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
        // Il numero come nell'Offesa (corsivo, "%" piccolo); soglia e due lati per i lettori di schermo; niente title del browser
        expect(cells[i].querySelector('.ct-num')!.textContent).toBe(`${cell.pct}%`);
        expect(cells[i]).toHaveClass(CLS[cell.band]);
        expect(cells[i].querySelector('.visually-hidden')!.textContent!.trim()).toBe(`${TAG[cell.band]} · fisico ${cell.physical}% · speciale ${cell.special}%`);
        expect(cells[i].getAttribute('title')).toBeNull();
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

  it('in fondo, come nell\'Offesa: Copertura di ogni tipo e Il migliore (chi lo regge meglio); i buchi segnati in testata', async () => {
    const { rating, table } = await openTypes();
    const rows = rating.defense.coverageTypes.rows;
    const level = within(table).getByRole('row', { name: /^Copertura/ });
    expect(within(level).getAllByRole('cell').map(c => c.textContent)).toEqual(rows.map(r => `${r.level}%`));
    const best = within(table).getByRole('row', { name: /^Il migliore/ });
    const typed = rating.defense.typed;
    within(best).getAllByRole('cell').forEach((cell, i) => {
      // Il danno più basso fra chi lo regge davvero (3HKO o meglio); nessuno: il trattino
      const holders = typed.map((m, k) => ({ k, c: m.cells[i] })).filter(x => x.c.band === 'three' || x.c.band === 'four');
      if (!holders.length) expect(cell.querySelector('.ct-best-mon')).toBeNull();
      else expect(cell).toHaveTextContent(typed[holders.reduce((a, b) => (b.c.pct < a.c.pct ? b : a)).k].species);
    });
    expect(within(table).queryByRole('row', { name: /^Regge/ })).toBeNull();
    expect(within(table).queryByRole('row', { name: /^Deboli/ })).toBeNull();
    expect(within(table).queryByRole('row', { name: /^Resistono/ })).toBeNull();
    expect(table.querySelectorAll('thead th.sev-serious')).toHaveLength(rating.defense.coverageTypes.weak.length);
  });

  it('tooltip DreamDex: sulla casella i due lati del colpo, sul tipo in testata Att e AttSp dell\'attaccante', async () => {
    const { rating, table } = await openTypes();
    const user = userEvent.setup();
    const tipOf = (cls: string) => vi.waitFor(() => { const el = document.querySelector<HTMLElement>(`body > .ftip.${cls}`); if (!el) throw new Error('no tip'); return el; });
    const cell = within(within(table).getAllByRole('row')[1]).getAllByRole('cell')[0];
    await user.hover(cell);
    const hit = await tipOf('dht');
    const c = rating.defense.typed[0].cells[0];
    expect(hit).toHaveTextContent(rating.defense.typed[0].species);
    expect(hit).toHaveTextContent(`Fisica${HOLD[holdBand(c.physical / 100)]}${c.physical}%`);
    expect(hit).toHaveTextContent(`Speciale${HOLD[holdBand(c.special / 100)]}${c.special}%`);
    await user.unhover(cell);
    const head = within(table).getAllByRole('columnheader')[1];
    expect(head).toHaveTextContent(/Att \d+, AttSp \d+/);
    await user.hover(head);
    expect((await tipOf('tst')).querySelectorAll('.tst-stats span')).toHaveLength(2);
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
    // Sta a destra nella striscia delle sottoschede, non nella tabella né nella striscia dei problemi; la tabella ha di nuovo "Pokémon"
    expect(sw.closest('.area-panel .panel-switch')).not.toBeNull();
    expect(table).not.toContainElement(sw);
    expect(table.querySelector('thead th.def-mon-h')).toHaveTextContent(/^Pokémon$/);
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
    expect(metaSwitch.closest('.area-panel .panel-switch')).not.toBeNull();
    expect(within(screen.getByRole('tabpanel')).getByRole('table').querySelector('.eff-dim')).not.toBeNull();
    // Sulle sottoschede senza etichette (Sostenibilità) l'interruttore non c'è
    await user.click(screen.getByRole('tab', { name: /^Sostenibilità/ }));
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it("col puntatore la colonna si accende; niente nome del tipo sotto l'icona né tooltip del browser", async () => {
    const user = userEvent.setup();
    const { table } = await openTypes();
    const fire = within(table).getByRole('columnheader', { name: /^Fire/ });
    await user.hover(fire);
    expect(fire.querySelector('.col-name')).toBeNull();
    expect(fire).not.toHaveAttribute('title');
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

  it('Coverage meta: tabella membri × minacce a pagine da 8, dalla meno coperta (a pari livello la più usata); danno colorato e riga Team Coverage', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const panel = within(screen.getByRole('tabpanel'));
    const rows = rating.defense.coverageMeta!.rows;
    const expected = [...rows].sort((a, b) => a.level - b.level || b.weight - a.weight);
    const names = () => panel.getAllByRole('columnheader').slice(1).map(h => h.getAttribute('aria-label'));
    expect(names()).toEqual(expected.slice(0, 8).map(r => r.species));
    // Ogni casella: il danno coi colori di Coverage tipi (4HKO+ sotto un terzo, 3HKO sotto la metà, 2HKO), KO rosso per chi non c'è in heldBy
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
          expect(cells[k]).toHaveClass({ four: 'hold-4', three: 'hold-3', two: 'hold-2', ohko: 'hold-ohko' }[h.band]);
          expect(h.band).toBe(h.pct >= 50 ? 'two' : h.pct >= 34 ? 'three' : h.pct < 33 ? 'four' : h.band);
          // Il colpo per i lettori di schermo (a vista sta nel tooltip DreamDex), la barra dei PS che restano
          expect(cells[k].querySelector('.visually-hidden')!.textContent!.trim()).toBe(`${r.species}: ${h.move} ${h.pct}%`);
          expect(cells[k].querySelector('.cm-hp')).not.toBeNull();
        }
      });
    });
    // In fondo la riga Team Coverage, come nell'Offesa: quanti la reggono del tutto
    const held = within(table).getByRole('row', { name: /^Team Coverage/ });
    expect(within(held).getAllByRole('cell').map(c => c.querySelector('.ct-pill')!.firstChild!.textContent)).toEqual(expected.slice(0, 8).map(r => `${r.heldBy.filter(h => !h.partial).length}`));
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
    // La legenda corta (KO e le tre fasce col loro %, come Coverage tipi), niente conteggi
    expect(document.querySelector('.def-frame > .rob-legend .cm-summary')).toBeNull();
    expect(document.querySelector('.def-frame > .rob-legend > .area-legend:first-child')).toHaveTextContent('KO< 33%33–49%50–99%');
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
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Coverage meta', 'Sostenibilità']);
    expect(document.body.textContent).not.toMatch(/Robustezza/);
  });

  it('senza meta niente Coverage meta, stesso ordine', () => {
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(subTabs()).toEqual(['Generale', 'Coverage tipi', 'Sostenibilità']);
  });

  it('Tipi e Meta sono barre a pezzi (Regge, 2HKO, OHKO) col conto di quanti ne regge; Difesa come quanto porta ogni membro (Sostenibilità dentro)', () => {
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr:not(.og-fill)'));
    rating.defense.members.forEach((_, i) => {
      const lines = rows[i].querySelectorAll('.hb-line');
      expect(lines).toHaveLength(2);
      // Il conto dei tipi: quelli dove il lato peggiore toglie meno di metà PS
      const held = rating.defense.typed[i].cells.filter(c => c.band === 'three' || c.band === 'four').length;
      expect(lines[0].querySelector('.kob-count-num')).toHaveTextContent(`${held}/18`);
      // I pezzi contano tutti i 18 tipi
      const sum = Array.from(lines[0].querySelectorAll('.kob-row > .kob.hb')).reduce((acc, el) => acc + Number(el.querySelector('.kob-num')!.textContent), 0);
      expect(sum).toBe(18);
    });
    // Nella colonna Difesa quanto porta ogni membro ("+12"): sommati fanno la Difesa del team
    const points = rows.map(r => Number(r.querySelector('.og-share-num')!.textContent!.replace('−', '-')));
    expect(points.reduce((a, b) => a + b, 0)).toBe(rating.defense.value);
    // Niente più anello debole
    expect(document.querySelector('.def-weak')).toBeNull();
  });

  it('la Difesa del team in fondo ha la barra col colore della soglia', () => {
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    const tone = (v: number) => (v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad');
    const bars = document.querySelectorAll('.def-members tfoot .def-bar');
    expect(bars[bars.length - 1]).toHaveClass(tone(rating.defense.value));
  });

  it('a squadra chiusa sotto Tipi e Meta i tre colpi peggiori senza colonne in più; altrimenti niente pastiglie', () => {
    const rating = withMeta();
    const { unmount } = renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} roomy />);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Tipi?', 'Meta?', 'Difesa']);
    const rows = Array.from(document.querySelectorAll('.def-members tbody tr:not(.og-fill)'));
    expect(rows).toHaveLength(team.length);
    rows.forEach(row => {
      const lists = row.querySelectorAll('.mcs.wh');
      expect(lists).toHaveLength(2);
      expect(lists[0].querySelectorAll('.mc')).toHaveLength(3);
      // Ogni pastiglia: il nome (si apre passando sopra) e il danno, KO o %
      for (const pill of lists[0].querySelectorAll('.mc')) {
        expect(pill.querySelector('.mc-name')!.textContent).not.toBe('');
        expect(pill.querySelector('b')).toHaveTextContent(/^(KO|\d+%)$/);
      }
    });
    unmount();
    renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(document.querySelector('.mcs.wh')).toBeNull();
  });
});

describe('Difesa Generale: clic sui pezzi delle barre', () => {
  it('ogni pezzo ha la sua etichetta (3HKO+, 2HKO, OHKO); clic su un pezzo di Tipi: Coverage tipi con la riga del membro e quei tipi accesi, "Mostra tutti" li spegne', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    const row = document.querySelectorAll('.def-members tbody tr:not(.og-fill)')[0];
    const pieces = Array.from(row.querySelectorAll('td')[0].querySelectorAll<HTMLElement>('.kob.hb'));
    for (const p of pieces) expect(p.querySelector('em')).toHaveTextContent(/^(3HKO\+|2HKO|OHKO)$/);
    const piece = pieces[0];
    const n = Number(piece.querySelector('.kob-num')!.textContent);
    expect(piece).toHaveAttribute('role', 'button');
    await user.click(piece);
    expect(screen.getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('td.kf-hit')).toHaveLength(n);
    expect(document.querySelector('tr.kf-row')).not.toBeNull();
    expect(document.querySelector('.kf-note')).toHaveTextContent(/Evidenziati/);
    await user.click(screen.getByRole('button', { name: 'Mostra tutti' }));
    expect(document.querySelector('td.kf-hit')).toBeNull();
  });

  it('clic su un pezzo di Meta: Coverage meta con le minacce di quel pezzo accese', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    const row = document.querySelectorAll('.def-members tbody tr:not(.og-fill)')[0];
    const piece = row.querySelectorAll('td')[1].querySelector<HTMLElement>('.kob.hb')!;
    const n = Number(piece.querySelector('.kob-num')!.textContent);
    await user.click(piece);
    expect(screen.getByRole('tab', { name: /^Coverage meta/ })).toHaveAttribute('aria-selected', 'true');
    // Le minacce accese vengono per prime: nella prima pagina (8 per pagina) ce ne sono quante ne stanno
    expect(document.querySelectorAll('td.kf-hit')).toHaveLength(Math.min(n, 8));
    expect(document.querySelector('.kf-note')).not.toBeNull();
  });
});
