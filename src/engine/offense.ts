import { usesMeta } from './analysis';
import { coverageTargets, teamCoverage } from './coverage';
import { bestHit, setKey, type FieldCondition, type Hit, type HitOptions, type Target } from './damage';
import type { EngineData } from './data';
import { defenderPanel, isDefensiveSet, metaDefenderCount } from './defenders';
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
/** Il 100 di Potenza e Wallbreaking del membro: il 3° miglior attaccante fra i più usati del formato (un 100 raro). */
export const REFERENCE_RANK = 3;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare gli attaccanti di riferimento. */
const REFERENCE_SCAN = 40;
/** Peso delle sottostatistiche nel valore del membro (senza setup: Potenza e Wallbreaking si dividono tutto). */
export const OFFENSE_WEIGHTS = { power: 0.5, wallbreaking: 0.35, setup: 0.15 };
/** Quota della Coverage nell'Offesa del team (il resto è la media pesata dei membri). */
export const COVERAGE_SHARE = 0.25;
/** Pesi per posizione nel team, dal membro più offensivo al meno: un membro debole conta poco perché è in fondo. */
export const RANK_WEIGHTS = [0.22, 0.18, 0.16, 0.15, 0.15, 0.14];

export interface MemberOffense {
  species: string;
  power: number;
  wallbreaking: number;
  /** null: il set non ha una mossa di potenziamento. */
  setup: number | null;
  value: number;
  /** Bersagli della Coverage che manda KO in due colpi (la Coverage vera è del team). */
  covered: number;
}

export interface TeamOffense {
  /** 75% la media pesata dei membri, 25% la Coverage. */
  value: number;
  memberValue: number;
  coverage: number;
  /** Bersagli che nessuno porta al 33%, e quanti bersagli ha la Coverage. */
  holes: string[];
  targets: number;
  power: number;
  wallbreaking: number;
  setup: number | null;
  members: MemberOffense[];
  /** I difensori contro cui si è misurata (per spiegare il voto): i primi `metaDefenders` dal meta, gli altri dal tier. */
  defenders: string[];
  metaDefenders: number;
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

const SPECIAL_BOOSTS: Record<string, { atk?: number; spa?: number; def?: number }> = {
  bellydrum: { atk: 6 }, curse: { atk: 1, def: 1 }, tidyup: { atk: 1 },
};

/** La mossa di potenziamento più forte del set: Attacco, Attacco Speciale, o Difesa con Body Press, dopo un uso. */
function setupBoosts(set: TeamSet): HitOptions['boosts'] | null {
  const bodyPress = set.moves.some(m => toID(m) === 'bodypress');
  let best: HitOptions['boosts'] | null = null;
  let bestSum = 0;
  const ghost = (battleSpecies(set)?.types as readonly string[] | undefined)?.includes('Ghost');
  for (const name of set.moves) {
    const move = getMove(name);
    if (!move || move.category !== 'Status') continue;
    // Mosse che i dati non descrivono come potenziamento di sé: Belly Drum (+6), Curse (+1, non da Spettro), Tidy Up (+1)
    const special = SPECIAL_BOOSTS[move.id];
    const own = special ?? (move.target === 'self' ? move.boosts : undefined);
    if (!own || (move.id === 'curse' && ghost)) continue;
    const boosts = { atk: Math.max(0, own.atk ?? 0), spa: Math.max(0, own.spa ?? 0), def: bodyPress ? Math.max(0, own.def ?? 0) : 0 };
    const sum = boosts.atk + boosts.spa + boosts.def;
    if (sum > bestSum) { best = boosts; bestSum = sum; }
  }
  return best;
}

/**
 * Misure grezze del set: danno medio contro i bersagli della Coverage (i Pokémon più usati, o i 18 tipi neutri),
 * e il valore del colpo migliore contro ogni muro del formato, anche dopo il setup.
 */
interface Raw { species: string; expected: number; steps: number[]; setupSteps: number[] | null }

function measureSet(set: TeamSet, team: TeamSet[], data: EngineData): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const attacks = set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status');
  const { own, all } = conditionsOf(set, team);
  // Poteri da una volta a partita: si conta la media fra con e senza
  const tera = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType ? [false, true] : [false];
  const zType = dex.items.get(set.item).zMoveType;
  const z = zType && set.moves.some(m => getMove(m)?.type === zType) ? [false, true] : [false];
  let known = false;

  // Contro un bersaglio: media sulle varianti; il meteo del team vale metà (mai sotto il danno senza)
  const against = (target: Target, boosts?: HitOptions['boosts']) => {
    const expected: number[] = [];
    const steps: number[] = [];
    for (const useTera of tera) for (const useZ of z) {
      const base = { tera: useTera, z: useZ, boosts };
      const off = bestHit(set, target, { ...base, conditions: own });
      const on = all.length > own.length ? bestHit(set, target, { ...base, conditions: all }) : off;
      if (off || on) known = true;
      const better = (on?.expected ?? 0) >= (off?.expected ?? 0) ? on : off;
      // Un KO è un KO: oltre il 100% dei PS il danno non conta di più
      expected.push((Math.min(1, off?.expected ?? 0) + Math.min(1, better?.expected ?? 0)) / 2);
      steps.push((stepValue(off) + stepValue(better)) / 2);
    }
    return { expected: mean(expected), step: mean(steps) };
  };

