/**
 * Banco dei team rotti apposta: si prende un team vero e lo si cambia in un modo di cui si sa già l'effetto giusto
 * (tolgo gli hazard, tolgo il recupero, tolgo la velocità, metto un Pokémon debole, cambio l'ordine…). Ogni volta che
 * il voto reagisce nel modo sbagliato è un'incongruenza, senza bisogno di una verità esterna.
 *
 *   npx tsx scripts/mutations.ts                 team da torneo di NatDex OU
 *   npx tsx scripts/mutations.ts --fmt=gen9ou    un altro formato
 *   npx tsx scripts/mutations.ts --limit=100     solo i primi N team (più veloce)
 *
 * Le regole controllano solo cose che devono valere sempre: un'area che non c'entra non si muove, un'area che si
 * indebolisce non sale, il voto di un team peggiorato non sale.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EngineData } from '../src/engine/data';
import { getMove, initTiers, toID } from '../src/engine/dex';
import type { FormatId } from '../src/engine/format';
import { rateTeam, type TeamRating } from '../src/engine/rating';
import type { TeamSet } from '../src/engine/sets';


const SOURCES: Partial<Record<FormatId, string>> = {
  ou: 'gen9nationaldex', ubers: 'gen9nationaldexubers', uu: 'gen9nationaldexuu', gen9ou: 'gen9ou', gen9uu: 'gen9uu', gen9ag: 'gen9anythinggoes',
};
const read = (dir: string, name: string) => { const p = join('data', dir, `${name}.json`); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FMT = (arg('fmt') ?? 'ou') as FormatId;
const LIMIT = Number(arg('limit') ?? 1e9);
const dir = SOURCES[FMT]!;
const tiers = read('_tiers', 'tiers'); if (tiers) initTiers(tiers);
const DATA = {
  formatId: FMT, stats: { meta: read(dir, 'meta'), pokemon: read(dir, 'stats') }, sets: read(dir, 'sets'), presets: read(dir, 'presets'),
  fallback: read('_fallback', 'sets'), fallbackPresets: read('_fallback', 'presets'), fallbackStats: read('_fallback', 'stats'),
} as EngineData;

interface BenchTeam { name: string; fmt: FormatId; cat: string; team: TeamSet[] }
const all = JSON.parse(readFileSync(join('scripts', 'bench', 'teams.json'), 'utf8')) as BenchTeam[];
const teams = all.filter(t => t.fmt === FMT && t.cat === 'torneo' && t.team.length === 6).slice(0, LIMIT);

/** Solo gli hazard di stato: Stone Axe e Ceaseless Edge sono anche attacchi, toglierli cambia giustamente l'Offesa. */
const HAZARDS = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb']);
const RECOVERY = new Set(['recover', 'roost', 'slackoff', 'softboiled', 'milkdrink', 'moonlight', 'synthesis', 'morningsun', 'shoreup', 'strengthsap', 'wish', 'rest']);
const isAttack = (m: string) => (getMove(m)?.category ?? 'Status') !== 'Status';
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
/** Setup offensivo: una mossa di stato su di sé che alza Attacco, Attacco Speciale o Velocità. */
/** Solo il setup puramente offensivo: Calm Mind, Bulk Up, Curse e simili alzano anche le difese, e la Difesa li conta. */
const isSetup = (m: string) => { const d = getMove(m); return !!d && d.category === 'Status' && d.target === 'self' && ((d.boosts?.atk ?? 0) > 0 || (d.boosts?.spa ?? 0) > 0 || (d.boosts?.spe ?? 0) > 0) && !(d.boosts?.def ?? 0) && !(d.boosts?.spd ?? 0) && d.id !== 'curse'; };
const clone = (team: TeamSet[]) => team.map(s => ({ ...s, moves: [...s.moves], evs: { ...s.evs } }));
const WEAK: TeamSet = { species: 'Raticate', item: 'Leftovers', ability: 'Guts', moves: ['Body Slam', 'Crunch', 'Quick Attack', 'Swords Dance'], nature: 'Jolly', evs: { atk: 252, spd: 4, spe: 252 } };
/** Una mossa di stato che non dà niente a nessuna area. */
const FILLER = 'Protect';

