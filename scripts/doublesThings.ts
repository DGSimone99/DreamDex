/**
 * Banco del doppio, misura "cosa fa vincere": per ogni cosa tipica del doppio (Fake Out, Tailwind, Trick Room…) e per
 * quelle del singolo (hazard, recupero…), quanto vince il team che ce l'ha contro quello che non ce l'ha. Serve a decidere
 * a mano le regole del voto in doppio: qui non si calcola nessun peso.
 *
 * Conta solo le partite dove un lato ha la cosa e l'altro no; lo stesso team entra al massimo in REPEAT_CAP partite
 * (pochi team giocano centinaia di partite e da soli sposterebbero i numeri).
 */
import { battleAbility, getMove, toID } from '../src/engine/dex';
import type { TeamSet } from '../src/engine/sets';

export interface Thing { key: string; label: string; has: (team: TeamSet[]) => boolean }
export interface BenchGame { a: TeamSet[]; b: TeamSet[]; winner: 1 | 2 }
export interface ThingResult {
  key: string;
  label: string;
  /** Lati che ce l'hanno, su tutti i lati (0–1). */
  share: number;
  /** Partite dove un lato sì e l'altro no (dopo il tetto per team). */
  games: number;
  /** Quota vinta da chi ce l'ha (0–1); NaN con games = 0. */
  winRate: number;
  /** Margine al 95% della quota (1,96·√(p(1−p)/n)); NaN con games = 0. */
  margin: number;
}

/** Ogni team entra al massimo in tante partite. */
const REPEAT_CAP = 3;

const ids = (names: string[]) => new Set(names.map(toID));
const memberHasMove = (set: TeamSet, moves: Set<string>) => set.moves.some(m => moves.has(toID(m)));
const withMove = (...names: string[]) => { const set = ids(names); return (team: TeamSet[]) => team.some(m => memberHasMove(m, set)); };
const withAbility = (...names: string[]) => { const set = ids(names); return (team: TeamSet[]) => team.some(m => set.has(toID(battleAbility(m)))); };

const PROTECT = ids(['Protect', 'Detect', 'Spiky Shield', "King's Shield", 'Baneful Bunker', 'Silk Trap', 'Burning Bulwark', 'Obstruct']);
/** Mossa che fa danno a più di un Pokémon in campo (dal dex: tutti gli avversari vicini, o tutti i vicini compreso il compagno). */
const isSpread = (name: string) => { const move = getMove(name); return !!move && move.category !== 'Status' && (move.target === 'allAdjacentFoes' || move.target === 'allAdjacent'); };
const hitsAlly = (name: string) => { const move = getMove(name); return !!move && move.category !== 'Status' && move.target === 'allAdjacent'; };

const count = (team: TeamSet[], test: (set: TeamSet) => boolean) => team.filter(test).length;
/** Tre fasce che si escludono sul numero di membri: 0–1, 2–3, 4+. */
const bands = (key: string, label: string, test: (set: TeamSet) => boolean): Thing[] => [
  { key: `${key}01`, label: `${label}: 0–1 membri`, has: team => count(team, test) <= 1 },
  { key: `${key}23`, label: `${label}: 2–3 membri`, has: team => { const n = count(team, test); return n === 2 || n === 3; } },
  { key: `${key}4`, label: `${label}: 4 o più membri`, has: team => count(team, test) >= 4 },
];

