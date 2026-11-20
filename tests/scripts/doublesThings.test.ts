import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { CONTROLS, levelJump, oncePerTeam, pairResults, thingResults, THINGS, type BenchGame } from '../../scripts/doublesThings';

const mon = (species: string, moves: string[] = [], extra: Partial<TeamSet> = {}): TeamSet => ({ ...emptySet(species), moves, ...extra });
/** Un team da 6: i membri dati più riempitivi senza mosse (ogni chiamata con `fill` diverso è un team diverso). */
const FILL = ['Pikachu', 'Eevee', 'Snorlax', 'Lapras', 'Ditto', 'Mew', 'Togepi', 'Marill', 'Wobbuffet', 'Skarmory', 'Blissey', 'Sableye', 'Mawile', 'Absol', 'Luxray', 'Lucario'];
const team = (members: TeamSet[], fill = 0): TeamSet[] => [...members, ...FILL.slice(fill, fill + 6 - members.length).map(s => mon(s))];
const result = (games: BenchGame[], key: string) => thingResults(games, THINGS).find(t => t.key === key)!;

describe('thingResults', () => {
  it("conta solo le partite dove un lato ha la cosa e l'altro no", () => {
    const tw = (fill: number) => team([mon('Tornadus', ['Tailwind'])], fill);
    const no = (fill: number) => team([mon('Heatran', ['Flamethrower'])], fill);
    const games: BenchGame[] = [
      { a: tw(0), b: no(0), winner: 1 },
      { a: no(1), b: tw(1), winner: 2 },
      { a: tw(2), b: tw(3), winner: 1 },
      { a: no(2), b: no(3), winner: 1 },
    ];
    const r = result(games, 'tailwind');
    expect(r.games).toBe(2);
    expect(r.winRate).toBe(1);
    expect(r.share).toBe(4 / 8);
    expect(r.margin).toBe(0);
  });

  it('dà la quota di chi ce l\'ha col suo margine', () => {
    const fo = (fill: number) => team([mon('Incineroar', ['Fake Out'])], fill);
    const no = (fill: number) => team([mon('Heatran', ['Flamethrower'])], fill);
    const games: BenchGame[] = [0, 1, 2, 3].map(i => ({ a: fo(i), b: no(i), winner: i === 0 ? 2 : 1 }));
    const r = result(games, 'fakeout');
    expect(r.winRate).toBe(0.75);
    // Il margine è allargato di 1,2: lo stesso team entra fino a 3 volte e le sue partite non sono indipendenti
    expect(r.margin).toBeCloseTo(1.2 * 1.96 * Math.sqrt(0.75 * 0.25 / 4), 10);
  });

  it('lo stesso team conta al massimo 3 volte', () => {
    const same = team([mon('Incineroar', ['Fake Out'])]);
    const games: BenchGame[] = Array.from({ length: 10 }, (_, i) => ({ a: same, b: team([mon('Heatran', ['Flamethrower'])], i), winner: 1 as const }));
    expect(result(games, 'fakeout').games).toBe(3);
  });

  it('le fasce di Protect si escludono', () => {
    const two = team([mon('Heatran', ['Protect']), mon('Rillaboom', ['Detect'])]);
    const none = team([mon('Tornadus', ['Hurricane'])], 3);
    const games: BenchGame[] = [{ a: two, b: none, winner: 1 }];
    expect(result(games, 'protect23').share).toBe(1 / 2);
    expect(result(games, 'protect01').share).toBe(1 / 2);
    expect(result(games, 'protect4').share).toBe(0);
  });

  it('le mosse a due bersagli vengono dal dex', () => {
    const has = (key: string, moves: string[]) => THINGS.find(t => t.key === key)!.has(team([mon('Heatran', moves)]));
    expect(has('hitsally', ['Heat Wave'])).toBe(false);
    expect(has('hitsally', ['Earthquake'])).toBe(true);
    expect(has('hitsally', ['Flamethrower'])).toBe(false);
    const spreadTeam = team([mon('Heatran', ['Heat Wave']), mon('Landorus-Therian', ['Earthquake']), mon('Tornadus', ['Flamethrower'])]);
    const key = (k: string) => THINGS.find(t => t.key === k)!.has(spreadTeam);
    expect(key('spread23')).toBe(true);
    expect(key('spread01')).toBe(false);
  });

  it('Charizard-Mega-Y vale come meteo, Intimidate e i campi si leggono dall\'abilità', () => {
    const has = (key: string, m: TeamSet) => THINGS.find(t => t.key === key)!.has(team([m]));
    expect(has('weather', mon('Charizard-Mega-Y'))).toBe(true);
    expect(has('weather', mon('Charizard'))).toBe(false);
    expect(has('intimidate', mon('Incineroar', [], { ability: 'Intimidate' }))).toBe(true);
    expect(has('terrain', mon('Rillaboom', [], { ability: 'Grassy Surge' }))).toBe(true);
    expect(has('redirect', mon('Amoonguss', ['Rage Powder']))).toBe(true);
    expect(has('speeddrop', mon('Flutter Mane', ['Icy Wind']))).toBe(true);
  });

  it('senza partite da contare winRate è NaN, non un errore', () => {
    const r = result([], 'tailwind');
    expect(r.games).toBe(0);
    expect(r.winRate).toBeNaN();
    expect(r.share).toBe(0);
  });
});

