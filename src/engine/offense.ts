import { usesMeta } from './analysis';
import { bestHit, setKey, type FieldCondition, type Hit, type HitOptions } from './damage';
import type { EngineData } from './data';
import { defenderPanel } from './defenders';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { rulesOf } from './formatRules';
import { isPassive, teamRoles } from './roles';
import type { TeamSet } from './sets';
import { enables } from './synergy';

/** Danno medio (in quota dei PS) dei difensori che vale Potenza 100. */
export const POWER_FULL = 0.6;
/** Danno che manda KO in due colpi: il difensore non può entrare due volte. */
export const TWO_HIT = 0.5;
/** Valore di un difensore: 2HKO 1, OHKO sicuro 1,5. */
export const STEP_2HKO = 1;
export const STEP_OHKO = 1.5;
/** Media dei valori che vale 100: 2HKO su tutti fa 80, i OHKO riempiono il resto. */
export const STEP_FULL = 1.25;
/** Peso delle sottostatistiche nel valore del membro (senza setup: Potenza e Wallbreaking si dividono tutto). */
export const OFFENSE_WEIGHTS = { power: 0.5, wallbreaking: 0.35, setup: 0.15 };
/** Un supporto pesa la metà di un attaccante nell'Offesa del team. */
export const SUPPORT_WEIGHT = 0.5;

export interface MemberOffense {
  species: string;
  power: number;
  wallbreaking: number;
  /** null: il set non ha una mossa di potenziamento. */
  setup: number | null;
  value: number;
  support: boolean;
}

export interface TeamOffense {
  value: number;
  power: number;
  wallbreaking: number;
  setup: number | null;
  members: MemberOffense[];
}

