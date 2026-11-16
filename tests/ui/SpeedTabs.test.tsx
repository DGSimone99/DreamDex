import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { poolSpecies } from '../../src/engine/speed';
import type { EngineData } from '../../src/engine/data';
import type { SpeciesStats } from '../../src/engine/stats';
import { LangProvider } from '../../src/i18n/react';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const dnite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant', { atk: 252, spe: 252 });
const webber = set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid', { spa: 252, spe: 252 });
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid', { spa: 252, spe: 252 });
const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Haze', 'Toxic'], 'Bold', { hp: 252, def: 252 });
const team = [dnite, webber, valiant, pex];

const withMeta = (t = team) => rateTeam(t, fixtureData, 'it')!;
const noMetaData = { ...fixtureData, ignoreMeta: true };
const noMeta = (t = team) => rateTeam(t, noMetaData, 'it')!;
const view = (t: TeamSet[] = team, rating = withMeta(t), data = fixtureData) =>
  renderIt(<AreaView rating={rating} area="speed" team={t} analysis={analyzeTeam(t, data)} problems={[]} />);
const names = () => screen.getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);
const barOf = (name: string) => screen.getByRole('button', { name: `Velocità di ${name}: apri i rivali` });
const dialogOf = (name: string) => screen.getByRole('dialog', { name: `Velocità di ${name}` });
const checks = (dialog: HTMLElement) => within(dialog).getAllByRole('checkbox').map(c => c.getAttribute('aria-label'));