describe('pairResults', () => {
  it('dà le coppie più viste con la loro quota di vittorie', () => {
    const pair = (fill: number) => team([mon('Rillaboom'), mon('Incineroar')], fill);
    const other = (fill: number) => team([mon('Heatran'), mon('Tornadus')], fill + 6);
    const games: BenchGame[] = [0, 1, 2].map(i => ({ a: pair(i), b: other(i), winner: i === 0 ? 2 : 1 }));
    const top = pairResults(games, 1);
    expect(top).toHaveLength(1);
    // Le più viste stanno in 3 team su 6 (a pari merito vince l'ordine alfabetico)
    expect(top[0].share).toBe(3 / 6);
    const r = pairResults(games, 500).find(p => p.key === 'Incineroar + Rillaboom')!;
    expect(r.share).toBe(3 / 6);
    expect(r.games).toBe(3);
    expect(r.winRate).toBeCloseTo(2 / 3, 10);
  });
});

describe('visto in partita', () => {
  it('una mossa che viene solo dal set più usato conta nel totale ma non nel "visto in partita"', () => {
    const full = team([mon('Tornadus', ['Tailwind'])]);
    const seenOnly = team([mon('Tornadus', [])]);
    const no = team([mon('Heatran', ['Flamethrower'])], 3);
    const games: BenchGame[] = [{ a: full, b: no, winner: 1, seen: { a: seenOnly, b: no } }];
    const r = result(games, 'tailwind');
    expect(r.games).toBe(1);
    expect(r.seen!.games).toBe(0);
    expect(r.seen!.share).toBe(0);
  });

  it('senza i team "visti" non esiste la seconda misura', () => {
    expect(result([{ a: team([mon('Tornadus', ['Tailwind'])]), b: team([], 3), winner: 1 }], 'tailwind').seen).toBeUndefined();
  });
});

describe('CONTROLS (quello che un lato mostra)', () => {
  const has = (key: string, t: TeamSet[]) => CONTROLS.find(c => c.key === key)!.has(t);
  it('Mega vista', () => {
    expect(has('megashown', team([mon('Charizard-Mega-Y')]))).toBe(true);
    expect(has('megashown', team([mon('Charizard')]))).toBe(false);
  });
  it('almeno 2 Pokémon che non hanno mai mosso', () => {
    const all = FILL.slice(0, 6).map(s => mon(s, ['Protect']));
    expect(has('unmoved2', all)).toBe(false);
    expect(has('unmoved2', [...all.slice(0, 4), mon('Ditto'), mon('Mew')])).toBe(true);
  });
  it('almeno 11 mosse viste', () => {
    expect(has('moves11', FILL.slice(0, 6).map(s => mon(s, ['Protect', 'Tackle'])))).toBe(true);
    expect(has('moves11', FILL.slice(0, 6).map(s => mon(s, ['Protect'])))).toBe(false);
  });
});

describe('levelJump', () => {
  it('media sotto 1400, media da 1500, differenza e margine al 95%', () => {
    const jump = levelJump([
      { rating: 1300, value: 60 }, { rating: 1399, value: 64 },
      { rating: 1500, value: 70 }, { rating: 1700, value: 74 },
      // Fra 1400 e 1499 non entra in nessuna delle due fasce
      { rating: 1450, value: 0 },
    ]);
    expect(jump.low).toBe(62);
    expect(jump.high).toBe(72);
    expect(jump.jump).toBe(10);
    // Varianza campionaria 8 in tutte e due le fasce, 2 righe ciascuna: errore standard √(8/2 + 8/2)
    expect(jump.margin).toBeCloseTo(1.96 * Math.sqrt(8), 10);
    expect([jump.lowCount, jump.highCount]).toEqual([2, 2]);
  });

  it('una fascia vuota dà NaN, non un errore', () => {
    const jump = levelJump([{ rating: 1300, value: 60 }, { rating: 1350, value: 62 }]);
    expect(jump.low).toBe(61);
    expect(jump.high).toBeNaN();
    expect(jump.jump).toBeNaN();
    expect(jump.margin).toBeNaN();
    expect(levelJump([]).jump).toBeNaN();
  });

  it('con una riga sola in una fascia il margine non si può stimare', () => {
    const jump = levelJump([{ rating: 1300, value: 60 }, { rating: 1600, value: 70 }]);
    expect(jump.jump).toBe(10);
    expect(jump.margin).toBeNaN();
  });
});

describe('oncePerTeam', () => {
  it('lo stesso team conta una volta sola per fascia di livello, anche se gioca cento partite', () => {
    const rows = [
      { key: 'a', rating: 1300, value: 60 }, { key: 'a', rating: 1350, value: 60 }, { key: 'a', rating: 1380, value: 60 },
      { key: 'b', rating: 1320, value: 70 },
      // Lo stesso team salito di livello conta anche fra gli alti (un'altra fascia)
      { key: 'a', rating: 1600, value: 60 }, { key: 'a', rating: 1650, value: 60 },
      { key: 'c', rating: 1450, value: 50 }, { key: 'c', rating: 1460, value: 50 },
    ];
    expect(oncePerTeam(rows).map(r => [r.key, r.rating])).toEqual([['a', 1300], ['b', 1320], ['a', 1600], ['c', 1450]]);
    // Il salto si misura sui team, non sulle partite: sotto 1400 la media è (60 + 70) / 2, non tirata dal team ripetuto
    expect(levelJump(oncePerTeam(rows)).low).toBe(65);
    expect(levelJump(rows).low).toBe(62.5);
  });
});
