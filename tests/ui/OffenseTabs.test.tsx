import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { TYPES } from '../../src/engine/types';
import { LangProvider } from '../../src/i18n/react';
import { AreaView } from '../../src/ui/AreaView';
import { gameName, typeName } from '../../src/i18n/game';
import { offenseSlots } from '../../src/ui/offense/slots';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const analysis = analyzeTeam(team, fixtureData);
const withMeta = () => rateTeam(team, fixtureData, 'it')!;
const noMeta = () => rateTeam(team, { ...fixtureData, ignoreMeta: true }, 'it')!;
const names = () => screen.getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);

describe('Offesa: navigazione e guida', () => {
  it("l'Offesa si apre su Generale, senza spiegazioni sulla pagina", () => {
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.ad-how')).toBeNull();
  });

  it('ordine delle sottoschede: Potenza e Coverage tipi sono una scheda sola', () => {
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(names()).toEqual(['Generale', 'Coverage tipi', 'Coverage meta']);
    unmount();
    renderIt(<AreaView rating={noMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(names()).toEqual(['Generale', 'Coverage tipi']);
  });

  it('il "?" della sottoscheda aperta apre la guida su quella sezione', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const help = screen.getByRole('button', { name: 'Come funziona Coverage tipi' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Coverage tipi' })).toHaveAttribute('aria-selected', 'true');
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent('Pokémon medio');
    // La regola del credito (soglie semplici) e il setup che conta solo in parte
    expect(panel).toHaveTextContent("Oltre il 33%: conta un po'");
    expect(panel).toHaveTextContent('Un tipo che nessuno manda KO in due colpi (al 50%) è scoperto');
    expect(panel).toHaveTextContent('quindi conta solo in parte');
    // Le difese medie dei 18 bersagli stanno qui, sotto il Colpo (chiuse sotto una freccina)
    expect(within(panel).getByText('Statistiche medie dei 18 bersagli').closest('details')).not.toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('la guida Generale dice i pesi: tipi 50 e meta 50; senza meta tipi 100 e niente Coverage meta', async () => {
    const user = userEvent.setup();
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Coverage meta' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Coverage tipi.*50/);
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Coverage meta.*50/);
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Potenza');
    expect(within(dialog).getByRole('tabpanel')).not.toHaveTextContent('Statistiche medie');
    unmount();
    renderIt(<AreaView rating={noMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(within(screen.getByRole('dialog')).queryByRole('tab', { name: 'Coverage meta' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('tabpanel')).toHaveTextContent(/Coverage tipi.*100/);
  });

  it('il Wallbreaking e la Potenza non compaiono più, né nelle schede né nella guida', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(document.body.textContent).not.toMatch(/Wallbreaking|Muri sfondati|Potenza/);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(document.body.textContent).not.toMatch(/Wallbreaking|muri/i);
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="strength" team={team} analysis={analysis} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General', 'Type coverage', 'Meta coverage']);
    await user.click(screen.getByRole('button', { name: 'How General works' }));
    expect(screen.getByRole('dialog', { name: 'Guide: Offense' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Wallbreaking|Power/);
  });
});

describe('Offesa: la velocità nella riga del membro è quella reale', () => {
  it('Victini con la Sciarpa mostra 492 e il segno Scarf, non 328', () => {
    const victini: TeamSet = { ...emptySet('Victini'), item: 'Choice Scarf', ability: 'Victory Star', nature: 'Jolly', evs: { atk: 252, spe: 252 }, moves: ['V-create', 'Bolt Strike', 'U-turn', 'Trick'] };
    const t = [victini];
    renderIt(<AreaView rating={rateTeam(t, fixtureData, 'it')!} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    const stat = document.querySelector('.def-members .def-mon-stats')!;
    expect(stat).toHaveTextContent('492');
    expect(stat).not.toHaveTextContent('328');
    expect(stat).toHaveTextContent('Scarf');
  });
});

describe('Offesa: Generale', () => {
  const view = (t: TeamSet[] = team, rating = withMeta(), roomy = false) => renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} roomy={roomy} />);
  /** Le righe dei membri, senza la riga che riempie lo spazio in fondo. */
  const memberRows = () => [...document.querySelectorAll<HTMLElement>('.def-members tbody tr:not(.og-fill)')];

  // I conti attesi, rifatti qui dai dati del motore: OHKO dal 100%, 2HKO dal 50%; col setup chi sale di fascia
  type Rating = ReturnType<typeof withMeta>;
  type Hit = { plain: number; setup: number | null };
  type Band = 'ohko' | 'two';
  const bandOf = (p: number): Band | null => (p >= 100 ? 'ohko' : p >= 50 ? 'two' : null);
  const rank = (b: Band | null) => (b === 'ohko' ? 2 : b === 'two' ? 1 : 0);
  const count = (hits: Hit[]) => {
    const out = { ohko: 0, two: 0, setupOhko: 0, setupTwo: 0 };
    for (const h of hits) {
      const base = bandOf(h.plain);
      if (base) out[base]++;
      const up = h.setup === null ? null : bandOf(h.setup);
      if (up && rank(up) > rank(base)) out[up === 'ohko' ? 'setupOhko' : 'setupTwo']++;
    }
    return out;
  };
  const typeHits = (rating: Rating, i: number): Hit[] => rating.offense.members[i].hits.map(h => ({ plain: h.plainPct, setup: h.setupPct }));
  const metaHits = (rating: Rating, slot: number): Hit[] =>
    rating.offense.coverageMeta!.rows.map(r => ({ plain: Math.max(0, r.cells![slot].pct), setup: r.cells![slot].setupPct }));
  /** Il team su ogni bersaglio: il membro migliore (col setup il meglio fra semplice e setup). */
  const best = (per: Hit[][]): Hit[] => per[0].map((_, k) => {
    const plain = Math.max(...per.map(l => l[k].plain));
    const setups = per.map(l => l[k].setup).filter((x): x is number => x !== null);
    return { plain, setup: setups.length ? Math.max(plain, ...setups) : null };
  });
  /** I due badge di una casella: numero, spento a zero, "+N" del setup e aria-label. */
  const expectBadges = (cell: Element, hits: Hit[]) => {
    const c = count(hits);
    for (const [b, n, extra, tag] of [['ohko', c.ohko, c.setupOhko, 'OHKO'], ['two', c.two, c.setupTwo, '2HKO']] as const) {
      const badge = cell.querySelector(`.kob.${b}`)!;
      expect(badge, `${tag} in ${cell.textContent}`).not.toBeNull();
      expect(badge.querySelector('b')).toHaveTextContent(new RegExp(`^${n}$`));
      expect(badge.classList.contains('zero')).toBe(n === 0);
      if (extra > 0) {
        // Nella tessera solo il triangolo del setup; quanti in più lo dice il tooltip (e il nome accessibile)
        expect(badge).toHaveClass('has-setup');
        expect(badge).not.toHaveTextContent('+');
        // Il migliore della colonna aggiunge ", il migliore della colonna" (la stella)
        expect(badge.getAttribute('aria-label')).toMatch(new RegExp(`^${tag} ${n}, altri ${extra} col setup(, il migliore della colonna)?$`));
      } else {
        expect(badge).not.toHaveClass('has-setup');
        expect(badge.getAttribute('aria-label')).toMatch(new RegExp(`^${tag} ${n}(, il migliore della colonna)?$`));
      }
    }
    return c;
  };
  const tipOf = async () => vi.waitFor(() => { const el = document.querySelector<HTMLElement>('body > .ftip.kot'); if (!el) throw new Error('no tip'); return el; });
  /** Il primo elenco del tooltip (il colpo semplice), non quelli delle righe in più. */
  const mainList = (tip: HTMLElement) => [...tip.querySelectorAll('.kot-list')].find(l => !l.closest('.kot-extra'));

  it('le colonne: Pokémon, Tipi, Meta (solo col meta), Offesa, coi titoli sulla stessa riga; i punti dei membri sommati fanno il voto', () => {
    const rating = withMeta();
    const { unmount } = view(team, rating);
    const n = rating.offense.coverageMeta!.rows.length;
    // Le testate di Meta e Tipi possono avere sotto le etichette OHKO / 2HKO: si guarda come iniziano
    let heads = screen.getAllByRole('columnheader').map(h => h.textContent!);
    expect(heads).toHaveLength(4);
    expect(heads[0]).toBe('Pokémon');
    expect(heads[1].startsWith('Tipi')).toBe(true);
    expect(heads[2].startsWith('Meta')).toBe(true);
    expect(heads[3]).toBe('Offesa');
    expect(memberRows().map(r => r.querySelector('.def-mon-name')!.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(rating.offense.shares.reduce((a, s) => a + s.points, 0)).toBe(rating.offense.value);
    unmount();
    view(team, noMeta());
    heads = screen.getAllByRole('columnheader').map(h => h.textContent!);
    expect(heads).toHaveLength(3);
    expect(heads[0]).toBe('Pokémon');
    expect(heads[1].startsWith('Tipi')).toBe(true);
    expect(heads[2]).toBe('Offesa');
    expect(document.querySelector('.def-members tfoot th')).toHaveTextContent('Team Coverage');
    expect(document.querySelectorAll('.def-members tfoot td')).toHaveLength(2);
  });

  it('niente tessere sotto la tabella', () => {
    view();
    expect(document.querySelector('.def-tile')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Coverage tipi|Coverage meta)/ })).toBeNull();
  });

  it('ogni membro: badge OHKO e 2HKO sul meta e sui 18 tipi, col conto dei bersagli dal colpo semplice (spenti a zero); poi la sua barra Offesa col titolo', () => {
    const rating = withMeta();
    view(team, rating);
    const rows = memberRows();
    expect(rows).toHaveLength(2);
    const slots = offenseSlots(team, rating.offense.members);
    rows.forEach((row, slot) => {
      const i = slots[slot]!;
      const m = rating.offense.members[i];
      const cells = row.querySelectorAll('td');
      expect(cells).toHaveLength(3);
      expectBadges(cells[0], typeHits(rating, i));
      expectBadges(cells[1], metaHits(rating, slot));
      // Niente più barre né tooltip del browser nelle caselle Meta e Tipi
      for (const c of [cells[0], cells[1]]) {
        expect(c.querySelector('.def-bar')).toBeNull();
        expect(c.querySelector('[title]')).toBeNull();
      }
      expect(cells[2]).toHaveTextContent(new RegExp(`^${m.total}$`));
      expect(cells[2].querySelector('.og-own')!.getAttribute('title')).toBe(`Offesa del membro da solo: ${m.total} (soprattutto contro i tipi, un po' contro il meta)`);
    });
    // A squadra aperta niente dettagli sotto la barra
    expect(document.querySelector('.og-detail')).toBeNull();
  });

  it('clic su una tessera dei Tipi: si apre Coverage tipi con la riga del membro e i tipi di quella fascia accesi; "Mostra tutti" li spegne', async () => {
    const user = userEvent.setup();
    const rating = noMeta();
    view(team, rating);
    const slots = offenseSlots(team, rating.offense.members);
    const slot = slots.findIndex(i => i !== null && count(typeHits(rating, i)).two > 0);
    const n = count(typeHits(rating, slots[slot]!)).two;
    const tile = memberRows()[slot].querySelectorAll('td')[0].querySelector<HTMLElement>('.kob.two')!;
    expect(tile).toHaveAttribute('role', 'button');
    await user.click(tile);
    expect(screen.getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('td.kf-hit')).toHaveLength(n);
    expect(document.querySelector('tr.kf-row')).not.toBeNull();
    expect(document.querySelector('.kf-note')).toHaveTextContent(/due colpi \(2HKO\)/);
    await user.click(screen.getByRole('button', { name: 'Mostra tutti' }));
    expect(document.querySelector('td.kf-hit')).toBeNull();
    expect(document.querySelector('.kf-note')).toBeNull();
  });

  it('senza meta: solo i badge dei tipi e la barra Offesa', () => {
    const rating = noMeta();
    view(team, rating);
    memberRows().forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      expect(cells).toHaveLength(2);
      expectBadges(cells[0], typeHits(rating, i));
      expect(cells[1]).toHaveTextContent(new RegExp(`^${rating.offense.members[i].total}$`));
    });
  });

  it('col setup che fa salire di fascia, il badge ha il triangolo e il tooltip la riga "<mossa> +N"', async () => {
    const user = userEvent.setup();
    const t = [{ ...emptySet('Kingambit'), ability: 'Supreme Overlord', item: 'Black Glasses', moves: ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], evs: { hp: 252, atk: 252 }, teraType: 'Dark' }];
    const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };
    const rating = rateTeam(t, gen9, 'it')!;
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, gen9)} problems={[]} />);
    expect(rating.offense.members[0].setupMove).toBe('Swords Dance');
    const types = memberRows()[0].querySelectorAll('td')[0];
    const c = expectBadges(types, typeHits(rating, 0));
    // Kingambit con Danza Spada manda KO qualche tipo in più: il test ha senso solo se succede
    expect(c.setupOhko + c.setupTwo).toBeGreaterThan(0);
    const band = c.setupOhko > 0 ? 'ohko' : 'two';
    await user.hover(types.querySelector(`.kob.${band}`)!);
    const tip = await tipOf();
    const move = gameName('move', 'Swords Dance', 'it');
    const extra = [...tip.querySelectorAll('.kot-extra')].find(e => e.textContent!.includes(move))!;
    const more = band === 'ohko' ? c.setupOhko : c.setupTwo;
    expect(extra.querySelector('.kot-extra-h')!.textContent).toBe(`${move} +${more}`);
    expect(extra.querySelectorAll('.kot-type')).toHaveLength(more);
  });

  it('passando su un badge si apre il tooltip DreamDex coi bersagli: i tipi con icona e nome, le minacce con la sprite', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    const cells = memberRows()[0].querySelectorAll('td');
    const types = count(typeHits(rating, 0));
    const band = types.ohko > 0 ? 'ohko' : 'two';
    expect(types[band]).toBeGreaterThan(0);
    const badge = cells[0].querySelector(`.kob.${band}`)!;
    await user.hover(badge);
    let tip = await tipOf();
    expect(tip).toHaveAttribute('aria-hidden', 'true');
    expect(tip.querySelector('.kot-head')).toHaveTextContent('Great Tusk');
    expect(tip.querySelector('.kot-head')).toHaveTextContent('tipi su 18');
    const list = mainList(tip)!;
    expect(list.querySelectorAll('.kot-type')).toHaveLength(types[band]);
    expect(list.querySelector('.kot-type img')).not.toBeNull();
    await user.unhover(badge);
    expect(document.querySelector('.ftip')).toBeNull();
    // Il meta: le minacce come sprite
    const meta = count(metaHits(rating, 0));
    const mBand = meta.ohko > 0 ? 'ohko' : 'two';
    expect(meta[mBand]).toBeGreaterThan(0);
    await user.hover(cells[1].querySelector(`.kob.${mBand}`)!);
    tip = await tipOf();
    expect(tip.querySelector('.kot-head')).toHaveTextContent(`minacce su ${rating.offense.coverageMeta!.rows.length}`);
    expect(mainList(tip)).toHaveClass('mons');
    expect(mainList(tip)!.querySelectorAll('.kot-mon')).toHaveLength(meta[mBand]);
  });

  it('la riga Team Coverage: per ogni bersaglio il membro migliore, poi "✓ tutti" o "Scoperti N" in rosso col tooltip; in fondo la barra del team', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    const foot = document.querySelector('.def-members tfoot tr.og-total')!;
    expect(foot.querySelector('th')).toHaveTextContent('Team Coverage');
    const cells = foot.querySelectorAll('td');
    expect(cells).toHaveLength(3);
    const per = [best([typeHits(rating, 0), typeHits(rating, 1)]), best([metaHits(rating, 0), metaHits(rating, 1)])];
    for (const [k, hits] of per.entries()) {
      expectBadges(cells[k], hits);
      const open = hits.filter(h => h.plain < 50).length;
      if (open === 0) {
        expect(cells[k].querySelector('.kob-ok')).toHaveTextContent('✓ tutti');
        expect(cells[k].querySelector('.kob.bad')).toBeNull();
      } else {
        const bad = cells[k].querySelector('.kob.bad')!;
        expect(bad.querySelector('b')).toHaveTextContent(new RegExp(`^${open}$`));
        expect(cells[k].querySelector('.kob-ok')).toBeNull();
        await user.hover(bad);
        const tip = await tipOf();
        expect(tip.querySelector('.kot-head')).toHaveTextContent('Nessuno li manda KO in due colpi');
        expect(mainList(tip)!.children).toHaveLength(open);
        await user.unhover(bad);
      }
    }
    expect(cells[2]).toHaveTextContent(new RegExp(`^${rating.offense.value}$`));
    expect(cells[2].querySelector('.def-bar')).not.toBeNull();
  });

  it('membro che il motore non conosce: la riga resta con "—" e senza badge', () => {
    const t = [team[0], { ...emptySet('Notamon'), moves: ['Tackle'] }];
    view(t);
    const rows = memberRows();
    expect(rows).toHaveLength(2);
    expect([...rows[1].querySelectorAll('td')].map(c => c.textContent)).toEqual(['—', '—', '—']);
    expect(rows[1].querySelector('.kob')).toBeNull();
  });

  it('un solo membro: la riga del team ha i suoi stessi badge, e la riga vuota tiene il team in fondo', () => {
    const rating = withMeta();
    view([team[0]], rating);
    expect(memberRows()).toHaveLength(1);
    const fill = document.querySelector('.def-members tbody tr.og-fill')!;
    expect(fill).toHaveAttribute('aria-hidden', 'true');
    expect(fill.querySelector('td')).toHaveAttribute('colspan', '4');
    expect(document.querySelector('.def-members tbody')!.lastElementChild).toBe(fill);
    // Senza la parte della stella: il membro unico è il migliore della colonna, il team non ha stelle
    const labels = (cell: Element) => [...cell.querySelectorAll('.kob.ohko, .kob.two')].map(b => b.getAttribute('aria-label')!.replace(', il migliore della colonna', ''));
    const row = memberRows()[0].querySelectorAll('td');
    const foot = document.querySelectorAll('.def-members tfoot td');
    expect(labels(foot[0])).toEqual(labels(row[0]));
    expect(labels(foot[1])).toEqual(labels(row[1]));
    expect(document.querySelector('.def-general')!.textContent).not.toContain('NaN');
  });

  it('squadra chiusa: accanto alla barra i punti che porta al team; niente tipi per fascia né Pokémon del meta mandati KO', () => {
    const rating = withMeta();
    view(team, rating, true);
    memberRows().forEach((row, i) => {
      const cells = row.querySelectorAll('td');
      expect(cells[2].querySelector('.og-points')!.textContent).toBe(`+${rating.offense.shares[i].points}`);
      expect(cells[0].querySelector('.kob.ohko')).not.toBeNull();
    });
    expect(document.querySelector('.og-bands')).toBeNull();
    expect(document.querySelector('.og-meta')).toBeNull();
    expect(document.querySelectorAll('.og-detail')).toHaveLength(2);
  });
});

