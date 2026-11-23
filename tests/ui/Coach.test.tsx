import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { coachTeam, type CoachAdvice, type Coaching, type CoachProblem } from '../../src/engine/coach';
import type { CoachFix } from '../../src/engine/coachFixes';
import { neutralAsAlternatives, proposalGroups } from '../../src/engine/coachProposals';
import type { MoveFix } from '../../src/engine/moveFixes';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { areaSnapshot, type AreaSnapshot } from '../../src/engine/teamGain';
import { emptySet, exportShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
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
/** I pulsanti delle righe sotto la carta (pagina corrente). */
const rowButtons = () => [...proposals().querySelectorAll<HTMLButtonElement>('.coach-item-btn')];
/** I nomi delle proposte nelle righe della pagina ("Apri: " tolto). */
const rowNames = () => rowButtons().map(b => b.getAttribute('aria-label')!.replace(/^Apri: /, ''));
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
 * righe sfogliando le pagine (un clic la apre); in ultimo le alternative di ogni riga. Torna la carta grande.
 */
async function findRow(user: ReturnType<typeof userEvent.setup>, pattern: RegExp): Promise<HTMLElement> {
  const inHero = async () => {
    if (pattern.test(heroName())) return true;
    const tile = altTiles().find((_, i) => pattern.test(altNames()[i]));
    if (tile) { await user.click(tile); return true; }
    return false;
  };
  if (await inHero()) return heroOf();
  const first = () => within(proposals()).queryByRole<HTMLButtonElement>('button', { name: 'Proposte precedenti' });
  const next = () => within(proposals()).queryByRole<HTMLButtonElement>('button', { name: 'Proposte successive' });
  for (let page = 0; page < 30; page++) {
    const button = rowButtons().find((_, i) => pattern.test(rowNames()[i]));
    if (button) { await user.click(button); return heroOf(); }
    const n = next();
    if (!n || n.disabled) break;
    await user.click(n);
  }
  // Fra le alternative delle altre righe: si aprono una per una, dalla prima pagina
  while (first() && !first()!.disabled) await user.click(first()!);
  const seen = new Set<string>();
  for (let tries = 0; tries < 60; tries++) {
    const button = rowButtons().find(b => !seen.has(b.getAttribute('aria-label')!));
    if (!button) {
      const n = next();
      if (!n || n.disabled) break;
      await user.click(n);
      continue;
    }
    seen.add(button.getAttribute('aria-label')!);
    await user.click(button);
    seen.add(`Apri: ${heroName()}`);
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
  it('dalla più utile: la carta grande ha il +N più alto, le righe sotto non salgono, al più 4 per pagina', async () => {
    const user = await openCoaching(six);
    const top = gainOf(heroName());
    const gains: number[] = [];
    for (let page = 0; page < 30; page++) {
      const names = rowNames();
      expect(names.length).toBeLessThanOrEqual(4);
      gains.push(...names.map(gainOf));
      const next = within(proposals()).queryByRole('button', { name: 'Proposte successive' });
      if (!next || (next as HTMLButtonElement).disabled) break;
      await user.click(next);
    }
    expect(gains.length).toBeGreaterThan(0);
    expect(gains.every(g => g <= top)).toBe(true);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
    // Niente più mappa dei problemi né tappe numerate
    expect(within(analysis()).queryByText('Problemi per area')).toBeNull();
    expect(analysis().querySelector('.coach-step-num, .coach-map')).toBeNull();
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
  const othersHead = () => list().querySelector('.coach-list .coach-list-head h4')!;
  const six6 = ['Zapdos', 'Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable', 'Dragonite'];
  /** La colonna "Da sistemare" a sinistra. */
  const rail = () => screen.getByRole('complementary', { name: /^Da sistemare/ });
  /** Il pulsante di un problema nella colonna, dal suo testo. */
  const railItem = (text: string) => [...rail().querySelectorAll<HTMLButtonElement>('.coach-diag-item:not(.is-all)')].find(b => b.textContent!.includes(text))!;
  const allButton = () => within(rail()).getByRole('button', { name: /^Tutte le proposte/ });

  it('a pari voto "±0", mai "+0"', () => {
    expect([gainText(3), gainText(0), gainText(-2)]).toEqual(['+3', '±0', '−2']);
  });

  it('la migliore nella carta grande, le altre in righe dalla più utile; nomi "X al posto di Y, voto +N"; quante sono nel titolo', () => {
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    expect(band()).toHaveTextContent('La proposta migliore');
    expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
    expect(within(list()).getByRole('article', { name: 'Zapdos al posto di Sunkern, voto +5' })).toBeInTheDocument();
    expect(heroOf().querySelector('.coach-hero-name')).toHaveTextContent('Zapdos');
    expect(heroOf().querySelector('.coach-plate')).toHaveTextContent('Al posto diSunkern');
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent('+5');
    expect(heroOf().querySelector('.coach-grade-change')).toHaveTextContent(`${rating.grade} ${rating.overall}`);
    expect(rowNames()).toEqual(['Heatran al posto di Gholdengo, voto +3', 'Rotom-Wash al posto di Magikarp, voto +2']);
    expect(othersHead()).toHaveTextContent('Altre proposte2');
    // Pochi: nessuna pagina
    expect(within(list()).queryByRole('navigation')).toBeNull();
  });

  it('un clic su una riga la porta nella carta grande ("La proposta scelta"); "Torna alla migliore" riporta la prima', async () => {
    const user = userEvent.setup();
    view(advice([swap('Rotom-Wash', 4, 2, [fire.key]), swap('Zapdos', 5, 5, [pivot.key]), swap('Heatran', 1, 3, [steel.key])]));
    await user.click(within(list()).getByRole('button', { name: 'Apri: Rotom-Wash al posto di Magikarp, voto +2' }));
    expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +2');
    expect(band()).toHaveTextContent('La proposta scelta');
    // La migliore torna fra le righe, al suo posto (in testa)
    expect(rowNames()).toEqual(['Zapdos al posto di Sunkern, voto +5', 'Heatran al posto di Gholdengo, voto +3']);
    await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
    expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    expect(band()).toHaveTextContent('La proposta migliore');
    expect(within(list()).queryByRole('button', { name: 'Torna alla migliore' })).toBeNull();
  });

  it('il magenta solo su Applica della carta grande, una volta sola (le righe non hanno Applica)', async () => {
    const user = userEvent.setup();
    view(advice(six6.map((s, i) => swap(s, i, 9 - i, [fire.key]))));
    const primary = () => document.querySelectorAll('.coach-apply.is-primary');
    expect(primary()).toHaveLength(1);
    expect(heroOf().contains(primary()[0])).toBe(true);
    expect(document.querySelectorAll('.coach-apply')).toHaveLength(1);
    await user.click(within(list()).getByRole('button', { name: 'Proposte successive' }));
    expect(primary()).toHaveLength(1);
    await user.click(rowButtons()[0]);
    expect(primary()).toHaveLength(1);
    expect(heroOf().contains(primary()[0])).toBe(true);
  });

  it('pagine da 4 righe: "‹ 1/2 ›" coi nomi per lo screen reader, avanti e indietro', async () => {
    const user = userEvent.setup();
    view(advice(six6.map((s, i) => swap(s, i, 9 - i, [fire.key]))));
    const pages = within(list()).getByRole('navigation', { name: 'Pagine delle proposte' });
    expect(pages).toHaveTextContent('1/2');
    expect(pages).toHaveTextContent('Proposte da 1 a 4');
    expect(within(pages).getByRole('button', { name: 'Proposte precedenti' })).toBeDisabled();
    // La migliore (Zapdos) è nella carta: le righe partono dalla seconda
    expect(rowNames().map(n => n.split(' ')[0])).toEqual(['Heatran', 'Rotom-Wash', 'Landorus-Therian', 'Clefable']);
    await user.click(within(pages).getByRole('button', { name: 'Proposte successive' }));
    expect(rowNames().map(n => n.split(' ')[0])).toEqual(['Dragonite']);
    expect(pages).toHaveTextContent('2/2');
    expect(pages).toHaveTextContent('Proposte da 5 a 5');
    expect(within(pages).getByRole('button', { name: 'Proposte successive' })).toBeDisabled();
    await user.click(within(pages).getByRole('button', { name: 'Proposte precedenti' }));
    expect(pages).toHaveTextContent('1/2');
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

  it('un\'area che sale senza problemi risolti: "alza solo il voto" e la sua riga "da → a"; nelle righe la prima area che sale', async () => {
    const off = Math.round(before.strength!);
    const def = Math.round(before.defense!);
    view(advice([swap('Zapdos', 4, 3, [], { strength: off + 2 }), swap('Heatran', 1, 2, [], { defense: def + 1 })]));
    const solves = within(heroOf()).getByRole('region', { name: 'Risolve' });
    expect(solves).toHaveTextContent('Nessun problema: alza solo il voto');
    expect(solves.querySelector('li.coach-solved')).toBeNull();
    expect(solves.querySelector('.coach-change b')).toHaveTextContent('Offesa');
    expect(solves.querySelector('.coach-change .coach-to')).toHaveTextContent(String(off + 2));
    const [row] = list().querySelectorAll('li.coach-item');
    expect(row.querySelector('.coach-marks')).toBeNull();
    expect(row.querySelector('.coach-change b')).toHaveTextContent('Difesa');
  });

  it('nelle righe: la spunta con quanti problemi risolve (il testo per lo screen reader) e "Costa" quando un\'area scende', () => {
    const def = Math.round(before.defense!);
    view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 3, [fire.key, zapdos.key], { defense: def - 2 })]));
    const [row] = list().querySelectorAll('li.coach-item');
    const marks = row.querySelector('.coach-marks')!;
    expect(marks.querySelector('.coach-marks-n')).toHaveTextContent('2');
    expect(marks.querySelector('.visually-hidden')).toHaveTextContent(/^Risolve: .*Fire.*; .*Zapdos/);
    expect(row.querySelector('.coach-item-cost')).toHaveTextContent('CostaDifesa');
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
    // Una proposta sola: nessun'altra
    expect(within(list()).getByText('Nessun\'altra proposta')).toBeInTheDocument();
  });

  describe('alternative', () => {
    const best = swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]);
    const second = swap('Heatran', 4, 3, [fire.key]);
    const third = swap('Volcanion', 4, 2, [fire.key, zapdos.key]);
    const other = swap('Zapdos', 5, 1, [pivot.key]);

    it('stesso membro e stesso problema principale: una carta con "Oppure" e le piccole carte delle altre; le righe senza', () => {
      const adv = advice([second, best, third, other]);
      expect(proposalGroups(problems, adv).map(g => g.options.length)).toEqual([3, 1]);
      view(adv);
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      const alts = within(heroOf()).getByRole('group', { name: 'Altre 2 proposte per questo posto' });
      expect(alts).toHaveTextContent('Oppure');
      expect(altNames()).toEqual(['Heatran al posto di Magikarp, voto +3', 'Volcanion al posto di Magikarp, voto +2']);
      expect(altTiles().map(t => t.textContent)).toEqual(['+3', '+2']);
      expect(rowNames()).toEqual(['Zapdos al posto di Sunkern, voto +1']);
    });

    it('un posto senza alternative non ha "Oppure"', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      await user.click(rowButtons()[0]);
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +1');
      expect(heroOf().querySelector('.coach-alts')).toBeNull();
    });

    it('scegliere un\'alternativa la mette nella carta (nome, +N) e Applica applica quella; la migliore va fra le piccole carte', async () => {
      const user = userEvent.setup();
      const h = view(advice([second, best, third, other]));
      await user.click(within(heroOf()).getByRole('button', { name: 'Metti nella carta: Heatran al posto di Magikarp, voto +3' }));
      expect(heroName()).toBe('Heatran al posto di Magikarp, voto +3');
      expect(heroOf().querySelector('.coach-gain')).toHaveTextContent('+3');
      expect(altNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +4', 'Volcanion al posto di Magikarp, voto +2']);
      await user.click(within(heroOf()).getByRole('button', { name: /^Applica: Heatran/ }));
      expect(h.onApplyFix).toHaveBeenLastCalledWith(second);
      await user.click(within(heroOf()).getByRole('button', { name: 'Vedi nella scheda Pokémon: Heatran' }));
      expect(h.onFix).toHaveBeenLastCalledWith(second);
      // Aperta un'altra riga, il posto resta con la scelta fra le righe
      await user.click(rowButtons()[0]);
      expect(rowNames()).toEqual(['Heatran al posto di Magikarp, voto +3']);
    });

    it('tastiera: le piccole carte sono pulsanti, Invio e Spazio scelgono', async () => {
      const user = userEvent.setup();
      view(advice([second, best, third, other]));
      altTiles()[1].focus();
      await user.keyboard('{Enter}');
      expect(heroName()).toBe('Volcanion al posto di Magikarp, voto +2');
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

    it('una proposta che non alza il voto va fra le alternative della prima che risolve il suo problema, non fra le righe', () => {
      const neutral = swap('Incineroar', 3, 0, [fire.key]);
      view(advice([second, best, other, neutral]));
      expect(altNames()).toEqual(['Heatran al posto di Magikarp, voto +3', 'Incineroar al posto di Corviknight, voto ±0']);
      expect(rowNames()).toEqual(['Zapdos al posto di Sunkern, voto +1']);
    });

    it('senza una proposta che alza il voto e risolve il suo problema, resta in coda alle righe', () => {
      const neutral = swap('Incineroar', 3, 0, [steel.key]);
      view(advice([best, other, neutral]));
      expect(rowNames()).toEqual(['Zapdos al posto di Sunkern, voto +1', 'Incineroar al posto di Corviknight, voto ±0']);
    });
  });

  it('cambio di mossa: la mossa nuova protagonista, "Su X", la vecchia barrata; Applica e "Apri il set"', async () => {
    const user = userEvent.setup();
    const move: MoveFix = { index: 0, member: 'Great Tusk', set: six[0], reduces: [], slot: 1, from: 'Rapid Spin', to: 'Knock Off', gain: 4, solves: [zapdos.key], after: before };
    const empty: MoveFix = { ...move, index: 1, member: 'Gholdengo', set: six[1], slot: 3, from: '', to: 'Thunderbolt', gain: 1, solves: [pivot.key] };
    const h = view(advice([swap('Rotom-Wash', 4, 2, [fire.key])], [move, empty]));
    expect(heroName()).toBe('Knock Off al posto di Rapid Spin su Great Tusk, voto +4');
    expect(rowNames()).toEqual(['Rotom-Wash al posto di Magikarp, voto +2', 'Thunderbolt in uno slot libero su Gholdengo, voto +1']);
    const hero = heroOf();
    expect(hero).toHaveClass('is-move');
    const title = hero.querySelector('.coach-hero-title.is-move')!;
    expect(title.querySelector('.coach-move-in')).toHaveTextContent('Knock Off');
    const plates = [...title.querySelectorAll('.coach-plate')];
    expect(plates[0]).toHaveTextContent('SuGreat Tusk');
    expect(plates[1]).toHaveClass('is-out');
    expect(plates[1].querySelector('s')).toHaveTextContent('Rapid Spin');
    expect(title).toHaveTextContent('cambio di mossa');
    // Nelle righe la mossa è segnata come tale
    expect(list().querySelectorAll('li.coach-item')[1]).toHaveClass('is-move');
    await user.click(within(hero).getByRole('button', { name: /^Applica: Knock Off/ }));
    expect(h.onApplyMove).toHaveBeenLastCalledWith(move);
    await user.click(within(hero).getByRole('button', { name: 'Apri il set: Great Tusk' }));
    expect(h.onMoveFix).toHaveBeenLastCalledWith(move);
    // Uno slot libero: "slot libero" al posto della mossa vecchia
    await user.click(within(list()).getByRole('button', { name: 'Apri: Thunderbolt in uno slot libero su Gholdengo, voto +1' }));
    expect(heroOf().querySelector('.coach-hero-free')).toHaveTextContent('slot libero');
    expect(heroOf().querySelector('.coach-plate.is-out')).toBeNull();
  });

  it('un cambio che lascia il team senza un ruolo d\'aiuto lo dice in "Costa": "Perdi Danno nel Tempo"; anche nella riga; gli altri no', async () => {
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
    const [clean] = list().querySelectorAll('li.coach-item');
    expect(clean.querySelector('.coach-item-cost')).toBeNull();
    await user.click(rowButtons()[0]);
    expect(heroOf().querySelector('.coach-lost')).toBeNull();
    expect(within(heroOf()).getByRole('region', { name: 'Costa' })).toHaveTextContent('Niente');
    const [lossy] = list().querySelectorAll('li.coach-item');
    expect(lossy.querySelector('.coach-item-cost')).toHaveTextContent('CostaDanno nel Tempo, Anti-setup');
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
      expect(railItem('Pivot')).toHaveAttribute('aria-pressed', 'true');
      expect(allButton()).toHaveAttribute('aria-pressed', 'false');
      expect(othersHead()).toHaveTextContent('Altre proposte per questo problema');
      expect(rowNames()).toEqual([]);
      act(() => { vi.advanceTimersByTime(2100); });
      expect(heroOf()).not.toHaveClass('is-flash');
    } finally {
      vi.useRealTimers();
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('consigli in calcolo: la carta e le righe scheletro (aria-busy) e un avviso per lo screen reader', () => {
    view(null);
    expect(list().querySelector('.coach-hero.skeleton')).not.toBeNull();
    expect(within(list()).queryByRole('article')).toBeNull();
    const busy = list().querySelector('ol[aria-busy="true"]')!;
    expect(busy.querySelectorAll('li.coach-item.skeleton')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('Calcolo dei consigli…');
  });

  it('le aree senza problemi in una riga verde sotto i problemi', () => {
    renderIt(<CoachingView coaching={coachingOf([zapdos])} advice={advice([swap('Rotom-Wash', 4, 2, [zapdos.key])])} members={6} rating={rating} {...noop} />);
    const clean = rail().querySelector('.coach-clean')!;
    expect(clean).toHaveTextContent(`Nessun problema in Offesa ${Math.round(before.strength!)} · Ruoli`);
    expect(clean).not.toHaveTextContent('Difesa');
  });

  describe('Da sistemare', () => {
    const stuck: CoachProblem = { severity: 'minor', category: 'redundancy', text: 'Due membri lenti', fixes: [], key: 'redundancy:slow' };

    it('i problemi una volta sola, col numero di proposte che li risolvono; "Tutte le proposte" acceso; senza proposte spento', () => {
      view(advice([swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]), swap('Heatran', 1, 3, [fire.key]), swap('Zapdos', 5, 2, [pivot.key])]),
        { coaching: coachingOf([...problems, stuck]) });
      expect(within(rail()).getByRole('heading', { name: /^Da sistemare/ })).toHaveTextContent('Da sistemare5');
      expect(allButton()).toHaveAttribute('aria-pressed', 'true');
      expect(allButton().querySelector('.coach-diag-n')).toHaveTextContent('3');
      const n = (text: string) => railItem(text).querySelector('.coach-diag-n')!;
      expect(n('contro Fire')).toHaveTextContent('2');
      expect(n('contro Fire')).toHaveAttribute('aria-label', '2 proposte');
      expect(n('contro Zapdos')).toHaveTextContent('1');
      expect(n('Pivot')).toHaveTextContent('1');
      expect(railItem('Acciaio')).toBeDisabled();
      expect(railItem('Due membri lenti')).toBeDisabled();
      expect(n('Acciaio')).toHaveTextContent('–');
      // Pochi: nessuna pagina
      expect(within(rail()).queryByRole('navigation')).toBeNull();
    });

    it('i problemi con la stessa proposta migliore in un blocco, con in testa chi li risolve tutti; un problema solo non ha testata', () => {
      view(advice([swap('Zapdos', 5, 5, [pivot.key, steel.key]), swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key]), swap('Heatran', 1, 1, [fire.key])]),
        { coaching: coachingOf([...problems, stuck]) });
      const cures = [...rail().querySelectorAll<HTMLButtonElement>('.coach-diag-cure')];
      expect(cures.map(c => c.getAttribute('aria-label'))).toEqual([
        'Apri Rotom-Wash al posto di Magikarp, voto +4: risolve tutti e 2 i problemi qui sotto',
        'Apri Zapdos al posto di Sunkern, voto +5: risolve tutti e 2 i problemi qui sotto',
      ]);
      expect(cures[0]).toHaveTextContent('Rotom-Wash');
      expect(cures[0]).toHaveTextContent('li risolve tutti e 2');
      // L'ordine: la testata, poi i suoi problemi; in coda quelli che nessuno risolve
      const order = [...rail().querySelectorAll<HTMLButtonElement>('.coach-diag-cure, .coach-diag-item:not(.is-all)')]
        .map(b => (b.classList.contains('coach-diag-cure') ? `cura:${b.textContent!.includes('Rotom') ? 'Rotom' : 'Zapdos'}` : b.textContent!.includes('Fire') ? 'fire' : b.textContent!.includes('contro Zapdos') ? 'zapdos'
          : b.textContent!.includes('Pivot') ? 'pivot' : b.textContent!.includes('Acciaio') ? 'steel' : 'stuck'));
      expect(order).toEqual(['cura:Rotom', 'fire', 'zapdos', 'cura:Zapdos', 'pivot', 'steel', 'stuck']);
      // La carta grande (Zapdos) risolve Pivot e Acciaio: righe accese
      expect(railItem('Pivot')).toHaveClass('is-cured');
      expect(railItem('Pivot')).toHaveTextContent('lo risolve la proposta nella carta');
      expect(railItem('contro Fire')).not.toHaveClass('is-cured');
      expect(cures[1]).toHaveClass('is-open');
    });

    it('un clic sulla testata di un blocco apre quella proposta nella carta grande', async () => {
      const user = userEvent.setup();
      view(advice([swap('Zapdos', 5, 5, [pivot.key, steel.key]), swap('Rotom-Wash', 4, 4, [fire.key, zapdos.key])]));
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
      await user.click(within(rail()).getByRole('button', { name: /^Apri Rotom-Wash al posto di Magikarp, voto \+4:/ }));
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta scelta');
      expect(railItem('contro Fire')).toHaveClass('is-cured');
      await user.click(within(list()).getByRole('button', { name: 'Torna alla migliore' }));
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    });

    it('un clic su un problema mostra solo le proposte che lo risolvono; di nuovo, o "Mostra tutte", tutte', async () => {
      const user = userEvent.setup();
      view(advice([swap('Zapdos', 5, 5, [pivot.key]), swap('Rotom-Wash', 4, 4, [fire.key]), swap('Heatran', 1, 3, [fire.key, zapdos.key]), swap('Clefable', 2, 2, [steel.key])]));
      await user.click(railItem('contro Fire'));
      expect(railItem('contro Fire')).toHaveAttribute('aria-pressed', 'true');
      expect(allButton()).toHaveAttribute('aria-pressed', 'false');
      expect(heroName()).toBe('Rotom-Wash al posto di Magikarp, voto +4');
      expect(band()).toHaveTextContent('La proposta migliore');
      expect(rowNames()).toEqual(['Heatran al posto di Gholdengo, voto +3']);
      expect(othersHead()).toHaveTextContent('Altre proposte per questo problema1');
      // Di nuovo sullo stesso problema: tutte
      await user.click(railItem('contro Fire'));
      expect(allButton()).toHaveAttribute('aria-pressed', 'true');
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
      expect(rowNames()).toHaveLength(3);
      // "Mostra tutte" nel titolo della lista
      await user.click(railItem('Pivot'));
      expect(rowNames()).toEqual([]);
      expect(within(list()).getByText('Nessun\'altra proposta risolve questo problema')).toBeInTheDocument();
      await user.click(within(list()).getByRole('button', { name: 'Mostra tutte' }));
      expect(othersHead()).toHaveTextContent('Altre proposte3');
      expect(within(list()).queryByRole('button', { name: 'Mostra tutte' })).toBeNull();
      expect(railItem('Pivot')).toHaveAttribute('aria-pressed', 'false');
      // "Tutte le proposte" toglie il filtro
      await user.click(railItem('Acciaio'));
      expect(heroName()).toBe('Clefable al posto di Toxapex, voto +2');
      await user.click(allButton());
      expect(heroName()).toBe('Zapdos al posto di Sunkern, voto +5');
    });

    it('il "?" apre "Come funziona il Coaching"', async () => {
      const user = userEvent.setup();
      view(advice([swap('Zapdos', 5, 5, [pivot.key])]));
      await user.click(within(rail()).getByRole('button', { name: 'Come funziona il Coaching' }));
      const dialog = screen.getByRole('dialog', { name: 'Come funziona il Coaching' });
      expect(within(dialog).getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Da sistemare', 'La carta grande', 'Risolve e Costa', 'Applica e Oppure']);
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
  });

  it('problemi che nessuna proposta risolve: Eevee pensieroso, i problemi che restano e Migliora i set', async () => {
    const user = userEvent.setup();
    const h = view(advice([]));
    expect(screen.getByRole('heading', { name: 'Nessuna sostituzione singola li risolve' })).toBeInTheDocument();
    expect(screen.getByText('Restano questi problemi, ma cambiare un solo Pokémon non basta.')).toBeInTheDocument();
    expect(document.querySelector('.coach-empty .eevee-moment.thinking')).not.toBeNull();
    const chips = within(screen.getByRole('list', { name: 'Problemi che restano' })).getAllByRole('listitem');
    // Il ruolo mancante ha la sua pillola
    expect(chips.map(c => c.querySelector('.area-chip')!.getAttribute('data-key'))).toEqual([fire.key, zapdos.key, pivot.key, steel.key]);
    expect(screen.getByText(/Migliora i set cerca le versioni migliori/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Migliora i set' }));
    expect(h.onImproveSets).toHaveBeenCalledTimes(1);
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

  it('coi consigli veri: ogni gruppo del motore compare (carta, righe, alternative), col +N del motore', async () => {
    const user = userEvent.setup();
    const coaching = coachTeam(six, DEFAULT_FORMAT, data);
    const adv = adviceOf(six, DEFAULT_FORMAT, data);
    const groups = neutralAsAlternatives(proposalGroups(coaching.problems, adv));
    expect(groups.length).toBeGreaterThan(0);
    renderIt(<CoachingView coaching={coaching} advice={adv} members={6} rating={rateTeam(six, data, 'it')} {...noop} />);
    expect(othersHead().querySelector('.coach-count')).toHaveTextContent(String(groups.length - 1));
    expect(heroOf()).toHaveAttribute('data-row', groups[0].id);
    expect(heroOf().querySelector('.coach-gain')).toHaveTextContent(gainText(groups[0].options[0].fix.gain));
    expect(altTiles().map(t => t.querySelector('b')!.textContent)).toEqual(groups[0].options.slice(1).map(o => gainText(o.fix.gain)));
    const ids: string[] = [];
    const gains: string[] = [];
    for (let page = 0; page < 30; page++) {
      for (const li of list().querySelectorAll<HTMLElement>('li.coach-item')) {
        ids.push(li.getAttribute('data-row')!);
        gains.push(li.querySelector('.coach-item-gain')!.textContent!);
      }
      const next = within(list()).queryByRole('button', { name: 'Proposte successive' });
      if (!next || (next as HTMLButtonElement).disabled) break;
      await user.click(next);
    }
    expect(ids).toEqual(groups.slice(1).map(g => g.id));
    expect(gains).toEqual(groups.slice(1).map(g => gainText(g.options[0].fix.gain)));
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
