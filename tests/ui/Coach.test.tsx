import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { gameName, typeName } from '../../src/i18n/game';
import { spyClipboard } from '../helpers/clipboard';
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
/** Le righe della classifica (una per proposta, pagina corrente): un clic la apre nella carta. */
const ranks = () => [...rail().querySelectorAll<HTMLButtonElement>('ol.coach-diag-list > li > button.coach-rank')];
/** I nomi delle proposte nella classifica ("Apri nella carta: " tolto). */
const rankNames = () => ranks().map(b => b.getAttribute('aria-label')!.replace(/^Apri nella carta: /, ''));
/** Il pulsante della carta grande che mette un'alternativa nella carta. */
const altTiles = () => [...heroOf().querySelectorAll<HTMLButtonElement>('.coach-alt-tile')];
/** "altre N" in Oppure: mostra le alternative nascoste (le prime tre sono sempre in vista). */
const altMore = () => heroOf().querySelector<HTMLButtonElement>('button.coach-alt-more');
/** Mostra tutte le alternative della carta (clic su "altre N" se c'è ed è chiuso). */
async function allAlts(user: ReturnType<typeof userEvent.setup>) {
  const more = altMore();
  if (more && more.getAttribute('aria-expanded') === 'false') await user.click(more);
}
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
 * righe della classifica (un clic la apre); in ultimo le alternative di ogni proposta. Torna la carta grande.
 */
