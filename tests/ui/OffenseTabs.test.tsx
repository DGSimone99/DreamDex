import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { stepBucket } from '../../src/engine/offense';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { LangProvider } from '../../src/i18n/react';
import { AreaView } from '../../src/ui/AreaView';
import { gameName } from '../../src/i18n/game';
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

  it('ordine delle sottoschede', () => {
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(names()).toEqual(['Generale', 'Coverage tipi', 'Potenza', 'Wallbreaking', 'Coverage meta']);
    unmount();
    renderIt(<AreaView rating={noMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(names()).toEqual(['Generale', 'Coverage tipi', 'Potenza', 'Wallbreaking']);
  });

  it('il "?" della sottoscheda aperta apre la guida su quella sezione', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Wallbreaking/ }));
    const help = screen.getByRole('button', { name: 'Come funziona Wallbreaking' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Wallbreaking' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent('OHKO');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(help).toHaveFocus();
  });

  it('la guida Generale dice pesi e Coverage; senza meta la guida non ha Coverage meta', async () => {
    const user = userEvent.setup();
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Offesa' });
    expect(within(dialog).getByRole('tab', { name: 'Coverage meta' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tabpanel')).toHaveTextContent(/Potenza.*50/);
    unmount();
    renderIt(<AreaView rating={noMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('button', { name: 'Come funziona Generale' }));
    expect(within(screen.getByRole('dialog')).queryByRole('tab', { name: 'Coverage meta' })).toBeNull();
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="strength" team={team} analysis={analysis} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General', 'Type coverage', 'Power', 'Wallbreaking', 'Meta coverage']);
    await user.click(screen.getByRole('button', { name: 'How General works' }));
    expect(screen.getByRole('dialog', { name: 'Guide: Offense' })).toBeInTheDocument();
  });
});

describe('Offesa: Generale', () => {
  const view = (t: TeamSet[] = team, rating = withMeta()) => renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);

  it('Generale: righe in ordine di team, colonne Pokémon, Potenza, Wallbreaking, Coverage, Offesa', () => {
    view();
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Potenza', 'Wallbreaking', 'Coverage', 'Offesa']);
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
  });

  it('quattro tessere, cliccandole si apre la sottoscheda e prende il focus', async () => {
    const user = userEvent.setup();
    const { unmount } = view();
    const tiles = () => screen.getAllByRole('button', { name: /^(Coverage tipi|Potenza|Wallbreaking|Coverage meta)/ });
    expect(tiles()).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: /^Wallbreaking/ }));
    const tab = screen.getByRole('tab', { name: /^Wallbreaking/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveFocus();
    unmount();
    view(team, noMeta());
    expect(tiles()).toHaveLength(3);
  });

  it('la tessera Wallbreaking conta i muri sfondati senza setup', () => {
    const rating = withMeta();
    view(team, rating);
    const expected = rating.offense.walls.filter(w => w.cells.some(c => ['ohko', 'two'].includes(stepBucket(c.step)))).length;
    const tile = screen.getByRole('button', { name: /^Wallbreaking/ });
    expect(within(tile).getByText('Muri sfondati')).toBeInTheDocument();
    expect(within(tile).getByText(`${expected}/${rating.offense.walls.length}`)).toBeInTheDocument();
  });

  it('membro senza attacchi: la riga resta con "—"', () => {
    const t = [team[0], { ...emptySet('Blissey'), moves: ['Soft-Boiled', 'Toxic', 'Stealth Rock', 'Teleport'] }];
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

  it('Coverage tipi: una tabella membri × 18 tipi con la riga Copertura', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader')).toHaveLength(19);
    const rows = screen.getAllByRole('row');
    const last = rows[rows.length - 1];
    expect(within(last).getByRole('rowheader')).toHaveTextContent('Copertura');
    const cells = within(last).getAllByRole('cell');
    expect(cells).toHaveLength(18);
    cells.forEach(c => expect(c.textContent).toMatch(/\d+%/));
  });

  it('i tipi scoperti sono segnati anche a parole', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const heads = screen.getAllByRole('columnheader').slice(1);
    const holes = rating.offense.coverageTypes.holes;
    expect(holes.length).toBeGreaterThan(0);
    const flagged = heads.filter(h => h.textContent!.includes('scoperto'));
    expect(flagged).toHaveLength(holes.length);
  });
});

