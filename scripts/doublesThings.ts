/**
 * Banco del doppio, misura "cosa fa vincere": per ogni cosa tipica del doppio (Fake Out, Tailwind, Trick Room…) e per
 * quelle del singolo (hazard, recupero…), quanto vince il team che ce l'ha contro quello che non ce l'ha. Serve a decidere
 * a mano le regole del voto in doppio: qui non si calcola nessun peso.
 *
 * Conta solo le partite dove un lato ha la cosa e l'altro no; lo stesso team entra al massimo in REPEAT_CAP partite
 * (pochi team giocano centinaia di partite e da soli sposterebbero i numeri).
 */
import { battleAbility, getMove, isMega, toID } from '../src/engine/dex';
import type { TeamSet } from '../src/engine/sets';

export interface Thing { key: string; label: string; has: (team: TeamSet[]) => boolean }
export interface BenchGame {
  a: TeamSet[];
  b: TeamSet[];
  winner: 1 | 2;
  /** Gli stessi team con le sole mosse viste in partita (senza quelle aggiunte dal set più usato). */
  seen?: { a: TeamSet[]; b: TeamSet[] };
}
export interface ThingResult {
  key: string;
  label: string;
  /** Lati che ce l'hanno, su tutti i lati (0–1). */
  share: number;
  /** Partite dove un lato sì e l'altro no (dopo il tetto per team). */
  games: number;
  /** Quota vinta da chi ce l'ha (0–1); NaN con games = 0. */
  winRate: number;
  /** Margine al 95% della quota (1,2 × 1,96·√(p(1−p)/n)); NaN con games = 0. */
  margin: number;
  /** La stessa misura contando solo le mosse viste in partita (c'è se le partite portano i team "visti"). */
  seen?: { share: number; games: number; winRate: number; margin: number };
}

/**
 * Il margine semplice viene troppo stretto: lo stesso team entra fino a REPEAT_CAP volte e le sue partite non sono
 * indipendenti. Con un tratto messo a caso sui team (600 prove sulle partite vere) cade fuori dal margine semplice
 * il 9–11% delle volte invece del 5%: allargato di 1,2 torna giusto.
 */
const MARGIN_WIDEN = 1.2;
/** Il tetto dipende dall'ordine delle partite: si fa la media su tanti ordini mescolati (sempre gli stessi, seme fisso). */
const SHUFFLES = 20;

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
function capOnce(games: BenchGame[]): BenchGame[] {
  const seen = new Map<string, number>();
  return games.filter(g => {
    const keys = [teamKey(g.a), teamKey(g.b)];
    if (keys.some(k => (seen.get(k) ?? 0) >= REPEAT_CAP)) return false;
    for (const k of keys) seen.set(k, (seen.get(k) ?? 0) + 1);
    return true;
  });
}

/** Le partite col tetto, in SHUFFLES ordini diversi: senza, resterebbero sempre le 3 partite più recenti di ogni team. */
function capped(games: BenchGame[]): BenchGame[][] {
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: SHUFFLES }, () => {
    const order = [...games];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return capOnce(order);
  });
}

type Teams = (g: BenchGame) => { a: TeamSet[]; b: TeamSet[] };
const FULL: Teams = g => g;
const SEEN: Teams = g => g.seen ?? g;

/** Quota dei lati che hanno la cosa, e quanto vince chi ce l'ha (media sugli ordini mescolati). */
function rate(all: BenchGame[], kept: BenchGame[][], has: Thing['has'], teams: Teams) {
  const sides = all.flatMap(g => { const t = teams(g); return [t.a, t.b]; });
  const share = sides.length ? sides.filter(has).length / sides.length : 0;
  let counted = 0, wins = 0;
  for (const round of kept) for (const g of round) {
    const t = teams(g);
    const [a, b] = [has(t.a), has(t.b)];
    if (a === b) continue;
    counted++;
    if ((a && g.winner === 1) || (b && g.winner === 2)) wins++;
  }
  const games = Math.round(counted / kept.length);
  const winRate = counted ? wins / counted : NaN;
  return { share, games, winRate, margin: games ? MARGIN_WIDEN * 1.96 * Math.sqrt(winRate * (1 - winRate) / games) : NaN };
}