describe('Velocità: una scheda a barre', () => {
  it('una sola scheda, senza spiegazioni sulla pagina; i membri come nel team con la barra a segmenti e il totale', () => {
    const rating = withMeta();
    view(team, rating);
    expect(names()).toEqual(['Generale']);
    expect(document.querySelector('.ad-how')).toBeNull();
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Dragonite', 'Ribombee', 'Iron Valiant', 'Toxapex']);
    const rows = document.querySelectorAll('.def-members tbody tr:not(.og-fill)');
    const sorted = team.map(s => rating.speed.members.find(m => m.species === s.species)!);
    sorted.forEach((m, i) => {
      const bar = within(rows[i] as HTMLElement).getByRole('button', { name: `Velocità di ${m.species}: apri i rivali` });
      expect(bar).toHaveTextContent(`${Math.round(100 * m.total)}%`);
      expect(bar.querySelectorAll('.sp-stack i')).toHaveLength(3);
    });
    // Dragonite: la parte propria (Dragon Dance, Extreme Speed) e quella del team (Web, Stun Spore) sono scritte nel dettaglio
    const d = sorted.find(m => m.species === 'Dragonite')!;
    const bar = barOf('Dragonite');
    expect(bar).toHaveTextContent(`${Math.round(100 * d.raw)}`);
    expect(bar).not.toHaveAttribute('title');
    // In fondo la riga del team, col voto dell'area
    expect(document.querySelector('.def-members tfoot')).toHaveTextContent(`Velocità del team${rating.speed.value}%`);
  });

  it('passando sulla barra: la scala dei rivali vicini e cosa aggiunge ogni guadagno, icona della Booster accanto al nome', async () => {
    const user = userEvent.setup();
    view();
    await user.hover(barOf('Dragonite'));
    const tip = await screen.findByText((_, el) => !!el?.classList.contains('stip-ladder'));
    expect(tip.querySelector('.stip-rung.self')).toHaveTextContent('Dragonite');
    const gains = document.querySelector('.stip-gains')!;
    expect(gains).toHaveTextContent(/Dragon Dance/);
    expect(gains).toHaveTextContent(/Sticky Web/);
    await user.unhover(barOf('Dragonite'));
    await user.hover(barOf('Iron Valiant'));
    const self = await screen.findByText((_, el) => !!el?.classList.contains('self') && !!el.textContent?.includes('Iron Valiant'));
    expect(self.querySelector('.item-icon')).not.toBeNull();
  });

  it('niente tessere sotto la tabella: solo i membri', () => {
    view();
    expect(document.querySelectorAll('.def-tile')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^Velocità di .*: apri i rivali$/ })).toHaveLength(4);
  });

  it('il modale di Dragonite: i check che esistono davvero, la lista dei rivali (una riga per specie) col membro al suo posto', async () => {
    const user = userEvent.setup();
    view();
    await user.click(barOf('Dragonite'));
    const dialog = dialogOf('Dragonite');
    expect(checks(dialog)).toEqual(expect.arrayContaining(['Dragon Dance', 'Sticky Web', 'Stun Spore']));
    expect(checks(dialog).filter(c => ['Dragon Dance', 'Sticky Web', 'Stun Spore', 'Booster Energy', 'Tailwind', 'Trick Room'].includes(c!))).toEqual(['Dragon Dance', 'Sticky Web', 'Stun Spore']);
    expect(dialog).not.toHaveTextContent('il voto non cambia');
    const list = within(dialog).getByRole('list', { name: /rivali/i });
    const rows = within(list).getAllByRole('listitem');
    // Una riga per specie, più la seconda versione di chi usa spesso la Sciarpa o la Booster (Gholdengo), più il membro
    expect(rows).toHaveLength(poolSpecies(fixtureData).filter(sp => sp !== 'Dragonite').length + 1 + 1);
    const me = rows.find(r => r.getAttribute('aria-current') === 'true')!;
    expect(me).toHaveTextContent('Dragonite');
    // Dal più veloce: il primo rivale è più veloce dell'ultimo
    const speeds = rows.filter(r => r !== me).map(r => Number(r.querySelector('.sp-rival-speed')!.textContent));
    expect(speeds).toEqual([...speeds].sort((a, b) => b - a));
    // Chi sta sopra è rosso, chi sta sotto verde
    const meIndex = rows.indexOf(me);
    expect(rows[meIndex - 1]?.classList.contains('sp-loses') ?? true).toBe(true);
    expect(rows[meIndex + 1]?.classList.contains('sp-beats') ?? true).toBe(true);
    // Niente riga delle priorità né note sull'interruttore degli strumenti
    expect(dialog).not.toHaveTextContent(/colpisce prima|compare due volte|Le righe con l'icona/);
  });

  it('i check cambiano la lista e il conteggio, non il voto: Dragon Dance fa superare di più; Scarf sul rivale lo fa correre', async () => {
    const user = userEvent.setup();
    view();
    await user.click(barOf('Dragonite'));
    const dialog = dialogOf('Dragonite');
    const count = () => Number(within(dialog).getByText(/^Supera \d+ su \d+$/).textContent!.match(/\d+/)![0]);
    const before = count();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Dragon Dance' }));
    expect(count()).toBeGreaterThan(before);
    // Gholdengo con la Sciarpa sul 38% dei set: di base compare due volte, la versione con la Sciarpa ha l'icona e il tooltip
    const rowsOf = (name: string) => within(dialog).getAllByRole('listitem').filter(r => r.textContent!.includes(name));
    expect(rowsOf('Gholdengo')).toHaveLength(2);
    const scarfed = rowsOf('Gholdengo').find(r => r.classList.contains('sp-boosted'))!;
    expect(scarfed.querySelector('.sp-rival-speed')).toHaveTextContent('439');
    expect(scarfed.querySelector('.item-icon')).not.toBeNull();
    expect(scarfed.getAttribute('title')).toMatch(/Gholdengo con Choice Scarf \(\d+% dei suoi set\)/);
    expect(rowsOf('Gholdengo').find(r => !r.classList.contains('sp-boosted'))!.querySelector('.sp-rival-speed')).toHaveTextContent('293');
    // Il check unico spegne le versioni in più
    const versions = within(dialog).getByRole('checkbox', { name: 'Strumenti avversari' });
    expect(versions).toBeChecked();
    await user.click(versions);
    expect(rowsOf('Gholdengo')).toHaveLength(1);
    expect(dialog).not.toHaveTextContent(/versione con lo strumento/);
    // Il voto in testa non cambia
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveTextContent(String(withMeta().speed.value));
  });

  it('un rivale con la Sciarpa su quasi tutti i set (85%): una riga sola, sempre con l\'icona, anche a check spento', async () => {
    const user = userEvent.setup();
    const entry = (usage: number, spread: string, items: Record<string, number>): SpeciesStats =>
      ({ usage, count: 100, abilities: {}, items, moves: {}, teraTypes: {}, spreads: { [spread]: 0.5 }, teammates: {}, checks: {} });
    const data: EngineData = { stats: { meta: { month: 'm', cutoff: 1, battles: 1 }, pokemon: {
      Rillaboom: entry(0.4, 'Adamant:0/252/0/0/4/252', { choicescarf: 0.85 }),
      Garchomp: entry(0.3, 'Jolly:0/252/0/0/4/252', { rockyhelmet: 0.9 }),
      Gholdengo: entry(0.2, 'Timid:0/0/0/252/4/252', { airballoon: 0.6, choicescarf: 0.3 }),
    } }, sets: {} };
    const t = [dnite, pex];
    renderIt(<AreaView rating={rateTeam(t, data, 'it')!} area="speed" team={t} analysis={analyzeTeam(t, data)} problems={[]} />);
    await user.click(barOf('Dragonite'));
    const dialog = dialogOf('Dragonite');
    const rowsOf = (name: string) => within(dialog).getAllByRole('listitem').filter(r => r.textContent!.includes(name));
    expect(rowsOf('Rillaboom')).toHaveLength(1);
    expect(rowsOf('Rillaboom')[0].querySelector('.sp-rival-speed')).toHaveTextContent('403');
    expect(rowsOf('Rillaboom')[0].querySelector('.item-icon')).not.toBeNull();
    expect(rowsOf('Rillaboom')[0].getAttribute('title')).toMatch(/Rillaboom con Choice Scarf \(85% dei suoi set\)/);
    // Il check toglie la seconda versione di Gholdengo (30%), non la riga di Rillaboom che è sempre con la Sciarpa
    expect(rowsOf('Gholdengo')).toHaveLength(2);
    await user.click(within(dialog).getByRole('checkbox', { name: 'Strumenti avversari' }));
    expect(rowsOf('Gholdengo')).toHaveLength(1);
    expect(rowsOf('Rillaboom')).toHaveLength(1);
    expect(rowsOf('Rillaboom')[0].querySelector('.item-icon')).not.toBeNull();
    expect(rowsOf('Garchomp')).toHaveLength(1);
  });

  it('due membri della stessa specie: ogni barra apre il modale del proprio set', async () => {
    const user = userEvent.setup();
    const plain = set('Dragonite', 'Choice Band', 'Multiscale', ['Outrage', 'Extreme Speed', 'Earthquake', 'Fire Punch'], 'Adamant', { atk: 252, spe: 4 });
    const t = [dnite, plain, pex];
    // Due della stessa specie solo dove la Species Clause non c'è (Anything Goes): altrove il voto è bloccato
    const ag = { ...fixtureData, formatId: 'gen9ag' as const };
    view(t, rateTeam(t, ag, 'it')!, ag);
    const bars = screen.getAllByRole('button', { name: 'Velocità di Dragonite: apri i rivali' });
    expect(bars).toHaveLength(2);
    // Il primo (nel team) è quello con Dragon Dance, il secondo no
    await user.click(bars[0]);
    expect(checks(dialogOf('Dragonite'))).toContain('Dragon Dance');
    await user.keyboard('{Escape}');
    expect(bars[0]).toHaveFocus();
    await user.click(bars[1]);
    expect(checks(dialogOf('Dragonite'))).not.toContain('Dragon Dance');
    await user.keyboard('{Escape}');
    expect(bars[1]).toHaveFocus();
  });

  it('Iron Valiant ha il check Booster Energy; Esc chiude e il focus torna alla barra', async () => {
    const user = userEvent.setup();
    view();
    await user.click(barOf('Iron Valiant'));
    const dialog = dialogOf('Iron Valiant');
    expect(checks(dialog)).toEqual(expect.arrayContaining(['Booster Energy']));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(barOf('Iron Valiant')).toHaveFocus();
  });

  it('senza meta: i Pokémon del tier, nessun check Sciarpa', async () => {
    const user = userEvent.setup();
    view(team, noMeta(), noMetaData);
    await user.click(barOf('Dragonite'));
    const dialog = dialogOf('Dragonite');
    expect(dialog).toHaveTextContent(/tier/);
    expect(within(dialog).queryByRole('checkbox', { name: 'Strumenti avversari' })).toBeNull();
    expect(within(dialog).getAllByRole('listitem').length).toBe(poolSpecies(noMetaData).filter(sp => sp !== 'Dragonite').length + 1);
  });

  it('la velocità nella riga è quella reale, con la Sciarpa: Victini 328 diventa 492', () => {
    const victini = set('Victini', 'Choice Scarf', 'Victory Star', ['V-create', 'Bolt Strike', 'U-turn', 'Trick'], 'Jolly', { atk: 252, spe: 252 });
    const t = [victini, pex];
    view(t, withMeta(t));
    const row = document.querySelectorAll('.def-members tbody tr')[0] as HTMLElement;
    expect(row).toHaveTextContent('Victini');
    const stat = row.querySelector('.def-mon-stats')!;
    expect(stat).toHaveTextContent('492');
    expect(stat).not.toHaveTextContent('328');
    expect(stat).toHaveTextContent('Scarf');
    expect(barOf('Victini')).toBeInTheDocument();
  });

  it('una specie sconosciuta: riga con "—", senza barra', () => {
    const odd = [...team, emptySet('Nessuno')];
    view(odd, withMeta(odd));
    const rows = document.querySelectorAll('.def-members tbody tr:not(.og-fill)');
    expect(rows).toHaveLength(5);
    const last = rows[4];
    expect(last).toHaveTextContent('Nessuno');
    expect(last).toHaveTextContent('—');
    expect(within(last as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('il "?" apre la guida della Velocità: rivali, le tre fonti col dettaglio nel tooltip, senza quote né pesi', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('button', { name: 'Come funziona Velocità' }));
    const dialog = screen.getByRole('dialog', { name: 'Guida: Velocità' });
    const panel = within(dialog).getByRole('tabpanel');
    expect(panel).toHaveTextContent(/40 Pokémon più usati/);
    expect(panel).toHaveTextContent(/Stolascelta/);
    // Niente quote né pesi: le fonti aggiungono un bonus, il team è la media
    expect(panel).not.toHaveTextContent(/50%|25%|12,5%|17%/);
    expect(panel).toHaveTextContent(/superarne il 74% vale 74/);
    expect(panel).toHaveTextContent(/ognuno conta uguale/);
    expect(panel).not.toHaveTextContent(/La finestra di ogni membro|non cambiano il voto|Clicca/);
    // Tre fonti come righe, ognuna col "?": il dettaglio sta nel tooltip, niente a vista sulla pagina
    expect(panel.querySelectorAll('.guide-rows > div')).toHaveLength(3);
    expect(panel.querySelectorAll('.guide-ask')).toHaveLength(3);
    expect(panel).not.toHaveTextContent(/×1,5|Shell Smash/);
    const chips = () => [...document.querySelectorAll('.sp-gd-tip .sp-gd-chip')].map(c => c.textContent);
    await user.hover(within(panel).getByRole('button', { name: 'Boost' }));
    await waitFor(() => expect(chips()).toContain('Shell Smash'));
    expect(chips()).toContain('Swift Swimpioggia');
    expect(chips()).toContain('Booster Energy');
    expect(document.querySelector('.sp-gd-tip')).toHaveTextContent(/×1,5/);
    await user.unhover(within(panel).getByRole('button', { name: 'Boost' }));
    await user.hover(within(panel).getByRole('button', { name: 'Controllo del team' }));
    await waitFor(() => expect(chips()).toContain('Glare'));
    // Le mosse che rallentano come etichette, coi tipi immuni dentro; la regola tiene solo l'eccezione comune
    // (i nomi dei tipi in italiano arrivano coi dati del gioco: qui, senza, restano in inglese)
    expect(chips()).toEqual(expect.arrayContaining(['Thunder Wavenon Ground', 'Glare', 'Stun Sporenon Grass', 'Nuzzlenon Ground', 'Icy Wind', 'Electrowebnon Ground']));
    const control = document.querySelector('.sp-gd-tip')!;
    expect(control).toHaveTextContent(/Non sui tipi Elettro/);
    expect(control).toHaveTextContent(/Trick Room/);
    expect(control).toHaveTextContent(/Tailwind/);
    expect(control).not.toHaveTextContent(/%/);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="speed" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General']);
    await user.click(screen.getByRole('button', { name: 'Speed of Dragonite: open the rivals' }));
    expect(screen.getByRole('dialog', { name: 'Speed of Dragonite' })).not.toHaveTextContent('the grade does not change');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'How Speed works' }));
    expect(screen.getByRole('dialog', { name: 'Guide: Speed' })).toHaveTextContent(/Scarf/);
  });
});

describe('Velocità: colori dei pezzi della barra', () => {
  it('coi suoi mezzi e col team non usano il giallo di stato né il magenta', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/styles/speed.css', 'utf8');
    const rules = css.split('\n').filter(line => /\.sp-(seg|part)-(own|team)\b/.test(line));
    expect(rules.length).toBe(4);
    rules.forEach(rule => expect(rule).not.toMatch(/--warn|--accent-2/));
  });
});