/** Valore del colpo migliore contro un difensore: 0, 1 (2HKO) o 1,5 (OHKO sicuro; mai per le mosse OHKO, che possono mancare). */
export function stepValue(hit: Hit | null): number {
  if (!hit) return 0;
  if (hit.min >= 1 && !getMove(hit.move)?.ohko) return STEP_OHKO;
  return hit.expected >= TWO_HIT ? STEP_2HKO : 0;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const toScore = (x: number, full: number) => Math.round(100 * Math.min(1, x / full));

/** Condizioni di campo (meteo, terreni) che il team porta; quelle che il set porta con la sua abilità sono sempre attive per lui. */
function conditionsOf(set: TeamSet, team: TeamSet[]) {
  const field = (links: ReturnType<typeof enables>) => links.map(l => l.condition).filter((c): c is FieldCondition => c !== 'trickroom');
  const own = field(enables(set).filter(l => toID(l.via) === toID(battleAbility(set))));
  const all = [...new Set([...own, ...team.flatMap(member => field(enables(member)))])].sort();
  return { own: [...new Set(own)], all };
}

/** La mossa di potenziamento più forte del set: Attacco, Attacco Speciale, o Difesa con Body Press, dopo un uso. */
function setupBoosts(set: TeamSet): HitOptions['boosts'] | null {
  const bodyPress = set.moves.some(m => toID(m) === 'bodypress');
  let best: HitOptions['boosts'] | null = null;
  let bestSum = 0;
  for (const name of set.moves) {
    const move = getMove(name);
    if (!move || move.category !== 'Status' || move.target !== 'self' || !move.boosts) continue;
    const boosts = { atk: Math.max(0, move.boosts.atk ?? 0), spa: Math.max(0, move.boosts.spa ?? 0), def: bodyPress ? Math.max(0, move.boosts.def ?? 0) : 0 };
    const sum = boosts.atk + boosts.spa + boosts.def;
    if (sum > bestSum) { best = boosts; bestSum = sum; }
  }
  return best;
}

interface Context { data: EngineData; team: TeamSet[] }

function computeMember(set: TeamSet, { data, team }: Context): MemberOffense | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const rules = rulesOf(data);
  const attacks = set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status');
  const support = !attacks || isPassive(set, teamRoles(set, rules));
  const { own, all } = conditionsOf(set, team);
  // Poteri da una volta a partita: si conta la media fra con e senza
  const tera = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType ? [false, true] : [false];
  const zType = dex.items.get(set.item).zMoveType;
  const z = zType && set.moves.some(m => getMove(m)?.type === zType) ? [false, true] : [false];
  const defenders = defenderPanel(data);

  // Per ogni difensore: media sulle varianti; il meteo del team vale metà (mai sotto il danno senza)
  const measure = (boosts?: HitOptions['boosts']) => {
    let known = false;
    const perDefender = defenders.map(defender => {
      const expected: number[] = [];
      const steps: number[] = [];
      for (const useTera of tera) for (const useZ of z) {
        const base = { tera: useTera, z: useZ, boosts };
        const off = bestHit(set, defender, { ...base, conditions: own });
        const on = all.length > own.length ? bestHit(set, defender, { ...base, conditions: all }) : off;
        if (off || on) known = true;
        const better = (on?.expected ?? 0) >= (off?.expected ?? 0) ? on : off;
        expected.push(((off?.expected ?? 0) + (better?.expected ?? 0)) / 2);
        steps.push((stepValue(off) + stepValue(better)) / 2);
      }
      return { expected: mean(expected), step: mean(steps) };
    });
    return { known, expected: mean(perDefender.map(d => d.expected)), step: mean(perDefender.map(d => d.step)) };
  };

  const plain = measure();
  // Ha mosse d'attacco ma la libreria non sa calcolarne nessuna: Pokémon sconosciuto, non conta
  if (attacks && !plain.known) return null;
  const power = toScore(plain.expected, POWER_FULL);
  const wallbreaking = toScore(plain.step, STEP_FULL);
  const boosts = setupBoosts(set);
  const setup = boosts && attacks ? toScore(measure(boosts).step, STEP_FULL) : null;
  const w = OFFENSE_WEIGHTS;
  const value = setup === null
    ? Math.round((w.power * power + w.wallbreaking * wallbreaking) / (w.power + w.wallbreaking))
    : Math.round(w.power * power + w.wallbreaking * wallbreaking + w.setup * setup);
  return Object.freeze({ species: species.name, power, wallbreaking, setup, value, support });
}

/** Per contenuto del set, formato, meta e condizioni del team: le proposte rifanno set uguali con oggetti nuovi. */
const members = new Map<string, MemberOffense | null>();
const MEMBER_LIMIT = 5000;

/** Offesa di un membro: il danno vero del set contro i difensori del formato (null se la libreria non conosce il Pokémon). */
export function memberOffense(set: TeamSet, team: TeamSet[], data: EngineData): MemberOffense | null {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${conditionsOf(set, team).all.join(',')}`;
  if (members.has(key)) return members.get(key)!;
  if (members.size >= MEMBER_LIMIT) members.clear();
  const value = computeMember(set, { data, team });
  members.set(key, value);
  return value;
}

/** Offesa del team: media dei membri, con i supporti a metà peso; il Setup solo fra chi ce l'ha. */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  const members = team.map(set => memberOffense(set, team, data)).filter((m): m is MemberOffense => m !== null);
  const weighted = (pick: (m: MemberOffense) => number, among = members) => {
    const total = among.reduce((acc, m) => acc + (m.support ? SUPPORT_WEIGHT : 1), 0);
    return total ? Math.round(among.reduce((acc, m) => acc + pick(m) * (m.support ? SUPPORT_WEIGHT : 1), 0) / total) : 0;
  };
  const setters = members.filter(m => m.setup !== null);
  return {
    value: weighted(m => m.value),
    power: weighted(m => m.power),
    wallbreaking: weighted(m => m.wallbreaking),
    setup: setters.length ? weighted(m => m.setup!, setters) : null,
    members,
  };
}
