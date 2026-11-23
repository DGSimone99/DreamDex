import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { coachTeam, type CoachAdvice, type Coaching, type CoachProblem } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { neutralAsAlternatives, proposalGroups } from '../../src/engine/coachProposals';
import type { MoveFix } from '../../src/engine/moveFixes';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { needLabel } from '../../src/engine/needs';
import { rateTeam } from '../../src/engine/rating';
import { areaSnapshot, type AreaSnapshot } from '../../src/engine/teamGain';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { gameName } from '../../src/i18n/game';
import { CoachingView, gainText } from '../../src/ui/CoachingView';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { adviceOf } from '../helpers/coach';
import { renderIt } from '../helpers/italian';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

// Due membri deboli lasciano spazio ai sostituti delle statistiche di prova (come nei test del motore)
const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });
const six = [...['Great Tusk', 'Gholdengo', 'Toxapex', 'Corviknight'].map(n => mostCommonSet(fixtureStats, n)!), junk('Magikarp'), junk('Sunkern')];
// Un Balance completo senza controllo hazard: il coach propone Rapid Spin o Defog (per i test delle proposte di mossa)
const mk = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet => ({ ...emptySet(species), item, ability, moves, nature, evs });
const fixable = [...['Gholdengo', 'Toxapex'].map(n => mostCommonSet(fixtureStats, n)!),
  mk('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Ice Spinner', 'Knock Off'], 'Jolly', { atk: 252, spe: 252 }),
  mk('Corviknight', 'Leftovers', 'Pressure', ['Roost', 'Brave Bird', 'U-turn', 'Iron Defense'], 'Impish', { hp: 248, def: 168, spd: 92 }),
  mk('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant', { atk: 252, spe: 252 }),
  mk('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Adamant', { hp: 200, atk: 252, spe: 56 })];
// Per i test delle aggiunte: con questo trio il Coaching propone anche aggiunte (un posto libero)
const trio = ['Gholdengo', 'Toxapex', 'Kingambit'].map(n => mostCommonSet(fixtureStats, n)!);
const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };

const analysis = () => screen.getByRole('region', { name: 'Analisi' });
const suggestions = () => screen.getAllByRole('region', { name: 'Suggerimenti' }).find(r => !analysis().contains(r))!;
const proposals = () => screen.getByRole('region', { name: 'Proposte, dalla più utile' });

/** La carta grande (la proposta scelta). */
const heroOf = () => within(proposals()).getByRole('article');
/** Il nome della proposta nella carta grande ("X al posto di Y, voto +N"). */
const heroName = () => heroOf().querySelector('h4')!.textContent!;
/** La colonna di sinistra: la classifica delle proposte. */
const rail = () => screen.getByRole('complementary', { name: /^Proposte/ });
/** Le testate della classifica (una per proposta, pagina corrente): un clic la apre nella carta. */
const cures = () => [...rail().querySelectorAll<HTMLButtonElement>('.coach-diag-cure')];
/** I nomi delle proposte nella classifica ("Apri nella carta: " tolto). */
const cureNames = () => cures().map(b => b.getAttribute('aria-label')!.replace(/^Apri nella carta: /, ''));
/** Il pulsante della carta grande che mette un'alternativa nella carta. */
const altTiles = () => [...heroOf().querySelectorAll<HTMLButtonElement>('.coach-alt-tile')];
const altNames = () => altTiles().map(b => b.getAttribute('aria-label')!.replace(/^Metti nella carta: /, ''));

/** Importa il team, apre Analisi e la scheda Coaching (e aspetta la carta grande). */
async function openCoaching(team: TeamSet[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste(exportShowdown(team));
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
  await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
  await within(proposals()).findByRole('article', {}, { timeout: 5000 });
  return user;
}

/**
 * Porta nella carta grande la prima proposta il cui nome rispetta `pattern`: la carta stessa, le sue alternative, poi le
 * testate della classifica (un clic la apre); in ultimo le alternative di ogni proposta. Torna la carta grande.
 */
async function findRow(user: ReturnType<typeof userEvent.setup>, pattern: RegExp): Promise<HTMLElement> {
  const inHero = async () => {
    if (pattern.test(heroName())) return true;
    const tile = altTiles().find((_, i) => pattern.test(altNames()[i]));
    if (tile) { await user.click(tile); return true; }
    return false;
  };
  if (await inHero()) return heroOf();
  const at = cureNames().findIndex(n => pattern.test(n));
  if (at >= 0) { await user.click(cures()[at]); return heroOf(); }
  // Fra le alternative delle altre proposte: si aprono una per una
  for (let i = 0; i < cures().length; i++) {
    await user.click(cures()[i]);
    if (await inHero()) return heroOf();
  }
  throw new Error(`nessuna proposta ${pattern}`);
}

const SWAP = /^(.+) al posto di (.+), voto \+(\d+)$/;
const ADD = /^(.+) in un posto libero, voto \+(\d+)$/;
const MOVE = /^(.+?) (?:al posto di .+?|in uno slot libero) su (.+), voto (\+\d+|±0)$/;
/** Il voto in più scritto in un nome ("voto +3" → 3, "voto ±0" → 0, "voto −2" → -2). */
const gainOf = (name: string) => Number(/voto ([+−±]\d+)$/.exec(name)![1].replace('−', '-').replace('±', ''));

/** Il "+N" della riga del candidato nella lista di Sostituisci. */
const rowGain = (species: string) => {
  const row = [...suggestions().querySelectorAll<HTMLElement>('.suggestions li')]
    .find(li => li.querySelector('.name-line strong')?.textContent?.replace(/^\d+\. /, '') === species)!;
  expect(row).toBeTruthy();
  return /\(([^)]+)\)$/.exec(within(row).getByLabelText(/^Voto del team: /).getAttribute('aria-label')!)![1];
};

