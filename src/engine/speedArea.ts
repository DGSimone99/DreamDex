import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { softScore } from './scale';
import { bestHit, setKey } from './damage';
import { metaThreats } from './attackers';
import { ownConditions } from './coverage';
import { usesMeta } from './analysis';
import type { TeamSet } from './sets';
import { isWebImmune, outspeedShare, sameSelf, speedPool, speedStat, tierSpecies, type SpeedRival } from './speed';
import { ownField } from './types';
import { getSpecies } from './dex';

export { isWebImmune };

/** Le condizioni che fanno superare più Pokémon: setup, meteo/campo, Unburden, Sticky Web, Trick Room, Tailwind, paralisi e rallentamenti. */
export type SpeedCondition = 'setup' | 'weather' | 'unburden' | 'web' | 'trickroom' | 'tailwind' | 'slow';

/** Peso di ogni membro per posizione di velocità, dal più veloce: i due più rapidi fanno quasi tutto, ma la velocità serve a tutti. */
export const SPEED_RANK_WEIGHTS = [25, 20, 16, 14, 13, 12];

/**
 * Quota del guadagno che entra nel voto: metà per ciò che dura o regge il team (setup, meteo, Web, Trick Room),
 * un quarto per Tailwind e un bersaglio rallentato.
 */
export const CONDITION_QUOTA: Record<SpeedCondition, number> = { setup: 0.5, weather: 0.5, unburden: 0.5, web: 0.5, trickroom: 0.5, tailwind: 0.25, slow: 0.25 };

export interface SpeedGain {
  condition: SpeedCondition;
  /** La mossa o l'abilità che la dà ("Dragon Dance", "Swift Swim", "Sticky Web"…). */
  source: string;
  /** Pokémon superati in più, già moltiplicati per la quota (0–1). */
  gain: number;
}

export interface MemberSpeed {
  species: string;
  speed: number;
  /** Quota del gruppo superata senza condizioni (pareggio a metà). */
  raw: number;
  gains: SpeedGain[];
  /** Velocità pura più i guadagni, al massimo 1. */
  total: number;
}

const SETUP_PLUS_ONE = new Set(['dragondance', 'quiverdance', 'shiftgear', 'victorydance', 'tidyup', 'trailblaze', 'flamecharge', 'rapidspin', 'aquastep', 'esperwing']);
const SETUP_PLUS_TWO = new Set(['shellsmash', 'agility', 'rockpolish', 'autotomize']);
/** Abilità che raddoppiano la velocità col meteo o il campo giusto. */
const WEATHER_SPEED: Record<string, { weather?: string; terrain?: string }> = {
  swiftswim: { weather: 'rain' }, chlorophyll: { weather: 'sun' }, sandrush: { weather: 'sand' }, slushrush: { weather: 'snow' },
  surgesurfer: { terrain: 'electric' },
};
const PARALYSIS = new Set(['thunderwave', 'glare', 'stunspore', 'nuzzle']);
const SPEED_DROP = new Set(['icywind', 'electroweb', 'bulldoze', 'rocktomb', 'lowsweep']);

/** Strumenti che si consumano e attivano Unburden (oltre a bacche, gemme e semi). */
const CONSUMED = new Set([
  'whiteherb', 'powerherb', 'mentalherb', 'airballoon', 'focussash', 'weaknesspolicy', 'throatspray', 'ejectbutton', 'ejectpack',
  'redcard', 'adrenalineorb', 'roomservice', 'blunderpolicy', 'boosterenergy', 'mirrorherb',
]);
function consumable(item: string): boolean {
  const data = dex.items.get(item);
  if (!data.exists) return false;
  const id = toID(item);
  return !!data.isBerry || !!data.isGem || id.endsWith('seed') || CONSUMED.has(id);
}

/**
 * Quanto una mossa rallenta un avversario: paralisi a metà, un calo di Velocità a due terzi; 1 se il tipo ne è immune
 * (Elettro non si paralizza, Terra non prende Thunder Wave, Erba non prende le polveri, Volante non prende Bulldoze…).
 */
export function slowFactor(move: string, species: string): number {
  const id = toID(move);
  const types = getSpecies(species)?.types ?? [];
  const has = (type: string) => types.includes(type as never);
  if (PARALYSIS.has(id)) {
    if (has('Electric')) return 1;
    if ((id === 'thunderwave' || id === 'nuzzle') && has('Ground')) return 1;
    if (id === 'stunspore' && has('Grass')) return 1;
    return 0.5;
  }
  if (SPEED_DROP.has(id)) {
    if (id === 'bulldoze' && has('Flying')) return 1;
    if (id === 'electroweb' && has('Ground')) return 1;
    if (id === 'lowsweep' && has('Ghost')) return 1;
    return 2 / 3;
  }
  return 1;
}

