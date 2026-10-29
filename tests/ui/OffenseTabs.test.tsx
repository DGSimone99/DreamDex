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