describe('scheda Coaching', () => {
  it('dalla più utile: la carta grande ha il +N più alto, la classifica a sinistra non sale e parte da lei', async () => {
    await openCoaching(six);
    const top = gainOf(heroName());
    const names = cureNames();
    expect(names.length).toBeGreaterThan(1);
    expect(names[0]).toBe(heroName());
    const gains = names.map(gainOf);
    expect(gains.every(g => g <= top)).toBe(true);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
    // Niente più mappa dei problemi né tappe numerate né lista sotto la carta
    expect(within(analysis()).queryByText('Problemi per area')).toBeNull();
    expect(analysis().querySelector('.coach-step-num, .coach-map, .coach-list, .coach-item')).toBeNull();
  });

  it('"Vedi nella scheda Pokémon": scheda Pokémon, quel membro da sostituire, il candidato aperto, stesso +N', async () => {
    const user = await openCoaching(six);
    const hero = await findRow(user, SWAP);
    const [, species, member, gain] = SWAP.exec(heroName())!;
    await user.click(within(hero).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveTextContent(`Sostituisci ${member}`);
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('una ricerca rimasta nella scheda Pokémon non nasconde il candidato: impostazioni predefinite, stesso +N', async () => {
    const user = await openCoaching(six);
    await user.click(screen.getByRole('tab', { name: /^Pokémon/ }));
    const search = within(suggestions()).getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'Zap');
    // Anche un tipo di team scelto a mano torna quello riconosciuto
    const type = () => within(suggestions()).getByRole('button', { name: /^Tipo di team:/ });
    const recognised = type().getAttribute('aria-label');
    await user.click(type());
    await user.click(within(screen.getByRole('listbox', { name: 'Tipo di team' })).getByRole('option', { name: recognised === 'Tipo di team: Stall' ? /^Hyper Offense/ : /^Stall/ }));
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    const hero = await findRow(user, SWAP);
    const [, species, , gain] = SWAP.exec(heroName())!;
    await user.click(within(hero).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` }, { timeout: 3000 })).toBeInTheDocument();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toHaveValue('');
    expect(type().getAttribute('aria-label')).toBe(recognised);
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('team di 3: un candidato da aggiungere apre Aggiungi con lui nel dettaglio, stesso +N', async () => {
    const user = await openCoaching(trio);
    const hero = await findRow(user, ADD);
    const [, species, gain] = ADD.exec(heroName())!;
    // Nella carta: "Aggiunta · posto libero" al posto di "Al posto di"
    expect(hero.querySelector('.coach-hero-title .coach-plate')).toHaveTextContent('Aggiuntaposto libero');
    await user.click(within(hero).getByRole('button', { name: `Vedi nella scheda Pokémon: ${species}` }));
    expect(screen.getByRole('tab', { name: /^Pokémon/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(suggestions()).getByRole('button', { name: 'Aggiungi' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: `Dettaglio di ${species}` })).toBeInTheDocument();
    expect(rowGain(species)).toBe(`+${gain}`);
  });

  it('Applica su un sostituto: lo applica subito (stessa scheda), avviso con Annulla che riporta il membro', async () => {
    const user = await openCoaching(six);
    const hero = await findRow(user, SWAP);
    const [, species, member] = SWAP.exec(heroName())!;
    const cards = () => [...document.querySelectorAll('.slot.filled .slot-card')].map(el => el.textContent ?? '');
    expect(cards().some(text => text.includes(member))).toBe(true);
    await user.click(within(hero).getByRole('button', { name: /^Applica: / }));
    // Resta su Analisi; il membro è sostituito
    expect(screen.getByRole('tab', { name: /^Analisi/ })).toHaveAttribute('aria-selected', 'true');
    expect(cards().some(text => text.includes(member))).toBe(false);
    expect(cards().some(text => text.includes(species))).toBe(true);
    const undo = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(undo).toHaveTextContent(member);
    expect(undo).toHaveTextContent(species);
    await user.click(within(undo).getByRole('button', { name: 'Annulla' }));
    expect(cards().some(text => text.includes(member))).toBe(true);
    expect(cards().some(text => text.includes(species))).toBe(false);
  });

  it('team di 3: Applica su un candidato da aggiungere lo aggiunge, Annulla lo toglie', async () => {
    const user = await openCoaching(trio);
    const hero = await findRow(user, ADD);
    const species = ADD.exec(heroName())![1];
    const filled = () => document.querySelectorAll('.slot.filled').length;
    await user.click(within(hero).getByRole('button', { name: /^Applica: / }));
    expect(filled()).toBe(4);
    const undo = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(undo).toHaveTextContent(`${species} aggiunto`);
    await user.click(within(undo).getByRole('button', { name: 'Annulla' }));
    expect(filled()).toBe(3);
  });

  it('invito ad aggiungere con meno di 2 membri', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    // Nella Panoramica: come giudizio e nel "Cosa fare" del cruscotto (Analisi si disegna la prima volta che si apre)
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    expect(within(analysis()).getAllByText('Aggiungi un altro Pokémon per ricevere il coaching').length).toBeGreaterThan(0);
    // Anche nella scheda Coaching, non "il team è a posto"
    await user.click(screen.getByRole('tab', { name: /^Analisi/ }));
    await user.click(within(analysis()).getByRole('tab', { name: /^Coaching/ }));
    expect(within(analysis()).getByText('Aggiungi un altro Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(within(analysis()).queryByText('Il team è a posto')).toBeNull();
  });
});

describe('CoachingView', () => {
  const rating = rateTeam(six, data, 'it')!;
  const before = areaSnapshot(rating);
  const noop = { onFix: () => {}, onMoveFix: () => {}, onApplyFix: () => {}, onApplyMove: () => {} };
  const coachingOf = (problems: CoachProblem[], over: Partial<Coaching> = {}): Coaching => ({ verdict: 'x', teamType: null, strengths: [], threatFixes: {}, problems, ...over });
  const fire: CoachProblem = { severity: 'serious', category: 'defense', text: 'Scoperto in difesa contro Fire: nessuno regge bene i suoi colpi',
    fixes: [], key: 'defense:Fire', subjects: ['Fire'], counts: { held: 0 } };
  const zapdos: CoachProblem = { severity: 'minor', category: 'meta', text: 'Senza check in difesa contro Zapdos', fixes: [], key: 'meta:Zapdos', subjects: ['Zapdos'] };
  const pivot: CoachProblem = { severity: 'minor', category: 'roles', text: 'Ruoli importanti mancanti: Pivot', fixes: [], key: 'roles:important', subjects: ['pivot'] };
  const steel: CoachProblem = { severity: 'minor', category: 'redundancy', text: '3 membri di tipo Acciaio', fixes: [], key: 'redundancy:3 membri di tipo Acciaio' };
  const problems = [fire, zapdos, pivot, steel];
  const pivotName = needLabel('pivot', 'it');
  const swap = (species: string, index: number, gain: number, solves: string[], after?: Partial<AreaSnapshot>): CoachFix => ({
    kind: 'swap', species, set: mostCommonSet(fixtureStats, species) ?? emptySet(species), index, member: six[index].species, gain, solves, reduces: [],
    after: { ...before, ...after },
  });
  const advice = (fixes: CoachFix[], moves: MoveFix[] = []): CoachAdvice => ({ fixes, moves, steps: [] });
  const view = (adv: CoachAdvice | null, over: Partial<Parameters<typeof CoachingView>[0]> = {}) => {
    const handlers = { onFix: vi.fn(), onMoveFix: vi.fn(), onApplyFix: vi.fn(), onApplyMove: vi.fn(), onExport: vi.fn(async () => true), onImproveSets: vi.fn(), onOverview: vi.fn() };
    renderIt(<CoachingView coaching={coachingOf(problems)} advice={adv} members={6} rating={rating} {...handlers} {...over} />);
    return handlers;
  };
  const list = () => screen.getByRole('region', { name: 'Proposte, dalla più utile' });
  const band = () => list().querySelector('.coach-hero-band h4')!;
  const heroTitle = () => heroOf().querySelector('h4')!;
  const live = () => list().querySelector('p[aria-live="polite"]')!;
  const six6 = ['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'];
  /** Il pulsante (o la riga ferma, in "Restano") di un problema nella classifica, dal suo testo. */
  const railItem = (text: string) => [...rail().querySelectorAll<HTMLElement>('.coach-diag-item')].find(b => b.textContent!.includes(text))!;
  /**
   * La classifica come si legge, riga per riga: "cura:Specie" (la testata di una proposta), il problema ("fire", "zapdos",
   * "pivot", "steel", "slow", "dragonite"), "nota:già sopra" / "nota:alza" e "restano" (la testata dei problemi senza cura).
   */
  const order = () => [...rail().querySelectorAll<HTMLLIElement>('ol.coach-diag-list > li')].map(li => {
    const text = li.textContent!;
    if (li.querySelector('.coach-diag-cure')) return `cura:${li.querySelector('.coach-diag-cure-text b')!.textContent}`;
    if (li.classList.contains('is-note')) return text === 'Risolve problemi già scritti sopra' ? 'nota:già sopra' : text === 'Nessun problema: alza solo il voto' ? 'nota:alza' : `nota:${text}`;
    if (li.classList.contains('is-stuck')) return 'restano';
    return text.includes('contro Fire') ? 'fire' : text.includes('contro Zapdos') ? 'zapdos' : text.includes(pivotName) ? 'pivot'
      : text.includes('Acciaio') ? 'steel' : text.includes('lenti') ? 'slow' : text.includes('Dragonite') ? 'dragonite' : `?${text}`;
  });

  it('a pari voto "±0", mai "+0"', () => {
    expect([gainText(3), gainText(0), gainText(-2)]).toEqual(['+3', '±0', '−2']);
  });

  it('la migliore nella carta grande, la classifica a sinistra dalla più utile; nomi "X al posto di Y, voto +N"; quante sono nel titolo', () => {
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    expect(band()).toHaveTextContent('La proposta migliore');
    expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
    expect(within(list()).getByRole('article', { name: 'Zapdos al posto di Sunkern, voto +5' })).toBeInTheDocument();
    expect(heroOf().querySelector('.coach-hero-name')).toHaveTextContent('Zapdos');
    expect(heroOf().querySelector('.coach-plate')).toHaveTextContent('Al posto diSunkern');
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent('+5');
    expect(heroOf().querySelector('.coach-grade-change')).toHaveTextContent(`${rating.grade} ${rating.overall}`);
    expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent('Proposte3');
    expect(cureNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2']);
    // La testata: nome, "al posto di X", +N; quella nella carta ha l'anello (aria-current)
    expect(cures()[0]).toHaveTextContent('Zapdosal posto di Sunkern+5');
    expect(cures()[0]).toHaveAttribute('aria-current', 'true');
    expect(cures()[0]).toHaveClass('is-open');
    expect(cures()[1]).not.toHaveAttribute('aria-current');
    // Niente più lista sotto la carta
    expect(list().querySelector('.coach-list, ol.coach-rows, li.coach-item, .coach-item-btn, .coach-marks')).toBeNull();
    expect(within(list()).queryByText(/^Altre proposte/)).toBeNull();
    // Pochi: nessuna pagina
    expect(within(rail()).queryByRole('navigation')).toBeNull();
  });

  it('un clic su una testata della classifica la porta nella carta grande ("La proposta scelta"); "Torna alla migliore" riporta la prima e il fuoco sul titolo della carta', async () => {
    const user = userEvent.setup();
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Rotom-Wash al posto di Magikarp, voto +2' }));
    expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +2');
    expect(band()).toHaveTextContent('La proposta scelta');
    // La classifica non cambia ordine: cambia solo l'anello
    expect(cureNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2']);
    expect(cures()[2]).toHaveAttribute('aria-current', 'true');
    expect(cures()[0]).not.toHaveAttribute('aria-current');
    await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
    expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    expect(band()).toHaveTextContent('La proposta migliore');
    expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
    await waitFor(() => expect(heroTitle()).toHaveFocus());
    expect(heroTitle()).toHaveAttribute('tabindex', '-1');
  });

  it('il magenta solo su Applica della carta grande, una volta sola (la classifica non ha Applica)', async () => {
    const user = userEvent.setup();
    view(advice(six6.map((s, i) => swap(s, i, 9 - i, [fire.key]))));
    const primary = () => document.querySelectorAll('.coach-apply.is-primary');
    expect(primary()).toHaveLength(1);
    expect(heroOf().contains(primary()[0])).toBe(true);
    expect(document.querySelectorAll('.coach-apply')).toHaveLength(1);
    expect(rail().querySelector('.coach-apply')).toBeNull();
    await user.click(cures()[4]);
    expect(primary()).toHaveLength(1);
    expect(heroOf().contains(primary()[0])).toBe(true);
  });

  it('a pagine quando la colonna è bassa: "‹ 1/3 ›" coi nomi per lo screen reader, un blocco non si spezza, avanti e indietro', async () => {
    // jsdom non misura: una colonna alta 200 e righe da 40 (5 righe per pagina)
    const realStyle = window.getComputedStyle.bind(window);
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => (el.classList.contains('coach-diag-box')
      ? ({ getPropertyValue: (p: string) => (p === '--row-h' ? '40' : '') } as unknown as CSSStyleDeclaration) : realStyle(el, pseudo)));
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('coach-diag-box') ? 200 : 0; } });
    const RO = class { constructor(private cb: ResizeObserverCallback) {} observe() { this.cb([], this as unknown as ResizeObserver); } unobserve() {} disconnect() {} };
    vi.stubGlobal('ResizeObserver', RO);
    try {
      const user = userEvent.setup();
      // Ogni blocco è testata + una riga (il primo: Fuoco; gli altri: "già scritti sopra"): due blocchi per pagina
      view(advice(six6.map((s, i) => swap(s, i, 9 - i, [fire.key]))), { coaching: coachingOf([fire]) });
      const pages = within(rail()).getByRole('navigation', { name: 'Pagine delle proposte' });
      expect(pages).toHaveTextContent('1/3');
      expect(pages).toHaveTextContent('Pagina 1 di 3');
      expect(within(pages).getByRole('button', { name: 'Proposte precedenti' })).toBeDisabled();
      expect(order()).toEqual(['cura:Zapdos', 'fire', 'cura:Heatran', 'nota:già sopra']);
      await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
      expect(order()).toEqual(['cura:Rotom-Wash', 'nota:già sopra', 'cura:Landorus-Therian', 'nota:già sopra']);
      expect(pages).toHaveTextContent('Pagina 2 di 3');
      await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
      expect(pages).toHaveTextContent('3/3');
      expect(within(pages).getByRole('button', { name: 'Proposte successive' })).toBeDisabled();
      await user.click(within(pages).getByRole('button', { name: 'Proposte precedenti' }));
      expect(pages).toHaveTextContent('2/3');
      // Il titolo conta tutte le proposte, non quelle della pagina
      expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent('Proposte6');
    } finally {
      style.mockRestore();
      delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
      vi.unstubAllGlobals();
    }
  });

  it('cosa cambia: "Risolve" coi problemi risolti (spunte) e le aree che salgono "da → a"; le aree che non cambiano non ci sono; "Costa: Niente"', () => {
    const def = Math.round(before.defense!);
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key, steel.key], { defense: def + 5, bonusMalus: before.bonusMalus + 1 })]));
    const solves = within(heroOf()).getByRole('region', { name: 'Risolve' });
    const solved = [...solves.querySelectorAll('li.coach-solved')];
    expect(solved).toHaveLength(3);
    expect(solved.map(li => li.textContent).join('|')).toMatch(/Scoperto in difesa contro Fire.*Senza check in difesa contro Zapdos.*3 membri di tipo Acciaio/);
    const changes = [...solves.querySelectorAll<HTMLElement>('.coach-change')];
    expect(changes.map(c => c.querySelector('b')!.textContent)).toEqual(['Difesa', 'Bonus/Malus']);
    expect(changes.every(c => c.classList.contains('is-up'))).toBe(true);
    expect(changes[0]).toHaveTextContent(`Difesa${def} →${def + 5}da ${def} a ${def + 5}`);
    expect(changes[0].querySelector('.coach-to')).toHaveTextContent(String(def + 5));
    expect(changes[1]).toHaveTextContent(`${gainText(before.bonusMalus).replace('±0', '0')} →${gainText(before.bonusMalus + 1)}`);
    const costs = within(heroOf()).getByRole('region', { name: 'Costa' });
    expect(costs).toHaveTextContent('CostaNiente');
    expect(costs).not.toHaveClass('is-bad');
  });

  it('"Risolve" mostra tutti i problemi risolti, senza "+N altri"', () => {
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key, pivot.key, steel.key])]));
    const solves = within(heroOf()).getByRole('region', { name: 'Risolve' });
    expect(solves.querySelectorAll('li.coach-solved')).toHaveLength(4);
    expect(solves).toHaveTextContent(pivotName);
    expect(solves).not.toHaveTextContent(/\+\d+ altr[io]/);
  });

  it('un\'area che sale senza problemi risolti: "alza solo il voto" e la sua riga "da → a"; nella classifica la nota sotto la testata', () => {
    const off = Math.round(before.strength!);
    view(advice([swap('Zapdos', 4, 3, [], { strength: off + 2 }), swap('Heatran', 1, 2, [], { defense: Math.round(before.defense!) + 1 })]));
    const solves = within(heroOf()).getByRole('region', { name: 'Risolve' });
    expect(solves).toHaveTextContent('Nessun problema: alza solo il voto');
    expect(solves.querySelector('li.coach-solved')).toBeNull();
    expect(solves.querySelector('.coach-change b')).toHaveTextContent('Offesa');
    expect(solves.querySelector('.coach-change .coach-to')).toHaveTextContent(String(off + 2));
    // Nessuna proposta risolve un problema: tutti in "Restano"
    expect(order()).toEqual(['cura:Zapdos', 'nota:alza', 'cura:Heatran', 'nota:alza', 'restano', 'fire', 'zapdos', 'pivot', 'steel']);
  });

  it('aperta nella carta, un\'area che scende sta in "Costa" (in rosso), non in "Risolve"', () => {
    const def = Math.round(before.defense!);
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key], { defense: def - 2 })]));
    const costs = within(heroOf()).getByRole('region', { name: 'Costa' });
    expect(costs).toHaveClass('is-bad');
    expect(costs.querySelector('.coach-change.is-down')).toHaveTextContent(`Difesa${def} →${def - 2}`);
    expect(within(heroOf()).getByRole('region', { name: 'Risolve' }).querySelector('.coach-change')).toBeNull();
  });

  it('Applica applica la proposta, "Vedi nella scheda Pokémon" la apre; il nome dice cosa applica', async () => {
    const user = userEvent.setup();
    const fix = swap('Rotom-Wash', 4, 3, [fire.key]);
    const h = view(advice([fix]));
    await user.click(within(heroOf()).getByRole('button', { name: 'Applica: Rotom-Wash al posto di Magikarp, voto +3' }));
    expect(h.onApplyFix).toHaveBeenLastCalledWith(fix);
    await user.click(within(heroOf()).getByRole('button', { name: 'Vedi nella scheda Pokémon: Rotom-Wash' }));
    expect(h.onFix).toHaveBeenLastCalledWith(fix);
    // Una proposta sola: una testata sola nella classifica, nessuna lista di altre
    expect(cureNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +3']);
    expect(within(list()).queryByText(/Nessun'altra proposta/)).toBeNull();
  });

  it('il set della proposta: Strumento e Abilità come targhette, le quattro mosse', () => {
    const fix = swap('Rotom-Wash', 4, 3, [fire.key]);
    view(advice([fix]));
    const set = within(heroOf()).getByRole('region', { name: 'Set' });
    expect(set).toHaveClass('coach-set');
    const plates = [...set.querySelectorAll('.coach-set-kit .coach-plate')];
    expect(plates.map(p => p.querySelector('.coach-plate-label')!.textContent)).toEqual(['Strumento', 'Abilità']);
    expect(plates[0].querySelector('.coach-plate-value')).toHaveTextContent(gameName('item', fix.set.item, 'it'));
    expect(plates[1].querySelector('.coach-plate-value')).toHaveTextContent(gameName('ability', fix.set.ability, 'it'));
    const moves = [...set.querySelectorAll('.coach-set-moves li')];
    expect(moves).toHaveLength(fix.set.moves.filter(Boolean).length);
    expect(fix.set.moves.filter(Boolean)).toHaveLength(4);
    // In un cambio di Pokémon nessuna mossa è "nuova"
    expect(set.querySelector('li.is-new')).toBeNull();
  });

  it('la regione viva dice cosa c\'è nella carta e cambia con lei', async () => {
    const user = userEvent.setup();
    view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 4, [fire.key])]));
    expect(live()).toHaveClass('visually-hidden');
    expect(live()).toHaveTextContent('Nella carta: Zapdos al posto di Sunkern, voto +5');
    await user.click(cures()[1]);
    expect(live()).toHaveTextContent('Nella carta: Rotom-Wash al posto di Magikarp, voto +4');
  });

  describe('alternative', () => {
    const best = swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]);
    const second = swap('Heatran', 4, 3, [fire.key]);
    const third = swap('Volcanion', 4, 2, [fire.key, zapdos.key]);
    const other = swap('Zapdos', 5, 1, [pivot.key]);

    it('stesso membro e stesso problema principale: una carta con "Oppure" e le piccole carte delle altre; nella classifica una testata sola', () => {
      const adv = advice([second, best, third, other]);
      expect(proposalGroups(problems, adv).map(g => g.options.length)).toEqual([3, 1]);
      view(adv);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      const alts = within(heroOf()).getByRole('group', { name: 'Altre 2 proposte per questo posto' });
      expect(alts).toHaveTextContent('Oppure');
      expect(altNames()).toEqual(['Heatran al posto di Magikarp, voto +3', 'Volcanion al posto di Magikarp, voto +2']);
      expect(altTiles().map(t => t.textContent)).toEqual(['+3', '+2']);
      expect(cureNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1']);
      expect(order()).toEqual(['cura:Rotom-Wash', 'fire', 'zapdos', 'cura:Zapdos', 'pivot', 'restano', 'steel']);
    });

    it('un posto senza alternative non ha "Oppure"', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      await user.click(cures()[1]);
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +1');
      expect(heroOf().querySelector('.coach-alts')).toBeNull();
    });

    it('scegliere un\'alternativa la mette nella carta (nome, +N), il fuoco va sul titolo della carta e Applica applica quella; la migliore va fra le piccole carte', async () => {
      const user = userEvent.setup();
      const h = view(advice([second, best, third, other]));
      await user.click(within(heroOf()).getByRole('button', { name: 'Metti nella carta: Heatran al posto di Magikarp, voto +3' }));
      expect(heroName()).toBe('Heatran al posto di Magikarp, voto +3');
      await waitFor(() => expect(heroTitle()).toHaveFocus());
      expect(heroOf().querySelector('.coach-gain')).toHaveTextContent('+3');
      expect(altNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Volcanion al posto di Magikarp, voto +2']);
      expect(live()).toHaveTextContent('Nella carta: Heatran al posto di Magikarp, voto +3');
      // La testata della classifica è la scelta; Zapdos lo risolve solo un'alternativa: resta sotto lo stesso posto, senza spunta
      expect(cureNames()[0]).toBe('Heatran al posto di Magikarp, voto +3');
      expect(order()).toEqual(['cura:Heatran', 'fire', 'zapdos', 'cura:Zapdos', 'pivot', 'restano', 'steel']);
      expect(railItem('contro Fire')).toHaveClass('is-cured');
      expect(railItem('contro Zapdos')).not.toHaveClass('is-cured');
      await user.click(within(heroOf()).getByRole('button', { name: /^Applica: Heatran/ }));
      expect(h.onApplyFix).toHaveBeenLastCalledWith(second);
      await user.click(within(heroOf()).getByRole('button', { name: 'Vedi nella scheda Pokémon: Heatran' }));
      expect(h.onFix).toHaveBeenLastCalledWith(second);
      // Aperta un'altra proposta, il posto resta con la scelta nella classifica
      await user.click(cures()[1]);
      expect(cureNames()[0]).toBe('Heatran al posto di Magikarp, voto +3');
    });

    it('tastiera: le piccole carte sono pulsanti, Invio e Spazio scelgono', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      altTiles()[1].focus();
      await user.keyboard('{Enter}');
      expect(heroName()).toBe('Volcanion al posto di Magikarp, voto +2');
      // Il pulsante usato sparisce: il fuoco va sul titolo della carta (al fotogramma dopo)
      await waitFor(() => expect(heroTitle()).toHaveFocus());
      altTiles()[0].focus();
      await user.keyboard(' ');
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
    });

    it('la scelta si dimentica quando cambiano i consigli', async () => {
      const user = userEvent.setup();
      const adv = advice([second, best, third, other]);
      const h = { onFix: vi.fn(), onMoveFix: vi.fn(), onApplyFix: vi.fn(), onApplyMove: vi.fn() };
      const { rerender } = renderIt(<CoachingView coaching={coachingOf(problems)} advice={adv} members={6} rating={rating} {...h} />);
      await user.click(altTiles()[0]);
      expect(heroName()).toBe('Heatran al posto di Magikarp, voto +3');
      rerender(<CoachingView coaching={coachingOf(problems)} advice={{ ...adv }} members={6} rating={rating} {...h} />);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
    });

    it('una proposta che non alza il voto va fra le alternative della prima che risolve il suo problema, non nella classifica', () => {
      const neutral = swap('Incineroar', 3, 0, [fire.key]);
      view(advice([second, best, other, neutral]));
      expect(altNames()).toEqual(['Heatran al posto di Magikarp, voto +3', 'Incineroar al posto di Corviknight, voto ±0']);
      expect(cureNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1']);
    });

    it('senza una proposta che alza il voto e risolve il suo problema, resta in coda alla classifica', () => {
      const neutral = swap('Incineroar', 3, 0, [steel.key]);
      view(advice([best, other, neutral]));
      expect(cureNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1', 'Incineroar al posto di Corviknight, voto ±0']);
      expect(order()).toEqual(['cura:Rotom-Wash', 'fire', 'zapdos', 'cura:Zapdos', 'pivot', 'cura:Incineroar', 'steel']);
    });
  });

  it('cambio di mossa: la mossa nuova protagonista, "Su X", la vecchia barrata, nel set la mossa nuova segnata; Applica e "Apri il set"', async () => {
    const user = userEvent.setup();
    const tusk: TeamSet = { ...six[0], moves: [six[0].moves[0], 'Knock Off', six[0].moves[2], six[0].moves[3]] };
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: tusk, reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [zapdos.key], after: before };
    const empty: MoveFix = { ...move, index: 1, member: 'Gholdengo', set: six[1], slot: 3, from: '', to: 'Thunderbolt', gain: 1, solves: [pivot.key] };
    const h = view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move, empty]));
    expect(heroName()).toBe('Knock Off al posto di Rapid Spin su Great Tusk, voto +4');
    expect(cureNames()).toEqual(['Knock Off al posto di Rapid Spin su Great Tusk, voto +4', 'Rotom-Wash al posto di Magikarp, voto +2', 'Thunderbolt in uno slot libero su Gholdengo, voto +1']);
    const hero = heroOf();
    expect(hero).toHaveClass('is-move');
    const title = hero.querySelector('.coach-hero-title.is-move')!;
    expect(title.querySelector('.coach-move-in')).toHaveTextContent('Knock Off');
    const plates = [...title.querySelectorAll('.coach-plate')];
    expect(plates[0]).toHaveTextContent('SuGreat Tusk');
    expect(plates[1]).toHaveClass('is-out');
    expect(plates[1].querySelector('s')).toHaveTextContent('Rapid Spin');
    expect(title).toHaveTextContent('cambio di mossa');
    // Nel set: le quattro mosse, la nuova (slot 1) segnata
    const moves = [...hero.querySelectorAll('.coach-set-moves li')];
    expect(moves).toHaveLength(4);
    expect(moves.map(li => li.classList.contains('is-new'))).toEqual([false, true, false, false]);
    expect(moves[1]).toHaveTextContent(gameName('move', 'Knock Off', 'it'));
    // Nella classifica la mossa è segnata come tale: la mossa nuova, "su X, al posto di Y"
    expect(cures().map(c => c.classList.contains('is-move'))).toEqual([true, false, true]);
    expect(cures()[0]).toHaveTextContent('su Great Tusk, al posto di Rapid Spin');
    expect(cures()[2]).toHaveTextContent('su Gholdengo, al posto di slot libero');
    await user.click(within(hero).getByRole('button', { name: /^Applica: Knock Off/ }));
    expect(h.onApplyMove).toHaveBeenLastCalledWith(move);
    await user.click(within(hero).getByRole('button', { name: 'Apri il set: Great Tusk' }));
    expect(h.onMoveFix).toHaveBeenLastCalledWith(move);
    // Uno slot libero: "slot libero" al posto della mossa vecchia
    await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Thunderbolt in uno slot libero su Gholdengo, voto +1' }));
    expect(heroOf().querySelector('.coach-hero-free')).toHaveTextContent('slot libero');
    expect(heroOf().querySelector('.coach-plate.is-out')).toBeNull();
    expect(heroOf().querySelectorAll('.coach-set-moves li')[3]).toHaveClass('is-new');
  });

  it('un cambio che lascia il team senza un ruolo d\'aiuto lo dice in "Costa": "Perdi Danno nel Tempo"; gli altri no', async () => {
    const user = userEvent.setup();
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: six[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 6, solves: [zapdos.key], after: before,
      lostHelpers: ['dot', 'phazer'], penalty: 2 };
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move]));
    expect(heroOf()).toHaveClass('is-move');
    const costs = within(heroOf()).getByRole('region', { name: 'Costa' });
    expect(costs).toHaveClass('is-bad');
    expect(costs.querySelector('.coach-lost')).toHaveTextContent('Perdi Danno nel Tempo, Anti-setup');
    // Il voto mostrato resta quello vero
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent('+6');
    expect(cures()[0].querySelector('.coach-diag-cure-gain')).toHaveTextContent('+6');
    await user.click(cures()[1]);
    expect(heroOf().querySelector('.coach-lost')).toBeNull();
    expect(within(heroOf()).getByRole('region', { name: 'Costa' })).toHaveTextContent('Niente');
  });

  it('aperto su un problema dalla testata di un\'area: filtro su quel problema, la prima proposta che lo risolve nella carta, in vista e accesa per 2 secondi', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.useFakeTimers();
    try {
      const fixes = six6.map((s, i) => swap(s, i, 9 - i, i === 5 ? [pivot.key] : [fire.key]));
      renderIt(<CoachingView coaching={coachingOf(problems)} advice={advice(fixes)} members={6} rating={rating} {...noop} focus={{ key: pivot.key, nonce: 1 }} />);
      const hero = heroOf();
      expect(heroName()).toBe('Dragonite al posto di Sunkern, voto +4');
      expect(hero).toHaveClass('is-flash');
      expect(scroll.mock.contexts[0]).toBe(hero);
      expect(railItem(pivotName)).toHaveAttribute('aria-pressed', 'true');
      expect(railItem(pivotName)).toHaveClass('is-on');
      const bar = rail().querySelector('.coach-filter')!;
      expect(bar).toHaveTextContent(`Solo per: ${pivotName}`);
      expect(within(bar as HTMLElement).getByRole('button', { name: 'Mostra tutte' })).toBeInTheDocument();
      // Solo le proposte che lo risolvono, senza "Restano"
      expect(cureNames()).toEqual(['Dragonite al posto di Sunkern, voto +4']);
      expect(order()).toEqual(['cura:Dragonite', 'pivot']);
      expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent('Proposte1');
      act(() => { vi.advanceTimersByTime(2100); });
      expect(heroOf()).not.toHaveClass('is-flash');
    } finally {
      vi.useRealTimers();
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('consigli in calcolo: la carta e la classifica scheletro (aria-busy), senza numero, e un avviso per lo screen reader', () => {
    view(null);
    expect(list().querySelector('.coach-hero.skeleton')).not.toBeNull();
    expect(within(list()).queryByRole('article')).toBeNull();
    const busy = rail().querySelector('ol.coach-diag-list[aria-busy="true"]')!;
    expect(busy.querySelectorAll('li.coach-rank-skeleton')).toHaveLength(6);
    expect(rail().querySelector('.coach-diag-cure, .coach-diag-item')).toBeNull();
    expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent(/^Proposte$/);
    expect(screen.getByRole('status')).toHaveTextContent('Calcolo dei consigli…');
    expect(live()).toHaveTextContent(/^$/);
  });

  it('le aree senza problemi in una riga verde sotto la classifica', () => {
    renderIt(<CoachingView coaching={coachingOf([zapdos])} advice={advice([swap('Rotom-Wash', 4, 2, [zapdos.key])])} members={6} rating={rating} {...noop} />);
    const clean = rail().querySelector('.coach-clean')!;
    expect(clean).toHaveTextContent(`Nessun problema in Offesa ${Math.round(before.strength!)} · Ruoli`);
    expect(clean).not.toHaveTextContent('Difesa');
  });

  describe('classifica', () => {
    const slow: CoachProblem = { severity: 'minor', category: 'redundancy', text: 'Due membri lenti', fixes: [], key: 'redundancy:slow' };
    const hit: CoachProblem = { severity: 'minor', category: 'metaHit', text: 'Senza risposta in attacco contro Dragonite', fixes: [], key: 'metaHit:Dragonite', subjects: ['Dragonite'] };
    const ranked = () => view(advice([swap('Zapdos', 5, 5, [pivot.key, steel.key]), swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]), swap('Heatran', 1, 1, [fire.key])]),
      { coaching: coachingOf([...problems, slow, hit]) });

    it('le proposte nell\'ordine dei gruppi, ognuna coi problemi che è la prima a risolvere (una volta sola); senza problemi nuovi la nota; in coda "Restano"', () => {
      ranked();
      expect(cureNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Rotom-Wash al posto di Magikarp, voto +4', 'Heatran al posto di Gholdengo, voto +1']);
      expect(order()).toEqual(['cura:Zapdos', 'pivot', 'steel', 'cura:Rotom-Wash', 'fire', 'zapdos', 'cura:Heatran', 'nota:già sopra', 'restano', 'slow', 'dragonite']);
      // Ogni problema una volta sola
      expect(rail().querySelectorAll('.coach-diag-item')).toHaveLength(6);
      expect(within(rail()).getByText('Restano: nessun cambio singolo li risolve')).toBeInTheDocument();
      // In "Restano" i problemi non sono pulsanti
      for (const text of ['Due membri lenti', 'Dragonite']) {
        expect(railItem(text).tagName).toBe('SPAN');
        expect(railItem(text)).toHaveClass('is-static');
        expect(railItem(text)).not.toHaveAttribute('aria-pressed');
      }
      expect(railItem('contro Fire').tagName).toBe('BUTTON');
      expect(railItem('contro Fire')).toHaveAttribute('aria-pressed', 'false');
      expect(railItem('contro Fire')).toHaveClass('serious');
    });

    it('le minacce col perché sotto il nome, i problemi semplici in testo semplice', () => {
      ranked();
      expect(railItem('contro Zapdos').querySelector('.coach-rank-why')).toHaveTextContent('Nessuno lo regge bene');
      expect(railItem('Dragonite').querySelector('.coach-rank-why')).toHaveTextContent('Nessuno lo manda KO in due colpi');
      expect(railItem('contro Fire').querySelector('.coach-rank-why')).toBeNull();
      expect(railItem('Acciaio').querySelector('.coach-rank-plain')).toHaveTextContent('3 membri di tipo Acciaio');
      expect(railItem('contro Fire').querySelector('.coach-rank-plain')).toBeNull();
    });

    it('i problemi della proposta nella carta hanno la spunta e lo dicono allo screen reader; un clic su un\'altra testata li sposta', async () => {
      const user = userEvent.setup();
      ranked();
      expect(railItem(pivotName)).toHaveClass('is-cured');
      expect(railItem(pivotName)).toHaveAttribute('aria-label', `${pivotName} · lo risolve la proposta nella carta. Mostra solo le proposte che lo risolvono`);
      expect(railItem('contro Fire')).not.toHaveClass('is-cured');
      expect(railItem('contro Fire')).toHaveAttribute('aria-label', `${fire.text}. Mostra solo le proposte che lo risolvono`);
      await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Rotom-Wash al posto di Magikarp, voto +4' }));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta scelta');
      expect(railItem('contro Fire')).toHaveClass('is-cured');
      expect(railItem(pivotName)).not.toHaveClass('is-cured');
      expect(cures()[1]).toHaveClass('is-open');
      await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    });

    it('un clic su un problema mostra solo le proposte che lo risolvono ("Solo per:"); di nuovo, o "Mostra tutte", tutte e il fuoco sul titolo della carta', async () => {
      const user = userEvent.setup();
      ranked();
      await user.click(railItem('contro Fire'));
      expect(railItem('contro Fire')).toHaveAttribute('aria-pressed', 'true');
      expect(rail().querySelector('.coach-filter')).toHaveTextContent(/^Solo per:/);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta migliore');
      expect(cureNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Heatran al posto di Gholdengo, voto +1']);
      expect(order()).toEqual(['cura:Rotom-Wash', 'fire', 'zapdos', 'cura:Heatran', 'nota:già sopra']);
      expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent('Proposte2');
      // Di nuovo sullo stesso problema: tutte
      await user.click(railItem('contro Fire'));
      expect(rail().querySelector('.coach-filter')).toBeNull();
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
      expect(cureNames()).toHaveLength(3);
      // "Mostra tutte" nella barra del filtro: sparisce, il fuoco va sul titolo della carta
      await user.click(railItem('Acciaio'));
      expect(cureNames()).toEqual(['Zapdos al posto di Sunkern, voto +5']);
      await user.click(within(rail()).getByRole('button', { name: 'Mostra tutte' }));
      expect(rail().querySelector('.coach-filter')).toBeNull();
      expect(within(rail()).queryByRole('button', { name: 'Mostra tutte' })).toBeNull();
      expect(railItem('Acciaio')).toHaveAttribute('aria-pressed', 'false');
      expect(cureNames()).toHaveLength(3);
      await waitFor(() => expect(heroTitle()).toHaveFocus());
      // Un filtro su un problema che risolve solo la seconda: la carta va su di lei
      await user.click(railItem('contro Zapdos'));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
    });

    it('il "?" (col fumetto dell\'app) apre "Come funziona il Coaching"', async () => {
      const user = userEvent.setup();
      view(advice([swap('Zapdos', 5, 5, [pivot.key])]));
      const help = within(rail()).getByRole('button', { name: 'Come funziona il Coaching' });
      expect(help).toHaveAttribute('data-hint', 'Come funziona il Coaching');
      expect(help.getAttribute('title') ?? '').toBe('');
      await user.click(help);
      const dialog = screen.getByRole('dialog', { name: 'Come funziona il Coaching' });
      expect(within(dialog).getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Proposte', 'La carta grande', 'Risolve e Costa', 'Applica e Oppure']);
    });
  });

  it('nessun problema: Eevee contento, "Il team è a posto", i valori delle aree, Esporta per Showdown e la Panoramica', async () => {
    const user = userEvent.setup();
    const h = view(advice([]), { coaching: coachingOf([]) });
    expect(screen.getByRole('heading', { name: 'Il team è a posto' })).toBeInTheDocument();
    expect(screen.getByText('Nessun problema da sistemare: il Coaching non ha niente da suggerire.')).toBeInTheDocument();
    expect(document.querySelector('.coach-empty .eevee-moment.happy')).not.toBeNull();
    expect(document.querySelector('.coach-empty-areas')).toHaveTextContent(`Offesa ${Math.round(before.strength!)} · Difesa ${Math.round(before.defense!)}`);
    await user.click(screen.getByRole('button', { name: 'Esporta per Showdown' }));
    expect(h.onExport).toHaveBeenCalledTimes(1);
    // "Team copiato per Showdown" lo dice l'avviso dell'app (DoneToast, in App): qui la spunta sul pulsante
    expect(await screen.findByRole('button', { name: 'Esporta per Showdown' })).toContainElement(document.querySelector('.coach-btn .icon'));
    await user.click(screen.getByRole('button', { name: 'Vedi la Panoramica' }));
    expect(h.onOverview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Proposte, dalla più utile' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: /^Proposte/ })).toBeNull();
  });

  it('problemi che nessuna proposta risolve: Eevee pensieroso, i problemi che restano e Migliora i set', async () => {
    const user = userEvent.setup();
    const h = view(advice([]));
    expect(screen.getByRole('heading', { name: 'Nessuna sostituzione singola li risolve' })).toBeInTheDocument();
    expect(screen.getByText('Restano questi problemi, ma cambiare un solo Pokémon non basta.')).toBeInTheDocument();
    expect(document.querySelector('.coach-empty .eevee-moment.down')).not.toBeNull();
    const chips = within(screen.getByRole('list', { name: 'Problemi che restano' })).getAllByRole('listitem');
    // Il ruolo mancante ha la sua pillola
    expect(chips.map(c => c.querySelector('.area-chip')!.getAttribute('data-key'))).toEqual([fire.key, zapdos.key, pivot.key, steel.key]);
    expect(screen.getByText(/Migliora i set cerca le versioni migliori/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    expect(h.onImproveSets).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('complementary', { name: /^Proposte/ })).toBeNull();
  });

  it('con meno di 2 membri: solo l\'invito ad aggiungere', () => {
    view(null, { members: 1, coaching: coachingOf([]) });
    expect(screen.getByText('Aggiungi un altro Pokémon per ricevere il coaching')).toBeInTheDocument();
    expect(screen.queryByText('Il team è a posto')).toBeNull();
  });

  it('dice quanti bannati restano fuori dai candidati', () => {
    view(advice([]), { coaching: coachingOf([], { bannedCount: 1 }) });
    expect(screen.getByText('1 bannato escluso')).toBeInTheDocument();
  });

  it('coi consigli veri: ogni gruppo del motore compare (testata della classifica, alternative), nell\'ordine e col +N del motore', async () => {
    const user = userEvent.setup();
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const adv = adviceOf(six, DEFAULT_FORMAT, data);
    const groups = neutralAsAlternatives(proposalGroups(coaching.problems, adv));
    expect(groups.length).toBeGreaterThan(0);
    renderIt(<CoachingView coaching={coaching} advice={adv} members={6} rating={rateTeam(six, data, 'it')} {...noop} />);
    expect(within(rail()).getByRole('heading', { name: /^Proposte/ })).toHaveTextContent(`Proposte${groups.length}`);
    expect(heroOf()).toHaveAttribute('data-row', groups[0].id);
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent(gainText(groups[0].options[0].fix.gain));
    expect(cures()).toHaveLength(groups.length);
    expect(cures().map(c => c.querySelector('.coach-diag-cure-gain')!.textContent)).toEqual(groups.map(g => gainText(g.options[0].fix.gain)));
    // Aperta ogni testata, la carta è quel gruppo e le piccole carte sono le sue alternative
    for (let i = 0; i < groups.length; i++) {
      await user.click(cures()[i]);
      expect(heroOf()).toHaveAttribute('data-row', groups[i].id);
      expect(heroOf().querySelector('.coach-gain')).toHaveTextContent(gainText(groups[i].options[0].fix.gain));
      expect(altTiles().map(t => t.querySelector('b')!.textContent)).toEqual(groups[i].options.slice(1).map(o => gainText(o.fix.gain)));
    }
    // Ogni problema mostrato una volta sola
    const keys = [...rail().querySelectorAll('.coach-diag-item')].map(el => el.textContent);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('proposta di mossa nell\'editor', () => {
  it('"Apri il set": si apre l\'editor del membro con la proposta; Applica cambia la mossa, Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const hero = await findRow(user, MOVE);
    const [, to, member, gain] = MOVE.exec(heroName())!;
    await user.click(within(hero).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    expect(card).toBeTruthy();
    // Il fuoco va su Applica
    expect(document.activeElement).toBe(within(card).getByRole('button', { name: 'Applica' }));
    const note = within(card).getByText(/^Proposta del coach: /);
    expect(note).toHaveTextContent(`${to}`);
    expect(note).toHaveTextContent(gain);
    const field = card.querySelector('.field.is-proposed')!;
    expect(field).toBeTruthy();
    const slot = [...card.querySelectorAll('.editor-group.moves .field')].indexOf(field);
    const input = () => within(card).getAllByRole('combobox', { name: /^Mossa \d$/ })[slot] as HTMLInputElement;
    const before = input().value;
    expect(before).not.toBe(to);
    await user.click(within(card).getByRole('button', { name: 'Applica' }));
    expect(input().value).toBe(to);
    expect(card.querySelector('.move-proposal')).toBeNull();
    const toast = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(toast).toHaveTextContent(`${member}: ${before || '—'} → ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(input().value).toBe(before);
  });

  it('Applica nella carta: la mossa cambia subito, senza editor; Annulla del toast la riporta', async () => {
    const user = await openCoaching(fixable);
    const hero = await findRow(user, MOVE);
    const [, to, member] = MOVE.exec(heroName())!;
    await user.click(within(hero).getByRole('button', { name: /^Applica: / }));
    expect(document.querySelector('.slot.open')).toBeNull();
    const toast = document.querySelector<HTMLElement>('.undo-toast')!;
    expect(toast).toHaveTextContent(`${member}: `);
    expect(toast).toHaveTextContent(`→ ${to}`);
    await user.click(within(toast).getByRole('button', { name: 'Annulla' }));
    expect(document.querySelector('.undo-toast')).toBeNull();
  });

  it('Annulla della proposta: nessun cambio, la proposta sparisce, l\'editor resta aperto', async () => {
    const user = await openCoaching(fixable);
    const hero = await findRow(user, MOVE);
    const member = MOVE.exec(heroName())![2];
    await user.click(within(hero).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    await user.click(within(card).getByRole('button', { name: 'Annulla' }));
    expect(card.querySelector('.move-proposal')).toBeNull();
    expect(card.querySelector('.is-proposed')).toBeNull();
    expect(document.querySelector('.slot.open')).toBe(card);
    expect(document.querySelector('.undo-toast')).toBeNull();
  });

  it('team compresso: "Apri il set" apre comunque l\'editor con la proposta e lo slot evidenziato', async () => {
    const user = await openCoaching(fixable);
    await user.click(screen.getByRole('button', { name: 'Comprimi team' }));
    const hero = await findRow(user, MOVE);
    const member = MOVE.exec(heroName())![2];
    await user.click(within(hero).getByRole('button', { name: `Apri il set: ${member}` }));
    const card = document.querySelector<HTMLElement>('.slot.open')!;
    expect(card).toBeTruthy();
    expect(card.querySelector('.move-proposal')).not.toBeNull();
    expect(card.querySelector('.field.is-proposed')).not.toBeNull();
  });

  // Il clic su una proposta vecchia (membro uscito o slot cambiato) non è raggiungibile dalla UI: dopo ogni modifica
  // i consigli si ricalcolano e la riga sparisce; la guardia in App.openMoveFix non ha un punto d'ingresso nei test.
  it('rimosso il membro, nessuna proposta resta aperta', async () => {
    const user = await openCoaching(fixable);
    await findRow(user, MOVE);
    const member = MOVE.exec(heroName())![2];
    await user.click(screen.getByRole('button', { name: new RegExp(`^Rimuovi ${member}`) }));
    expect(document.querySelector('.move-proposal')).toBeNull();
    expect(document.querySelector('.undo-toast')).toHaveTextContent('rimosso');
  });
});
