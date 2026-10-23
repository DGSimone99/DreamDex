/**
 * Banco del voto: i team di scripts/bench/teams.json valutati sui dati scaricati (npm run fetch-data).
 *
 *   npm run bench            medie e voti per categoria, col meta e senza; ordine buono > medio > scarso; archetipi
 *   npm run bench -- --climb  la "salita": da alcuni team si applica sempre lo scambio libero migliore finché il voto sale
 *   npm run bench -- --replays partite vere di alto livello (scripts/bench/replays.json): quante ne vince il team col voto più alto
 *
 * Serve a verificare ogni modifica al voto: i team da torneo devono stare in alto, i brutti in basso,
 * e la salita non deve arrivare a 100 né portare ogni team allo stesso archetipo.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { teamArchetype } from '../src/engine/archetype';
import type { EngineData } from '../src/engine/data';
import { initTiers } from '../src/engine/dex';
import { DEFAULT_FORMAT, type FormatId } from '../src/engine/format';
import { formatRules } from '../src/engine/formatRules';
import { rateTeam, type TeamRating } from '../src/engine/rating';
import { improveReplacements } from '../src/engine/replace';
import { defaultSet, type TeamSet } from '../src/engine/sets';
import { bestSwaps, withCandidate } from '../src/engine/teamGain';

interface BenchTeam {
  name: string;
  fmt: FormatId;
  /** riferimento, torneo, datato (torneo di un meta passato), buono, generato, medio, brutto */
  cat: string;
  /** Banco per archetipi: archetipo atteso, livello e gruppo (la stessa base in tre livelli). */
  archetype?: string;
  tier?: 'buono' | 'medio' | 'scarso';
  group?: string;
  team: TeamSet[];
}