describe('Offesa: Potenza', () => {
  const view = () => {
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="strength" team={team} analysis={analysis} problems={[]} />);
    return rating;
  };

  it('Potenza: membri in ordine di team, ognuno col suo colpo migliore', async () => {
    const user = userEvent.setup();
    const rating = view();
    await user.click(screen.getByRole('tab', { name: /^Potenza/ }));
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    const rows = document.querySelectorAll('.def-members tbody tr');
    const slots = offenseSlots(team, rating.offense.members);
    team.forEach((_, slot) => {
      const m = rating.offense.members[slots[slot]!];
      expect(m.bestMove).toBeTruthy();
      expect(rows[slot].querySelector('.pw-move')!.textContent).toBe(gameName('move', m.bestMove!, 'it'));
    });
  });

  it('Potenza: il +N di Tera o mossa Z ha il suo titolo', async () => {
    const user = userEvent.setup();
    const t = [{ ...emptySet('Kingambit'), ability: 'Supreme Overlord', item: 'Black Glasses', moves: ['Kowtow Cleave', 'Sucker Punch', 'Iron Head'], evs: { hp: 252, atk: 252 }, teraType: 'Dark' }];
    const gen9 = { ...fixtureData, formatId: 'gen9ou' as const };
    const rating = rateTeam(t, gen9, 'it')!;
    renderIt(<AreaView rating={rating} area="strength" team={t} analysis={analyzeTeam(t, gen9)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Potenza/ }));
    const gains = rating.offense.members.filter(m => m.oneUse && Math.round(m.powerInGrade - m.power) > 0);
    expect(gains.length).toBeGreaterThan(0);
    const small = [...document.querySelectorAll('.pw-bar small.ad-once')];
    expect(small).toHaveLength(gains.length);
    small.forEach(el => {
      expect(el.textContent).toMatch(/\(\+\d+\)/);
      expect(el.getAttribute('title')).toMatch(/una volta a partita/);
    });
  });

  it('Generale: il "+N" del setup e di Tera sta nel posto riservato della cella, in ogni riga della colonna', () => {
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
      // Il numero e il "+N" si leggono insieme: "50 (+23)"
      expect(gain.closest('.def-cell')).toHaveTextContent(/^\d+ \(\+\d+\)$/);
      const column = [...gain.closest('tr')!.children].indexOf(gain.closest('td')!);
      for (const row of rows) expect(row.children[column].querySelector('.def-cell')).toHaveClass('with-gain');
    }
    // Le colonne senza "+N" non riservano il posto
    expect(rows[0].children[1].querySelector('.def-cell')).not.toHaveClass('with-gain');
  });

  it('Potenza: membro scartato resta con "—"', async () => {
    const user = userEvent.setup();
    const t = [team[0], { ...emptySet('Blissey'), moves: ['Soft-Boiled', 'Toxic', 'Stealth Rock', 'Teleport'] }];
    renderIt(<AreaView rating={rateTeam(t, fixtureData, 'it')!} area="strength" team={t} analysis={analyzeTeam(t, fixtureData)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Potenza/ }));
    const rows = document.querySelectorAll('.def-members tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('.pw-move')).toBeNull();
    expect(within(rows[1] as HTMLElement).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('Potenza: senza statistiche il riferimento è fisso', async () => {
    const user = userEvent.setup();
    const noStats = { ...fixtureData, stats: null };
    renderIt(<AreaView rating={rateTeam(team, noStats, 'it')!} area="strength" team={team} analysis={analyzeTeam(team, noStats)} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Potenza/ }));
    expect(document.querySelector('.pw-ref')!.textContent).toMatch(/100 = un danno medio del \d+% dei PS/);
    expect(document.querySelectorAll('.pw-ref .def-open-mon')).toHaveLength(0);
  });

  it('Potenza: i tre attaccanti di riferimento', async () => {
    const user = userEvent.setup();
    const rating = view();
    await user.click(screen.getByRole('tab', { name: /^Potenza/ }));
    const refs = rating.offense.referenceAttackers;
    expect(refs).toHaveLength(3);
    refs.forEach(s => expect(document.querySelector(`.pw-ref [title="${s}"]`)).toBeInTheDocument());
  });

  it('Wallbreaking: membri in riga, un muro per colonna, la riga Lo sfondano', async () => {
    const user = userEvent.setup();
    const rating = view();
    await user.click(screen.getByRole('tab', { name: /^Wallbreaking/ }));
    const heads = screen.getAllByRole('columnheader').map(h => h.getAttribute('aria-label')).filter(Boolean);
    expect(heads).toEqual(rating.offense.walls.map(w => w.species));
    const rows = [...document.querySelectorAll('.def-walls tbody tr')];
    expect(rows).toHaveLength(team.length + 1);
    expect(within(rows[rows.length - 1] as HTMLElement).getByRole('rowheader')).toHaveTextContent('Lo sfondano');
  });

  it('le soglie sono scritte anche a parole', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Wallbreaking/ }));
    const words = [...document.querySelectorAll('.def-walls .rob-cell .visually-hidden')].map(el => el.textContent!.trim());
    expect(words.some(w => w === '2HKO' || w === 'OHKO')).toBe(true);
  });
});

