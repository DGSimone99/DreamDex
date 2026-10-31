import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { poolSpecies } from '../../src/engine/speed';
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
const noControl = [dnite, valiant, pex];

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
  it('una sola scheda, senza spiegazioni sulla pagina; i membri dal più veloce con la barra a segmenti e il totale', () => {
    const rating = withMeta();
    view(team, rating);
    expect(names()).toEqual(['Generale']);
    expect(document.querySelector('.ad-how')).toBeNull();
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Ribombee', 'Iron Valiant', 'Dragonite', 'Toxapex']);
    const rows = document.querySelectorAll('.def-members tbody tr');
    const sorted = [...rating.speed.members].sort((a, b) => b.speed - a.speed);
    sorted.forEach((m, i) => {
      const bar = within(rows[i] as HTMLElement).getByRole('button', { name: `Velocità di ${m.species}: apri i rivali` });
      expect(bar).toHaveTextContent(`${Math.round(100 * m.total)}%`);
      expect(bar.querySelectorAll('.sp-stack i')).toHaveLength(3);
    });
    // Dragonite: la parte propria (Dragon Dance, Extreme Speed) e quella del team (Web, Stun Spore) sono scritte nel dettaglio
    const d = sorted.find(m => m.species === 'Dragonite')!;
    const bar = barOf('Dragonite');
    expect(bar).toHaveTextContent(`${Math.round(100 * d.raw)}`);
    expect(bar.getAttribute('title')).toMatch(/Dragon Dance/);
    expect(bar.getAttribute('title')).toMatch(/Sticky Web/);
  });

  it('le tessere: Velocità con "Nessuno li supera" e il Controllo con le mosse; senza controllo il testo', () => {
    const { unmount } = view();
    const tiles = document.querySelectorAll('.def-tile');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveTextContent('Velocità');
    expect(tiles[0]).toHaveTextContent(/Nessuno li supera\d+\/\d+/);
    expect(tiles[1]).toHaveTextContent('Controllo velocità');
    expect(tiles[1]).toHaveTextContent('Sticky Web');
    expect(tiles[0].tagName).toBe('DIV');
    unmount();
    view(noControl, withMeta(noControl));
    expect(document.querySelectorAll('.def-tile')[1]).toHaveTextContent('Nessun controllo');
  });

  it('il modale di Dragonite: i check che esistono davvero, la lista dei rivali (una riga per specie) col membro al suo posto', async () => {
    const user = userEvent.setup();
    view();
    await user.click(barOf('Dragonite'));
    const dialog = dialogOf('Dragonite');
    expect(checks(dialog)).toEqual(expect.arrayContaining(['Dragon Dance', 'Sticky Web', 'Stun Spore']));
    expect(checks(dialog).filter(c => ['Dragon Dance', 'Sticky Web', 'Stun Spore', 'Booster Energy', 'Tailwind', 'Trick Room'].includes(c!))).toEqual(['Dragon Dance', 'Sticky Web', 'Stun Spore']);
    expect(dialog).toHaveTextContent('il voto non cambia');
    const list = within(dialog).getByRole('list', { name: /rivali/i });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(poolSpecies(fixtureData).filter(sp => sp !== 'Dragonite').length + 1);
    const me = rows.find(r => r.getAttribute('aria-current') === 'true')!;
    expect(me).toHaveTextContent('Dragonite');
    // Dal più veloce: il primo rivale è più veloce dell'ultimo
    const speeds = rows.filter(r => r !== me).map(r => Number(r.querySelector('.sp-rival-speed')!.textContent));
    expect(speeds).toEqual([...speeds].sort((a, b) => b - a));
    // Chi sta sopra è rosso, chi sta sotto verde
    const meIndex = rows.indexOf(me);
    expect(rows[meIndex - 1]?.classList.contains('sp-loses') ?? true).toBe(true);
    expect(rows[meIndex + 1]?.classList.contains('sp-beats') ?? true).toBe(true);
    // La riga delle priorità c'è solo se il voto conta una priorità (Extreme Speed non tocca Dragapult, che è Spettro)
    const priority = withMeta().speed.members.find(m => m.species === 'Dragonite')!.gains.find(g => g.condition === 'priority');
    if (priority) expect(dialog).toHaveTextContent(new RegExp(`Con ${priority.source} colpisce prima`));
    else expect(dialog).not.toHaveTextContent(/colpisce prima/);
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
    // Gholdengo con la Sciarpa sul 37% dei set: il check sulla sua riga
    const gholdengo = within(dialog).getAllByRole('listitem').find(r => r.textContent!.includes('Gholdengo'))!;
    expect(gholdengo.querySelector('.sp-rival-speed')).toHaveTextContent('293');
    const scarf = within(gholdengo).getByRole('checkbox', { name: /^Scarf \d+%$/ });
    await user.click(scarf);
    const after = within(dialog).getAllByRole('listitem').find(r => r.textContent!.includes('Gholdengo'))!;
    expect(after.querySelector('.sp-rival-speed')).toHaveTextContent('439');
    expect(dialog).toHaveTextContent(/Nel voto contano anche.*Gholdengo \(Scarf \d+%\)/);
    // Il voto in testa non cambia
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveTextContent(String(withMeta().speed.value));
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
    expect(within(dialog).queryByRole('checkbox', { name: /^(Scarf|Booster) \d+%$/ })).toBeNull();
    expect(within(dialog).getAllByRole('listitem').length).toBe(poolSpecies(noMetaData).filter(sp => sp !== 'Dragonite').length + 1);
  });

  it('una specie sconosciuta: riga con "—", senza barra', () => {
    const odd = [...team, emptySet('Nessuno')];
    view(odd, withMeta(odd));
    const rows = document.querySelectorAll('.def-members tbody tr');
    expect(rows).toHaveLength(5);
    const last = rows[4];
    expect(last).toHaveTextContent('Nessuno');
    expect(last).toHaveTextContent('—');
    expect(within(last as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('in inglese', async () => {
    const user = userEvent.setup();
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="speed" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General']);
    await user.click(screen.getByRole('button', { name: 'Speed of Dragonite: open the rivals' }));
    expect(screen.getByRole('dialog', { name: 'Speed of Dragonite' })).toHaveTextContent('the grade does not change');
  });
});
