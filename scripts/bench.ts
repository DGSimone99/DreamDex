/**
 * Banco del voto: i team di scripts/bench/teams.json valutati sui dati scaricati (npm run fetch-data).
 *
 *   npm run bench            medie e voti per categoria, col meta e senza; ordine buono > medio > scarso; archetipi
 *   npm run bench -- --climb  la "salita": da alcuni team si applica sempre lo scambio libero migliore finché il voto sale
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
import type { TeamSet } from '../src/engine/sets';
import { bestSwaps, withCandidate } from '../src/engine/teamGain';

interface BenchTeam {
  name: string;
  fmt: FormatId;
  /** riferimento, torneo, buono, generato, medio, brutto */
  cat: string;
  /** Banco per archetipi: archetipo atteso, livello e gruppo (la stessa base in tre livelli). */
  archetype?: string;
  tier?: 'buono' | 'medio' | 'scarso';
  group?: string;
  team: TeamSet[];
}

const SOURCES: Partial<Record<FormatId, string>> = { ou: 'gen9nationaldex', ubers: 'gen9nationaldexubers', uu: 'gen9nationaldexuu', gen9ou: 'gen9ou' };
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

function summary() {
  for (const withMeta of [true, false]) {
    const rate = (t: BenchTeam) => rateTeam(t.team, withMeta ? DATA[t.fmt] : { ...DATA[t.fmt], ignoreMeta: true })!;
    console.log(`\n[${withMeta ? 'col meta' : 'senza meta'}]`);
    if (reference) {
      const r = rate(reference);
      console.log(`  ${reference.name}: ${r.overall} ${r.grade}  (${areas(r)})`);
    }
    const averages: Record<string, number> = {};
    for (const cat of ['torneo', 'buono', 'generato', 'medio', 'brutto']) {
      const rs = unique.filter(t => t.cat === cat).map(rate);
      averages[cat] = mean(rs.map(r => r.overall));
      console.log(`  ${cat.padEnd(9)} ${String(rs.length).padStart(3)} team  media ${averages[cat].toFixed(1).padStart(4)}  ${grades(rs)}`);
    }
    console.log(`  distacco torneo − medio ${(averages.torneo - averages.medio).toFixed(1)}, buono − medio ${(averages.buono - averages.medio).toFixed(1)}`);
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

if (process.argv.includes('--climb')) {
  // Il team di riferimento e la base migliore di ogni archetipo in OU
  const starts = [reference, ...['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall']
    .map(arch => teams.find(t => t.fmt === 'ou' && t.archetype === arch && t.tier === 'buono'))]
    .filter((t): t is BenchTeam => !!t);
  for (const start of starts) climb(start);
} else {
  summary();
}