describe('Offesa: Coverage meta', () => {
  const open = async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    renderIt(<AreaView rating={rating} area="strength" team={team} analysis={analysis} problems={[]} />);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    return { user, rating };
  };
  const level = (li: HTMLElement) => Number(/: (\d+)%/.exec(li.getAttribute('aria-label') ?? '')![1]);

  it('Coverage meta: pagine da 8 dal bersaglio meno coperto', async () => {
    const { user } = await open();
    const tiles = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    expect(tiles).toHaveLength(8);
    expect(level(tiles[0])).toBeLessThanOrEqual(level(tiles[tiles.length - 1]));
    await user.click(screen.getByRole('button', { name: 'Bersagli successivi' }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('un bersaglio senza colpi dice nessuno', async () => {
    const { rating } = await open();
    const rows = rating.offense.coverageMeta!.rows;
    const none = rows.find(r => r.coveredBy.length === 0);
    // La squadra di prova lascia scoperti dei bersagli: senza, il test non dimostrerebbe niente
    expect(none).toBeDefined();
    // I meno coperti stanno in prima pagina
    const tile = within(screen.getByRole('tabpanel')).getAllByRole('listitem').find(li => li.getAttribute('aria-label')!.startsWith(`${none!.species}:`));
    expect(tile).toBeDefined();
    expect(tile!.getAttribute('aria-label')).toContain('nessuno');
    expect(tile).toHaveClass('none');
    expect(tile!.querySelector('.ct-pill')).toHaveClass('bad');
  });

  it('i conteggi in alto coincidono con i gruppi delle righe', async () => {
    const { rating } = await open();
    const rows = rating.offense.coverageMeta!.rows;
    const none = rows.filter(r => r.coveredBy.length === 0).length;
    const partial = rows.filter(r => r.coveredBy.length > 0 && r.coveredBy.every(c => c.partial)).length;
    const summary = document.querySelector('.cm-summary')!;
    expect(summary).toHaveTextContent(`${rows.length} bersagli`);
    expect(summary).toHaveTextContent(`${rows.length - none - partial} coperti`);
    expect(summary).toHaveTextContent(`${partial} a metà`);
    expect(summary).toHaveTextContent(`${none} nessuno`);
  });

  it('pastiglia del livello col colore giusto e % gialla per chi copre a metà', async () => {
    await open();
    const tiles = within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    for (const tile of tiles) {
      const lvl = level(tile);
      expect(tile.querySelector('.cm-head .ct-pill')).toHaveClass(lvl === 0 ? 'bad' : lvl < 80 ? 'warn' : 'good');
    }
    // Un colpo da 3HKO copre a metà: la sua % è gialla
    expect(document.querySelectorAll('.cm-holder.partial .cm-holder-pct.half').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.cm-holder:not(.partial) .cm-holder-pct.half')).toHaveLength(0);
  });
});