export const THINGS: Thing[] = [
  { key: 'fakeout', label: 'Fake Out', has: withMove('Fake Out') },
  { key: 'tailwind', label: 'Tailwind', has: withMove('Tailwind') },
  { key: 'trickroom', label: 'Trick Room', has: withMove('Trick Room') },
  { key: 'speeddrop', label: 'Icy Wind o Electroweb', has: withMove('Icy Wind', 'Electroweb') },
  { key: 'redirect', label: 'Follow Me o Rage Powder', has: withMove('Follow Me', 'Rage Powder') },
  { key: 'helpinghand', label: 'Helping Hand', has: withMove('Helping Hand') },
  { key: 'wideguard', label: 'Wide Guard', has: withMove('Wide Guard') },
  { key: 'intimidate', label: 'Intimidate', has: withAbility('Intimidate') },
  { key: 'weather', label: "Meteo dall'abilità (sole, pioggia, sabbia, neve)", has: withAbility('Drought', 'Drizzle', 'Sand Stream', 'Snow Warning') },
  { key: 'terrain', label: "Campo dall'abilità (erboso, psichico, elettrico, nebbioso)", has: withAbility('Grassy Surge', 'Psychic Surge', 'Electric Surge', 'Misty Surge') },
  ...bands('protect', 'Protect e simili', set => memberHasMove(set, PROTECT)),
  ...bands('spread', 'Mosse a due bersagli', set => set.moves.some(isSpread)),
  { key: 'hitsally', label: 'Mosse che colpiscono anche il compagno', has: team => team.some(m => m.moves.some(hitsAlly)) },
  { key: 'hazards', label: 'Hazard (da singolo)', has: withMove('Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web') },
  { key: 'removal', label: 'Rimozione hazard (da singolo)', has: withMove('Rapid Spin', 'Defog', 'Mortal Spin', 'Tidy Up', 'Court Change') },
  { key: 'recovery', label: 'Mosse di recupero (da singolo)', has: withMove('Recover', 'Roost', 'Slack Off', 'Soft-Boiled', 'Moonlight', 'Morning Sun', 'Synthesis', 'Milk Drink', 'Strength Sap', 'Shore Up', 'Wish') },
  { key: 'setup', label: 'Potenziamenti (da singolo)', has: withMove('Swords Dance', 'Nasty Plot', 'Dragon Dance', 'Calm Mind', 'Quiver Dance', 'Bulk Up', 'Shell Smash', 'Belly Drum') },
];

/** Lo stesso team in partite diverse: le specie, in ordine. */
const teamKey = (team: TeamSet[]) => team.map(m => m.species).sort().join('/');

/** Le partite col tetto: una partita si salta se uno dei due team è già entrato REPEAT_CAP volte. */
function capped(games: BenchGame[]): BenchGame[] {
  const seen = new Map<string, number>();
  return games.filter(g => {
    const keys = [teamKey(g.a), teamKey(g.b)];
    if (keys.some(k => (seen.get(k) ?? 0) >= REPEAT_CAP)) return false;
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    return true;
  });
}

function measure(all: BenchGame[], kept: BenchGame[], thing: Thing): ThingResult {
  const sides = all.flatMap(g => [g.a, g.b]);
  const share = sides.length ? sides.filter(thing.has).length / sides.length : 0;
  let games = 0, wins = 0;
  for (const g of kept) {
    const [a, b] = [thing.has(g.a), thing.has(g.b)];
    if (a === b) continue;
    games++;
    if ((a && g.winner === 1) || (b && g.winner === 2)) wins++;
  }
  const winRate = games ? wins / games : NaN;
  return { key: thing.key, label: thing.label, share, games, winRate, margin: games ? 1.96 * Math.sqrt(winRate * (1 - winRate) / games) : NaN };
}

export function thingResults(games: BenchGame[], things: Thing[] = THINGS): ThingResult[] {
  const kept = capped(games);
  return things.map(thing => measure(games, kept, thing));
}

/** Le coppie di compagni più viste (per quota di team che le hanno) con la loro quota di vittorie. */
export function pairResults(games: BenchGame[], top = 20): ThingResult[] {
  const seen = new Map<string, number>();
  for (const team of games.flatMap(g => [g.a, g.b])) {
    const species = [...new Set(team.map(m => m.species))].sort();
    for (let i = 0; i < species.length; i++) for (let j = i + 1; j < species.length; j++) {
      const key = `${species[i]} + ${species[j]}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  const kept = capped(games);
  return [...seen.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, top).map(([key]) => {
    const [first, second] = key.split(' + ');
    const has = (team: TeamSet[]) => team.some(m => m.species === first) && team.some(m => m.species === second);
    return measure(games, kept, { key, label: key, has });
  });
}
