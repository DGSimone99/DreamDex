import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaView } from '../../src/ui/AreaView';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const analysis = analyzeTeam(team, fixtureData);
const view = (area: 'strength' | 'defense' | 'speed' = 'strength') => renderIt(<AreaView rating={rateTeam(team, fixtureData, 'it')!} area={area} team={team} analysis={analysis} problems={[]} />);

// Telefono e tablet piccolo (fino a 767 px): niente da scorrere di lato
describe('Offesa sullo schermo stretto', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: ['(max-width: 767px)', '(max-width: 599px)', '(max-width: 1099px)'].includes(query), media: query, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Generale a carte: in cima la riga del team, poi una carta per membro (+N, nome, barre Tipi e Meta); la carta apre il foglio', async () => {
    const user = userEvent.setup();
    view();
    const hero = screen.getByRole('region', { name: 'Team Coverage' });
    expect([...hero.querySelectorAll('.og-card-label')].map(x => x.textContent)).toEqual(['Tipi', 'Meta']);
    const cards = document.querySelectorAll('.og-cards > .og-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.og-card-name')).toHaveTextContent('Great Tusk');
    expect(cards[0].querySelector('.og-share-num')).toHaveTextContent(/^\+\d+$/);
    expect([...cards[0].querySelectorAll('.og-card-label')].map(x => x.textContent)).toEqual(['Tipi', 'Meta']);
    // La parte alta della carta apre il foglio col dettaglio: le barre e le mosse; Esc lo chiude
    await user.click(screen.getByRole('button', { name: 'Dettagli di Great Tusk' }));
    const sheet = screen.getByRole('dialog', { name: 'Great Tusk' });
    expect(sheet).toHaveTextContent(/Porta \+\d+ all'Offesa del team/);
    expect([...sheet.querySelectorAll('h4')].map(h => h.textContent)).toEqual(['Coverage tipi', 'Coverage meta']);
    expect(sheet.querySelectorAll('.mcs').length).toBe(2);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Great Tusk' })).toBeNull();
  });

  it('Coverage tipi a tessere: 18 tipi con la coverage del team; una tessera apre il foglio coi membri', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    const list = screen.getByRole('list', { name: 'Coverage tipi' });
    expect(list.querySelectorAll('.ct-tile')).toHaveLength(18);
    expect(screen.getByRole('region', { name: 'Team Coverage' })).toHaveTextContent(/\/18 tipi coperti · \d+ con un OHKO/);
    await user.click(within(list).getByRole('button', { name: /^(Fuoco|Fire): Team Coverage \d+%/ }));
    const sheet = screen.getByRole('dialog', { name: /^(Fuoco|Fire)$/ });
    expect([...sheet.querySelectorAll('.ct-sheet-name')].map(x => x.textContent)).toEqual(['Great Tusk', 'Gholdengo']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Coverage meta a carte: le minacce con la barra dei membri, "Altre N" ne aggiunge; una carta apre il foglio', async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const list = screen.getByRole('list', { name: 'Coverage meta' });
    const cards = list.querySelectorAll('.cm-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(12);
    expect(cards[0].querySelector('.og-card-tag')).toHaveTextContent(/^#\d+$/);
    expect(screen.getByRole('region', { name: 'Team Coverage' })).toHaveTextContent(/minacce coperte/);
    const more = screen.queryByRole('button', { name: /^Altre \d+ minacce/ });
    if (more) { await user.click(more); expect(list.querySelectorAll('.cm-card').length).toBeGreaterThan(12); }
    const name = cards[0].querySelector('.og-card-name')!.textContent!;
    await user.click(within(list).getByRole('button', { name: `Dettagli di ${name}` }));
    const sheet = screen.getByRole('dialog', { name });
    expect(sheet.querySelectorAll('.cm-sheet-row')).toHaveLength(2);
  });

  it('Difesa a carte come in Offesa: Generale, tessere dei tipi, carte delle minacce col foglio; Recupero una riga per voce', async () => {
    const user = userEvent.setup();
    view('defense');
    expect(screen.getByRole('region', { name: 'Team Coverage' })).toBeInTheDocument();
    const cards = document.querySelectorAll('.og-cards > .og-card');
    expect(cards).toHaveLength(2);
    expect([...cards[0].querySelectorAll('.og-card-label')].map(x => x.textContent)).toEqual(['Tipi', 'Meta']);
    await user.click(screen.getByRole('button', { name: 'Dettagli di Great Tusk' }));
    expect(screen.getByRole('dialog', { name: 'Great Tusk' })).toHaveTextContent(/Difesa del team/);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('tab', { name: /^Coverage tipi/ }));
    expect(screen.getByRole('list', { name: 'Coverage tipi' }).querySelectorAll('.ct-tile')).toHaveLength(18);
    expect(screen.getByRole('region', { name: 'Team Coverage' })).toHaveTextContent(/tipi retti dal team/);
    await user.click(screen.getByRole('tab', { name: /^Coverage meta/ }));
    const list = screen.getByRole('list', { name: 'Coverage meta' });
    expect(list.querySelectorAll('.cm-card').length).toBeGreaterThan(0);
    const name = list.querySelector('.og-card-name')!.textContent!;
    await user.click(within(list).getByRole('button', { name: `Dettagli di ${name}` }));
    expect(screen.getByRole('dialog', { name }).querySelectorAll('.cm-sheet-row')).toHaveLength(2);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('tab', { name: /^Recupero/ }));
    const sus = screen.getByRole('table', { name: 'Difesa: Recupero' });
    expect(sus).toHaveClass('sus-stack');
    expect([...sus.querySelectorAll('tbody.og-stack-mon')[0].querySelectorAll('.og-bar-label')].map(th => th.textContent)).toEqual(['Perde', 'Recupera', 'Netto']);
  });

  it('Velocità a carte: la riga del team con la legenda a parole, una carta per membro (Vel, % del meta superato) che apre i rivali; Distortozona spenta se nessuno la usa', async () => {
    const user = userEvent.setup();
    view('speed');
    const hero = screen.getByRole('region', { name: 'Velocità del team' });
    expect(hero).toHaveTextContent('Base');
    const cards = document.querySelectorAll('.og-cards > .sp-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.sp-card-tag')).toHaveTextContent(/^Vel \d+/);
    expect(cards[0].querySelector('.sp-big')).toHaveTextContent(/\d+%del meta superato/);
    expect(screen.getByRole('switch', { name: /Distortozona/ })).toBeDisabled();
    await user.click(cards[0].querySelector('button.og-card-open') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
