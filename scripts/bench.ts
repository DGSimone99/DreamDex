/**
 * Banco del voto: i team di scripts/bench/teams.json valutati sui dati scaricati (npm run fetch-data).
 *
 *   npm run bench            medie e voti per categoria, col meta e senza; ordine buono > medio > scarso; archetipi;
 *                            con scripts/bench/ladder.json (npx tsx scripts/fetch-replays.ts --ladder) anche il gruppo
 *                            "ladder": team veri di giocatori medi (rating 1100–1400), il "medio" non costruito a mano
 *   npm run bench -- --climb  la "salita": da alcuni team si applica sempre lo scambio libero migliore finché il voto sale
 *   npm run bench -- --replays partite vere (scripts/bench/replays.json di alto livello e, se c'è, ladder.json dei medi):
 *                            quante ne vince il team col voto più alto
 *   SPEED_TOP=1 npm run bench        Velocità coi pesi per posizione dal più veloce (30/30/20/10/5/5) invece della media semplice
 *   ROLES_MEASURED=1 npm run bench   con l'interruttore dei Ruoli acceso (Attacco, muri e Recupero contano anche nei Ruoli)
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
// Il voto v1 congelato (legacy/voto-v1): solo per --confronta
import { initTiers as initTiersV1 } from '../legacy/voto-v1/engine/dex';
import { rateTeam as rateTeamV1 } from '../legacy/voto-v1/engine/rating';
import { setRolesCountMeasured } from '../src/engine/roleLevels';
import { setSpeedTopHeavy } from '../src/engine/speedArea';
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

if (process.env.SPEED_TOP === '1') {
  setSpeedTopHeavy(true);
  console.log('Velocità: pesi per posizione dal più veloce (SPEED_TOP=1)');
}
if (process.env.ROLES_MEASURED === '1') {
  setRolesCountMeasured(true);
  console.log('Ruoli: interruttore acceso (ROLES_MEASURED=1)');
}

if (!existsSync(join('data', SOURCES.ou!, 'stats.json'))) {
  console.error('Mancano i dati: lancia prima npm run fetch-data');
  process.exit(1);
}
const tiers = read('_tiers', 'tiers');
if (tiers) { initTiers(tiers); initTiersV1(tiers); }
const DATA = Object.fromEntries(Object.keys(SOURCES).map(id => [id, load(id as FormatId)])) as Record<string, EngineData>;
/** Gli stessi dati, oggetti separati: le cache dei due motori non si toccano. */
const DATA_V1 = Object.fromEntries(Object.keys(SOURCES).map(id => [id, load(id as FormatId)])) as Record<string, EngineData>;

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