  const targets = coverageTargets(data);
  const expected = targets.reduce((acc, target) => acc + target.weight * against(target.set).expected, 0);
  const defenders = defenderPanel(data);
  const steps = defenders.map(defender => against(defender).step);
  // Ha mosse d'attacco ma la libreria non sa calcolarne nessuna: Pokémon sconosciuto, non conta
  if (attacks && !known) return null;
  const boosts = setupBoosts(set);
  return {
    species: species.name, expected, steps,
    setupSteps: boosts && attacks ? defenders.map(defender => against(defender, boosts).step) : null,
  };
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
 * Il 100 di Potenza e Wallbreaking: il 3° miglior attaccante fra i più usati del formato (set più comune,
 * stessi difensori). Così 100 vuol dire "fra i migliori del meta", non una soglia che nessuno raggiunge.
 * Senza statistiche: i valori fissi di riserva.
 */
export function offenseReference(data: EngineData): OffenseReference {
  // Anche senza meta il riferimento usa le statistiche, se ci sono: mentre si caricano non devono restare quelle di riserva
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let reference = references.get(key);
  if (reference) return reference;
  const rules = rulesOf(data);
  const measured = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set
      && set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length >= 2 && !isDefensiveSet(set, rules))
    .map(set => rawOf(set, [set], data))
    .filter((raw): raw is Raw => raw !== null)
    .map(raw => ({ species: raw.species, expected: raw.expected, step: mean(raw.steps) }));
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
  const wallbreaking = toScore(mean(raw.steps), ref.step);
  const setup = raw.setupSteps === null ? null : toScore(mean(raw.setupSteps), ref.step);
  return { species: raw.species, power, wallbreaking, setup, value: blend(power, wallbreaking, setup), covered: 0 };
}

/** Potenza 50%, Wallbreaking 35%, Setup 15%; senza setup le prime due si dividono tutto, e il setup può solo aggiungere. */
function blend(power: number, wallbreaking: number, setup: number | null): number {
  const w = OFFENSE_WEIGHTS;
  const base = Math.round((w.power * power + w.wallbreaking * wallbreaking) / (w.power + w.wallbreaking));
  return setup === null ? base : Math.max(base, Math.round(w.power * power + w.wallbreaking * wallbreaking + w.setup * setup));
}

/** Media pesata per posizione: valori dal più alto al più basso, pesi 22/18/16/15/15/14% (rinormalizzati se sono meno di sei). */
function rankWeighted(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const weights = sorted.map((_, i) => RANK_WEIGHTS[Math.min(i, RANK_WEIGHTS.length - 1)]);
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round(sorted.reduce((acc, v, i) => acc + v * weights[i], 0) / total);
}

/** Profondità del Wallbreaking di squadra: il 1°, 2° e 3° membro che sfonda un muro valgono 70, 20 e 10%. */
export const WALL_DEPTH = [0.7, 0.2, 0.1];
/**
 * Il 100 del Wallbreaking di squadra: ogni muro mandato KO in due colpi da tre membri (la profondità piena, 0,7 + 0,2 + 0,1).
 * È una scala naturale, senza riferimenti tarati: un solo breaker per muro vale 70, i OHKO alzano.
 */
export const TEAM_WALL_FULL = 1;
/** Setup di squadra: la win condition migliore, più questa quota della seconda. */
export const SECOND_SETUP = 0.2;

/**
 * Offesa del team dalle sottostatistiche di squadra: Potenza (media pesata per posizione dei membri),
 * Wallbreaking (chi sfonda ogni muro, con la profondità), Setup (la win condition migliore più un po' della seconda),
 * combinate come per un membro; poi 75% questo e 25% la Coverage.
 */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  const coverage = teamCoverage(team, data);
  const ref = offenseReference(data);
  const raws = team.map(set => rawOf(set, team, data)).filter((r): r is Raw => r !== null);
  const members = team
    .map((set, i) => { const m = memberOffense(set, team, data); return m && { ...m, covered: coverage.perMember[i] }; })
    .filter((m): m is MemberOffense => m !== null);
  const defenders = defenderPanel(data);
  // Per ogni muro, i membri dal più forte: il team lo sfonda se qualcuno ci riesce, meglio se più di uno
  const wallStep = mean(defenders.map((_, d) => {
    const best = raws.map(r => r.steps[d]).sort((a, b) => b - a);
    return WALL_DEPTH.reduce((acc, share, i) => acc + share * (best[i] ?? 0), 0);
  }));
  const setups = members.filter(m => m.setup !== null).map(m => m.setup!).sort((a, b) => b - a);
  const power = rankWeighted(members.map(m => m.power));
  const wallbreaking = raws.length ? toScore(wallStep, TEAM_WALL_FULL) : 0;
  const setup = setups.length ? Math.min(100, Math.round(setups[0] + SECOND_SETUP * (setups[1] ?? 0))) : null;
  const memberValue = members.length ? blend(power, wallbreaking, setup) : 0;
  return {
    value: members.length ? Math.round((1 - COVERAGE_SHARE) * memberValue + COVERAGE_SHARE * coverage.value) : 0,
    memberValue,
    coverage: coverage.value,
    holes: coverage.holes,
    targets: coverageTargets(data).length,
    power,
    wallbreaking,
    setup,
    members,
    defenders: defenders.map(set => set.species),
    metaDefenders: metaDefenderCount(data),
  };
}
