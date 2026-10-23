import { usesMeta } from './analysis';
import { bestHit, setKey, type FieldCondition, type Hit, type HitOptions } from './damage';
import type { EngineData } from './data';
import { defenderPanel, isDefensiveSet } from './defenders';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { rulesOf } from './formatRules';
import { mostCommonSet, type TeamSet } from './sets';
import { topThreats } from './stats';
import { enables } from './synergy';

/** Riferimento di riserva (senza statistiche del formato): danno medio che vale Potenza 100. */
export const POWER_FULL = 0.6;
/** Soglie del colpo migliore contro un difensore: 3HKO e 2HKO (il difensore non può entrare due volte). */
export const THREE_HIT = 1 / 3;
export const TWO_HIT = 0.5;
/** Valore di un difensore: 3HKO 0,5, 2HKO 1, OHKO sicuro 1,5. */
export const STEP_3HKO = 0.5;
export const STEP_2HKO = 1;
export const STEP_OHKO = 1.5;
/** Riferimento di riserva: media dei valori che vale Wallbreaking 100. */
export const STEP_FULL = 1.25;
/**
 * Il 100 di Potenza e Wallbreaking: il 18° miglior attaccante fra i più usati del formato.
 * Tarato sul bench: i team offensivi da torneo (hyper e bulky offense) fanno in media 85.
 */
export const REFERENCE_RANK = 18;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare gli attaccanti di riferimento. */
const REFERENCE_SCAN = 40;
/** Peso delle sottostatistiche nel valore del membro (senza setup: Potenza e Wallbreaking si dividono tutto). */
export const OFFENSE_WEIGHTS = { power: 0.5, wallbreaking: 0.35, setup: 0.15 };
/** Pesi per posizione nel team, dal membro più offensivo al meno: un membro debole conta poco perché è in fondo. */
export const RANK_WEIGHTS = [0.22, 0.18, 0.16, 0.15, 0.15, 0.14];

export interface MemberOffense {
  species: string;
  power: number;
  wallbreaking: number;
  /** null: il set non ha una mossa di potenziamento. */
  setup: number | null;
  value: number;
}

export interface TeamOffense {
  value: number;
  power: number;
  wallbreaking: number;
  setup: number | null;
  members: MemberOffense[];
}

/** Valore del colpo migliore contro un difensore: 0, 0,5 (3HKO), 1 (2HKO) o 1,5 (OHKO sicuro; mai per le mosse OHKO, che possono mancare). */
export function stepValue(hit: Hit | null): number {
  if (!hit) return 0;
  if (hit.min >= 1 && !getMove(hit.move)?.ohko) return STEP_OHKO;
  return hit.expected >= TWO_HIT ? STEP_2HKO : hit.expected >= THREE_HIT ? STEP_3HKO : 0;
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

/** Misure grezze del set contro i difensori: danno medio, valore medio dei colpi, lo stesso dopo il setup. */
interface Raw { species: string; expected: number; step: number; setupStep: number | null }

function measureSet(set: TeamSet, team: TeamSet[], data: EngineData): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const attacks = set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status');
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
  const boosts = setupBoosts(set);
  return { species: species.name, expected: plain.expected, step: plain.step, setupStep: boosts && attacks ? measure(boosts).step : null };
}

/** Per contenuto del set, formato, meta e condizioni del team: le proposte rifanno set uguali con oggetti nuovi. */
const raws = new Map<string, Raw | null>();
const RAW_LIMIT = 5000;

function rawOf(set: TeamSet, team: TeamSet[], data: EngineData): Raw | null {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${conditionsOf(set, team).all.join(',')}`;
  if (raws.has(key)) return raws.get(key)!;
  if (raws.size >= RAW_LIMIT) raws.clear();
  const value = measureSet(set, team, data);
  raws.set(key, value);
  return value;
}

export interface OffenseReference {
  /** Danno medio e valore medio dei colpi che valgono 100. */
  power: number;
  step: number;
  /** Gli attaccanti più usati del formato, dal miglior Wallbreaking (vuoto senza statistiche). */
  attackers: string[];
}

const references = new Map<string, OffenseReference>();

/**
 * Il 100 di Potenza e Wallbreaking: il 18° miglior attaccante fra i più usati del formato (set più comune,
 * stessi difensori). Così 100 vuol dire "ai livelli dei migliori del meta", non una soglia che nessuno raggiunge.
 * Senza statistiche: i valori fissi di riserva.
 */
export function offenseReference(data: EngineData): OffenseReference {
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}`;
  let reference = references.get(key);
  if (reference) return reference;
  const rules = rulesOf(data);
  const measured = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set
      && set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length >= 2 && !isDefensiveSet(set, rules))
    .map(set => rawOf(set, [set], data))
    .filter((raw): raw is Raw => raw !== null);
  const nth = (values: number[]) => values.sort((a, b) => b - a)[Math.min(REFERENCE_RANK, values.length) - 1];
  const power = measured.length ? nth(measured.map(r => r.expected)) : 0;
  const step = measured.length ? nth(measured.map(r => r.step)) : 0;
  reference = {
    power: power > 0 ? power : POWER_FULL,
    step: step > 0 ? step : STEP_FULL,
    attackers: [...measured].sort((a, b) => b.step - a.step).map(r => r.species),
  };
  references.set(key, reference);
  return reference;
}

/** Offesa di un membro: il danno vero del set contro i difensori del formato (null se la libreria non conosce il Pokémon). */
export function memberOffense(set: TeamSet, team: TeamSet[], data: EngineData): MemberOffense | null {
  const raw = rawOf(set, team, data);
  if (!raw) return null;
  const ref = offenseReference(data);
  const power = toScore(raw.expected, ref.power);
  const wallbreaking = toScore(raw.step, ref.step);
  const setup = raw.setupStep === null ? null : toScore(raw.setupStep, ref.step);
  const w = OFFENSE_WEIGHTS;
  const base = Math.round((w.power * power + w.wallbreaking * wallbreaking) / (w.power + w.wallbreaking));
  // Il setup può solo aggiungere: un potenziamento che vale meno degli attacchi non abbassa il membro
  const value = setup === null ? base : Math.max(base, Math.round(w.power * power + w.wallbreaking * wallbreaking + w.setup * setup));
  return { species: raw.species, power, wallbreaking, setup, value };
}

/** Media pesata per posizione: valori dal più alto al più basso, pesi 22/18/16/15/15/14% (rinormalizzati se sono meno di sei). */
function rankWeighted(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const weights = sorted.map((_, i) => RANK_WEIGHTS[Math.min(i, RANK_WEIGHTS.length - 1)]);
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round(sorted.reduce((acc, v, i) => acc + v * weights[i], 0) / total);
}

/** Offesa del team: media pesata per posizione dei membri; il Setup solo fra chi ce l'ha. */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  const members = team.map(set => memberOffense(set, team, data)).filter((m): m is MemberOffense => m !== null);
  const setters = members.filter(m => m.setup !== null);
  return {
    value: rankWeighted(members.map(m => m.value)),
    power: rankWeighted(members.map(m => m.power)),
    wallbreaking: rankWeighted(members.map(m => m.wallbreaking)),
    setup: setters.length ? rankWeighted(setters.map(m => m.setup!)) : null,
    members,
  };
}