interface Game { format: string; rating: number; p1: string[]; p2: string[]; winner: 1 | 2 }
const REPLAY_FORMAT: Record<string, FormatId> = { gen9nationaldex: 'ou', gen9ou: 'gen9ou', gen9nationaldexubers: 'ubers', gen9uu: 'gen9uu', gen9nationaldexuu: 'uu' };
const readGames = (name: string): Game[] => {
  const file = join('scripts', 'bench', name);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Game[]).filter(g => REPLAY_FORMAT[g.format] && DATA[REPLAY_FORMAT[g.format]]) : [];
};
/** Team di una partita coi set più usati di ogni Pokémon (null se a qualcuno manca il set). */
const gameTeam = (formatId: FormatId, names: string[]): TeamSet[] | null => {
  const team = names.map(name => defaultSet(DATA[formatId], name, 9)).filter((s): s is TeamSet => !!s);
  return team.length === 6 ? team : null;
};
/** I team del ladder medio, uno per combinazione di Pokémon, col formato. */
const ladderTeams = (): { fmt: FormatId; team: TeamSet[] }[] => {
  const out: { fmt: FormatId; team: TeamSet[] }[] = [];
  const seenTeams = new Set<string>();
  for (const game of readGames('ladder.json')) {
    const fmt = REPLAY_FORMAT[game.format];
    for (const names of [game.p1, game.p2]) {
      const key = `${fmt} ${[...names].sort().join('/')}`;
      const team = seenTeams.has(key) ? null : gameTeam(fmt, names);
      if (!team) continue;
      seenTeams.add(key);
      out.push({ fmt, team });
    }
  }
  return out;
};

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
    // Area Ruoli dei team da torneo per tipo di team riconosciuto
    const byType = new Map<string, number[]>();
    for (const r of unique.filter(t => t.cat === 'torneo').map(rate)) {
      const v = r.areas.find(a => a.key === 'roles')?.value;
      if (v != null) byType.set(r.teamType, [...(byType.get(r.teamType) ?? []), v]);
    }
    console.log(`  Ruoli dei team da torneo: ${[...byType].map(([type, vs]) => `${type} ${mean(vs).toFixed(1)} (${vs.length})`).join(' · ')}`);
    console.log(`  distacco torneo − medio ${(averages.torneo - averages.medio).toFixed(1)}, buono − medio ${(averages.buono - averages.medio).toFixed(1)}`);
    // Il ladder medio: team veri di giocatori medi, per formato; il torneo dello stesso formato deve stare sopra
    const ladder = ladderTeams();
    if (ladder.length) {
      const rs = ladder.map(t => rateTeam(t.team, withMeta ? DATA[t.fmt] : { ...DATA[t.fmt], ignoreMeta: true })!);
      console.log(`  ladder    ${String(rs.length).padStart(3)} team  media ${mean(rs.map(r => r.overall)).toFixed(1).padStart(4)}  ${grades(rs)}   distacco torneo − ladder ${(averages.torneo - mean(rs.map(r => r.overall))).toFixed(1)}`);
      for (const fmt of [...new Set(ladder.map(t => t.fmt))]) {
        const l = ladder.filter(t => t.fmt === fmt).map(t => rateTeam(t.team, withMeta ? DATA[fmt] : { ...DATA[fmt], ignoreMeta: true })!.overall);
        const tour = unique.filter(t => t.fmt === fmt && t.cat === 'torneo').map(t => rate(t).overall);
        console.log(`    ${fmt.padEnd(7)} ladder ${mean(l).toFixed(1)} (${l.length}) · torneo ${mean(tour).toFixed(1)} (${tour.length}) · distacco ${(mean(tour) - mean(l)).toFixed(1)}`);
      }
    }
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
  if (!existsSync(join('scripts', 'bench', 'replays.json'))) {
    console.error('Mancano le partite: lancia npx tsx scripts/fetch-replays.ts');
    return;
  }
  for (const name of ['replays.json', 'ladder.json']) replayFile(name, readGames(name));
}

