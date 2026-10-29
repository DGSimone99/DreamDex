import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaGuide } from '../../src/ui/AreaGuide';
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
const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent!.replace(/\s*[\d.,%n/d–]+$/, '').trim());

describe('vista di un\'area sulla pagina', () => {
  it('Difesa: sottostatistiche calcolate, Generale aperta di default', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(tabs()).toEqual(expect.arrayContaining(['Robustezza', 'Sostenibilità', 'Coverage tipi', 'Coverage meta']));
    expect(screen.getByRole('tab', { name: /^Generale/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('senza meta niente Coverage meta', () => {
    renderIt(<AreaView rating={noMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(screen.queryByRole('tab', { name: /^Coverage meta/ })).toBeNull();
  });

  it('nessuna finestra', () => {
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('Bonus/Malus mostra il catalogo con le voci attive', () => {
    renderIt(<AreaView rating={withMeta()} area="bonusMalus" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getAllByRole('tab').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('tabpanel').textContent!.length).toBeGreaterThan(0);
  });

  it('sottoschede in orizzontale; i problemi in una riga sotto la striscia, fuori dal pannello', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[{ severity: 'serious', category: 'defense', text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' }]} />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    const line = screen.getByRole('list', { name: /Problemi/ });
    expect(within(line).getByText('Debole a Fuoco').closest('li')).toHaveClass('serious');
    expect(within(screen.getByRole('tabpanel')).queryByText('Debole a Fuoco')).toBeNull();
  });

  it('frecce destra/sinistra con giro, Home e End', async () => {
    const user = userEvent.setup();
    renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis} problems={[]} />);
    const all = screen.getAllByRole('tab');
    await user.click(all[0]);
    all[0].focus();
    await user.keyboard('{ArrowLeft}');
    expect(all.at(-1)).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(all[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(all.at(-1)).toHaveFocus();
  });

  it('aree senza guida: nessun "?" nelle sottoschede', () => {
    renderIt(<AreaView rating={withMeta()} area="speed" team={team} analysis={analysis} problems={[]} />);
    expect(screen.queryByRole('button', { name: /^Come funziona/ })).toBeNull();
  });

  it('AreaGuide: si apre sulla sezione scelta, Esc chiude', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderIt(<AreaGuide title="Guida" current="b" onCurrent={() => {}} onClose={onClose}
      sections={[{ key: 'a', label: 'A', content: 'testo A' }, { key: 'b', label: 'B', content: 'testo B' }]} />);
    expect(screen.getByRole('dialog', { name: 'Guida' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'B' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('testo B');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('vista di un\'area: casi particolari', () => {
  it('un\'area che non conta lo dice nel titolo (Velocità nello stall)', () => {
    const rating = { ...withMeta(), areas: withMeta().areas.map(a => (a.key === 'speed' ? { ...a, inactive: true } : a)) };
    renderIt(<AreaView rating={rating} area="speed" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('note')).toHaveTextContent(/Non conta nello Stall/);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
