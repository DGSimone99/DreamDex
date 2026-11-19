/**
 * Partite vere coi set veri: come fetch-replays.ts, ma per ogni Pokémon salva anche quello che la partita rivela
 * (mosse usate, strumento, abilità, Tera). Il banco completa il resto col set più usato. Servono migliaia di partite per
 * tarare i pesi del voto sui risultati (con 500 partite l'errore è ±2,4 punti, con 5000 ±0,7).
 *
 *   npx tsx scripts/fetch-games.ts [--min=1500] [--max=Infinity] [--target=3000] [--days=60] [formato…]
 *   npx tsx scripts/fetch-games.ts --out=games-doubles.json gen9nationaldexdoubles   (il doppio, in un file a parte)
 *
 * Scorre le partite dalle più recenti all'indietro (search.json?before=…), tiene quelle col rating nella fascia, e
 * aggiunge a scripts/bench/games.json, o al file di --out (le partite già salvate si saltano). Una richiesta ogni 300 ms. I log restano in
 * data/replay-logs: con --reparse le partite già salvate si rileggono col parser di oggi senza riscaricarle.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canHaveAbility, replayLog, teamForme } from './replay-shared';

const arg = (name: string, fallback: number) => Number(process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const MIN_RATING = arg('min', 1500);
const MAX_RATING = arg('max', Infinity);
const TARGET = arg('target', 3000);
const MAX_AGE_DAYS = arg('days', 60);
const MIN_TURNS = 6;
const DELAY = 300;

/** Quello che la partita rivela di un Pokémon. */
export interface Revealed {
  /** Nome come nel resto del banco: la forma vista in campo (Mega comprese), altrimenti quella dell'anteprima. */
  species: string;
  moves: string[];
  item?: string;
  ability?: string;
  tera?: string;
}

export interface Game {
  format: string;
  id: string;
  rating: number;
  turns: number;
  uploadtime: number;
  p1: Revealed[];
  p2: Revealed[];
  winner: 1 | 2;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function json<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'DreamDex bench (personal project)' } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
    } catch { /* riprova */ }
    await sleep(2000);
  }
  return null;
}

const speciesOf = (details: string) => details.split(',')[0].trim();
/** "p1a: Nick" → lato e soprannome. */
const who = (ref: string | undefined): { side: 'p1' | 'p2'; nick: string } | null => {
  const m = ref?.match(/^(p[12])[a-d]?: (.+)$/);
  return m ? { side: m[1] as 'p1' | 'p2', nick: m[2].trim() } : null;
};
/** Valore di un tag "[from] item: Leftovers" o "[of] p1a: Nick" fra le parti della riga. */
const tag = (parts: string[], name: string) => parts.find(p => p.startsWith(`[${name}]`))?.slice(name.length + 2).trim();