function measure(all: BenchGame[], kept: BenchGame[][], thing: Thing, teams: Teams = FULL): ThingResult {
  const withSeen = teams === FULL && all.length > 0 && all.every(g => g.seen);
  return { key: thing.key, label: thing.label, ...rate(all, kept, thing.has, teams), ...(withSeen && { seen: rate(all, kept, thing.has, SEEN) }) };
}

/**
 * Controllo: quello che un lato MOSTRA in partita va insieme al vincere più di quasi tutte le cose (chi vince tiene
 * Pokémon in panchina e mostra più mosse). Si misurano sui team "visti": servono a pesare le altre righe.
 */
export const CONTROLS: Thing[] = [
  { key: 'megashown', label: 'Controllo: una Mega vista in campo', has: team => team.some(isMega) },
  { key: 'unmoved2', label: 'Controllo: almeno 2 Pokémon che non hanno mai mosso', has: team => count(team, m => m.moves.length === 0) >= 2 },
  { key: 'moves11', label: 'Controllo: almeno 11 mosse viste in tutto', has: team => team.reduce((n, m) => n + m.moves.length, 0) >= 11 },
];

/** I controlli, misurati sui team con le sole mosse viste (le partite devono portarli). */
export function controlResults(games: BenchGame[]): ThingResult[] {
  const kept = capped(games);
  return CONTROLS.map(thing => measure(games, kept, thing, SEEN));
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

/** Fasce del livello dei giocatori per `levelJump`: sotto LOW_BELOW i bassi, da HIGH_FROM gli alti (in mezzo non conta). */
export const LOW_BELOW = 1400;
export const HIGH_FROM = 1500;

export interface LevelJump { low: number; high: number; jump: number; margin: number; lowCount: number; highCount: number }

/**
 * Il secondo metro del voto del doppio: il valore medio (voto o area) dei team nelle partite da HIGH_FROM in su meno
 * quello sotto LOW_BELOW. Se sale, il voto riconosce i team costruiti meglio (i giocatori forti li portano di più).
 * `margin`: margine al 95% della differenza (1,96 × errore standard). Una fascia vuota dà NaN.
 */
export function levelJump(rows: { rating: number; value: number }[]): LevelJump {
  const band = (keep: (rating: number) => boolean) => {
    const values = rows.filter(r => keep(r.rating)).map(r => r.value);
    const n = values.length;
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : NaN;
    // Varianza campionaria (n − 1): con una riga sola non si può stimare
    const variance = n > 1 ? values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1) : NaN;
    return { n, mean, variance };
  };
  const low = band(rating => rating < LOW_BELOW), high = band(rating => rating >= HIGH_FROM);
  return {
    low: low.mean, high: high.mean, jump: high.mean - low.mean,
    margin: 1.96 * Math.sqrt(low.variance / low.n + high.variance / high.n),
    lowCount: low.n, highCount: high.n,
  };
}

/**
 * Ogni team una volta sola per fascia di livello (sotto LOW_BELOW, in mezzo, da HIGH_FROM): pochi team giocano centinaia
 * di partite, e contati a ogni partita tirerebbero la media dalla loro parte e stringerebbero il margine di `levelJump`
 * (le partite dello stesso team non sono indipendenti). Resta la prima comparsa.
 */
export function oncePerTeam<T extends { key: string; rating: number }>(rows: T[]): T[] {
  const band = (rating: number) => (rating < LOW_BELOW ? 'low' : rating >= HIGH_FROM ? 'high' : 'mid');
  const seen = new Set<string>();
  return rows.filter(row => {
    const id = `${band(row.rating)}|${row.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