const SOURCES: Partial<Record<FormatId, string>> = {
  ou: 'gen9nationaldex', ubers: 'gen9nationaldexubers', uu: 'gen9nationaldexuu', gen9ou: 'gen9ou', gen9uu: 'gen9uu', gen9ag: 'gen9anythinggoes',
};
const read = (dir: string, name: string) => {
  const path = join('data', dir, `${name}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};
const load = (formatId: FormatId): EngineData => {
  const dir = SOURCES[formatId]!;
  return {
    formatId,
    stats: { meta: read(dir, 'meta'), pokemon: read(dir, 'stats') },
    sets: read(dir, 'sets'), presets: read(dir, 'presets'),
    fallback: read('_fallback', 'sets'), fallbackPresets: read('_fallback', 'presets'), fallbackStats: read('_fallback', 'stats'),
  } as EngineData;
};

if (!existsSync(join('data', SOURCES.ou!, 'stats.json'))) {
  console.error('Mancano i dati: lancia prima npm run fetch-data');
  process.exit(1);
}
const tiers = read('_tiers', 'tiers');
if (tiers) initTiers(tiers);
const DATA = Object.fromEntries(Object.keys(SOURCES).map(id => [id, load(id as FormatId)])) as Record<string, EngineData>;

const teams = JSON.parse(readFileSync(join('scripts', 'bench', 'teams.json'), 'utf8')) as BenchTeam[];
// Per le medie, stessi Pokémon nella stessa categoria e formato contano una volta sola
const seen = new Set<string>();
const unique = teams.filter(t => {
  const key = `${t.fmt} ${t.cat} ${t.team.map(s => s.species).sort().join('/')}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const grades = (rs: TeamRating[]) => ['S', 'A', 'B', 'C', 'D'].map(g => `${g}${rs.filter(r => r.grade === g).length}`).join(' ');
const areas = (r: TeamRating) => r.areas.map(a => `${a.key} ${a.value ?? '–'}`).join(' · ');
const reference = teams.find(t => t.cat === 'riferimento');

/** Tempo medio di un voto: a freddo (prima volta per ogni team) e a cache calda. Il voto non deve bloccare la pagina. */
function timing() {
  const time = () => {
    const start = performance.now();
    for (const t of unique) rateTeam(t.team, DATA[t.fmt]);
    return (performance.now() - start) / unique.length;
  };
  const cold = time();
  const warm = time();
  console.log(`\ntempo per voto: a freddo ${cold.toFixed(1)} ms, a cache calda ${warm.toFixed(1)} ms (${unique.length} team)`);
}

function summary() {
  timing();
  for (const withMeta of [true, false]) {
    const rate = (t: BenchTeam) => rateTeam(t.team, withMeta ? DATA[t.fmt] : { ...DATA[t.fmt], ignoreMeta: true })!;
    console.log(`\n[${withMeta ? 'col meta' : 'senza meta'}]`);
    if (reference) {
      const r = rate(reference);
      console.log(`  ${reference.name}: ${r.overall} ${r.grade}  (${areas(r)})`);
    }
    const averages: Record<string, number> = {};
    // 'datato': squadre di torneo di un meta passato (Gen 9 UU di Smogon), a parte
    for (const cat of ['torneo', 'datato', 'buono', 'generato', 'medio', 'brutto']) {
      const rs = unique.filter(t => t.cat === cat).map(rate);
      averages[cat] = mean(rs.map(r => r.overall));
      console.log(`  ${cat.padEnd(9)} ${String(rs.length).padStart(3)} team  media ${averages[cat].toFixed(1).padStart(4)}  ${grades(rs)}`);
    }
    console.log(`  distacco torneo − medio ${(averages.torneo - averages.medio).toFixed(1)}, buono − medio ${(averages.buono - averages.medio).toFixed(1)}`);
    // Per formato: i team da torneo di NatDex OU sono la maggioranza e non devono coprire gli altri
    for (const fmt of Object.keys(SOURCES)) {
      const cells = ['torneo', 'datato', 'buono', 'generato', 'medio', 'brutto'].flatMap(cat => {
        const rs = unique.filter(t => t.fmt === fmt && t.cat === cat).map(rate);
        return rs.length ? [`${cat} ${mean(rs.map(r => r.overall)).toFixed(1)} (${rs.length})`] : [];
      });
      if (cells.length) console.log(`    ${fmt.padEnd(7)} ${cells.join(' · ')}`);
    }
    // Ogni base del banco per archetipi in tre livelli: il voto deve rispettarne l'ordine
    const groups = [...new Set(teams.filter(t => t.group).map(t => t.group!))];
    const ordered = groups.filter(group => {
      const [good, medium, poor] = (['buono', 'medio', 'scarso'] as const).map(tier => rate(teams.find(t => t.group === group && t.tier === tier)!).overall);
      return good > medium && medium > poor;
    });
    console.log(`  ordine buono > medio > scarso: ${ordered.length}/${groups.length}`);
  }
  const archetypal = teams.filter(t => t.tier === 'buono');
  const recognised = archetypal.filter(t => teamArchetype(t.team, formatRules(t.fmt))?.archetype === t.archetype);
  console.log(`\narchetipi riconosciuti (banco, livello buono): ${recognised.length}/${archetypal.length}`);
}

/** Applica sempre lo scambio libero migliore finché il voto sale (al massimo `steps` volte). */
function climb(start: BenchTeam, steps = 10) {
  const data = DATA[start.fmt];
  const rules = formatRules(start.fmt);
  let team = start.team;
  const first = rateTeam(team, data)!;
  const path: string[] = [];
  for (let step = 0; step < steps; step++) {
    const [best] = bestSwaps(team, data, 'it', index => improveReplacements(team, index, { ...DEFAULT_FORMAT, formatId: start.fmt }, data, 15));
    if (!best || best.teamGain.gain <= 0) break;
    path.push(`${best.species} per ${team[best.replaces].species} +${best.teamGain.gain}`);
    team = withCandidate(team, best.set, best.replaces);
  }
  const last = rateTeam(team, data)!;
  const from = teamArchetype(start.team, rules)?.archetype ?? '?';
  const to = teamArchetype(team, rules)?.archetype ?? '?';
  console.log(`\n${start.name} [${start.fmt}]: ${first.overall} ${first.grade} (${from}) → ${last.overall} ${last.grade} (${to}) in ${path.length} scambi`);
  if (path.length) console.log(`  ${path.join(' · ')}`);
  console.log(`  ${team.map(s => s.species).join(', ')}`);
  console.log(`  ${areas(last)}`);
}

/**
 * Partite vere: i due team (set più usati di ogni Pokémon) valutati col voto; quante ne vince il team col voto più alto.
 * La bravura dei giocatori pesa molto: il 50% è il caso puro, ogni punto sopra è un segnale.
 */
function replays() {
  const file = join('scripts', 'bench', 'replays.json');
  if (!existsSync(file)) {
    console.error('Mancano le partite: lancia npx tsx scripts/fetch-replays.ts');
    return;
  }
  const FORMAT: Record<string, FormatId> = { gen9nationaldex: 'ou', gen9ou: 'gen9ou', gen9nationaldexubers: 'ubers', gen9uu: 'gen9uu', gen9nationaldexuu: 'uu' };
  const games = (JSON.parse(readFileSync(file, 'utf8')) as { format: string; rating: number; p1: string[]; p2: string[]; winner: 1 | 2 }[])
    .filter(g => FORMAT[g.format] && DATA[FORMAT[g.format]]);
  for (const withMeta of [true, false]) {
    const bins = [[1, 4], [5, 9], [10, 100]] as const;
    const stats = bins.map(() => ({ right: 0, total: 0 }));
    let skipped = 0;
    for (const game of games) {
      const formatId = FORMAT[game.format];
      const data = withMeta ? DATA[formatId] : { ...DATA[formatId], ignoreMeta: true };
      const build = (names: string[]) => names.map(name => defaultSet(DATA[formatId], name, 9)).filter((s): s is TeamSet => !!s);
      const [a, b] = [build(game.p1), build(game.p2)];
      if (a.length !== 6 || b.length !== 6) { skipped++; continue; }
      const diff = rateTeam(a, data)!.overall - rateTeam(b, data)!.overall;
      const bin = bins.findIndex(([lo, hi]) => Math.abs(diff) >= lo && Math.abs(diff) <= hi);
      if (bin < 0) continue;
      stats[bin].total++;
      if ((diff > 0 && game.winner === 1) || (diff < 0 && game.winner === 2)) stats[bin].right++;
    }
    const all = stats.reduce((acc, s) => ({ right: acc.right + s.right, total: acc.total + s.total }), { right: 0, total: 0 });
    const pct = (s: { right: number; total: number }) => (s.total ? `${(100 * s.right / s.total).toFixed(1)}% su ${s.total}` : '–');
    console.log(`
[${withMeta ? 'col meta' : 'senza meta'}] ${games.length} partite (${skipped} saltate: Pokémon senza set)`);
    console.log(`  vince il voto più alto: ${pct(all)}`);
    bins.forEach(([lo, hi], i) => console.log(`  differenza ${lo}–${hi === 100 ? '…' : hi}: ${pct(stats[i])}`));
  }
}

if (process.argv.includes('--replays')) {
  replays();
} else if (process.argv.includes('--climb')) {
  // Il team di riferimento e la base migliore di ogni archetipo in OU
  const starts = [reference, ...['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall']
    .map(arch => teams.find(t => t.fmt === 'ou' && t.archetype === arch && t.tier === 'buono'))]
    .filter((t): t is BenchTeam => !!t);
  for (const start of starts) climb(start);
} else {
  summary();
}
