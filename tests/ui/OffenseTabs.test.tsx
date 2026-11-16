import { render, screen, waitFor, within } from '@testing-library/react';
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
    // Una pagina sola per le due Coverage (stesse regole), coi bersagli di tutte e due in alto
    expect(within(dialog).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Come funziona']);
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/^Come funzionaBersagli.*Coverage tipi.*Pokémon medio.*Coverage meta.*Il test.*Colpo.*contano meno.*Quanti lo coprono/);
    // La regola del credito nella riga del Colpo; quello che vale meno in una riga sola; niente ×2·×4 né righe della legenda
    expect(panel).toHaveTextContent('Per ogni membro, il suo colpo migliore contro ogni bersaglio che fa almeno il 50%');
    // Quello che conta meno: a capo sotto il Colpo, senza un titolo suo
    expect(panel).not.toHaveTextContent('Valgono meno');
    expect(panel.querySelector('.guide-sub')).toHaveTextContent('Band, Specs e simili, e i boost da setup, meteo o campo e le mosse Z contano meno (pieni se il meteo o il campo lo porta il membro stesso).');
    for (const gone of ['Scoperto', 'Non conta', 'Dal 66%', 'Statistiche medie', '×2 · ×4']) expect(panel).not.toHaveTextContent(gone);
    // Il "?" dei tipi: le medie dei 18 tipi nel tooltip; quello del meta: le sprite delle minacce
    await user.hover(within(panel).getByRole('button', { name: 'Il Pokémon medio dei 18 tipi' }));
    await waitFor(() => expect(document.querySelector('.ftip.gat .gat-table')).not.toBeNull());
    const avg = document.querySelector('.ftip.gat')!;
    expect(avg.querySelectorAll('tbody tr')).toHaveLength(18);
    await user.unhover(within(panel).getByRole('button', { name: 'Il Pokémon medio dei 18 tipi' }));
    const metaAsk = within(panel).getByRole('button', { name: /^I \d+ Pokémon più usati$/ });
    await user.hover(metaAsk);
    await waitFor(() => expect(document.querySelector('.ftip.gat .gat-mons')).not.toBeNull());
    expect(document.querySelectorAll('.ftip.gat .gat-mons > span').length).toBe(withMeta().offense.coverageMeta!.rows.length);
    await user.unhover(metaAsk);
    // Una sezione sola anche se il "?" c'è in tutte e tre le schede
    expect(within(dialog).queryByRole('tab', { name: 'Generale' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('anche la Generale ha il "?": apre la stessa pagina Come funziona', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(within(screen.getByRole('dialog', { name: 'Guida: Offesa' })).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    // Accanto alle testate Tipi e Meta il "?" dei bersagli, lo stesso della guida
    const typesAsk = screen.getByRole('button', { name: 'Il Pokémon medio dei 18 tipi' });
    await user.hover(typesAsk);
    await waitFor(() => expect(document.querySelectorAll('.ftip.gat tbody tr')).toHaveLength(18));
    await user.unhover(typesAsk);
    expect(screen.getByRole('button', { name: /^I \d+ Pokémon più usati$/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    // Il "?" di Coverage meta apre la stessa pagina di Coverage tipi
    await user.click(screen.getByRole('button', { name: 'Come funziona Coverage meta' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Come funziona' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('contano meno');
  });

  it('il Wallbreaking e la Potenza non compaiono più, né nelle schede né nella guida', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(document.body.textContent).not.toMatch(/Wallbreaking|Muri sfondati|Potenza/);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    await user.click(screen.getByRole('button', { name: 'Come funziona Coverage tipi' }));
    expect(document.body.textContent).not.toMatch(/Wallbreaking|muri/i);
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="strength" team={team} analysis={analysis} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General', 'Type coverage', 'Meta coverage']);
    expect(screen.getByRole('button', { name: 'How General works' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /^Type coverage/ }));
    await user.click(screen.getByRole('button', { name: 'How Type coverage works' }));
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
      // Un pezzo a zero non c'è, salvo che il setup ci porti qualcuno
      if (n === 0 && extra === 0) { expect(badge, `${tag} in ${cell.textContent}`).toBeNull(); continue; }
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
    // In fondo, grigio, quelli che non manda KO in due colpi (niente pezzo se non ce ne sono)
    const rest = hits.filter(h => h.plain < 50).length;
    const restEl = cell.querySelector('.kob.rest');
    if (rest === 0) expect(restEl).toBeNull();
    else expect(restEl!.querySelector('b')).toHaveTextContent(new RegExp(`^${rest}$`));
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

  it('ogni membro: badge OHKO e 2HKO sul meta e sui 18 tipi, col conto dei bersagli dal colpo semplice (spenti a zero); poi quanto porta al team col titolo', () => {
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
      // Quanto porta al team, col title del browser
      expect(cells[2]).toHaveTextContent(new RegExp(`^[+]${rating.offense.shares[i].points}$`));
      expect(cells[2].querySelector('.og-share')!.getAttribute('title')).toBe(`Porta +${rating.offense.shares[i].points} all'Offesa del team`);
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

  it('clic su un pezzo dei Meta: Coverage meta acceso; le frecce delle pagine non spengono l’evidenziazione, un altro clic sì', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    const tile = memberRows()[0].querySelectorAll('td')[1].querySelector<HTMLElement>('.kob.rest, .kob.two, .kob.ohko')!;
    await user.click(tile);
    expect(screen.getByRole('tab', { name: /^Coverage meta/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.kf-note')).not.toBeNull();
    const next = screen.getByRole('button', { name: 'Bersagli successivi' });
    if (!(next as HTMLButtonElement).disabled) {
      await user.click(next);
      expect(document.querySelector('.kf-note')).not.toBeNull();
    }
    await user.click(document.querySelector<HTMLElement>('.def-frame')!);
    expect(document.querySelector('.kf-note')).toBeNull();
  });

  it('clic sul pezzo grigio: Coverage tipi coi tipi che il membro non manda KO in due colpi accesi; un clic in qualunque punto li spegne', async () => {
    const user = userEvent.setup();
    const rating = noMeta();
    view(team, rating);
    const slots = offenseSlots(team, rating.offense.members);
    const slot = slots.findIndex(i => i !== null && typeHits(rating, i).some(h => h.plain < 50));
    const n = typeHits(rating, slots[slot]!).filter(h => h.plain < 50).length;
    const rest = memberRows()[slot].querySelectorAll('td')[0].querySelector<HTMLElement>('.kob.rest')!;
    expect(rest).toHaveAttribute('role', 'button');
    await user.click(rest);
    expect(screen.getByRole('tab', { name: /^Coverage tipi/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelectorAll('td.kf-hit')).toHaveLength(n);
    expect(document.querySelector('.kf-note')).toHaveTextContent(/non manda KO in due colpi/);
    // Un clic qualunque (qui sulla testata della tabella) spegne l'evidenziazione
    await user.click(document.querySelector<HTMLElement>('.ct-table thead th')!);
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
      expect(cells[1]).toHaveTextContent(new RegExp(`^[+]${rating.offense.shares[i].points}$`));
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

  it('la riga Team Coverage: per ogni bersaglio il membro migliore, in fondo gli scoperti in rosso col tooltip (niente se non ce ne sono); in fondo la barra del team', async () => {
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
      expect(cells[k]).not.toHaveTextContent('tutti');
      if (open === 0) {
        expect(cells[k].querySelector('.kob.bad')).toBeNull();
      } else {
        const bad = cells[k].querySelector('.kob.rest.bad')!;
        expect(bad.querySelector('b')).toHaveTextContent(new RegExp(`^${open}$`));
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

  it('squadra chiusa: sotto le barre quanto lavora ogni mossa d’attacco (i numeri sommati fanno i pezzi verdi); niente tipi per fascia né Pokémon del meta mandati KO', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating, true);
    const slots = offenseSlots(team, rating.offense.members);
    memberRows().forEach((row, slot) => {
      const i = slots[slot]!;
      const cells = row.querySelectorAll('td');
      expect(cells[2]).toHaveTextContent(new RegExp(`^[+]${rating.offense.shares[i].points}$`));
      expect(cells[0].querySelector('.kob.ohko')).not.toBeNull();
      for (const [k, hits] of [[0, typeHits(rating, i)], [1, metaHits(rating, slot)]] as const) {
        const chips = [...cells[k].querySelectorAll('.mcs .mc')];
        expect(chips.length).toBeGreaterThan(0);
        const sum = chips.reduce((acc, c) => acc + Number(c.querySelector('b')!.textContent), 0);
        expect(sum).toBe(count(hits).ohko + count(hits).two);
        // Dalla più utile; il nome c'è (si apre passandoci sopra)
        const ns = chips.map(c => Number(c.querySelector('b')!.textContent));
        expect(ns).toEqual([...ns].sort((a, b) => b - a));
        for (const c of chips) expect(c.querySelector('.mc-name')!.textContent).not.toBe('');
      }
    });
    // Il tooltip di una mossa elenca i bersagli su cui è la migliore
    const chip = memberRows()[0].querySelectorAll('td')[0].querySelector<HTMLElement>('.mcs .mc:not(.z)')!;
    await user.hover(chip);
    const tip = await tipOf();
    expect(tip.querySelector('.kot-head')).toHaveTextContent(chip.querySelector('.mc-name')!.textContent!);
    expect(mainList(tip)!.children).toHaveLength(Number(chip.querySelector('b')!.textContent));
    await user.unhover(chip);
    expect(document.querySelector('.og-bands')).toBeNull();
    expect(document.querySelector('.og-meta')).toBeNull();
    expect(document.querySelector('.og-detail')).toBeNull();
  });
});

describe('Offesa: Coverage tipi (il pacchetto dei tipi)', () => {
  const open = async (t: TeamSet[] = team, rating = withMeta()) => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    return rating;
  };

  it('una tabella membri × 18 tipi con la riga Copertura e la riga Il migliore (chi colpisce più forte ogni tipo)', async () => {
    const rating = await open();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader')).toHaveLength(19);
    const rows = screen.getAllByRole('row');
    const sum = rows[rows.length - 2];
    expect(within(sum).getByRole('rowheader')).toHaveTextContent('Copertura');
    const cells = within(sum).getAllByRole('cell');
    expect(cells).toHaveLength(18);
    cells.forEach(c => expect(c.textContent).toMatch(/\d+%/));
    const bestRow = rows[rows.length - 1];
    expect(within(bestRow).getByRole('rowheader')).toHaveTextContent('Il migliore');
    const slots = offenseSlots(team, rating.offense.members);
    within(bestRow).getAllByRole('cell').forEach((cell, i) => {
      const pcts = team.map((_, slot) => rating.offense.members[slots[slot]!].hits.find(h => h.label === TYPES[i])!.plainPct);
      const top = Math.max(...pcts);
      if (top < 50) expect(cell.querySelector('.ct-best-mon')).toBeNull();
      else expect(cell).toHaveTextContent(rating.offense.members[slots[pcts.indexOf(top)]!].species);
    });
  });

  it('sul tipo in testata il tooltip con PS, Dif e DifSp medi del bersaglio (anche a parole per i lettori di schermo)', async () => {
    await open();
    const user = userEvent.setup();
    const water = screen.getAllByRole('columnheader')[1 + TYPES.indexOf('Water')];
    expect(water).toHaveTextContent(/PS \d+, Dif \d+, DifSp \d+/);
    await user.hover(water);
    const tip = await vi.waitFor(() => { const el = document.querySelector<HTMLElement>('body > .ftip.tst'); if (!el) throw new Error('no tip'); return el; });
    expect(tip).toHaveTextContent(typeName('Water', 'it'));
    expect(tip.querySelectorAll('.tst-stats span')).toHaveLength(3);
    await user.unhover(water);
    expect(document.querySelector('.ftip.tst')).toBeNull();
  });

  it('il triangolo del setup sulla casella solo se la danza fa salire di fascia (fino al 2HKO o all’OHKO)', async () => {
    const rating = await open();
    const rows = document.querySelectorAll('.ct-table tbody tr');
    const slots = offenseSlots(team, rating.offense.members);
    const rank = (pct: number | null) => (pct === null ? 0 : pct >= 100 ? 2 : pct >= 50 ? 1 : 0);
    let lifted = 0;
    team.forEach((_, slot) => {
      const m = rating.offense.members[slots[slot]!];
      const cells = rows[slot].querySelectorAll('td');
      TYPES.forEach((type, i) => {
        const hit = m.hits.find(h => h.label === type)!;
        const up = rank(hit.setupPct) > rank(hit.plainPct);
        if (up) lifted++;
        expect(cells[i].classList.contains('has-setup')).toBe(up);
      });
    });
    expect(lifted).toBeGreaterThan(0);
  });

  it('sulla casella il tooltip DreamDex: tipo, badge dei colpi, membro, mossa e danno %; nessun tooltip del browser', async () => {
    const user = userEvent.setup();
    const rating = await open();
    const cell = document.querySelector<HTMLElement>('.ct-table tbody tr td.ok-full')!;
    expect(cell).not.toHaveAttribute('title');
    // Nemmeno in testata: il nome del tipo compare sotto l'icona col puntatore
    document.querySelectorAll('.ct-table thead th').forEach(th => expect(th).not.toHaveAttribute('title'));
    await user.hover(cell);
    const tip = await vi.waitFor(() => { const el = document.querySelector<HTMLElement>('body > .ftip.tht'); if (!el) throw new Error('no tip'); return el; });
    expect(tip.querySelector('.ftip-head .ftip-ko')!.textContent).toMatch(/^(OHKO|2HKO|3HKO|4HKO\+)$/);
    expect(tip.querySelector('.tht-body .tht-pct')!.textContent).toMatch(/^[0-9]+%$/);
    expect(rating.offense.members.map(m => m.species)).toContain(tip.querySelector('.tht-name')!.textContent);
    // Uscendo dalla casella (anche verso il nome del membro, dentro la tabella) il tooltip si chiude
    await user.hover(document.querySelector<HTMLElement>('.ct-table tbody th')!);
    expect(document.querySelector('body > .ftip.tht')).toBeNull();
    // ...e la colonna si spegne: resta accesa solo la riga del membro
    expect(document.querySelector('.ct-table .x-col')).toBeNull();
    expect(document.querySelector('.ct-table tr.x-row')).not.toBeNull();
  });

  it('ogni casella è il danno del membro: verde acceso al 100% (OHKO), verde da 66%, gialla dal 50% (KO in due colpi), vuota sotto', async () => {
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
          // Vuota: al massimo l'etichetta ×2 / ×4 di una mossa superefficace che non arriva al 50%
          expect(cell.textContent).toMatch(/^(×[24] superefficace ×[24])?$/);
        } else {
          expect(cell).toHaveTextContent(`${hit.pct}%`);
          expect(cell).toHaveClass(hit.credit >= 2 / 3 ? 'ok-full' : 'ok-half');
          // Il 100% ha il suo verde (OHKO); poi forte e medio
          expect(cell.classList.contains('ok-ohko')).toBe(hit.pct >= 100);
          expect(cell).toHaveTextContent(hit.pct >= 100 ? 'OHKO' : hit.credit >= 2 / 3 ? 'forte' : 'medio');
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

  it("×2 solo se è superefficace la mossa che fa il danno della casella (non un'altra mossa del set)", async () => {
    const weakSe = [{ ...emptySet('Blissey'), ability: 'Natural Cure', moves: ['Seismic Toss', 'Ember'] }];
    const rating = await open(weakSe, rateTeam(weakSe, fixtureData, 'it')!);
    const cells = document.querySelectorAll('.ct-table tbody tr')[0].querySelectorAll('td');
    const grass = TYPES.indexOf('Grass');
    // Su Erba il danno viene da Seismic Toss (neutro): Ember superefficace non basta per l'etichetta
    expect(rating.offense.members[0].hits[grass].move).toBe('Seismic Toss');
    expect(cells[grass].querySelector('.eff-tag')).toBeNull();
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
    expect(document.querySelector('.area-legend')).toHaveTextContent('OHKOForteMedio');
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
  const bodyRows = () => [...table().querySelectorAll('tbody tr:not(.og-fill)')] as HTMLElement[];

  it('una riga per membro, 8 bersagli per pagina dal meno coperto, e in fondo la riga Team Coverage con Lo coprono', async () => {
    const { user, sorted } = await open();
    expect(heads()).toEqual(sorted.slice(0, 8).map(r => r.species));
    const rows = bodyRows();
    expect(rows).toHaveLength(team.length);
    expect(rows.map(r => r.querySelector('.def-mon-name')!.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    expect(within(document.querySelector<HTMLElement>('tfoot tr.cm-total')!).getByRole('rowheader')).toHaveTextContent(/^Team CoverageLo coprono/);
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
        expect(cell).toHaveClass(`ko-${ko(pct)}`);
        if (ko(pct) === 'ohko') {
          // In un colpo: il timbro KO al posto del numero (il % e la fascia a parole per chi legge lo schermo), niente barra
          expect(cell.querySelector('.cm-ko')!.textContent).toBe('KO');
          expect(cell.querySelector('.wall-pct')).toBeNull();
          expect(cell.querySelector('.cm-hp')).toBeNull();
          expect(cell).toHaveTextContent(`${pct}% OHKO`);
        } else {
          expect(cell.querySelector('.wall-pct')!.textContent).toBe(`${pct}%`);
          // Sotto il danno la barra dei PS che restano
          expect((cell.querySelector<HTMLElement>('.cm-hp-bar i')!).style.width).toBe(`${100 - pct}%`);
          if (ko(pct) !== 'none') expect(cell.querySelector('.visually-hidden')!.textContent!.trim()).toBe({ two: '2HKO', three: '3HKO' }[ko(pct) as 'two']);
        }
      });
    });
  });

  it('triangolo del setup solo se la danza fa salire fino al 2HKO o all’OHKO (detto a parole nel testo nascosto); niente tooltip del browser', async () => {
    const { sorted } = await open();
    const rank = (pct: number | null) => (pct === null ? 0 : pct >= 100 ? 2 : pct >= 50 ? 1 : 0);
    const rows = bodyRows();
    let lifted = 0;
    sorted.slice(0, 8).forEach((target, col) => {
      team.forEach((_, m) => {
        const c = target.cells![m];
        const cell = rows[m].querySelectorAll('td')[col];
        const up = c.setupPct !== null && rank(c.setupPct) > rank(c.pct);
        if (up) lifted++;
        expect(cell.classList.contains('has-setup')).toBe(up);
        if (up) expect(cell).toHaveTextContent(`setup ${c.setupPct}%`);
        expect(cell).not.toHaveAttribute('title');
      });
    });
    expect(lifted).toBeGreaterThan(0);
  });

  it('×2 / ×4 dove il membro ha una mossa superefficace sul Pokémon; sulla sprite in testata la carta del Pokémon', async () => {
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
    expect(head).not.toHaveAttribute('title');
    await user.hover(head.querySelector<HTMLElement>('.cm-head-mon')!);
    const card = await vi.waitFor(() => { const el = document.querySelector<HTMLElement>('body > .ftip.member'); if (!el) throw new Error('no card'); return el; });
    expect(card).toHaveTextContent(sorted[0].species);
    expect(head.querySelector('.col-name')).toBeNull();
  });

  it('sulla casella il tooltip DreamDex: la minaccia col badge dei colpi, il membro, la sua mossa e il danno %', async () => {
    const { user, sorted } = await open();
    const cell = bodyRows()[0].querySelectorAll<HTMLElement>('td')[0];
    await user.hover(cell);
    const tip = await vi.waitFor(() => { const el = document.querySelector<HTMLElement>('body > .ftip.tht'); if (!el) throw new Error('no tip'); return el; });
    expect(tip.querySelector('.ftip-head')).toHaveTextContent(sorted[0].species);
    expect(tip.querySelector('.ftip-head .ftip-ko')!.textContent).toMatch(/^(OHKO|2HKO|3HKO|4HKO\+)$/);
    expect(tip.querySelector('.tht-body .tht-pct')!.textContent).toMatch(/^[0-9]+%$/);
    await user.unhover(cell);
  });

  it('Lo coprono conta chi lo manda KO in due colpi', async () => {
    const { sorted } = await open();
    const counts = [...document.querySelectorAll('tfoot tr.cm-total td')].map(td => Number(td.querySelector('.ct-pill')!.firstChild!.textContent));
    expect(counts).toEqual(sorted.slice(0, 8).map(r => r.cells!.filter(c => c.pct >= 50).length));
  });

  it('la riga Team Coverage in fondo: la linguetta e le pastiglie di Lo coprono, niente barra né conteggi', async () => {
    await open();
    const row = document.querySelector('tfoot tr.cm-total')!;
    expect(row.querySelector('.og-plate')).toHaveTextContent('Team Coverage');
    expect(row.querySelectorAll('td .ct-pill').length).toBeGreaterThan(0);
    expect(document.querySelector('.cm-summary')).toBeNull();
    expect(document.querySelector('.def-walls .kob-row')).toBeNull();
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
    expect(document.querySelectorAll('tfoot tr.cm-total td')[ghost % 8]).toHaveTextContent('0');
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
    expect(within(table()).getByRole('rowheader', { name: /^Team Coverage\s*Covered by/ })).toBeInTheDocument();
  });
});