async function findRow(user: ReturnType<typeof userEvent.setup>, pattern: RegExp): Promise<HTMLElement> {
  const inHero = async () => {
    if (pattern.test(heroName())) return true;
    await allAlts(user);
    const tile = altTiles().find((_, i) => pattern.test(altNames()[i]));
    if (tile) { await user.click(tile); return true; }
    return false;
  };
  if (await inHero()) return heroOf();
  const at = rankNames().findIndex(n => pattern.test(n));
  if (at >= 0) { await user.click(ranks()[at]); return heroOf(); }
  // Fra le alternative delle altre proposte: si aprono una per una
  for (let i = 0; i < ranks().length; i++) {
    await user.click(ranks()[i]);
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
    const names = rankNames();
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
    // Nella fascia VS: a sinistra il posto libero tratteggiato, niente chi esce
    expect(hero.querySelector('.coach-vs')).toHaveClass('is-add');
    expect(hero.querySelector('.coach-vs-free')).toHaveTextContent('Posto libero');
    expect(hero.querySelector('.coach-vs-out-name')).toBeNull();
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
  /** Il titolo visibile della carta: riceve il fuoco quando il pulsante usato sparisce. */
  const heroTitle = () => heroOf().querySelector<HTMLElement>('.coach-hero-focus')!;
  const live = () => list().querySelector('p[aria-live="polite"]')!;
  const six6 = ['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'];
  /** Il filtro per problema (la tendina "Problema"). */
  const filter = () => within(rail()).getByRole('combobox', { name: 'Problema' }) as HTMLSelectElement;
  /** La riga "Restano N problemi" in fondo alla classifica. */
  const stuckLine = () => rail().querySelector<HTMLElement>('p.coach-rank-stuck');
  /** Il titolo della classifica: "Proposte" e il numero di cambi. */
  const railHead = () => within(rail()).getByRole('heading', { name: /^Proposte/ });
  /**
   * I problemi risolti in piccolo sotto una riga della classifica: "fire", "zapdos", "pivot", "steel" (e "+N" per gli
   * altri); "alza" se non ne risolve nessuno.
   */
  const pills = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('.coach-pill, .coach-pill-more, .coach-pill-none')].map(el => {
    if (el.classList.contains('coach-pill-more')) return el.textContent!;
    if (el.classList.contains('coach-pill-none')) return el.textContent === 'Non risolve problemi: alza il voto' ? 'alza' : `?${el.textContent}`;
    const text = el.textContent!;
    return text.includes('Fire') ? 'fire' : text.includes('Zapdos') ? 'zapdos' : text.includes(pivotName) ? 'pivot' : text.includes('Acciaio') ? 'steel' : `?${text}`;
  });
  /** I problemi in piccolo di ogni riga della classifica. */
  const railPills = () => ranks().map(pills);

  it('a pari voto "±0", mai "+0"', () => {
    expect([gainText(3), gainText(0), gainText(-2)]).toEqual(['+3', '±0', '−2']);
  });

  it('la migliore nella carta grande, la classifica a sinistra dalla più utile; nomi "X al posto di Y, voto +N"; quante sono nel titolo', () => {
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    expect(band()).toHaveTextContent('La proposta migliore');
    expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
    expect(within(list()).getByRole('article', { name: 'Zapdos al posto di Sunkern, voto +5' })).toBeInTheDocument();
    expect(heroOf().querySelector('.coach-hero-name')).toHaveTextContent('Zapdos');
    // La fascia VS: a sinistra chi esce (spento, "esce" e il nome), al centro +N e il voto prima → dopo, a destra chi entra
    const vs = heroOf().querySelector('.coach-vs')!;
    expect(vs).toHaveClass('is-swap');
    expect(vs.querySelector('.coach-vs-side.is-out .coach-vs-label')).toHaveTextContent('esce');
    expect(vs.querySelector('.coach-vs-side.is-out .coach-vs-out-name')).toHaveTextContent('Sunkern');
    expect(vs.querySelector('.coach-vs-side.is-out .coach-art-out .sprite')).not.toBeNull();
    expect(vs.querySelector('.coach-vs-side.is-in .coach-hero-name')).toHaveTextContent('Zapdos');
    expect(vs.querySelector('.coach-vs-side.is-in .pedana-disc')).not.toBeNull();
    expect(vs.querySelector('.coach-vs-mid .coach-gain')).toHaveTextContent('+5');
    const after = Math.min(100, rating.overall + 5);
    const grade = after >= 90 ? 'S' : after >= 80 ? 'A' : after >= 70 ? 'B' : after >= 60 ? 'C' : 'D';
    expect(vs.querySelector('.coach-grade-change')).toHaveTextContent(`${rating.grade} ${rating.overall} → ${grade} ${after}`);
    // Il voto dopo nel colore del voto
    expect(vs.querySelector('.coach-grade-change .coach-grade-tag')).toHaveClass(`grade-${grade}`);
    expect(railHead()).toHaveTextContent(/^Proposte3 cambi$/);
    expect(rail().querySelector('.coach-diag-total')).toHaveTextContent('3 cambi');
    expect(rankNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2']);
    // Una riga per proposta: un pulsante solo, nome, "al posto di X", +N; quella nella carta ha l'anello (aria-current)
    expect(rail().querySelectorAll('ol.coach-diag-list > li')).toHaveLength(3);
    expect(ranks()[0].querySelector('.coach-rank-who')).toHaveTextContent('Zapdosal posto di Sunkern');
    expect(ranks()[0].querySelector('.coach-rank-gain')).toHaveTextContent('+5');
    expect(ranks()[0]).toHaveTextContent('Zapdosal posto di Sunkern+5');
    expect(ranks()[0]).toHaveAttribute('aria-current', 'true');
    expect(ranks()[0]).toHaveClass('is-open');
    expect(ranks()[1]).not.toHaveAttribute('aria-current');
    // Niente più lista sotto la carta
    expect(list().querySelector('.coach-list, ol.coach-rows, li.coach-item, .coach-item-btn, .coach-marks')).toBeNull();
    expect(within(list()).queryByText(/^Altre proposte/)).toBeNull();
    // Pochi: nessuna pagina
    expect(within(rail()).queryByRole('navigation')).toBeNull();
  });

  it('un clic su una riga della classifica la porta nella carta grande ("La proposta scelta"); "Torna alla migliore" riporta la prima e il fuoco sul titolo della carta', async () => {
    const user = userEvent.setup();
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Rotom-Wash al posto di Magikarp, voto +2' }));
    expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +2');
    expect(band()).toHaveTextContent('La proposta scelta');
    // La classifica non cambia ordine: cambia solo l'anello
    expect(rankNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2']);
    expect(ranks()[2]).toHaveAttribute('aria-current', 'true');
    expect(ranks()[0]).not.toHaveAttribute('aria-current');
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
    await user.click(ranks()[4]);
    expect(primary()).toHaveLength(1);
    expect(heroOf().contains(primary()[0])).toBe(true);
  });

  it('a pagine quando la colonna è bassa: "‹ 1/3 ›" sotto la lista coi nomi per lo screen reader, avanti e indietro; il filtro riparte dalla prima', async () => {
    // jsdom non misura: una colonna alta 80 e righe da 40 (2 righe per pagina)
    const realStyle = window.getComputedStyle.bind(window);
    const style = vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => (el.classList.contains('coach-diag-box')
      ? ({ getPropertyValue: (p: string) => (p === '--row-h' ? '40' : '') } as unknown as CSSStyleDeclaration) : realStyle(el, pseudo)));
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('coach-diag-box') ? 80 : 0; } });
    const RO = class { constructor(private cb: ResizeObserverCallback) {} observe() { this.cb([], this as unknown as ResizeObserver); } unobserve() {} disconnect() {} };
    vi.stubGlobal('ResizeObserver', RO);
    try {
      const user = userEvent.setup();
      // Sei proposte, una riga ciascuna (tutte risolvono Fuoco): due per pagina
      view(advice(six6.map((s, i) => swap(s, i, 9 - i, [fire.key]))), { coaching: coachingOf([fire]) });
      const pages = within(rail()).getByRole('navigation', { name: 'Pagine delle proposte' });
      expect(pages.closest('.coach-diag-foot')).not.toBeNull();
      expect(pages).toHaveTextContent('1/3');
      expect(pages).toHaveTextContent('Pagina 1 di 3');
      expect(within(pages).getByRole('button', { name: 'Proposte precedenti' })).toBeDisabled();
      const species = () => ranks().map(b => b.querySelector('.coach-rank-who b')!.textContent);
      expect(species()).toEqual(['Zapdos', 'Heatran']);
      await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
      expect(species()).toEqual(['Rotom-Wash', 'Landorus-Therian']);
      expect(railPills()).toEqual([['fire'], ['fire']]);
      expect(pages).toHaveTextContent('Pagina 2 di 3');
      await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
      expect(pages).toHaveTextContent('3/3');
      expect(within(pages).getByRole('button', { name: 'Proposte successive' })).toBeDisabled();
      await user.click(within(pages).getByRole('button', { name: 'Proposte precedenti' }));
      expect(pages).toHaveTextContent('2/3');
      // Il titolo conta tutte le proposte, non quelle della pagina
      expect(railHead()).toHaveTextContent(/^Proposte6 cambi$/);
      // Un filtro cambia la lista: si riparte dalla prima pagina
      await user.selectOptions(filter(), fire.key);
      expect(within(rail()).getByRole('navigation', { name: 'Pagine delle proposte' })).toHaveTextContent('Pagina 1 di 3');
      expect(species()).toEqual(['Zapdos', 'Heatran']);
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

  it('un\'area che sale senza problemi risolti: "alza solo il voto" e la sua riga "da → a"; nella classifica lo dice la riga; tutti i problemi in "Restano"', () => {
    const off = Math.round(before.strength!);
    view(advice([swap('Zapdos', 4, 3, [], { strength: off + 2 }), swap('Heatran', 1, 2, [], { defense: Math.round(before.defense!) + 1 })]));
    const solves = within(heroOf()).getByRole('region', { name: 'Risolve' });
    expect(solves).toHaveTextContent('Non risolve problemi: alza il voto');
    expect(solves.querySelector('li.coach-solved')).toBeNull();
    expect(solves.querySelector('.coach-change b')).toHaveTextContent('Offesa');
    expect(solves.querySelector('.coach-change .coach-to')).toHaveTextContent(String(off + 2));
    expect(railPills()).toEqual([['alza'], ['alza']]);
    expect(ranks()[0]).toHaveAccessibleDescription('Non risolve problemi: alza il voto');
    // Nessuna proposta risolve un problema: tutti in "Restano", nessun filtro
    expect(stuckLine()).toHaveTextContent('Restano 4 problemi che nessun cambio singolo risolve');
    expect(within(rail()).queryByRole('combobox')).toBeNull();
    expect(rail().querySelector('.coach-filter')).toBeNull();
  });

  it('aperta nella carta, un\'area che scende sta in "Costa" (in rosso), non in "Risolve"', () => {
    const def = Math.round(before.defense!);
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key], { defense: def - 2 })]));
    const costs = within(heroOf()).getByRole('region', { name: 'Costa' });
    expect(costs).toHaveClass('is-bad');
    expect(costs.querySelector('.coach-change.is-down')).toHaveTextContent(`Difesa${def} →${def - 2}`);
    expect(within(heroOf()).getByRole('region', { name: 'Risolve' }).querySelector('.coach-change')).toBeNull();
    // Costa sta nella fascia VS, accanto al voto (mai sotto la parte che scorre), una volta sola
    expect(costs.closest('.coach-vs-mid')).not.toBeNull();
    expect(within(heroOf()).getAllByRole('region', { name: 'Costa' })).toHaveLength(1);
  });

  it('il costo nella riga della classifica: l\'area che scende di più in rosso accanto al +N ("−3 Dif"), tutte a parole nella descrizione; senza costo niente', () => {
    const def = Math.round(before.defense!);
    const spe = Math.round(before.speed!);
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key], { defense: def - 3, speed: spe - 1 }), swap('Zapdos', 5, 2, [pivot.key])]));
    const [costly, free] = ranks();
    expect(costly.querySelector('.coach-rank-cost')).toHaveTextContent(/^−3 Dif$/);
    expect(costly.querySelector('.coach-rank-end')).toHaveTextContent('−3 Dif+3');
    expect(costly).toHaveAccessibleDescription(`Risolve: ${fire.text}. Costa: Difesa scende di 3; Velocità scende di 1`);
    expect(free.querySelector('.coach-rank-cost')).toBeNull();
    expect(free).toHaveAccessibleDescription(`Risolve: ${pivotName}`);
  });

  it('lo stesso primo problema risolto in tre righe o più: detto una volta sopra la lista ("Risolvono tutte"), tolto dalle righe', () => {
    // (le pillole seguono l'ordine dei problemi: qui Acciaio è il primo)
    view(advice([swap('Zapdos', 5, 5, [steel.key, pivot.key]), swap('Rotom-Wash', 4, 4, [steel.key]), swap('Heatran', 1, 3, [steel.key, fire.key])]),
      { coaching: coachingOf([steel, fire, zapdos, pivot]) });
    const lead = rail().querySelector('.coach-rank-lead')!;
    expect(lead).toHaveTextContent('Risolvono tutte:');
    expect(lead).toHaveTextContent('3 membri di tipo Acciaio');
    // Al posto della riga che spiega (stessa altezza)
    expect(rail().querySelector('.coach-diag-sub:not(.coach-rank-lead)')).toBeNull();
    // Le righe senza quella pillola (l'unica: niente "Non risolve problemi"); la descrizione la dice sempre
    expect(railPills()).toEqual([['pivot'], [], ['fire']]);
    expect(ranks()[1]).toHaveAccessibleDescription(`Risolve: ${steel.text}`);
  });

  it('un solo titolo di livello 3 (nascosto) per la scheda; la classifica e la carta coi titoli di livello 4', () => {
    view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 4, [fire.key])]));
    const root = document.querySelector('.coaching')!;
    expect([...root.querySelectorAll('h3')].map(h => h.textContent)).toEqual(['Proposte, dalla più utile']);
    expect(railHead().tagName).toBe('H4');
    expect(band().tagName).toBe('H4');
  });

  it('la tendina "Problema": il testo scelto ricopiato sopra (coi puntini se è lungo), lo stesso della voce', async () => {
    const user = userEvent.setup();
    view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 4, [fire.key])]));
    const shownText = () => rail().querySelector('.coach-filter-shown')!;
    expect(shownText()).toHaveTextContent('Tutti i problemi');
    expect(shownText()).toHaveAttribute('aria-hidden', 'true');
    await user.selectOptions(filter(), fire.key);
    expect(shownText()).toHaveTextContent(filter().selectedOptions[0].textContent!);
  });

  it('Applica applica la proposta, "Vedi nella scheda Pokémon" la apre; il nome dice cosa applica', async () => {
    const user = userEvent.setup();
    const fix = swap('Rotom-Wash', 4, 3, [fire.key]);
    const h = view(advice([fix]));
    await user.click(within(heroOf()).getByRole('button', { name: 'Applica: Rotom-Wash al posto di Magikarp, voto +3' }));
    expect(h.onApplyFix).toHaveBeenLastCalledWith(fix);
    await user.click(within(heroOf()).getByRole('button', { name: 'Vedi nella scheda Pokémon: Rotom-Wash' }));
    expect(h.onFix).toHaveBeenLastCalledWith(fix);
    // Una proposta sola: una riga sola nella classifica, nessuna lista di altre
    expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +3']);
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
    // La parte centrale (Risolve, Costa, Set) scorre; Applica e le azioni stanno fuori, sempre in vista
    const scroll = heroOf().querySelector<HTMLElement>('.coach-hero-scroll')!;
    expect(scroll).toContainElement(set);
    expect(scroll).toContainElement(within(heroOf()).getByRole('region', { name: 'Risolve' }));
    expect(scroll.querySelector('.coach-apply, .coach-see')).toBeNull();
    expect(heroOf().querySelector('.coach-hero-foot .coach-apply')).not.toBeNull();
  });

  it('Copia set: copia il set della proposta per Showdown, "Copiato" sul pulsante e per lo screen reader', async () => {
    const user = userEvent.setup();
    const copied = spyClipboard();
    const fix = swap('Rotom-Wash', 4, 3, [fire.key]);
    view(advice([fix]));
    const copy = within(heroOf()).getByRole('button', { name: 'Copia set' });
    expect(copy).toHaveClass('coach-copy');
    expect(copy.closest('.coach-hero-foot')).not.toBeNull();
    expect(copy).toHaveTextContent(/^Copia set$/);
    expect(within(heroOf()).queryByRole('status')).toBeNull();
    await user.click(copy);
    expect(copied()).toBe(exportShowdown([fix.set]));
    expect(await within(heroOf()).findByRole('status')).toHaveTextContent('Copiato');
    expect(copy).toHaveTextContent(/^Copiato$/);
    expect(copy).toHaveClass('is-done');
  });

  it('Copia set senza appunti: niente "Copiato"', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    view(advice([swap('Rotom-Wash', 4, 3, [fire.key])]));
    await user.click(within(heroOf()).getByRole('button', { name: 'Copia set' }));
    expect(within(heroOf()).queryByRole('status')).toBeNull();
    expect(within(heroOf()).getByRole('button', { name: 'Copia set' })).toHaveTextContent(/^Copia set$/);
  });

  it('la regione viva dice cosa c\'è nella carta e cambia con lei', async () => {
    const user = userEvent.setup();
    view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 4, [fire.key])]));
    expect(live()).toHaveClass('visually-hidden');
    expect(live()).toHaveTextContent('Nella carta: Zapdos al posto di Sunkern, voto +5');
    await user.click(ranks()[1]);
    expect(live()).toHaveTextContent('Nella carta: Rotom-Wash al posto di Magikarp, voto +4');
  });

  describe('alternative', () => {
    const best = swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]);
    const second = swap('Heatran', 4, 3, [fire.key]);
    const third = swap('Volcanion', 4, 2, [fire.key, zapdos.key]);
    const other = swap('Zapdos', 5, 1, [pivot.key]);

    it('stesso membro e stesso problema principale: una carta con "Oppure" e le piccole carte delle altre; nella classifica una riga sola', () => {
      const adv = advice([second, best, third, other]);
      expect(proposalGroups(problems, adv).map(g => g.options.length)).toEqual([3, 1]);
      view(adv);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      const alts = within(heroOf()).getByRole('group', { name: 'Altre 2 proposte per questo posto' });
      expect(alts).toHaveTextContent('Oppure');
      expect(altNames()).toEqual(['Heatran al posto di Magikarp, voto +3', 'Volcanion al posto di Magikarp, voto +2']);
      // Ogni piccola carta col nome di chi entra e il +N
      expect(altTiles().map(t => t.textContent)).toEqual(['Heatran+3', 'Volcanion+2']);
      expect(altMore()).toBeNull();
      expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1']);
      expect(railPills()).toEqual([['fire', 'zapdos'], ['pivot']]);
      // Il problema che nessuno risolve: la riga "Resta 1 problema" in fondo
      expect(stuckLine()).toHaveTextContent('Resta 1 problema che nessun cambio singolo risolve');
    });

    it('un posto senza alternative non ha "Oppure"', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      await user.click(ranks()[1]);
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
      // La carta non mostra più la migliore: "La proposta scelta" e "Torna alla migliore"
      expect(band()).toHaveTextContent('La proposta scelta');
      expect(within(list()).getByRole('button', { name: 'Torna alla migliore' })).toBeInTheDocument();
      // La riga della classifica resta la migliore del posto (+4, coi suoi problemi): un'alternativa cambia solo la carta
      expect(rankNames()[0]).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(ranks()[0].querySelector('.coach-rank-gain')).toHaveTextContent('+4');
      expect(railPills()).toEqual([['fire', 'zapdos'], ['pivot']]);
      expect(ranks()[0]).toHaveAccessibleDescription(`Risolve: ${fire.text}; ${zapdos.text}`);
      expect(ranks()[0]).toHaveAttribute('aria-current', 'true');
      // Zapdos resta risolvibile: non va in "Restano"
      expect(stuckLine()).toHaveTextContent('Resta 1 problema');
      expect([...filter().options].map(o => o.value)).toContain(zapdos.key);
      await user.click(within(heroOf()).getByRole('button', { name: /^Applica: Heatran/ }));
      expect(h.onApplyFix).toHaveBeenLastCalledWith(second);
      await user.click(within(heroOf()).getByRole('button', { name: 'Vedi nella scheda Pokémon: Heatran' }));
      expect(h.onFix).toHaveBeenLastCalledWith(second);
      // "Torna alla migliore": la migliore torna nella carta, col titolo e il fuoco sul titolo
      await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta migliore');
      expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
      await waitFor(() => expect(heroTitle()).toHaveFocus());
    });

    it('la riga di un posto apre la sua migliore: l\'alternativa scelta prima si dimentica', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      await user.click(altTiles()[0]);
      expect(heroName()).toBe('Heatran al posto di Magikarp, voto +3');
      await user.click(ranks()[1]);
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +1');
      await user.click(ranks()[0]);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta migliore');
    });

    it('stesso Pokémon due volte fra le proposte del posto: sotto il nome la riga piccola con cosa cambia (lo strumento)', () => {
      const rotom = mostCommonSet(fixtureStats, 'Rotom-Wash')!;
      const twin: CoachFix = { ...best, set: { ...rotom, item: rotom.item === 'Leftovers' ? 'Choice Scarf' : 'Leftovers' }, gain: 3 };
      view(advice([best, twin, third]));
      const tile = altTiles()[0];
      expect(tile.querySelector('.coach-alt-name')).toHaveTextContent('Rotom-Wash');
      expect(tile.querySelector('.coach-alt-sub')).toHaveTextContent(gameName('item', twin.set.item, 'it'));
      // Un nome che compare una volta sola: niente riga piccola
      expect(altTiles()[1].querySelector('.coach-alt-sub')).toBeNull();
      // "Oppure" scritto sempre
      expect(heroOf().querySelector('.coach-alts-word')).toHaveTextContent('Oppure');
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
      expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1']);
    });

    it('senza una proposta che alza il voto e risolve il suo problema, resta in coda alla classifica', () => {
      const neutral = swap('Incineroar', 3, 0, [steel.key]);
      view(advice([best, other, neutral]));
      expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Zapdos al posto di Sunkern, voto +1', 'Incineroar al posto di Corviknight, voto ±0']);
      expect(railPills()).toEqual([['fire', 'zapdos'], ['pivot'], ['steel']]);
      // Ogni problema ha una proposta: niente "Restano"
      expect(stuckLine()).toBeNull();
    });
  });

  it('cambio di mossa: la mossa nuova protagonista, "Su X", la vecchia barrata, nel set la mossa nuova segnata; Applica e "Apri il set"', async () => {
    const user = userEvent.setup();
    const tusk: TeamSet = { ...six[0], moves: [six[0].moves[0], 'Knock Off', six[0].moves[2], six[0].moves[3]] };
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: tusk, reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [zapdos.key], after: before };
    const empty: MoveFix = { ...move, index: 1, member: 'Gholdengo', set: six[1], slot: 3, from: '', to: 'Thunderbolt', gain: 1, solves: [pivot.key] };
    const h = view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move, empty]));
    expect(heroName()).toBe('Knock Off al posto di Rapid Spin su Great Tusk, voto +4');
    expect(rankNames()).toEqual(['Knock Off al posto di Rapid Spin su Great Tusk, voto +4', 'Rotom-Wash al posto di Magikarp, voto +2', 'Thunderbolt in uno slot libero su Gholdengo, voto +1']);
    const hero = heroOf();
    expect(hero).toHaveClass('is-move');
    const title = hero.querySelector('.coach-hero-title.is-move')!;
    expect(title.querySelector('.coach-move-in')).toHaveTextContent('Knock Off');
    expect(title.querySelector('.coach-hero-name')).toHaveTextContent('Su Great Tusk');
    expect(title).toHaveTextContent('cambio di mossa');
    // A sinistra la mossa che esce (grigia e barrata), a destra il membro sulla pedana con la mossa nuova
    const vs = hero.querySelector('.coach-vs')!;
    expect(vs).toHaveClass('is-move');
    expect(vs.querySelector('.coach-vs-side.is-out .coach-move-out')).toHaveTextContent(gameName('move', 'Rapid Spin', 'it'));
    expect(vs.querySelector('.coach-vs-side.is-out .coach-vs-label')).toHaveTextContent('esce');
    expect(vs.querySelector('.coach-vs-side.is-in .coach-art-in .sprite')).not.toBeNull();
    // Nel set: le quattro mosse, la nuova (slot 1) segnata
    const moves = [...hero.querySelectorAll('.coach-set-moves li')];
    expect(moves).toHaveLength(4);
    expect(moves.map(li => li.classList.contains('is-new'))).toEqual([false, true, false, false]);
    expect(moves[1]).toHaveTextContent(gameName('move', 'Knock Off', 'it'));
    // Nella classifica la mossa è segnata come tale: la mossa nuova, "su X, al posto di Y"
    expect(ranks().map(c => c.classList.contains('is-move'))).toEqual([true, false, true]);
    expect(ranks()[0].querySelector('.coach-rank-who b')).toHaveTextContent(gameName('move', 'Knock Off', 'it'));
    expect(ranks()[0]).toHaveTextContent('su Great Tusk, al posto di Rapid Spin');
    expect(ranks()[2]).toHaveTextContent('su Gholdengo, al posto di slot libero');
    // Un cambio di mossa non ha un Pokémon che esce
    expect(hero.querySelector('.coach-vs-out-name, .coach-art-out')).toBeNull();
    await user.click(within(hero).getByRole('button', { name: /^Applica: Knock Off/ }));
    expect(h.onApplyMove).toHaveBeenLastCalledWith(move);
    await user.click(within(hero).getByRole('button', { name: 'Apri il set: Great Tusk' }));
    expect(h.onMoveFix).toHaveBeenLastCalledWith(move);
    // Uno slot libero: "slot libero" al posto della mossa vecchia
    await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Thunderbolt in uno slot libero su Gholdengo, voto +1' }));
    expect(heroOf().querySelector('.coach-vs-free.is-slot')).toHaveTextContent('slot libero');
    expect(heroOf().querySelector('.coach-move-out')).toBeNull();
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
    expect(ranks()[0].querySelector('.coach-rank-gain')).toHaveTextContent('+6');
    await user.click(ranks()[1]);
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
      // Il filtro è su quel problema (la tendina lo mostra), con "Mostra tutte"
      expect(filter()).toHaveValue(pivot.key);
      expect(filter().selectedOptions[0]).toHaveTextContent(pivotName);
      const bar = rail().querySelector<HTMLElement>('.coach-filter')!;
      expect(bar).toHaveClass('is-on');
      expect(within(bar).getByRole('button', { name: 'Mostra tutte' })).toBeInTheDocument();
      // Solo le proposte che lo risolvono, senza "Restano"
      expect(rankNames()).toEqual(['Dragonite al posto di Sunkern, voto +4']);
      expect(railPills()).toEqual([['pivot']]);
      expect(ranks()[0]).toHaveAttribute('aria-current', 'true');
      expect(stuckLine()).toBeNull();
      expect(railHead()).toHaveTextContent(/^Proposte1 cambio$/);
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
    // Senza misura (jsdom) quattro righe scheletro, nessuna riga vera, nessun numero
    expect(busy.querySelectorAll('li.coach-rank-skeleton')).toHaveLength(4);
    expect(busy.querySelectorAll('li.coach-rank-skeleton[aria-hidden="true"]')).toHaveLength(4);
    expect(rail().querySelector('.coach-rank')).toBeNull();
    expect(rail().querySelector('.coach-diag-total')).toBeNull();
    expect(railHead()).toHaveTextContent(/^Proposte$/);
    expect(screen.getByRole('status')).toHaveTextContent('Calcolo dei consigli…');
    expect(live()).toHaveTextContent(/^$/);
  });

  it('le aree senza problemi in una riga verde sotto la classifica', () => {
    renderIt(<CoachingView coaching={coachingOf([zapdos])} advice={advice([swap('Rotom-Wash', 4, 2, [zapdos.key])])} members={6} rating={rating} {...noop} />);
    const clean = rail().querySelector('.coach-clean')!;
    expect(clean).toHaveTextContent(`Già a posto: Offesa ${Math.round(before.strength!)} · Ruoli`);
    expect(clean).not.toHaveTextContent('Difesa');
  });

  describe('classifica', () => {
    const slow: CoachProblem = { severity: 'minor', category: 'redundancy', text: 'Due membri lenti', fixes: [], key: 'redundancy:slow' };
    const hit: CoachProblem = { severity: 'minor', category: 'metaHit', text: 'Senza risposta in attacco contro Dragonite', fixes: [], key: 'metaHit:Dragonite', subjects: ['Dragonite'] };
    const ranked = () => view(advice([swap('Zapdos', 5, 5, [pivot.key, steel.key]), swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]), swap('Heatran', 1, 1, [fire.key])]),
      { coaching: coachingOf([...problems, slow, hit]) });

    it('una riga per proposta nell\'ordine dei gruppi, coi problemi che risolve in piccolo (tutti, anche quelli già risolti da un\'altra); niente più blocchi', () => {
      ranked();
      expect(rankNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Rotom-Wash al posto di Magikarp, voto +4', 'Heatran al posto di Gholdengo, voto +1']);
      expect(railPills()).toEqual([['pivot', 'steel'], ['fire', 'zapdos'], ['fire']]);
      // Le pillole: la minaccia col suo nome, il tipo col nome italiano, il ruolo, il resto in testo corto
      const [zapdosRow, rotomRow] = ranks();
      expect(rotomRow.querySelectorAll('.coach-pill')[0]).toHaveTextContent('Fire');
      expect(rotomRow.querySelectorAll('.coach-pill')[1]).toHaveTextContent('Zapdos');
      expect(zapdosRow.querySelectorAll('.coach-pill')[0]).toHaveTextContent(pivotName);
      expect(zapdosRow.querySelectorAll('.coach-pill')[1]).toHaveTextContent('3 membri di tipo Acciaio');
      expect(rail().querySelector('.coach-pill-more')).toBeNull();
      // Allo screen reader la riga dice tutti i problemi che risolve, coi testi interi
      expect(rotomRow).toHaveAccessibleDescription(`Risolve: ${fire.text}; ${zapdos.text}`);
      expect(rotomRow.querySelector('.coach-rank-pills')).toHaveAttribute('aria-hidden', 'true');
      // Niente più testate di blocco, problemi come pulsanti, note
      expect(rail().querySelector('.coach-diag-item, .coach-diag-cure, .coach-diag-note, li.is-note, li.is-stuck')).toBeNull();
      expect(within(rail()).queryByText('Risolve problemi già scritti sopra')).toBeNull();
      expect(within(rail()).queryByText('Restano: nessun cambio singolo li risolve')).toBeNull();
      expect(within(rail()).getAllByRole('button').filter(b => b.classList.contains('coach-rank'))).toHaveLength(3);
    });

    it('più di due problemi risolti: i primi due in piccolo e "+N"; la descrizione li dice tutti', () => {
      view(advice([swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key, pivot.key, steel.key])]));
      expect(railPills()).toEqual([['fire', 'zapdos', '+2']]);
      expect(ranks()[0].querySelectorAll('.coach-pill')).toHaveLength(2);
      expect(ranks()[0]).toHaveAccessibleDescription(`Risolve: ${fire.text}; ${zapdos.text}; ${pivotName}; ${steel.text}`);
    });

    it('le debolezze in comune non sono fra le pillole', () => {
      const shared: CoachProblem = { severity: 'minor', category: 'redundancy', text: '3 membri deboli a Terra', fixes: [], key: 'redundancy:sharedWeak:Ground' };
      view(advice([swap('Rotom-Wash', 4, 3, [shared.key, fire.key])]), { coaching: coachingOf([shared, fire]) });
      expect(railPills()).toEqual([['fire']]);
      expect(ranks()[0]).toHaveAccessibleDescription(`Risolve: ${fire.text}`);
      expect([...filter().options].map(o => o.value)).toEqual(['', fire.key]);
    });

    it('in fondo "Restano N problemi" che nessun cambio singolo risolve: raggiungibile col Tab, i nomi nel fumetto e per lo screen reader', () => {
      ranked();
      const line = stuckLine()!;
      expect(line).toHaveTextContent(/^Restano 2 problemi che nessun cambio singolo risolve/);
      expect(line.closest('.coach-diag-foot')).not.toBeNull();
      expect(line).toHaveAttribute('tabindex', '0');
      expect(line).toHaveAttribute('data-hint', `${slow.text}; ${hit.text}`);
      expect(line.querySelector('.visually-hidden')).toHaveTextContent(`: ${slow.text}; ${hit.text}`);
      // I problemi senza cura non sono nel filtro
      expect([...filter().options].map(o => o.value)).not.toContain(slow.key);
    });

    it('il filtro "Problema": "Tutti i problemi" e un problema per riga (quelli che un cambio risolve), col nome corto del problema', () => {
      ranked();
      const select = filter();
      expect(select.closest('.coach-filter')).not.toHaveClass('is-on');
      expect(select).toHaveValue('');
      expect([...select.options].map(o => o.value)).toEqual(['', fire.key, zapdos.key, pivot.key, steel.key]);
      // Ogni voce è il nome corto del problema (sta su una riga): il tipo, la minaccia, i ruoli, il resto col suo testo
      expect([...select.options].map(o => o.textContent)).toEqual(['Tutti i problemi', `${typeName('Fire', 'it')}: nessuno lo regge`, 'Zapdos: scoperta', pivotName, steel.text]);
      expect(within(rail()).queryByRole('button', { name: 'Mostra tutte' })).toBeNull();
    });

    it('il clic su un\'altra riga la porta nella carta (anello), "Torna alla migliore" riporta la prima', async () => {
      const user = userEvent.setup();
      ranked();
      expect(ranks()[0]).toHaveClass('is-open');
      await user.click(within(rail()).getByRole('button', { name: 'Apri nella carta: Rotom-Wash al posto di Magikarp, voto +4' }));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta scelta');
      expect(ranks()[1]).toHaveClass('is-open');
      expect(ranks()[1]).toHaveAttribute('aria-current', 'true');
      expect(ranks()[0]).not.toHaveClass('is-open');
      await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    });

    it('scelto un problema nel filtro, solo le proposte che lo risolvono; "Tutti i problemi" o "Mostra tutte" le riportano tutte e il fuoco sul titolo della carta', async () => {
      const user = userEvent.setup();
      ranked();
      await user.selectOptions(filter(), fire.key);
      expect(filter()).toHaveValue(fire.key);
      expect(rail().querySelector('.coach-filter')).toHaveClass('is-on');
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta migliore');
      expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Heatran al posto di Gholdengo, voto +1']);
      expect(railPills()).toEqual([['fire', 'zapdos'], ['fire']]);
      expect(railHead()).toHaveTextContent(/^Proposte2 cambi$/);
      // Col filtro niente "Restano"
      expect(stuckLine()).toBeNull();
      expect(within(rail()).getByRole('button', { name: 'Mostra tutte' })).toBeInTheDocument();
      // "Tutti i problemi": tutte
      await user.selectOptions(filter(), '');
      expect(rail().querySelector('.coach-filter')).not.toHaveClass('is-on');
      expect(within(rail()).queryByRole('button', { name: 'Mostra tutte' })).toBeNull();
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
      expect(rankNames()).toHaveLength(3);
      expect(stuckLine()).not.toBeNull();
      // "Mostra tutte" accanto al filtro: sparisce, il fuoco va sul titolo della carta
      await user.selectOptions(filter(), steel.key);
      expect(rankNames()).toEqual(['Zapdos al posto di Sunkern, voto +5']);
      await user.click(within(rail()).getByRole('button', { name: 'Mostra tutte' }));
      expect(within(rail()).queryByRole('button', { name: 'Mostra tutte' })).toBeNull();
      expect(filter()).toHaveValue('');
      expect(rankNames()).toHaveLength(3);
      await waitFor(() => expect(heroTitle()).toHaveFocus());
      expect(heroTitle()).toHaveAttribute('tabindex', '-1');
      expect(heroTitle()).toHaveAccessibleName(heroName());
      // Un filtro su un problema che risolve solo la seconda: la carta va su di lei
      await user.selectOptions(filter(), zapdos.key);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(rankNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4']);
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
      // Il fuoco sulla chiusura; il Tab (avanti e indietro) resta nella finestra
      const close = within(dialog).getByRole('button', { name: 'Chiudi' });
      expect(close).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
      await user.tab({ shift: true });
      expect(close).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(help).toHaveFocus();
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

  it('problemi che nessuna proposta risolve: Eevee sdraiato a terra, i problemi che restano e Migliora i set', async () => {
    const user = userEvent.setup();
    const h = view(advice([]));
    expect(screen.getByRole('heading', { name: 'Nessun cambio singolo li risolve' })).toBeInTheDocument();
    expect(screen.getByText('Restano questi problemi, ma un solo cambio (di Pokémon o di mossa) non basta.')).toBeInTheDocument();
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

  it('coi consigli veri: ogni gruppo del motore compare (riga della classifica, alternative), nell\'ordine e col +N del motore', async () => {
    const user = userEvent.setup();
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const adv = adviceOf(six, DEFAULT_FORMAT, data);
    const groups = neutralAsAlternatives(proposalGroups(coaching.problems, adv));
    expect(groups.length).toBeGreaterThan(0);
    renderIt(<CoachingView coaching={coaching} advice={adv} members={6} rating={rateTeam(six, data, 'it')} {...noop} />);
    expect(railHead()).toHaveTextContent(groups.length === 1 ? 'Proposte1 cambio' : `Proposte${groups.length} cambi`);
    expect(heroOf()).toHaveAttribute('data-row', groups[0].id);
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent(gainText(groups[0].options[0].fix.gain));
    expect(ranks()).toHaveLength(groups.length);
    expect(ranks().map(c => c.querySelector('.coach-rank-gain')!.textContent)).toEqual(groups.map(g => gainText(g.options[0].fix.gain)));
    // Ogni riga dice allo screen reader cosa risolve (o che alza solo il voto)
    for (const row of ranks()) expect(row).toHaveAccessibleDescription(/^(Risolve: .+|Non risolve problemi: alza il voto)$/);
    // Il filtro: ogni problema risolto da una proposta una volta sola
    const values = [...filter().options].map(o => o.value).slice(1);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every(key => groups.some(g => g.options.some(o => o.fix.solves.includes(key))))).toBe(true);
    // Aperta ogni riga, la carta è quel gruppo e le piccole carte sono le sue alternative
    for (let i = 0; i < groups.length; i++) {
      await user.click(ranks()[i]);
      expect(heroOf()).toHaveAttribute('data-row', groups[i].id);
      expect(heroOf().querySelector('.coach-gain')).toHaveTextContent(gainText(groups[i].options[0].fix.gain));
      // Al più tre piccole carte in vista; le altre dietro "altre N"
      expect(altTiles().length).toBe(Math.min(3, groups[i].options.length - 1));
      await allAlts(user);
      expect(altTiles().map(t => t.querySelector('b')!.textContent)).toEqual(groups[i].options.slice(1).map(o => gainText(o.fix.gain)));
    }
  });
  describe('Oppure: le alternative col nome, al più tre in vista', () => {
    const five = [swap('Rotom-Wash', 4, 6, [fire.key]), swap('Heatran', 4, 5, [fire.key]), swap('Volcanion', 4, 4, [fire.key]), swap('Zapdos', 4, 3, [fire.key]), swap('Clefable', 4, 2, [fire.key])];

    it('le prime tre col nome e il +N, poi "altre N": un clic le mostra tutte (aria-expanded), un altro le richiude', async () => {
      const user = userEvent.setup();
      view(advice(five));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +6');
      expect(altTiles().map(t => t.textContent)).toEqual(['Heatran+5', 'Volcanion+4', 'Zapdos+3']);
      // Il gruppo dice quante sono tutte, anche quelle nascoste
      expect(within(heroOf()).getByRole('group', { name: 'Altre 4 proposte per questo posto' })).toBeInTheDocument();
      const more = altMore()!;
      expect(more).toHaveTextContent(/^altre 1$/);
      expect(more).toHaveAttribute('aria-expanded', 'false');
      expect(more).toHaveAccessibleName('Mostra altre 1 proposte per questo posto');
      await user.click(more);
      expect(altTiles().map(t => t.textContent)).toEqual(['Heatran+5', 'Volcanion+4', 'Zapdos+3', 'Clefable+2']);
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(more).toHaveTextContent(/^meno$/);
      expect(more).toHaveAccessibleName('Mostra meno proposte');
      // Da tastiera: Invio richiude
      more.focus();
      await user.keyboard('{Enter}');
      expect(altTiles()).toHaveLength(3);
      expect(more).toHaveAttribute('aria-expanded', 'false');
      // Un'alternativa nascosta, mostrata e scelta, va nella carta
      await user.click(more);
      await user.click(within(heroOf()).getByRole('button', { name: 'Metti nella carta: Clefable al posto di Magikarp, voto +2' }));
      expect(heroName()).toBe('Clefable al posto di Magikarp, voto +2');
    });

    it('con tre alternative o meno niente "altre"', () => {
      view(advice(five.slice(0, 4)));
      expect(altTiles()).toHaveLength(3);
      expect(altMore()).toBeNull();
    });

    it('un\'alternativa di mossa mostra la mossa nuova col +N', () => {
      const tusk: TeamSet = { ...six[0], moves: [six[0].moves[0], 'Knock Off', six[0].moves[2], six[0].moves[3]] };
      const a: MoveFix = { index: 0, member: 'Great Tusk', set: tusk, reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [zapdos.key], after: before };
      const b: MoveFix = { ...a, set: { ...tusk, moves: [tusk.moves[0], 'Ice Spinner', tusk.moves[2], tusk.moves[3]] }, to: 'Ice Spinner', gain: 2 };
      view(advice([], [a, b]));
      expect(altTiles().map(t => t.textContent)).toEqual([`${gameName('move', 'Ice Spinner', 'it')}+2`]);
      expect(altTiles()[0]).toHaveClass('is-move');
    });
  });

  it('un ruolo risolto: nella riga e nella carta solo il nome del ruolo con la spunta verde, senza ×', () => {
    view(advice([swap('Zapdos', 5, 5, [pivot.key])]));
    const pill = ranks()[0].querySelector('.coach-pill')!;
    expect(pill).toHaveTextContent(pivotName);
    expect(pill.querySelectorAll('.icon')).toHaveLength(1);
    const solved = within(heroOf()).getByRole('region', { name: 'Risolve' }).querySelector('li.coach-solved')!;
    expect(solved).toHaveTextContent(pivotName);
    expect(solved.querySelectorAll('.icon')).toHaveLength(1);
  });

  it('i testi: sotto il titolo "Un cambio per ogni posto", "Non risolve problemi: alza il voto" in tenue, il voto senza problemi', () => {
    view(advice([swap('Zapdos', 4, 3, [])]));
    expect(rail().querySelector('.coach-diag-sub')).toHaveTextContent('Un cambio per ogni posto: le alternative sono nella carta');
    expect(ranks()[0].querySelector('.coach-pill-none')).toHaveTextContent('Non risolve problemi: alza il voto');
    expect(within(heroOf()).getByRole('region', { name: 'Risolve' }).querySelector('.coach-fact-none')).toHaveTextContent('Non risolve problemi: alza il voto');
  });

  describe('Piano', () => {
    // Il team di prova: Magikarp (4) e Sunkern (5) sono deboli, ogni cambio su di loro alza il voto vero
    const zap = swap('Zapdos', 4, 5, [fire.key]);
    // Stesso posto di Zapdos (Magikarp): non può stare nel piano con lui
    const heat = swap('Heatran', 4, 4, [zapdos.key]);
    const rotom = swap('Rotom-Wash', 5, 3, [pivot.key]);
    const real = (team: TeamSet[]) => rateTeam(team, data, 'it')!;
    const withSet = (team: TeamSet[], index: number, set: TeamSet) => team.map((m, i) => (i === index ? set : m));
    const plan = () => list().querySelector<HTMLElement>('nav.coach-plan');
    const planView = (fixes: CoachFix[], moves: MoveFix[] = []) => view(advice(fixes, moves), { team: six, data });
    /** Aspetta il calcolo del Piano (dopo il primo disegno). */
    const settle = () => act(() => new Promise<void>(resolve => { setTimeout(resolve, 30); }));

    it('i cambi migliori da fare insieme, uno per posto (Heatran salta: stesso posto di Zapdos), col voto vero dopo ognuno', async () => {
      planView([zap, heat, rotom]);
      const strip = await waitFor(() => { const el = plan(); expect(el).not.toBeNull(); return el!; });
      expect(strip).toHaveAccessibleName('Piano: i cambi migliori da fare insieme');
      const steps = [...strip.querySelectorAll<HTMLButtonElement>('button.coach-plan-step')];
      expect(steps.map(b => b.querySelector('.coach-plan-who b')!.textContent)).toEqual(['Zapdos', 'Rotom-Wash']);
      expect(steps.map(b => b.querySelector('.coach-plan-n')!.textContent)).toEqual(['1', '2']);
      expect(steps[0].querySelector('.coach-plan-who small')).toHaveTextContent('al posto di Magikarp');
      // Il voto vero (rateTeam) col primo cambio, poi coi due insieme
      const one = real(withSet(six, 4, zap.set));
      const two = real(withSet(withSet(six, 4, zap.set), 5, rotom.set));
      expect(one.overall).toBeGreaterThan(rating.overall);
      expect(two.overall).toBeGreaterThan(one.overall);
      expect(strip.querySelector('.coach-plan-path')).toHaveTextContent(`${rating.grade} ${rating.overall} → ${one.grade} ${one.overall} → ${two.grade} ${two.overall}`);
      expect(strip.querySelector('.coach-plan-path .coach-grade-tag.is-last')).toHaveClass(`grade-${two.grade}`);
      expect(strip.querySelector('.coach-plan-after')).toHaveTextContent('dopo 2 cambi');
      expect(strip.querySelector('.coach-plan-grade .visually-hidden')).toHaveTextContent(`Voto: ${rating.grade} ${rating.overall} → ${one.grade} ${one.overall} → ${two.grade} ${two.overall}`);
      expect(steps[1]).toHaveAccessibleName(`Passo 2: Rotom-Wash al posto di Sunkern, voto +3. Voto dopo: ${two.grade} ${two.overall}. Apri nella carta`);
      // Il Piano sta sopra la carta, non dentro
      expect(heroOf().contains(strip)).toBe(false);
    });

    it('un clic su un passo lo apre nella carta grande ("La proposta scelta"), anche fuori dal filtro', async () => {
      const user = userEvent.setup();
      planView([zap, heat, rotom]);
      await waitFor(() => expect(plan()).not.toBeNull());
      await user.click(within(plan()!).getByRole('button', { name: /^Passo 2: Rotom-Wash/ }));
      expect(heroName()).toBe('Rotom-Wash al posto di Sunkern, voto +3');
      expect(band()).toHaveTextContent('La proposta scelta');
      // Col filtro su un problema che Rotom-Wash non risolve: il filtro si toglie e Rotom-Wash va nella carta
      await user.selectOptions(filter(), fire.key);
      expect(rankNames()).toEqual(['Zapdos al posto di Magikarp, voto +5']);
      await user.click(within(plan()!).getByRole('button', { name: /^Passo 2: Rotom-Wash/ }));
      expect(filter()).toHaveValue('');
      expect(heroName()).toBe('Rotom-Wash al posto di Sunkern, voto +3');
    });

    it('un cambio di mossa sul membro che un passo sostituisce non entra nel piano', async () => {
      const kar: TeamSet = { ...six[4], moves: ['Splash', 'Tackle'] };
      const move: MoveFix = { index: 4, member: 'Magikarp', set: kar, reduces: [], slot: 1, from: '', to: 'Tackle', gain: 4, solves: [zapdos.key], after: before };
      planView([zap, rotom], [move]);
      const strip = await waitFor(() => { const el = plan(); expect(el).not.toBeNull(); return el!; });
      expect([...strip.querySelectorAll('.coach-plan-who b')].map(b => b.textContent)).toEqual(['Zapdos', 'Rotom-Wash']);
    });

    it('con meno di due passi niente Piano (due proposte sullo stesso posto, o una sola)', async () => {
      planView([zap, heat]);
      await settle();
      expect(plan()).toBeNull();
      cleanup();
      planView([zap]);
      await settle();
      expect(plan()).toBeNull();
    });

    it('senza team e dati (la vista da sola) niente Piano', async () => {
      view(advice([zap, heat, rotom]));
      await settle();
      expect(plan()).toBeNull();
    });
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
