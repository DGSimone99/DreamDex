import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { TYPES } from '../../src/engine/types';
import { LangProvider } from '../../src/i18n/react';
import { AreaView } from '../../src/ui/AreaView';
import { typeName } from '../../src/i18n/game';
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
    // La regola del credito e il setup a un terzo
    expect(panel).toHaveTextContent('Oltre il 33%');
    expect(panel).toHaveTextContent('un terzo del guadagno');
    // Le difese medie dei 18 bersagli stanno qui, sotto il Colpo (chiuse sotto una freccina)
    expect(within(panel).getByText('Statistiche medie dei 18 bersagli').closest('details')).not.toHaveAttribute('open');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('la guida Generale dice i pesi: tipi 70 e meta 30; senza meta tipi 100 e niente Coverage meta', async () => {
    const user = userEvent.setup();
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Coverage meta' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Coverage tipi.*70/);
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Coverage meta.*30/);
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
  const view = (t: TeamSet[] = team, rating = withMeta()) => renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);

  it("Generale: il valore sui tipi, la Coverage meta e l'Offesa del membro coi pesi della squadra", () => {
    const rating = withMeta();
    const { unmount } = view(team, rating);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Coverage tipi', 'Coverage meta', 'Offesa']);
    const rows = document.querySelectorAll('.def-members tbody tr');
    rating.offense.members.forEach((m, i) => {
      const cells = rows[i].querySelectorAll('td');
      expect(cells[0]).toHaveTextContent(`${m.value - m.setupGain - m.oneUseGain}`);
      expect(cells[1]).toHaveTextContent(`${m.coverMeta}%`);
      expect(cells[2]).toHaveTextContent(`${m.total}`);
    });
    unmount();
    view(team, noMeta());
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Coverage tipi', 'Offesa']);
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
  });

  it('niente tessere sotto la tabella', () => {
    view();
    expect(document.querySelector('.def-tile')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Coverage tipi|Coverage meta)/ })).toBeNull();
  });

  it('membro che il motore non conosce: la riga resta con "—"', () => {
    const t = [team[0], { ...emptySet('Notamon'), moves: ['Tackle'] }];
    view(t);
    const rows = document.querySelectorAll('.def-members tbody tr');
    expect(rows).toHaveLength(2);
    expect(within(rows[1] as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('un solo membro', () => {
    view([team[0]]);
    expect(document.querySelectorAll('.def-members tbody tr')).toHaveLength(1);
    expect(document.querySelector('.def-general')!.textContent).not.toContain('NaN');
  });

  it('il +N di Tera o mossa Z ha il suo titolo', () => {
    const t = [{ ...emptySet('Kingambit'), ability: 'Supreme Overlord', item: 'Black Glasses', moves: ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'], evs: { hp: 252, atk: 252 }, teraType: 'Dark' }];
    const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };
    const rating = rateTeam(t, gen9, 'it')!;
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, gen9)} problems={[]} />);
    const gains = rating.offense.members.filter(m => m.oneUse && m.oneUseGain > 0);
    expect(gains.length).toBeGreaterThan(0);
    const small = [...document.querySelectorAll('.def-members small.ad-once')];
    expect(small).toHaveLength(gains.length);
    small.forEach(el => {
      expect(el.textContent).toMatch(/\(\+\d+\)/);
      expect(el.getAttribute('title')).toBe(`Tera ${typeName('Dark', 'it')}`);
    });
  });

  it('il "+N" del setup e di Tera sta nel posto riservato della cella, in ogni riga della colonna', () => {
    const t = [
      { ...emptySet('Kingambit'), ability: 'Supreme Overlord', item: 'Black Glasses', moves: ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], evs: { hp: 252, atk: 252 }, teraType: 'Dark' },
      team[0],
    ];
    const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };
    renderIt(<AreaView rating={rateTeam(t, gen9, 'it')!} area="strength" team={t} analysis={analyzeTeam(t, gen9)} problems={[]} />);
    const table = screen.getByRole('table');
    const gains = [...table.querySelectorAll('.ad-gain, .ad-once')];
    expect(gains.map(g => g.className.split(' ')[0]).sort()).toEqual(['ad-gain', 'ad-once']);
    const rows = [...table.querySelectorAll('tbody tr')];
    for (const gain of gains) {
      expect(gain.closest('.def-cell.with-gain > .def-gain')).not.toBeNull();
      // Il numero e i "+N" si leggono insieme: "50 (+23)" o, con setup e Tera, "50 (+11) (+3)"
      expect(gain.closest('.def-cell')).toHaveTextContent(/^\d+( \(\+\d+\))+$/);
      const column = [...gain.closest('tr')!.children].indexOf(gain.closest('td')!);
      for (const row of rows) expect(row.children[column].querySelector('.def-cell')).toHaveClass('with-gain');
    }
    // Le colonne senza "+N" non riservano il posto (la Coverage meta)
    expect(rows[0].children[2].querySelector('.def-cell')).not.toHaveClass('with-gain');
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
          expect(cell.textContent).toBe('');
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