const area = (r: TeamRating, key: string) => r.areas.find(a => a.key === key)?.value ?? 0;
type Check = { what: string; ok: (before: TeamRating, after: TeamRating) => boolean; detail: (before: TeamRating, after: TeamRating) => string };
const areas = (r: TeamRating) => `Dif ${area(r, 'defense')} Off ${area(r, 'strength')} Vel ${area(r, 'speed')} voto ${r.overall}`;
const same = (key: string, label: string): Check => ({ what: `${label} invariata`, ok: (b, a) => area(b, key) === area(a, key), detail: (b, a) => `${area(b, key)} → ${area(a, key)}` });
const notUp = (key: string, label: string): Check => ({ what: `${label} non sale`, ok: (b, a) => area(a, key) <= area(b, key), detail: (b, a) => `${area(b, key)} → ${area(a, key)}` });
const overallNotUp: Check = { what: 'voto non sale', ok: (b, a) => a.overall <= b.overall, detail: (b, a) => `${b.overall} → ${a.overall}` };
const overallDown: Check = { what: 'voto scende', ok: (b, a) => a.overall < b.overall, detail: (b, a) => `${b.overall} → ${a.overall}` };
const identical: Check = { what: 'tutto identico', ok: (b, a) => areas(b) === areas(a), detail: (b, a) => `${areas(b)} → ${areas(a)}` };

interface Mutation {
  key: string;
  label: string;
  /** Il team cambiato e una descrizione, o null se al team non si applica. */
  apply: (team: TeamSet[]) => { team: TeamSet[]; what: string } | null;
  checks: Check[];
}

const MUTATIONS: Mutation[] = [
  {
    key: 'order', label: 'ordine dei membri al contrario',
    apply: team => ({ team: [...clone(team)].reverse(), what: '' }),
    checks: [identical],
  },
  {
    key: 'hazards', label: 'tolgo tutti gli hazard (Protect al loro posto)',
    apply: team => {
      if (!team.some(s => s.moves.some(m => HAZARDS.has(toID(m))))) return null;
      const t = clone(team);
      for (const s of t) s.moves = s.moves.map(m => (HAZARDS.has(toID(m)) ? FILLER : m));
      return { team: t, what: '' };
    },
    checks: [same('strength', 'Offesa'), same('defense', 'Difesa'), overallNotUp],
  },
  {
    key: 'recovery', label: 'tolgo il recupero a un muro (il primo con una mossa di recupero)',
    apply: team => {
      const i = team.findIndex(s => s.moves.some(m => RECOVERY.has(toID(m))));
      if (i < 0) return null;
      const t = clone(team);
      t[i].moves = t[i].moves.map(m => (RECOVERY.has(toID(m)) ? FILLER : m));
      return { team: t, what: t[i].species };
    },
    checks: [notUp('defense', 'Difesa'), same('strength', 'Offesa'), overallNotUp],
  },
  {
    key: 'attack', label: "tolgo una mossa d'attacco a ogni membro (la prima)",
    apply: team => {
      const t = clone(team);
      let changed = false;
      for (const s of t) {
        // Non le mosse che curano (Drain Punch, Giga Drain…) né quelle che tolgono gli hazard: la Difesa le conta
        const j = s.moves.findIndex(m => isAttack(m) && !getMove(m)?.drain && !REMOVAL.has(toID(m)));
        if (j >= 0 && s.moves.filter(isAttack).length >= 2) { s.moves[j] = FILLER; changed = true; }
      }
      return changed ? { team: t, what: '' } : null;
    },
    checks: [notUp('strength', 'Offesa'), same('defense', 'Difesa'), notUp('speed', 'Velocità')],
  },
  {
    key: 'speedEvs', label: 'tolgo gli EV in Velocità a tutti (natura neutra)',
    apply: team => {
      const t = clone(team);
      for (const s of t) { s.evs.spe = 0; s.nature = 'Hardy'; }
      return { team: t, what: '' };
    },
    checks: [notUp('speed', 'Velocità')],
  },
  {
    key: 'removal', label: 'tolgo tutte le rimozioni degli hazard',
    apply: team => {
      if (!team.some(s => s.moves.some(m => REMOVAL.has(toID(m))))) return null;
      const t = clone(team);
      for (const s of t) s.moves = s.moves.map(m => (REMOVAL.has(toID(m)) ? FILLER : m));
      return { team: t, what: '' };
    },
    checks: [notUp('defense', 'Difesa')],
  },
  {
    key: 'setup', label: 'tolgo tutte le mosse di setup offensivo',
    apply: team => {
      if (!team.some(s => s.moves.some(isSetup))) return null;
      const t = clone(team);
      for (const s of t) s.moves = s.moves.map(m => (isSetup(m) ? FILLER : m));
      return { team: t, what: '' };
    },
    checks: [notUp('strength', 'Offesa'), notUp('speed', 'Velocità'), same('defense', 'Difesa')],
  },
  {
    key: 'bulkEvs', label: 'sposto gli EV della Velocità nei PS',
    apply: team => {
      const t = clone(team);
      let changed = false;
      for (const s of t) {
        const spe = s.evs.spe ?? 0;
        const room = 252 - (s.evs.hp ?? 0);
        const moved = Math.min(spe, room);
        if (moved > 0) { s.evs.hp = (s.evs.hp ?? 0) + moved; s.evs.spe = spe - moved; changed = true; }
      }
      return changed ? { team: t, what: '' } : null;
    },
    checks: [notUp('speed', 'Velocità'), { what: 'Difesa non scende', ok: (b, a) => area(a, 'defense') >= area(b, 'defense'), detail: (b, a) => `${area(b, 'defense')} → ${area(a, 'defense')}` }],
  },
  {
    key: 'attackEvs', label: "252 EV nella statistica d'attacco di chi attacca (presi da PS e difese)",
    apply: team => {
      const t = clone(team);
      let changed = false;
      for (const s of t) {
        const attacks = s.moves.filter(isAttack).map(m => getMove(m)!.category);
        if (attacks.length < 2) continue;
        const stat = attacks.filter(c => c === 'Physical').length >= attacks.filter(c => c === 'Special').length ? 'atk' : 'spa';
        const need = 252 - (s.evs[stat] ?? 0);
        if (need <= 0) continue;
        let left = need;
        for (const from of ['def', 'spd', 'hp'] as const) {
          const take = Math.min(left, s.evs[from] ?? 0);
          s.evs[from] = (s.evs[from] ?? 0) - take; left -= take;
        }
        s.evs[stat] = 252 - left;
        if (need - left > 0) changed = true;
      }
      return changed ? { team: t, what: '' } : null;
    },
    checks: [{ what: 'Offesa non scende', ok: (b, a) => area(a, 'strength') >= area(b, 'strength'), detail: (b, a) => `${area(b, 'strength')} → ${area(a, 'strength')}` }],
  },
  {
    key: 'weak', label: 'sostituisco un membro con Raticate (ognuno a turno: il peggiore dei sei)',
    apply: () => null,
    checks: [overallDown],
  },
  {
    key: 'items', label: 'tolgo tutti gli strumenti',
    apply: team => {
      // Le Mega e gli strumenti che cambiano forma restano: senza, il Pokémon non è più quello
      const keep = (s: TeamSet) => /ite( [XY])?$|^Rusted|Orb$|Memory$|Drive$|Plate$/.test(s.item) && !/^(Flame|Toxic|Life) Orb$/.test(s.item);
      const t = clone(team).map(s => (keep(s) ? s : { ...s, item: '' }));
      return { team: t, what: '' };
    },
    checks: [overallNotUp],
  },
];

