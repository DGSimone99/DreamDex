/**
 * Scarica replay di Showdown per il banco: i due team (6 Pokémon con la forma reale) e chi ha vinto.
 * Uso: npx tsx scripts/fetch-replays.ts [formato…]            partite di alto livello (rating ≥ 1500, dalle più alte)
 *      npx tsx scripts/fetch-replays.ts --ladder [formato…]   partite di giocatori medi (rating 1100–1400, le più recenti)
 * Formati predefiniti: gen9nationaldex, gen9ou. Scrive scripts/bench/replays.json (alto livello) o
 * scripts/bench/ladder.json (medi): i team del ladder medio fanno da gruppo "ladder" nel banco, un "medio" vero e non
 * costruito a mano. Rispetta il server: una richiesta ogni 300 ms.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LADDER = process.argv.includes('--ladder');
/** Rating della partita (alto livello: dal minimo in su; ladder medio: tra minimo e massimo) e quanto indietro andare (il meta cambia). */
const MIN_RATING = LADDER ? 1100 : 1500;
const MAX_RATING = LADDER ? 1400 : Infinity;
const MAX_AGE_DAYS = 365;
/** Partite finite prima di questo turno (abbandoni) non dicono niente sui team. */
const MIN_TURNS = 6;
/** Massimo di pagine (50 partite l'una) e di partite tenute per formato; il ladder medio è sparso tra le recenti: più pagine. */
const MAX_PAGES = LADDER ? 60 : 20;
const MAX_REPLAYS = LADDER ? 300 : 400;
const DELAY = 300;

export interface Replay {
  format: string;
  id: string;
  rating: number;
  turns: number;
  p1: string[];
  p2: string[];
  /** 1 se ha vinto p1, 2 se p2. */
  winner: 1 | 2;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'DreamDex bench (personal project)' } });
    return res.ok ? (await res.json()) as T : null;
  } catch {
    return null;
  }
}

/** Specie dalla riga di dettaglio ("Urshifu-Rapid-Strike, L50, M" → "Urshifu-Rapid-Strike"). */
const speciesOf = (details: string) => details.split(',')[0].trim();

/**
 * I team dal log: l'anteprima (|poke|) nasconde alcune forme ("Urshifu-*"), gli ingressi (|switch|) e le
 * megaevoluzioni (|detailschange|) le rivelano. Il nome di battaglia vince su quello dell'anteprima.
 */
export function parseLog(log: string): { p1: string[]; p2: string[]; winner: string | null; turns: number; players: Record<string, string> } | null {
  const players: Record<string, string> = {};
  const preview: Record<'p1' | 'p2', string[]> = { p1: [], p2: [] };
  const seen: Record<'p1' | 'p2', Map<string, string>> = { p1: new Map(), p2: new Map() };
  let winner: string | null = null;
  let turns = 0;
  for (const line of log.split('\n')) {
    const parts = line.split('|');
    const kind = parts[1];
    if (kind === 'player' && parts[3]) players[parts[2]] = parts[3];
    else if (kind === 'poke' && (parts[2] === 'p1' || parts[2] === 'p2')) preview[parts[2]].push(speciesOf(parts[3]));
    else if ((kind === 'switch' || kind === 'drag' || kind === 'detailschange') && parts[2]) {
      const side = parts[2].slice(0, 2) as 'p1' | 'p2';
      const forme = speciesOf(parts[3]);
      const base = forme.split('-')[0];
      if (side === 'p1' || side === 'p2') seen[side].set(base, forme);
    } else if (kind === 'turn') turns = Number(parts[2]) || turns;
    else if (kind === 'win') winner = parts[2];
  }
  if (preview.p1.length !== 6 || preview.p2.length !== 6) return null;
  const resolve = (side: 'p1' | 'p2') => preview[side].map(name => {
    const base = name.replace(/-\*$/, '').split('-')[0];
    return seen[side].get(base) ?? name.replace(/-\*$/, '');
  });
  return { p1: resolve('p1'), p2: resolve('p2'), winner, turns, players };
}

async function fetchFormat(format: string, known: Set<string>): Promise<Replay[]> {
  const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400;
  const found: Replay[] = [];
  for (let page = 1; page <= MAX_PAGES && found.length < MAX_REPLAYS; page++) {
    // Alto livello: dalle partite col rating più alto; ladder medio: le più recenti, di qualunque rating
    const list = await json<{ id: string; rating: number | null; uploadtime: number }[]>(
      `https://replay.pokemonshowdown.com/search.json?format=${format}${LADDER ? '' : '&sort=rating'}&page=${page}`);
    await sleep(DELAY);
    if (!list?.length) break;
    if (!LADDER && (list[list.length - 1].rating ?? 0) < MIN_RATING && (list[0].rating ?? 0) < MIN_RATING) break;
    if (LADDER && list[list.length - 1].uploadtime < cutoff) break;
    for (const entry of list) {
      if (found.length >= MAX_REPLAYS) break;
      const rating = entry.rating ?? 0;
      if (rating < MIN_RATING || rating > MAX_RATING || entry.uploadtime < cutoff || known.has(entry.id)) continue;
      const replay = await json<{ log: string; players: string[] }>(`https://replay.pokemonshowdown.com/${entry.id}.json`);
      await sleep(DELAY);
      const parsed = replay && parseLog(replay.log);
      if (!parsed || !parsed.winner || parsed.turns < MIN_TURNS) continue;
      const winner = parsed.players.p1 === parsed.winner ? 1 : parsed.players.p2 === parsed.winner ? 2 : null;
      if (!winner) continue;
      found.push({ format, id: entry.id, rating: entry.rating!, turns: parsed.turns, p1: parsed.p1, p2: parsed.p2, winner });
    }
    console.log(`${format}: pagina ${page}, ${found.length} partite`);
  }
  return found;
}

const file = join('scripts', 'bench', LADDER ? 'ladder.json' : 'replays.json');
const args = process.argv.slice(2).filter(a => a !== '--ladder');
const formats = args.length ? args : ['gen9nationaldex', 'gen9ou'];
const existing: Replay[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
const known = new Set(existing.map(r => r.id));
const all = [...existing];
for (const format of formats) all.push(...await fetchFormat(format, known));
writeFileSync(file, '[\n' + all.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`Salvate ${all.length} partite in ${file}`);
