import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
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