describe('Offesa: Coverage tipi (il pacchetto dei tipi)', () => {
  const open = async (t: TeamSet[] = team, rating = withMeta()) => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    return rating;
  };

  it('una tabella membri × 18 tipi con la riga Copertura', async () => {
    await open();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader')).toHaveLength(19);
    const rows = screen.getAllByRole('row');
    const last = rows[rows.length - 1];
    expect(within(last).getByRole('rowheader')).toHaveTextContent('Copertura');
    const cells = within(last).getAllByRole('cell');
    expect(cells).toHaveLength(18);
    cells.forEach(c => expect(c.textContent).toMatch(/\d+%/));
  });

  it('ogni casella è il danno del membro: verde da 66% (credito da metà), gialla oltre il 33%, vuota sotto', async () => {
    const rating = await open();
    const rows = document.querySelectorAll('.ct-table tbody tr');
    const slots = offenseSlots(team, rating.offense.members);
    team.forEach((_, slot) => {
      const m = rating.offense.members[slots[slot]!];
      const cells = rows[slot].querySelectorAll('td');
      TYPES.forEach((type, i) => {
        const hit = m.hits.find(h => h.label === type)!;
        const cell = cells[i];
        if (hit.credit === 0) {
          // Vuota: al massimo l'etichetta ×2 / ×4 di una mossa superefficace che non arriva al 33%
          expect(cell.textContent).toMatch(/^(×[24] superefficace ×[24])?$/);
        } else {
          expect(cell).toHaveTextContent(`${hit.pct}%`);
          expect(cell).toHaveClass(hit.credit >= 0.5 ? 'ok-full' : 'ok-half');
          expect(cell).toHaveTextContent(hit.credit >= 0.5 ? 'forte' : 'conta');
        }
      });
    });
  });

  it('i tipi che nessuno colpisce oltre il 33% sono segnati anche a parole', async () => {
    const weak = [{ ...emptySet('Blissey'), moves: ['Seismic Toss'] }];
    const rating = await open(weak, rateTeam(weak, fixtureData, 'it')!);
    const heads = screen.getAllByRole('columnheader').slice(1);
    const holes = rating.offense.types.holes;
    expect(holes.length).toBeGreaterThan(0);
    expect(heads.filter(h => h.textContent!.includes('scoperto'))).toHaveLength(holes.length);
  });

  it("×2 in basso a sinistra anche quando la mossa superefficace è debole e il danno migliore viene da un'altra", async () => {
    const weakSe = [{ ...emptySet('Blissey'), ability: 'Natural Cure', moves: ['Seismic Toss', 'Ember'] }];
    const rating = await open(weakSe, rateTeam(weakSe, fixtureData, 'it')!);
    const cells = document.querySelectorAll('.ct-table tbody tr')[0].querySelectorAll('td');
    const grass = TYPES.indexOf('Grass');
    expect(rating.offense.members[0].hits[grass].move).toBe('Seismic Toss');
    expect(cells[grass].querySelector('.eff-tag')).toHaveTextContent('×2');
    expect(cells[grass]).toHaveTextContent('superefficace ×2');
    // Sull'Acqua Ember non fa effetto e Seismic Toss è neutro: niente etichetta
    expect(cells[TYPES.indexOf('Water')].querySelector('.eff-tag')).toBeNull();
  });

  it('"Solo superefficaci" spegne le altre caselle, che restano al loro posto', async () => {
    const user = userEvent.setup();
    await open();
    const sw = screen.getByRole('switch', { name: 'Solo superefficaci' });
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    const cells = [...document.querySelectorAll('.ct-table tbody tr:not(.ct-sum) td')];
    expect(cells).toHaveLength(team.length * 18);
    cells.forEach(td => expect(td.classList.contains('eff-dim')).toBe(!td.querySelector('.eff-tag')));
  });

  it('la legenda: Forte e Conta', async () => {
    await open();
    expect(document.body.textContent).toContain('Forte (oltre 66%)');
    expect(document.body.textContent).toContain('Conta (oltre 33%)');
  });
});