/** Il log della partita: anteprima, forme viste in campo e tutto quello che viene rivelato di ogni Pokémon. */
export function parseGame(log: string) {
  const players: Record<string, string> = {};
  const preview: Record<'p1' | 'p2', string[]> = { p1: [], p2: [] };
  /** Per lato: soprannome → specie vista in campo. */
  const nicks: Record<'p1' | 'p2', Map<string, string>> = { p1: new Map(), p2: new Map() };
  /** Per lato: specie di base → dati rivelati. */
  const info: Record<'p1' | 'p2', Map<string, { forme: string; moves: Set<string>; item?: string; ability?: string; tera?: string; tricked?: boolean }>> = { p1: new Map(), p2: new Map() };
  /** Per lato: chi è andato KO (dopo il KO la Mega torna forma base: quel cambio non conta). */
  const fainted: Record<'p1' | 'p2', Set<string>> = { p1: new Set(), p2: new Set() };
  /** Per lato: chi si è trasformato (Transform, Imposter): mosse e abilità sono del bersaglio finché non esce. */
  const transformed: Record<'p1' | 'p2', Set<string>> = { p1: new Set(), p2: new Set() };
  let winner: string | null = null;
  let turns = 0;
  const entry = (side: 'p1' | 'p2', nick: string) => {
    const forme = nicks[side].get(nick);
    if (!forme) return null;
    const base = forme.split('-')[0];
    let e = info[side].get(base);
    if (!e) { e = { forme, moves: new Set() }; info[side].set(base, e); }
    return e;
  };
  /** Come entry, ma null per chi è trasformato: quello che fa e mostra non è suo. */
  const own = (side: 'p1' | 'p2', nick: string) => (transformed[side].has(nick) ? null : entry(side, nick));
  for (const line of log.split('\n')) {
    const parts = line.split('|');
    const kind = parts[1];
    if (kind === 'player' && parts[3]) players[parts[2]] = parts[3];
    else if (kind === 'poke' && (parts[2] === 'p1' || parts[2] === 'p2')) preview[parts[2]].push(speciesOf(parts[3]));
    else if (kind === 'switch' || kind === 'drag' || kind === 'detailschange' || kind === 'replace') {
      const w = who(parts[2]);
      if (!w) continue;
      if (kind !== 'detailschange') { fainted[w.side].delete(w.nick); transformed[w.side].delete(w.nick); }
      // Dopo il KO Showdown riporta la Mega alla forma base (|detailschange|…|[silent]): la forma vera resta la Mega
      else if (fainted[w.side].has(w.nick)) continue;
      const forme = teamForme(speciesOf(parts[3]));
      nicks[w.side].set(w.nick, forme);
      const e = entry(w.side, w.nick);
      // La forma più "avanzata" vince (la Mega dopo la base)
      if (e && (kind === 'detailschange' || forme.length > e.forme.length)) e.forme = forme;
    } else if (kind === 'faint') {
      const w = who(parts[2]);
      if (w) fainted[w.side].add(w.nick);
    } else if (kind === '-transform') {
      const w = who(parts[2]);
      if (!w) continue;
      const from = tag(parts, 'from');
      const e = entry(w.side, w.nick);
      if (e && from?.startsWith('ability: ')) e.ability ??= from.slice(9);
      transformed[w.side].add(w.nick);
      continue;
    } else if (kind === 'move') {
      const w = who(parts[2]);
      // Le mosse chiamate da altre (Sleep Talk, Dancer, Magic Bounce…) non sono del set
      if (!w || parts.slice(4).some(p => p.startsWith('[from]'))) continue;
      const e = own(w.side, w.nick);
      if (e && parts[3] && parts[3] !== 'Struggle') e.moves.add(parts[3]);
    } else if (kind === '-item' || kind === '-enditem') {
      const w = who(parts[2]);
      const from = tag(parts, 'from') ?? '';
      if (!w) continue;
      const e = entry(w.side, w.nick);
      if (!e) continue;
      // Trick e Switcheroo: lo strumento ricevuto non è quello del set; il primo visto prima dello scambio resta
      if (/move: (Trick|Switcheroo|Bestow)/.test(from)) { e.tricked = true; continue; }
      // Magician e Pickpocket: chi ruba ha l'abilità, lo strumento rubato non è del suo set
      if (kind === '-item' && /ability: (Magician|Pickpocket)/.test(from)) { e.tricked = true; e.ability ??= from.slice(9); continue; }
      if (!e.item && !e.tricked) e.item = parts[3];
    } else if (kind === '-terastallize') {
      const w = who(parts[2]);
      const e = w && entry(w.side, w.nick);
      if (e) e.tera = parts[3];
    } else if (kind === '-ability') {
      const w = who(parts[2]);
      const from = tag(parts, 'from');
      if (from === 'ability: Trace') {
        // "|-ability|Gardevoir|Regenerator|[from] ability: Trace|[of] Alomomola": Trace è di chi copia, l'abilità copiata del bersaglio
        const of = who(tag(parts, 'of'));
        const tracer = w && own(w.side, w.nick);
        const target = of && own(of.side, of.nick);
        if (tracer && !tracer.ability && canHaveAbility(tracer.forme, 'Trace')) tracer.ability = 'Trace';
        if (target && !target.ability && canHaveAbility(target.forme, parts[3])) target.ability = parts[3];
        continue;
      }
      const e = w && own(w.side, w.nick);
      // Skill Swap, Role Play, Entrainment ([from] move: …) e Receiver/Power of Alchemy ([from] ability: …) danno un'abilità non del set
      if (e && !e.ability && !from && canHaveAbility(e.forme, parts[3])) e.ability = parts[3];
    } else if (kind === 'turn') turns = Number(parts[2]) || turns;
    else if (kind === 'win') winner = parts[2];
    // Strumenti e abilità rivelati da altre righe: "[from] item: Life Orb" (di chi subisce, o di [of] se c'è)
    if (kind && kind.startsWith('-')) {
      const from = tag(parts, 'from');
      const of = who(tag(parts, 'of'));
      const subject = who(parts[2]);
      const owner = of ?? subject;
      // Magician e Pickpocket: già visti sopra (in queste righe [of] è chi viene derubato)
      if (from && !/ability: (Magician|Pickpocket)/.test(from)) {
        const e = owner && own(owner.side, owner.nick);
        if (e && from.startsWith('item: ') && !e.item && !e.tricked) e.item = from.slice(6);
        if (from.startsWith('ability: ')) {
          // [of] a volte ha l'abilità (Static, Rough Skin), a volte l'ha solo colpita (Water Absorb): va a chi può averla
          const ability = from.slice(9);
          const holder = [of, subject].map(w => w && own(w.side, w.nick)).find(x => x && canHaveAbility(x.forme, ability));
          if (holder && !holder.ability) holder.ability = ability;
        }
      }
    }
  }
  if (preview.p1.length !== 6 || preview.p2.length !== 6) return null;
  const resolve = (side: 'p1' | 'p2'): Revealed[] => preview[side].map(name => {
    const base = name.replace(/-\*$/, '').split('-')[0];
    const e = info[side].get(base);
    const species = e?.forme ?? teamForme(name.replace(/-\*$/, ''));
    // Un'abilità che la forma non può avere (Embody Aspect di Ogerpon terastallizzato) non è del set
    const ability = e?.ability && canHaveAbility(species, e.ability) ? e.ability : undefined;
    return { species, moves: e ? [...e.moves] : [], ...(e?.item && { item: e.item }), ...(ability && { ability }), ...(e?.tera && { tera: e.tera }) };
  });
  return { p1: resolve('p1'), p2: resolve('p2'), winner, turns, players };
}

