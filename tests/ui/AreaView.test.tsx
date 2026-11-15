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
    expect(tabs()).toEqual(expect.arrayContaining(['Sostenibilità', 'Coverage tipi', 'Coverage meta']));
    expect(tabs()).not.toContain('Robustezza');
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

  it('Bonus/Malus: una scheda sola col netto sul voto, dentro il netto con le voci del team e i core a tre', () => {
    renderIt(<AreaView rating={withMeta()} area="bonusMalus" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getAllByRole('tab')[0].querySelector('span')!.textContent).toBe('Bonus/Malus');
    expect(screen.getByRole('region', { name: 'Sul voto' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Core' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tutte le voci possibili/ })).toBeInTheDocument();
  });

  it('sottoschede in orizzontale; i problemi in una striscia sotto il pannello, fuori da lui', () => {
    const { container } = renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[{ severity: 'serious', category: 'defense', text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' }]} />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    const line = screen.getByRole('list', { name: /Problemi/ });
    expect(within(line).getByText('Debole a Fuoco').closest('li')).toHaveClass('serious');
    expect(within(screen.getByRole('tabpanel')).queryByText('Debole a Fuoco')).toBeNull();
    // Ordine: striscia delle sottoschede, riga degli strumenti, pannello, problemi
    const order = [...container.querySelector('.area-view')!.children].map(el => el.className.split(' ')[0]).filter(c => c.startsWith('area-'));
    expect(order).toEqual(['area-strip', 'area-tools-row', 'area-panel', 'area-problems-row']);
    expect(line.closest('.area-problems-row')).toHaveClass('serious');
  });

  it('la riga degli strumenti e la striscia dei problemi ci sono in ogni area, anche in Ruoli e Bonus', () => {
    for (const area of ['defense', 'strength', 'speed', 'bonusMalus'] as const) {
      const { container, unmount } = renderIt(<AreaView rating={withMeta()} area={area} team={team} analysis={analysis} problems={[]} />);
      expect(container.querySelectorAll('.area-tools-row')).toHaveLength(1);
      expect(container.querySelectorAll('.area-problems-row')).toHaveLength(1);
      unmount();
    }
  });

  it('tutta la striscia dei problemi porta al Coaching; il pulsante dice cosa contiene', async () => {
    const user = userEvent.setup();
    const onCoaching = vi.fn();
    const { container } = renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} onCoaching={onCoaching}
      problems={[{ severity: 'minor', category: 'defense', text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' }]} />);
    const go = screen.getByRole('button', { name: 'Vai al Coaching: 1 problema in Difesa' });
    await user.click(go);
    expect(onCoaching).toHaveBeenCalledTimes(1);
    // Anche un clic sul testo del problema
    await user.click(screen.getByText('Debole a Fuoco'));
    expect(onCoaching).toHaveBeenCalledTimes(2);
    // Da tastiera
    go.focus();
    await user.keyboard('{Enter}');
    expect(onCoaching).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.area-problems-row')).toHaveClass('is-link');
  });

  it('senza problemi la striscia resta, ferma, con "Nessun problema in quest’area" (anche in Velocità): niente link al Coaching', async () => {
    const user = userEvent.setup();
    const onCoaching = vi.fn();
    for (const area of ['defense', 'speed'] as const) {
      const { container, unmount } = renderIt(<AreaView rating={withMeta()} area={area} team={team} analysis={analysis} problems={[]} onCoaching={onCoaching} />);
      const row = container.querySelector<HTMLElement>('.area-problems-row')!;
      expect(row).toHaveClass('is-clear');
      expect(row).not.toHaveClass('is-link');
      expect(screen.getByRole('note', { name: /^Problemi in / })).toHaveTextContent("Nessun problema in quest'area");
      expect(screen.queryByRole('list', { name: /Problemi/ })).toBeNull();
      expect(within(row).queryByRole('button')).toBeNull();
      await user.click(within(row).getByText("Nessun problema in quest'area"));
      expect(onCoaching).not.toHaveBeenCalled();
      // Una sottoscheda sola: il "?" porta il nome dell'area
      if (area === 'speed') expect(screen.getByRole('button', { name: 'Come funziona Velocità' })).toBeInTheDocument();
      unmount();
    }
  });

  it('i problemi stanno in una riga: prima i risolvibili, poi i gravi; quelli che non stanno nel "+N" (title e testo nascosto)', () => {
    // Misura finta: la lista è larga 300px, ogni voce (anche il "+N") 100px
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return this.classList.contains('area-problems') ? 300 : 0; });
    const scroll = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) { return this.classList.contains('area-problems') ? 100 * this.children.length : 0; });
    try {
      const p = (key: string, severity: 'serious' | 'minor', fixes: string[] = []) => ({ severity, category: 'coverage' as const, text: `Problema ${key}`, fixes, key });
      renderIt(<AreaView rating={withMeta()} area="strength" team={team} analysis={analysis}
        problems={[p('a', 'minor'), p('b', 'serious'), p('c', 'minor', ['Kyurem']), p('d', 'minor'), p('e', 'serious')]} />);
      const list = screen.getByRole('list', { name: /Problemi/ });
      const items = within(list).getAllByRole('listitem');
      expect(items.map(li => li.textContent)).toEqual(['Problema c', 'Problema b', expect.stringMatching(/^\+3/)]);
      const more = items[2];
      expect(more).toHaveAttribute('title', 'Problema e\nProblema a\nProblema d');
      expect(more.querySelector('.visually-hidden')).toHaveTextContent('Altri 3 problemi: Problema e; Problema a; Problema d');
    } finally {
      width.mockRestore();
      scroll.mockRestore();
    }
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

  it('Bonus/Malus → Ruoli e la Velocità hanno il "?"', () => {
    const { unmount } = renderIt(<AreaView rating={withMeta()} area="bonusMalus" picked="roles" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('button', { name: 'Come funziona Ruoli' })).toBeInTheDocument();
    unmount();
    renderIt(<AreaView rating={withMeta()} area="speed" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('button', { name: /^Come funziona/ })).toBeInTheDocument();
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
    expect(screen.getByRole('note', { name: '' })).toHaveTextContent(/Non conta nello Stall/);
    // Il titolo dell'area c'è solo per i lettori di schermo (a vista lo dice la scheda aperta)
    expect(screen.getByRole('heading', { level: 3, name: 'Velocità' })).toHaveClass('visually-hidden');
  });
});
