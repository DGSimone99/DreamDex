import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
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
const noMeta = (t = team) => rateTeam(t, { ...fixtureData, ignoreMeta: true }, 'it')!;
const view = (t: TeamSet[] = team, rating = withMeta(t), data = fixtureData) =>
  renderIt(<AreaView rating={rating} area="speed" team={t} analysis={analyzeTeam(t, data)} problems={[]} />);
const names = () => screen.getAllByRole('tab').map(tab => tab.querySelector('span')!.textContent);

describe('Velocità: schede', () => {
  it('tre schede, Generale aperta, senza spiegazioni sulla pagina', () => {
    view();
    expect(names()).toEqual(['Generale', 'Chi supera', 'Controllo velocità']);
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.ad-how')).toBeNull();
    expect(screen.getByRole('tab', { name: /^Controllo velocità/ })).toHaveTextContent(/\+\d+$/);
  });

  it('Generale: una colonna per voce, membri dal più veloce, tessere Velocità e Controllo', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Velocità', 'Pura', 'Propria', 'Con il team']);
    expect([...document.querySelectorAll('.def-mon-name')].map(n => n.textContent)).toEqual(['Ribombee', 'Iron Valiant', 'Dragonite', 'Toxapex']);
    const rows = document.querySelectorAll('.def-members tbody tr');
    const sorted = [...rating.speed.members].sort((a, b) => b.speed - a.speed);
    sorted.forEach((m, i) => {
      const cells = rows[i].querySelectorAll('td');
      expect(cells[0]).toHaveTextContent(String(m.speed));
      expect(cells[1]).toHaveTextContent(`${Math.round(100 * m.raw)}%`);
      expect(cells[2]).toHaveTextContent(`${Math.round(100 * m.own)}%`);
      expect(cells[3]).toHaveTextContent(`${Math.round(100 * m.total)}%`);
    });
    // Dragonite: la Propria vale più della Pura (Dragon Dance ed Extreme Speed), col "+N" spiegato nel tooltip
    const dniteRow = rows[2];
    const gain = dniteRow.querySelectorAll('td')[2].querySelector('.ad-gain')!;
    expect(gain).toHaveTextContent(/^\(\+\d+\)$/);
    expect(gain.getAttribute('title')).toMatch(/Dragon Dance/);
    const tiles = screen.getAllByRole('button', { name: /^(Velocità|Controllo velocità)/ });
    expect(tiles).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^Controllo velocità/ }));
    expect(screen.getByRole('tab', { name: /^Controllo velocità/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('Chi supera: i membri in riga, 8 rivali per pagina dal meno superato, la riga "Lo superano", la Sciarpa segnata', async () => {
    const user = userEvent.setup();
    const rating = withMeta();
    view(team, rating);
    await user.click(screen.getByRole('tab', { name: /^Chi supera/ }));
    const panel = screen.getByRole('tabpanel');
    const table = within(panel).getByRole('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent('Pokémon');
    expect(headers.length - 1).toBe(Math.min(8, rating.speed.threats.length));
    expect(within(table).getAllByRole('rowheader').map(h => h.textContent)).toEqual(expect.arrayContaining(['Lo superano']));
    expect([...table.querySelectorAll('tbody .def-mon-name')].map(n => n.textContent)).toEqual(['Dragonite', 'Ribombee', 'Iron Valiant', 'Toxapex']);
    // La prima colonna è la meno superata
    const first = rating.speed.threats[0];
    expect(headers[1].getAttribute('aria-label')).toContain(first.species);
    const pills = [...table.querySelectorAll('.ct-sum .ct-pill')].map(p => Number(p.textContent!.replace(/\D.*$/, '')));
    expect(pills[0]).toBe(first.outsped);
    expect(pills).toEqual([...pills].sort((a, b) => a - b));
    // Gholdengo con la Sciarpa sul 37% dei set: due colonne, una col segno "Scarf" (in una delle pagine)
    const marks: string[] = [];
    const pages = within(panel).getAllByRole('button', { name: /^Rivali da/ });
    for (const page of pages) {
      await user.click(page);
      marks.push(...[...document.querySelectorAll('.sp-mark')].map(m => m.textContent!));
    }
    expect(marks).toContain('Scarf');
    // Le celle: Dragonite contro un rivale lento dice che lo supera; la legenda c'è
    const yes = table.querySelectorAll('.sp-cell.sp-full');
    expect(yes.length).toBeGreaterThan(0);
    expect(panel.querySelector('.rob-legend')).not.toBeNull();
  });

  it('senza meta: i Pokémon del tier, nessun segno Sciarpa o Booster', async () => {
    const user = userEvent.setup();
    view(team, noMeta(), { ...fixtureData, ignoreMeta: true });
    await user.click(screen.getByRole('tab', { name: /^Chi supera/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent(/tier/);
    expect(document.querySelectorAll('.sp-mark')).toHaveLength(0);
  });

  it('una specie sconosciuta: riga con "—", senza errori', async () => {
    const user = userEvent.setup();
    const odd = [...team, emptySet('Nessuno')];
    view(odd, withMeta(odd));
    expect(document.querySelectorAll('.def-members tbody tr')).toHaveLength(5);
    await user.click(screen.getByRole('tab', { name: /^Chi supera/ }));
    const rows = within(screen.getByRole('tabpanel')).getAllByRole('row');
    expect(rows.some(r => within(r).queryByText('Nessuno') && r.textContent!.includes('—'))).toBe(true);
  });

  it('Controllo velocità: chi porta la mossa, quanti aiuta e quanti punti; senza controllo il testo', async () => {
    const user = userEvent.setup();
    const { unmount } = view();
    await user.click(screen.getByRole('tab', { name: /^Controllo velocità/ }));
    const table = within(screen.getByRole('tabpanel')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Mossa', 'Aiuta', 'Punti']);
    const web = within(table).getAllByRole('row').find(r => r.textContent!.includes('Sticky Web'))!;
    expect(web).toHaveTextContent('Ribombee');
    expect(web).toHaveTextContent(/\+\d+/);
    unmount();
    view(noControl, withMeta(noControl));
    await user.click(screen.getByRole('tab', { name: /^Controllo velocità/ }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('nessun controllo della velocità');
  });

  it('in inglese', () => {
    render(<LangProvider lang="en"><AreaView rating={rateTeam(team, fixtureData, 'en')!} area="speed" team={team} analysis={analyzeTeam(team, fixtureData)} problems={[]} /></LangProvider>);
    expect(names()).toEqual(['General', 'Who outspeeds', 'Speed control']);
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Pokémon', 'Speed', 'Raw', 'Own', 'With the team']);
  });
});