const rate = (team: TeamSet[]) => rateTeam(team, DATA)!;
const found: Record<string, { label: string; tried: number; bad: string[] }> = {};
const start = Date.now();
for (const [n, t] of teams.entries()) {
  const before = rate(t.team);
  for (const m of MUTATIONS) {
    const entry = (found[m.key] ??= { label: m.label, tried: 0, bad: [] });
    if (m.key === 'weak') {
      // Il cambio peggiore dei sei: il voto deve comunque scendere
      const worst = t.team.map((_, i) => { const team = clone(t.team); team[i] = { ...WEAK, evs: { ...WEAK.evs }, moves: [...WEAK.moves] }; return { i, r: rate(team) }; })
        .sort((a, b) => b.r.overall - a.r.overall)[0];
      entry.tried++;
      for (const c of m.checks) if (!c.ok(before, worst.r)) entry.bad.push(`${c.what}: ${c.detail(before, worst.r)} (al posto di ${t.team[worst.i].species}) — ${t.name}`);
      continue;
    }
    const mutated = m.apply(t.team);
    if (!mutated) continue;
    entry.tried++;
    const after = rate(mutated.team);
    for (const c of m.checks) if (!c.ok(before, after)) entry.bad.push(`${c.what}: ${c.detail(before, after)}${mutated.what ? ` (${mutated.what})` : ''} — ${t.name}`);
  }
  if ((n + 1) % 50 === 0) console.log(`${n + 1}/${teams.length} team, ${((Date.now() - start) / 1000).toFixed(0)} s`);
}

console.log(`\nTeam rotti apposta: ${teams.length} team da torneo di ${FMT}\n`);
for (const { label, tried, bad } of Object.values(found)) {
  console.log(`${bad.length ? '✗' : '✓'} ${label}: ${bad.length} incongruenze su ${tried} prove`);
  for (const line of bad.slice(0, 8)) console.log(`    ${line}`);
  if (bad.length > 8) console.log(`    … e altre ${bad.length - 8}`);
}
