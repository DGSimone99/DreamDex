import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { softScore } from './scale';
import { bestHit, setKey } from './damage';
import { metaThreats } from './attackers';
import { ownConditions } from './coverage';
import { usesMeta } from './analysis';
import type { TeamSet } from './sets';
import { outspeedShare, speedPool, speedStat, tierSpecies, type SpeedRival } from './speed';
import { teamField } from './types';

/** Le condizioni che fanno superare più Pokémon: setup, meteo/campo, Unburden, Sticky Web, Tailwind, paralisi e rallentamenti. */
export type SpeedCondition = 'setup' | 'weather' | 'unburden' | 'web' | 'tailwind' | 'slow';

/** Peso di ogni membro per posizione di velocità, dal più veloce: i due più rapidi fanno quasi tutto, ma la velocità serve a tutti. */
export const SPEED_RANK_WEIGHTS = [25, 20, 16, 14, 13, 12];

/** Quota del guadagno che entra nel voto: metà per ciò che dura (setup, meteo, Web), un quarto per Tailwind e un bersaglio rallentato. */
export const CONDITION_QUOTA: Record<SpeedCondition, number> = { setup: 0.5, weather: 0.5, unburden: 0.5, web: 0.5, tailwind: 0.25, slow: 0.25 };

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

/** Strumenti che si consumano e attivano Unburden. */
function consumable(item: string): boolean {
  const data = dex.items.get(item);
  if (!data.exists) return false;
  const id = toID(item);
  return !!data.isBerry || !!data.isGem || id.endsWith('seed') || id === 'whiteherb' || id === 'airballoon';
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
  const field = teamField(team);
  const web = teamMove(team, new Set(['stickyweb']));
  const tailwind = teamMove(team, new Set(['tailwind']));
  const paralysis = teamMove(team, PARALYSIS);
  const drop = teamMove(team, SPEED_DROP);
  const key = `${setKey(set)}|${field.weather}|${field.terrain}|${web}|${tailwind}|${paralysis}|${drop}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  if (members.has(key)) return members.get(key)!;
  if (members.size >= MEMBER_LIMIT) members.clear();
  const value = measure(set, data, { field, web, tailwind, paralysis, drop });
  members.set(key, value);
  return value;
}

function measure(set: TeamSet, data: EngineData, team: { field: ReturnType<typeof teamField>; web: string | null; tailwind: string | null; paralysis: string | null; drop: string | null }): MemberSpeed | null {
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
  if (needs && ((needs.weather && team.field.weather === needs.weather) || (needs.terrain && team.field.terrain === needs.terrain))) {
    add('weather', battleAbility(set), shareWith(speed * 2));
  }
  if (ability === 'unburden' && consumable(set.item)) add('unburden', battleAbility(set), shareWith(speed * 2));
  if (team.web) add('web', team.web, shareWith(speed, r => (r.webImmune ? 1 : 2 / 3)));
  if (team.tailwind) add('tailwind', team.tailwind, shareWith(speed * 2));
  // Rallentare: la paralisi dimezza, un calo di Velocità porta a due terzi; conta la migliore che il team ha
  if (team.paralysis) add('slow', team.paralysis, shareWith(speed, () => 0.5));
  else if (team.drop) add('slow', team.drop, shareWith(speed, () => 2 / 3));

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
export function priorityTargets(list: MemberSpeed[], data: EngineData): { set: TeamSet; speed: number; weight: number }[] {
  if (!list.length) return [];
  const speeds = list.map(m => m.speed).sort((a, b) => b - a);
  const second = speeds[1] ?? speeds[0];
  const candidates = usesMeta(data)
    ? metaThreats(data).map(({ set, weight }) => ({ set, speed: speedStat(set).value, weight }))
    : tierSpecies(data.formatId ?? 'ou')
      .map(s => ({ set: { species: s.name, item: '', ability: s.abilities[0], moves: [], nature: 'Hardy', evs: {} } as TeamSet, speed: Math.floor((2 * s.baseStats.spe + 31 + 63 + 5) * 1.1), weight: 1 }))
      .sort((a, b) => b.speed - a.speed)
      .slice(0, TIER_TARGETS);
  return candidates
    .filter(c => c.speed >= second)
    .map(c => ({ ...c, weight: c.speed === second ? c.weight / 2 : c.weight }));
}

/** La parte Priorità: quanto il team colpisce per primo, con danno vero, le minacce che non supera. */
export function priorityPart(team: TeamSet[], list: MemberSpeed[], speedPartValue: number, data: EngineData): { value: number; rows: PriorityRow[] } {
  const targets = priorityTargets(list, data);
  // Chi supera già tutto non ha bisogno di priorità
  if (!targets.length) return { value: speedPartValue, rows: [] };
  const known = team.filter(set => battleSpecies(set));
  const rows: PriorityRow[] = targets.map(t => {
    let best: PriorityRow['best'] = null;
    for (const member of known) {
      const hit = bestHit(member, t.set, { priorityOnly: true, conditions: ownConditions(member) });
      if (hit && (!best || hit.expected > best.expected)) {
        best = { species: battleSpecies(member)!.name, move: hit.move, pct: Math.floor(100 * Math.min(1, hit.expected)), expected: hit.expected };
      }
    }
    return { species: t.set.species, speed: t.speed, weight: t.weight, best, credit: best ? Math.min(1, best.expected / PRIORITY_FULL) : 0 };
  });
  const total = rows.reduce((acc, r) => acc + r.weight, 0);
  return { value: total ? softScore(rows.reduce((acc, r) => acc + r.weight * r.credit, 0) / total) : 0, rows };
}