const moveName = (set: TeamSet, ids: Set<string>) => set.moves.find(m => ids.has(toID(m))) ?? null;
const teamMove = (team: TeamSet[], ids: Set<string>) => {
  for (const member of team) { const found = moveName(member, ids); if (found) return getMove(found)?.name ?? found; }
  return null;
};

const members = new Map<string, MemberSpeed | null>();
const MEMBER_LIMIT = 5000;

/** Velocità di un membro: quanti Pokémon del gruppo supera, e quanti in più con setup, meteo, Web, Tailwind e paralisi. */
export function memberSpeed(set: TeamSet, team: TeamSet[], data: EngineData): MemberSpeed | null {
  // Tutti i meteo e i campi che il team porta (anche più d'uno), compresi quelli del membro stesso
  const fields = [...team, set].map(ownField);
  const weathers = [...new Set(fields.map(f => f.weather).filter(Boolean))].sort() as string[];
  const terrains = [...new Set(fields.map(f => f.terrain).filter(Boolean))].sort() as string[];
  const web = teamMove(team, new Set(['stickyweb']));
  const trickRoom = teamMove(team, new Set(['trickroom']));
  const tailwind = teamMove(team, new Set(['tailwind']));
  const paralysis = teamMove(team, PARALYSIS);
  const drop = teamMove(team, SPEED_DROP);
  const key = `${setKey(set)}|${weathers}|${terrains}|${web}|${trickRoom}|${tailwind}|${paralysis}|${drop}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  if (members.has(key)) return members.get(key)!;
  if (members.size >= MEMBER_LIMIT) members.clear();
  const value = measure(set, data, { weathers, terrains, web, trickRoom, tailwind, paralysis, drop });
  members.set(key, value);
  return value;
}

interface TeamConditions {
  weathers: string[];
  terrains: string[];
  web: string | null;
  trickRoom: string | null;
  tailwind: string | null;
  paralysis: string | null;
  drop: string | null;
}

function measure(set: TeamSet, data: EngineData, team: TeamConditions): MemberSpeed | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const pool = speedPool(data);
  const speed = speedStat(set).value;
  const shareWith = (own: number, opponent: (r: SpeedRival) => number = () => 1) =>
    outspeedShare(own, pool.map(r => ({ ...r, value: Math.floor(r.value * opponent(r)) })), set.species);
  const raw = shareWith(speed);
  const gains: SpeedGain[] = [];
  const add = (condition: SpeedCondition, source: string, share: number) => {
    const gain = CONDITION_QUOTA[condition] * Math.max(0, share - raw);
    if (gain > 0) gains.push({ condition, source, gain });
  };

  const ability = toID(battleAbility(set));
  const plusTwo = moveName(set, SETUP_PLUS_TWO);
  const plusOne = moveName(set, SETUP_PLUS_ONE) ?? (ability === 'speedboost' ? battleAbility(set) : null);
  if (plusTwo) add('setup', getMove(plusTwo)?.name ?? plusTwo, shareWith(speed * 2));
  else if (plusOne) add('setup', getMove(plusOne)?.name ?? plusOne, shareWith(Math.floor(speed * 1.5)));

  const needs = WEATHER_SPEED[ability];
  if (needs && ((needs.weather && team.weathers.includes(needs.weather)) || (needs.terrain && team.terrains.includes(needs.terrain)))) {
    add('weather', battleAbility(set), shareWith(speed * 2));
  }
  if (ability === 'unburden' && consumable(set.item)) add('unburden', battleAbility(set), shareWith(speed * 2));
  if (team.web) add('web', team.web, shareWith(speed, r => (r.webImmune ? 1 : 2 / 3)));
  // Trick Room: chi è lento "supera" chi è più veloce di lui (a pari velocità metà). Misura da sola chi è adatto:
  // i lenti guadagnano molto, i veloci niente
  if (team.trickRoom) add('trickroom', team.trickRoom, 1 - raw);
  if (team.tailwind) add('tailwind', team.tailwind, shareWith(speed * 2));
  // Rallentare: conta la mossa migliore che il team ha, con le immunità di tipo
  const slowed = [team.paralysis, team.drop]
    .filter((move): move is string => !!move)
    .map(move => ({ move, share: shareWith(speed, r => slowFactor(move, r.species)) }))
    .sort((a, b) => b.share - a.share)[0];
  if (slowed) add('slow', slowed.move, slowed.share);

  const total = Math.min(1, raw + gains.reduce((acc, g) => acc + g.gain, 0));
  return { species: species.name, speed, raw, gains, total };
}

/** La parte Velocità del team: i membri pesati dal più veloce (25/20/16/14/13/12), poi la scala morbida (100 non si raggiunge). */
export function speedPart(list: MemberSpeed[]): number {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => b.speed - a.speed);
  const weights = sorted.map((_, i) => SPEED_RANK_WEIGHTS[Math.min(i, SPEED_RANK_WEIGHTS.length - 1)]);
  const total = weights.reduce((a, b) => a + b, 0);
  return softScore(sorted.reduce((acc, m, i) => acc + weights[i] * m.total, 0) / total);
}

export interface PriorityRow {
  species: string;
  speed: number;
  weight: number;
  /** Il colpo prioritario migliore del team su questa minaccia (danno atteso in quota dei PS). */
  best: { species: string; move: string; pct: number; expected: number } | null;
  credit: number;
}

/** Metà PS tolti con una mossa prioritaria valgono il credito pieno: basta a finire una minaccia indebolita. */
const PRIORITY_FULL = 0.5;
/** Senza meta: i più veloci del tier, con un set neutro. */
const TIER_TARGETS = 20;

/**
 * Le minacce che il team non supera: più veloci del suo secondo membro più rapido (velocità pura; setup e meteo sono
 * condizionali). Col meta i 40 più usati pesati per uso; a pari velocità metà peso.
 */
export function priorityTargets(list: MemberSpeed[], data: EngineData, team: TeamSet[] = []): { set: TeamSet; speed: number; weight: number }[] {
  if (!list.length) return [];
  const speeds = list.map(m => m.speed).sort((a, b) => b - a);
  const second = speeds[1] ?? speeds[0];
  const candidates = usesMeta(data)
    ? metaThreats(data).map(({ set, weight }) => ({ set, speed: speedStat(set).value, weight }))
    : tierSpecies(data.formatId ?? 'ou')
      .map(s => ({ set: { species: s.name, item: '', ability: s.abilities[0], moves: [], nature: 'Hardy', evs: {} } as TeamSet, speed: Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1), weight: 1 }))
      .sort((a, b) => b.speed - a.speed)
      .slice(0, TIER_TARGETS);
  // Le specie del team non sono minacce per il team stesso
  return candidates
    .filter(c => !team.some(member => sameSelf(member.species, c.set.species)))
    .filter(c => c.speed >= second)
    .map(c => ({ ...c, weight: c.speed === second ? c.weight / 2 : c.weight }));
}

/** La parte Priorità: quanto il team colpisce per primo, con danno vero, le minacce che non supera. */
export function priorityPart(team: TeamSet[], list: MemberSpeed[], speedPartValue: number, data: EngineData): { value: number; rows: PriorityRow[] } {
  const targets = priorityTargets(list, data, team);
  // Grassy Glide è prioritario anche col Grassy Terrain di un compagno
  const grassy = team.some(member => ownField(member).terrain === 'grassy');
  // Chi supera già tutto non ha bisogno di priorità
  if (!targets.length) return { value: speedPartValue, rows: [] };
  const known = team.filter(set => battleSpecies(set));
  const rows: PriorityRow[] = targets.map(t => {
    let best: PriorityRow['best'] = null;
    for (const member of known) {
      const own = ownConditions(member);
      const conditions = grassy && !own.includes('grassyterrain') ? [...own, 'grassyterrain' as const] : own;
      const hit = bestHit(member, t.set, { priorityOnly: true, conditions });
      if (hit && (!best || hit.expected > best.expected)) {
        best = { species: battleSpecies(member)!.name, move: hit.move, pct: Math.floor(100 * Math.min(1, hit.expected)), expected: hit.expected };
      }
    }
    return { species: t.set.species, speed: t.speed, weight: t.weight, best, credit: best ? Math.min(1, best.expected / PRIORITY_FULL) : 0 };
  });
  const total = rows.reduce((acc, r) => acc + r.weight, 0);
  return { value: total ? softScore(rows.reduce((acc, r) => acc + r.weight * r.credit, 0) / total) : 0, rows };
}

/** Velocità (coi guadagni delle condizioni) e Priorità nell'area: 80 e 20. */
export const SPEED_SHARES = { speed: 0.8, priority: 0.2 };

export interface TeamSpeed {
  value: number;
  speed: number;
  priority: number;
  members: MemberSpeed[];
  targets: PriorityRow[];
}

/** Velocità del team: quanti Pokémon supera ogni membro (con setup, meteo, Web…) e quanto colpisce per primo chi non supera. */
export function teamSpeedArea(team: TeamSet[], data: EngineData): TeamSpeed {
  const list = team.map(set => memberSpeed(set, team, data)).filter((m): m is MemberSpeed => m !== null);
  if (!list.length) return { value: 0, speed: 0, priority: 0, members: [], targets: [] };
  const speed = speedPart(list);
  const priority = priorityPart(team, list, speed, data);
  return {
    value: Math.round(SPEED_SHARES.speed * speed + SPEED_SHARES.priority * priority.value),
    speed, priority: priority.value, members: list, targets: priority.rows,
  };
}