function replayFile(name: string, games: Game[]) {
  if (!games.length) return;
  console.log(`\n== ${name === 'ladder.json' ? 'ladder medio (rating 1100–1400)' : 'alto livello'}: ${name}`);
  for (const withMeta of [true, false]) {
    const bins = [[1, 4], [5, 9], [10, 100]] as const;
    const stats = bins.map(() => ({ right: 0, total: 0 }));
    let skipped = 0;
    for (const game of games) {
      const formatId = REPLAY_FORMAT[game.format];
      const data = withMeta ? DATA[formatId] : { ...DATA[formatId], ignoreMeta: true };
      const [a, b] = [gameTeam(formatId, game.p1), gameTeam(formatId, game.p2)];
      if (!a || !b) { skipped++; continue; }
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

type Rate = (team: TeamSet[], fmt: FormatId, withMeta: boolean) => TeamRating;
const ENGINES: { name: string; rate: Rate }[] = [
  { name: 'v1', rate: (team, fmt, withMeta) => rateTeamV1(team, withMeta ? DATA_V1[fmt] : { ...DATA_V1[fmt], ignoreMeta: true }) as unknown as TeamRating },
  { name: 'nuovo', rate: (team, fmt, withMeta) => rateTeam(team, withMeta ? DATA[fmt] : { ...DATA[fmt], ignoreMeta: true })! },
];
const AREA_KEYS = ['strength', 'defense', 'speed', 'roles'];
const areaOf = (r: TeamRating, key: string) => r.areas.find(a => a.key === key)?.value ?? 0;
const arrow = (a: number, b: number) => `${a.toFixed(1)} → ${b.toFixed(1)}`;

/** --confronta: gli stessi team nel voto v1 congelato e nel voto attuale, gruppo per gruppo e area per area. */
function confronta() {
  const ladder = ladderTeams().map((t, i) => ({ name: `ladder ${i + 1}`, fmt: t.fmt, cat: 'ladder', team: t.team }) as BenchTeam);
  const pool = [...unique, ...ladder];
  for (const withMeta of [true, false]) {
    console.log(`
[${withMeta ? 'col meta' : 'senza meta'}]  v1 → nuovo`);
    const rated = pool.map(t => ({ t, v1: ENGINES[0].rate(t.team, t.fmt, withMeta), now: ENGINES[1].rate(t.team, t.fmt, withMeta) }));
    const avg: Record<string, [number, number]> = {};
    for (const cat of ['torneo', 'buono', 'medio', 'brutto', 'ladder']) {
      const rs = rated.filter(r => r.t.cat === cat);
      if (!rs.length) continue;
      avg[cat] = [mean(rs.map(r => r.v1.overall)), mean(rs.map(r => r.now.overall))];
      const areaText = AREA_KEYS.map(k => `${k} ${arrow(mean(rs.map(r => areaOf(r.v1, k))), mean(rs.map(r => areaOf(r.now, k))))}`).join(' · ');
      console.log(`  ${cat.padEnd(7)} ${String(rs.length).padStart(3)} team  voto ${arrow(avg[cat][0], avg[cat][1])}   ${grades(rs.map(r => r.v1))} → ${grades(rs.map(r => r.now))}`);
      console.log(`          ${areaText}`);
    }
    const gap = (a: string, b: string, i: 0 | 1) => (avg[a] && avg[b] ? avg[a][i] - avg[b][i] : 0);
    console.log(`  distacco torneo − medio ${arrow(gap('torneo', 'medio', 0), gap('torneo', 'medio', 1))}, torneo − ladder ${arrow(gap('torneo', 'ladder', 0), gap('torneo', 'ladder', 1))}`);
    const moved = rated.filter(r => r.t.cat !== 'ladder').sort((a, b) => Math.abs(b.now.overall - b.v1.overall) - Math.abs(a.now.overall - a.v1.overall)).slice(0, 10);
    console.log('  i 10 team che si muovono di più:');
    for (const r of moved) {
      const deltas = AREA_KEYS.map(k => `${k} ${(areaOf(r.now, k) - areaOf(r.v1, k)) >= 0 ? '+' : ''}${areaOf(r.now, k) - areaOf(r.v1, k)}`).join(' ');
      console.log(`    ${(r.now.overall - r.v1.overall) >= 0 ? '+' : ''}${r.now.overall - r.v1.overall}  ${r.v1.overall} → ${r.now.overall}  ${r.t.name} [${r.t.fmt}, ${r.t.cat}]  (${deltas})`);
    }
  }
}

/** --confronta --replays: quante partite indovina il voto più alto, v1 e attuale fianco a fianco. */
function confrontaReplays() {
  for (const name of ['replays.json', 'ladder.json']) {
    const games = readGames(name);
    if (!games.length) continue;
    console.log(`
== ${name === 'ladder.json' ? 'ladder medio (rating 1100–1400)' : 'alto livello'}: ${name}   v1 → nuovo`);
    for (const withMeta of [true, false]) {
      const bins = [[1, 4], [5, 9], [10, 100]] as const;
      const result = ENGINES.map(engine => {
        const stats = bins.map(() => ({ right: 0, total: 0 }));
        for (const game of games) {
          const fmt = REPLAY_FORMAT[game.format];
          const [a, b] = [gameTeam(fmt, game.p1), gameTeam(fmt, game.p2)];
          if (!a || !b) continue;
          const diff = engine.rate(a, fmt, withMeta).overall - engine.rate(b, fmt, withMeta).overall;
          const bin = bins.findIndex(([lo, hi]) => Math.abs(diff) >= lo && Math.abs(diff) <= hi);
          if (bin < 0) continue;
          stats[bin].total++;
          if ((diff > 0 && game.winner === 1) || (diff < 0 && game.winner === 2)) stats[bin].right++;
        }
        const all = stats.reduce((acc, x) => ({ right: acc.right + x.right, total: acc.total + x.total }), { right: 0, total: 0 });
        return [all, ...stats];
      });
      const pct = (x: { right: number; total: number }) => (x.total ? `${(100 * x.right / x.total).toFixed(1)}% (${x.total})` : '–');
      console.log(`  [${withMeta ? 'col meta' : 'senza meta'}]`);
      ['vince il voto più alto', 'differenza 1–4', 'differenza 5–9', 'differenza 10–…'].forEach((label, i) =>
        console.log(`    ${label.padEnd(23)} ${pct(result[0][i]).padEnd(14)} → ${pct(result[1][i])}`));
    }
  }
}

if (process.argv.includes('--confronta')) {
  if (process.argv.includes('--replays')) confrontaReplays();
  else confronta();
} else if (process.argv.includes('--replays')) {
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
