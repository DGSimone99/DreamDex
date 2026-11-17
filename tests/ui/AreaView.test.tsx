import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { rateTeam } from '../../src/engine/rating';
import { emptySet } from '../../src/engine/sets';
import { AreaGuide } from '../../src/ui/AreaGuide';
import { AreaView } from '../../src/ui/AreaView';
import { problemsOf } from '../../src/ui/AnalysisPanel';
import type { CoachProblem } from '../../src/engine/coach';
import type { CoachStep } from '../../src/engine/coachSteps';
import { fixtureData } from '../fixtures/data';
import { renderIt } from '../helpers/italian';

const team = [
  { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Rapid Spin'], evs: { atk: 252, spe: 252 } },
  { ...emptySet('Gholdengo'), ability: 'Good as Gold', moves: ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], evs: { spa: 252, spe: 252 } },
];
const analysis = analyzeTeam(team, fixtureData);
const withMeta = () => rateTeam(team, fixtureData, 'it')!;
const noMeta = () => rateTeam(team, { ...fixtureData, ignoreMeta: true }, 'it')!;
const tabs = () => screen.getAllByRole('tab').map(tab => tab.textContent!.trim());

describe('vista di un\'area sulla pagina', () => {
  it('Difesa: sottostatistiche calcolate, Generale aperta di default', () => {
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[]} />);
    expect(tabs()).toEqual(expect.arrayContaining(['Recupero', 'Coverage tipi', 'Coverage meta']));
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

  it("una testata sola sopra il pannello: voto dell'area, problemi e sottoschede (solo i nomi, il valore nella descrizione)", () => {
    const rating = withMeta();
    const { container } = renderIt(<AreaView rating={rating} area="defense" team={team} analysis={analysis} problems={[{ severity: 'serious', category: 'defense', text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' }]} />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
    const line = screen.getByRole('list', { name: 'Problemi in Difesa' });
    expect(within(line).getByText('Debole a Fuoco').closest('.area-chip')).toHaveClass('serious');
    expect(within(screen.getByRole('tabpanel')).queryByText('Debole a Fuoco')).toBeNull();
    // Ordine: la testata, subito il pannello; niente striscia in fondo
    const order = [...container.querySelector('.area-view')!.children].map(el => el.className.split(' ')[0]).filter(c => c.startsWith('area-'));
    expect(order).toEqual(['area-head', 'area-panel']);
    // Il voto dell'area come lettera e parola
    const value = rating.areas.find(a => a.key === 'defense')!.value!;
    const letter = value >= 90 ? 'S' : value >= 80 ? 'A' : value >= 70 ? 'B' : value >= 60 ? 'C' : 'D';
    const grade = container.querySelector('.area-grade')!;
    expect(grade).toHaveClass(`grade-${letter}`);
    expect(grade).toHaveTextContent(new RegExp(`^${letter} (Eccellente|Ottimo|Buono|Discreto|Debole)$`));
    // Sul selettore solo il nome; il valore lo sente lo screen reader
    const general = screen.getByRole('tab', { name: 'Generale' });
    expect(general).toHaveTextContent(/^Generale$/);
    expect(general).toHaveAccessibleDescription(String(value));
  });

  it("la testata c'è in ogni area; Ruoli e Bonus senza voto, Velocità senza selettore", () => {
    for (const area of ['defense', 'strength', 'speed', 'bonusMalus'] as const) {
      const { container, unmount } = renderIt(<AreaView rating={withMeta()} area={area} team={team} analysis={analysis} problems={[]} />);
      expect(container.querySelectorAll('.area-head')).toHaveLength(1);
      if (area === 'bonusMalus') expect(container.querySelector('.area-grade')).toBeNull();
      else expect(container.querySelector('.area-grade')).not.toBeNull();
      if (area === 'speed') {
        // Una sottoscheda sola: niente selettore, il pannello porta il nome dell'area
        expect(screen.queryByRole('tablist')).toBeNull();
        expect(screen.getByRole('tabpanel', { name: 'Velocità' })).toBeInTheDocument();
      } else expect(screen.getByRole('tablist')).toBeInTheDocument();
      unmount();
    }
  });

  it('con una proposta del Coaching la pillola è un pulsante che apre il Coaching su quel problema (clic e tastiera)', async () => {
    const user = userEvent.setup();
    const onCoaching = vi.fn();
    const fire = { severity: 'minor' as const, category: 'defense' as const, text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' };
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} onCoaching={onCoaching}
      problems={[fire]} steps={[{ problem: fire, swap: null, move: null, group: [], alsoSolves: [] } as unknown as CoachStep]} />);
    const chip = screen.getByRole('button', { name: 'Debole a Fuoco' });
    expect(chip).toHaveAccessibleDescription('Debole a Fuoco · Coperto dalla tappa 1 · Vai al Coaching');
    await user.click(chip);
    expect(onCoaching).toHaveBeenLastCalledWith('defense:Fire');
    chip.focus();
    await user.keyboard('{Enter}');
    expect(onCoaching).toHaveBeenCalledTimes(2);
    await user.keyboard(' ');
    expect(onCoaching).toHaveBeenCalledTimes(3);
  });

  it('col fuoco una pillola mostra il problema intero nel tooltip DreamDex, e la tappa che lo copre', async () => {
    const user = userEvent.setup();
    const fire = { severity: 'serious' as const, category: 'defense' as const, text: 'Nessuno regge Fuoco', fixes: [], key: 'defense:Fire', subjects: ['Fire'], counts: { held: 0 } };
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} onCoaching={() => {}}
      problems={[fire]} steps={[{ problem: fire, swap: null, move: null, group: [], alsoSolves: [] } as unknown as CoachStep]} />);
    const chip = screen.getByRole('button', { name: /Nessuno regge Fuoco/ });
    for (let i = 0; i < 20 && document.activeElement !== chip; i++) await user.tab();
    expect(chip).toHaveFocus();
    await waitFor(() => expect(document.querySelector('.ftip.area-chip-tip')).toHaveTextContent('Nessuno regge FuocoCoperto dalla tappa 1'));
    // Niente percentuali nel tooltip
    expect(document.querySelector('.ftip.area-chip-tip')!.textContent).not.toMatch(/%/);
  });

  it('problemi che nessuna proposta del Coaching risolve, o tappe ancora da calcolare: la pillola mostra solo il tooltip', async () => {
    const user = userEvent.setup();
    const onCoaching = vi.fn();
    const fire = { severity: 'serious' as const, category: 'defense' as const, text: 'Debole a Fuoco', fixes: [], key: 'defense:Fire' };
    const other = { ...fire, key: 'defense:Water', text: 'Debole a Acqua' };
    for (const steps of [[], [{ problem: other, swap: null, move: null, group: [], alsoSolves: [] } as unknown as CoachStep], null]) {
      const { unmount } = renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} onCoaching={onCoaching} problems={[fire]} steps={steps} />);
      const list = screen.getByRole('list', { name: 'Problemi in Difesa' });
      const chip = within(list).getByText('Debole a Fuoco').closest<HTMLElement>('.area-chip')!;
      expect(chip).not.toHaveClass('is-link');
      expect(chip).toHaveAttribute('tabindex', '0');
      expect(within(list).queryByRole('button')).toBeNull();
      await user.click(chip);
      expect(onCoaching).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('senza problemi una pillola verde "Nessun problema" (anche in Velocità), ferma', async () => {
    const user = userEvent.setup();
    const onCoaching = vi.fn();
    for (const area of ['defense', 'speed'] as const) {
      const { unmount } = renderIt(<AreaView rating={withMeta()} area={area} team={team} analysis={analysis} problems={[]} onCoaching={onCoaching} />);
      const list = screen.getByRole('list', { name: /^Problemi in / });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      const chip = within(list).getByText('Nessun problema');
      expect(chip).toHaveClass('area-chip', 'good');
      expect(within(list).queryByRole('button')).toBeNull();
      await user.click(chip);
      expect(onCoaching).not.toHaveBeenCalled();
      // Una sottoscheda sola: il "?" porta il nome dell'area
      if (area === 'speed') expect(screen.getByRole('button', { name: 'Come funziona Velocità' })).toBeInTheDocument();
      unmount();
    }
  });

  it('i problemi stanno in una riga: prima i risolvibili, poi i gravi; quelli che non stanno nel "+N" (tooltip col fuoco e testo nascosto)', async () => {
    // Misura finta: la lista è larga 300px, ogni voce (anche il "+N") 100px
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) { return this.classList.contains('area-chips') ? 300 : 0; });
    const scroll = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) { return this.classList.contains('area-chips') ? 100 * this.children.length : 0; });
    try {
      const p = (key: string, severity: 'serious' | 'minor', fixes: string[] = []) => ({ severity, category: 'redundancy' as const, text: `Problema ${key}`, fixes, key });
      renderIt(<AreaView rating={withMeta()} area="bonusMalus" team={team} analysis={analysis}
        problems={[p('a', 'minor'), p('b', 'serious'), p('c', 'minor', ['Kyurem']), p('d', 'minor'), p('e', 'serious')]} />);
      const list = screen.getByRole('list', { name: /Problemi/ });
      const items = within(list).getAllByRole('listitem');
      expect(items.map(li => li.textContent)).toEqual(['Problema c', 'Problema b', expect.stringMatching(/^\+3/)]);
      const more = items[2];
      // Niente title del browser: il "+N" si raggiunge col Tab e col fuoco il tooltip DreamDex li elenca
      expect(more).not.toHaveAttribute('title');
      expect(more).toHaveAttribute('tabindex', '0');
      const user = userEvent.setup();
      for (let i = 0; i < 20 && document.activeElement !== more; i++) await user.tab();
      expect(more).toHaveFocus();
      await waitFor(() => expect(document.querySelector('.ftip.kot:not(.area-chip-tip)')).toHaveTextContent('Problema eProblema aProblema d'));
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

describe('problemi delle aree', () => {
  it('le stesse colonne della mappa del Coaching: le minacce del meta in Difesa e Offesa, le condizioni in Ruoli e Bonus, niente debolezze in comune né regole', () => {
    const p = (category: CoachProblem['category'], key: string): CoachProblem => ({ severity: 'minor', category, text: key, fixes: [], key });
    const all = [p('defense', 'defense:Fire'), p('meta', 'meta:Zapdos'), p('coverage', 'coverage:Fairy'), p('metaHit', 'metaHit:Toxapex'),
      p('roles', 'roles:important'), p('conditions', 'conditions:pivot'), p('redundancy', 'redundancy:hazards'), p('redundancy', 'redundancy:sharedWeak:Ice'), p('rules', 'rules:ban')];
    const keys = (area: Parameters<typeof problemsOf>[1]) => problemsOf(all, area).map(x => x.key);
    expect(keys('defense')).toEqual(['defense:Fire', 'meta:Zapdos']);
    expect(keys('strength')).toEqual(['coverage:Fairy', 'metaHit:Toxapex']);
    expect(keys('bonusMalus')).toEqual(['roles:important', 'conditions:pivot', 'redundancy:hazards']);
    expect(keys('speed')).toEqual([]);
  });

  it('una minaccia del meta nella testata della Difesa: icona e nome del Pokémon, il testo intero nel tooltip', async () => {
    const user = userEvent.setup();
    const threat: CoachProblem = { severity: 'minor', category: 'meta', text: 'Scoperto in difesa contro Zapdos: nessuno regge bene i suoi colpi', fixes: [], key: 'meta:Zapdos', subjects: ['Zapdos'] };
    renderIt(<AreaView rating={withMeta()} area="defense" team={team} analysis={analysis} problems={[threat]} />);
    const list = screen.getByRole('list', { name: 'Problemi in Difesa' });
    const chip = list.querySelector<HTMLElement>('.area-chip')!;
    expect(chip.querySelector('.coach-threat-name')).toHaveTextContent('Zapdos');
    for (let i = 0; i < 20 && document.activeElement !== chip; i++) await user.tab();
    await waitFor(() => expect(document.querySelector('.ftip.area-chip-tip')).toHaveTextContent(threat.text));
  });
});

describe('vista di un\'area: casi particolari', () => {
  it('un\'area che non conta lo dice nel titolo (Velocità nello stall)', () => {
    const rating = { ...withMeta(), areas: withMeta().areas.map(a => (a.key === 'speed' ? { ...a, inactive: true } : a)) };
    renderIt(<AreaView rating={rating} area="speed" team={team} analysis={analysis} problems={[]} />);
    expect(screen.getByRole('note')).toHaveTextContent(/Non conta nello Stall/);
    // Il titolo dell'area c'è solo per i lettori di schermo (a vista lo dice la scheda aperta)
    expect(screen.getByRole('heading', { level: 3, name: 'Velocità' })).toHaveClass('visually-hidden');
  });
});