async function fetchFormat(format: string, known: Set<string>): Promise<Game[]> {
  const cutoff = Date.now() / 1000 - MAX_AGE_DAYS * 86400;
  const found: Game[] = [];
  let before: number | null = null;
  let scanned = 0;
  while (found.length < TARGET) {
    const list: { id: string; rating: number | null; uploadtime: number }[] | null = await json(
      `https://replay.pokemonshowdown.com/search.json?format=${format}${before ? `&before=${before}` : ''}`);
    await sleep(DELAY);
    if (!list?.length) break;
    before = list[list.length - 1].uploadtime;
    scanned += list.length;
    for (const e of list) {
      if (found.length >= TARGET) break;
      const rating = e.rating ?? 0;
      if (rating < MIN_RATING || rating > MAX_RATING || known.has(e.id)) continue;
      const log = await replayLog(e.id, DELAY);
      const g = log && parseGame(log);
      if (!g || !g.winner || g.turns < MIN_TURNS) continue;
      const winner = g.players.p1 === g.winner ? 1 : g.players.p2 === g.winner ? 2 : null;
      if (!winner) continue;
      known.add(e.id);
      found.push({ format, id: e.id, rating, turns: g.turns, uploadtime: e.uploadtime, p1: g.p1, p2: g.p2, winner });
    }
    if (before < cutoff) break;
    if (scanned % 2550 < 51) console.log(`${format}: ${scanned} partite scorse, ${found.length} tenute, fino al ${new Date(before * 1000).toISOString().slice(0, 10)}`);
  }
  console.log(`${format}: ${found.length} partite (${scanned} scorse)`);
  return found;
}

async function main() {
  // --parse=<file.log>: mostra cosa si legge da un log salvato, senza scaricare niente (per controllare il parser)
  const parseOnly = process.argv.find(a => a.startsWith('--parse='))?.slice(8);
  if (parseOnly) {
    console.log(JSON.stringify(parseGame(readFileSync(parseOnly, 'utf8')), null, 1));
    process.exit(0);
  }
  // --out=<nome>: il file d'uscita in scripts/bench (le partite del doppio stanno a parte, in games-doubles.json)
  const file = join('scripts', 'bench', process.argv.find(a => a.startsWith('--out='))?.slice(6) || 'games.json');
  const save = (games: Game[]) => writeFileSync(file, '[\n' + games.map(g => JSON.stringify(g)).join(',\n') + '\n]\n');
  // --reparse: rilegge le partite già salvate col parser di oggi (i log da data/replay-logs, o riscaricati una volta)
  if (process.argv.includes('--reparse')) {
    const games: Game[] = JSON.parse(readFileSync(file, 'utf8'));
    const kept: Game[] = [];
    for (const [i, game] of games.entries()) {
      const log = await replayLog(game.id, DELAY);
      const g = log && parseGame(log);
      if (g) kept.push({ ...game, p1: g.p1, p2: g.p2 });
      if ((i + 1) % 500 === 0) console.log(`${i + 1}/${games.length} rilette`);
    }
    save(kept);
    console.log(`Rilette ${kept.length} partite su ${games.length} in ${file}`);
    process.exit(0);
  }
  const formats = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const existing: Game[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const known = new Set(existing.map(g => g.id));
  const all = [...existing];
  for (const format of formats.length ? formats : ['gen9nationaldex', 'gen9ou']) {
    all.push(...await fetchFormat(format, known));
    // Salva dopo ogni formato: un'interruzione non perde tutto
    save(all);
  }
  console.log(`Salvate ${all.length} partite in ${file}`);
}

// Solo se lanciato da riga di comando: importato (per parseGame) non scarica niente
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