describe('Offesa: Coverage meta', () => {
  const ko = (pct: number) => (pct >= 100 ? 'ohko' : pct >= 50 ? 'two' : pct >= 34 ? 'three' : 'none');
  const open = async (t: TeamSet[] = team) => {
    const user = userEvent.setup();
    const rating = rateTeam(t, fixtureData, 'it')!;
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const sorted = [...rating.offense.coverageMeta!.rows].sort((a, b) => a.level - b.level || b.weight - a.weight);
    return { user, rating, sorted };
  };
  const table = () => within(screen.getByRole('tabpanel')).getByRole('table');
  const heads = () => [...table().querySelectorAll('thead th[aria-label]')].map(th => th.getAttribute('aria-label'));
  const bodyRows = () => [...table().querySelectorAll('tbody tr')] as HTMLElement[];

  it('una riga per membro, 8 bersagli per pagina dal meno coperto, e la riga Lo coprono', async () => {
    const { user, sorted } = await open();
    expect(heads()).toEqual(sorted.slice(0, 8).map(r => r.species));
    const rows = bodyRows();
    expect(rows).toHaveLength(team.length + 1);
    expect(rows.slice(0, team.length).map(r => r.querySelector('.def-mon-name')!.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(within(rows[rows.length - 1]).getByRole('rowheader')).toHaveTextContent('Lo coprono');
    // Le pagine "‹ 1/N ›" nella casella in alto a sinistra, al posto di "Pokémon"
    const corner = table().querySelector<HTMLElement>('thead th.def-mon-h')!;
    expect(within(corner).getByRole('navigation', { name: 'Pagine dei bersagli' })).toHaveTextContent(`1/${Math.ceil(sorted.length / 8)}`);
    expect(corner).not.toHaveTextContent('Pokémon');
    const next = within(corner).getByRole('button', { name: 'Bersagli successivi' });
    if (sorted.length > 8) {
      await user.click(next);
      expect(heads()).toEqual(sorted.slice(8, 16).map(r => r.species));
    } else {
      // Una sola pagina: la freccia è spenta
      expect(next).toBeDisabled();
    }
  });

  it('ogni casella: il danno del colpo semplice, colorato per soglia e scritto anche a parole', async () => {
    const { sorted } = await open();
    const rows = bodyRows();
    sorted.slice(0, 8).forEach((target, col) => {
      team.forEach((_, m) => {
        const cell = rows[m].querySelectorAll('td')[col];
        const { pct } = target.cells![m];
        expect(cell.querySelector('.wall-pct')!.textContent).toBe(`${pct}%`);
        expect(cell).toHaveClass(`ko-${ko(pct)}`);
        if (ko(pct) !== 'none') expect(cell.querySelector('.visually-hidden')!.textContent!.trim()).toBe({ ohko: 'OHKO', two: '2HKO', three: '3HKO' }[ko(pct) as 'ohko']);
      });
    });
  });

  it('con il setup che cambia soglia la casella lo dice ("setup N%")', async () => {
    const { user, sorted } = await open();
    const jumps = sorted.flatMap((target, i) => target.cells!.map((c, m) => ({ i, m, c }))
      .filter(({ c }) => c.setupPct !== null && ko(c.setupPct) !== ko(c.pct)));
    expect(jumps.length).toBeGreaterThan(0);
    const first = jumps[0];
    for (let p = 0; p < Math.floor(first.i / 8); p++) await user.click(screen.getByRole('button', { name: 'Bersagli successivi' }));
    const cell = bodyRows()[first.m].querySelectorAll('td')[first.i % 8];
    expect(cell).toHaveClass('has-setup');
    expect(cell.querySelector('.wall-setup')!.textContent).toBe(`setup ${first.c.setupPct}%`);
  });

  it('×2 / ×4 dove il membro ha una mossa superefficace sul Pokémon; col puntatore sotto lo sprite il nome', async () => {
    const { user, sorted } = await open();
    const rows = bodyRows();
    let tags = 0;
    sorted.slice(0, 8).forEach((target, col) => {
      team.forEach((_, m) => {
        const mult = target.cells![m].mult;
        const tag = rows[m].querySelectorAll('td')[col].querySelector('.eff-tag');
        if (mult !== null && mult > 1) { tags++; expect(tag).toHaveTextContent(mult >= 4 ? '×4' : '×2'); } else expect(tag).toBeNull();
      });
    });
    expect(tags).toBeGreaterThan(0);
    const head = table().querySelector<HTMLElement>('thead th[aria-label]')!;
    await user.hover(head);
    expect(head.querySelector('.col-name')).toHaveTextContent(sorted[0].species);
  });

  it('Lo coprono conta chi lo manda KO in due colpi', async () => {
    const { sorted } = await open();
    const rows = bodyRows();
    const counts = [...rows[rows.length - 1].querySelectorAll('td')].map(td => Number(td.textContent));
    expect(counts).toEqual(sorted.slice(0, 8).map(r => r.cells!.filter(c => c.pct >= 50).length));
  });

  it('i conteggi in alto: coperti, solo 3HKO, scoperti', async () => {
    const { rating } = await open();
    const rows = rating.offense.coverageMeta!.rows;
    const covered = rows.filter(r => r.level > 0).length;
    const only3 = rows.filter(r => r.level === 0 && r.cells!.some(c => c.pct >= 34)).length;
    const summary = document.querySelector('.cm-summary')!;
    expect(summary).toHaveTextContent(`${rows.length} bersagli`);
    expect(summary).toHaveTextContent(`${covered} coperti`);
    expect(summary).toHaveTextContent(`${only3} solo 3HKO`);
    expect(summary).toHaveTextContent(`${rows.length - covered - only3} scoperti`);
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent(/un quarto/);
  });

  it('un bersaglio immune a tutti: 0% ovunque e nessuno lo copre', async () => {
    const lax = [{ ...emptySet('Snorlax'), ability: 'Thick Fat', moves: ['Body Slam', 'Double-Edge'], evs: { atk: 252, hp: 252 } }];
    const { user, sorted } = await open(lax);
    const ghost = sorted.findIndex(r => r.cells![0].pct === 0 && r.level === 0);
    expect(ghost).toBeGreaterThanOrEqual(0);
    for (let p = 0; p < Math.floor(ghost / 8); p++) await user.click(screen.getByRole('button', { name: 'Bersagli successivi' }));
    const rows = bodyRows();
    expect(rows[0].querySelectorAll('td')[ghost % 8].querySelector('.wall-pct')!.textContent).toBe('0%');
    expect(rows[rows.length - 1].querySelectorAll('td')[ghost % 8]).toHaveTextContent('0');
  });

  it('un membro che il motore non conosce resta con "—"', async () => {
    const t = [team[0], { ...emptySet('Notamon'), moves: ['Tackle'] }];
    await open(t);
    const cells = bodyRows()[1].querySelectorAll('td');
    expect(cells).toHaveLength(8);
    cells.forEach(td => expect(td).toHaveTextContent('—'));
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="strength" team={team} analysis={analysis} problems={[]} /></LangProvider>);
    await user.click(screen.getByRole('tab', { name: /^Meta coverage/ }));
    expect(within(table()).getByRole('rowheader', { name: 'Covered by' })).toBeInTheDocument();
    expect(document.querySelector('.cm-summary')).toHaveTextContent(/3HKO only/);
  });
});
