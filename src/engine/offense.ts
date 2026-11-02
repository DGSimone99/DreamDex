import { usesMeta } from './analysis';
import { coverageTargets, teamCoverage, type CoverageRow } from './coverage';
import { bestHit, setKey, type FieldCondition, type Hit, type HitOptions, type Target } from './damage';
import type { EngineData } from './data';
import { defenderPanel, isDefensiveSet } from './defenders';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { rulesOf } from './formatRules';
import { attackStyle } from './roles';
import { mostCommonSet, type TeamSet } from './sets';
import { setupBoosts } from './setupBoosts';
import { topThreats } from './stats';
import { softScore } from './scale';
import { enables } from './synergy';

/** Riferimento di riserva (senza statistiche del formato): danno medio sui 18 Pokémon medi che vale Potenza 100 (i formati con statistiche stanno fra 0,75 e 0,88). */
export const POWER_FULL = 0.8;
/** Solo per i Ruoli: il vecchio riferimento di riserva della Potenza (bersagli della Coverage). */
const ROLES_POWER_FULL = 0.6;
/** Soglie del colpo migliore contro un difensore: 3HKO e 2HKO (il difensore non può entrare due volte). */
export const THREE_HIT = 1 / 3;
export const TWO_HIT = 0.5;
/** Valore di un difensore: 3HKO 0,5, 2HKO 1, OHKO sicuro 1,5. */
export const STEP_3HKO = 0.5;
export const STEP_2HKO = 1;
export const STEP_OHKO = 1.5;
/** Riferimento di riserva: media dei valori che vale Wallbreaking 100. */
export const STEP_FULL = 1.25;
/** Il 100 della Potenza del membro: il 3° miglior attaccante fra i più usati del formato (un 100 raro). */
export const REFERENCE_RANK = 3;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare gli attaccanti di riferimento. */
const REFERENCE_SCAN = 40;
/** Offesa del team: Potenza 60% e Coverage 40% (col meta 20% tipi e 20% meta, senza meta 40% tipi). */
export const OFFENSE_SHARES = { power: 0.6, coverage: 0.4 };
/** Solo per i Ruoli (wallbreaker, sweeper): il vecchio valore del membro, Potenza e Wallbreaking 50 e 35. */
const ROLES_WEIGHTS = { power: 0.5, wallbreaking: 0.35 };
/** Il setup costa un turno libero: nel voto entra metà di quanto alza la Potenza dopo una danza. */
export const SETUP_SHARE = 0.5;
/** Pesi per posizione nel team, dal membro più offensivo al meno: un membro debole conta poco perché è in fondo. */
export const RANK_WEIGHTS = [0.30, 0.22, 0.17, 0.13, 0.10, 0.08];
/** Tera e mosse Z si usano una volta a partita: nel voto entra un quarto di quello che aggiungono. */
export const ONE_USE_SHARE = 0.25;

export interface MemberOffense {
  species: string;
  /** Potenza senza setup né Tera/Z: danno medio contro il Pokémon medio dei 18 tipi. */
  power: number;
  /** La mossa di potenziamento del set (null se non ne ha). */
  setupMove: string | null;
  /** La mossa più spesso migliore contro i 18 Pokémon medi dei tipi; null senza mosse d'attacco. */
  bestMove: string | null;
  /** Punti di Potenza che vengono dal setup (già dentro `value`: metà del guadagno dopo una danza). */
  setupGain: number;
  /** Tera o mossa Z del membro (una volta a partita), null se non ne ha. */
  oneUse: { kind: 'tera' | 'z'; name: string } | null;
  /** Punti di Offesa del membro che vengono da Tera/Z (già dentro `value`: un quarto del guadagno). */
  oneUseGain: number;
  /** Potenza con metà del guadagno del setup e un quarto di quello di Tera/Z: entra nella Potenza del team. */
  powerInGrade: number;
  /** Il valore del membro: `powerInGrade` arrotondata (dice chi è un attaccante forte). */
  value: number;
  /** Quota (0–100) dei 18 tipi e dei bersagli del meta che il membro copre da solo (null senza meta). */
  coverTypes: number;
  coverMeta: number | null;
  /** Quanto il membro porta all'Offesa, coi pesi della squadra: 60/20/20, senza meta 60/40. */
  total: number;
}

export interface CoverageDetail {
  value: number;
  /** Bersagli che nessuno colpisce super efficace al 33%. */
  holes: string[];
  /** Per ogni bersaglio: tipi, Pokémon, peso, quanto è coperto e chi lo copre (con quale mossa). */
  rows: CoverageRow[];
}

export interface TeamOffense {
  /** Quanti attaccanti fisici, speciali e misti (solo informazione, non entra nel voto). */
  attackers: { physical: number; special: number; mixed: number };
  /** Potenza 60% + Coverage 40% (col meta 20% tipi e 20% meta). */
  value: number;
  /** Coverage nel voto: col meta la media di quella di tipi e di quella del meta, senza meta quella di tipi. */
  coverage: number;
  coverageTypes: CoverageDetail;
  /** null senza meta. */
  coverageMeta: CoverageDetail | null;
  /** Media pesata per posizione della Potenza dei membri (setup e Tera/Z compresi). */
  power: number;
  /** Punti di Offesa finale che vengono dal setup. */
  setupGain: number;
  setters: { species: string; move: string }[];
  members: MemberOffense[];
  /** I tre migliori attaccanti del meta: il 3° è il 100 della Potenza (vuoto senza statistiche). */
  referenceAttackers: string[];
}

/** Valore del colpo migliore contro un difensore: 0, 0,5 (3HKO), 1 (2HKO) o 1,5 (OHKO sicuro; mai per le mosse OHKO, che possono mancare). */
export function stepValue(hit: Hit | null): number {
  if (!hit) return 0;
  if (hit.min >= 1 && !getMove(hit.move)?.ohko) return STEP_OHKO;
  return hit.expected >= TWO_HIT ? STEP_2HKO : hit.expected >= THREE_HIT ? STEP_3HKO : 0;
}

/**
 * Soglia di una casella della tabella dei muri. Il valore può essere una media (Tera, Z e meteo contano a metà):
 * da 1,25 è un OHKO, da 0,75 un 2HKO, da 0,25 un 3HKO.
 */
export function stepBucket(step: number): 'ohko' | 'two' | 'three' | 'none' {
  return step >= 1.25 ? 'ohko' : step >= 0.75 ? 'two' : step >= 0.25 ? 'three' : 'none';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Dal rapporto col riferimento al punteggio: lineare, il riferimento vale 100. */
const toScore = (x: number, full: number) => softScore(x / full);

/** Condizioni di campo (meteo, terreni) che il team porta; quelle che il set porta con la sua abilità sono sempre attive per lui. */
function conditionsOf(set: TeamSet, team: TeamSet[]) {
  const field = (links: ReturnType<typeof enables>) => links.map(l => l.condition).filter((c): c is FieldCondition => c !== 'trickroom');
  const own = field(enables(set).filter(l => toID(l.via) === toID(battleAbility(set))));
  const all = [...new Set([...own, ...team.flatMap(member => field(enables(member)))])].sort();
  return { own: [...new Set(own)], all };
}

const WEATHERS: FieldCondition[] = ['sun', 'rain', 'sand', 'snow'];

/**
 * Le combinazioni di campo che il team può dare al membro, oltre alle sue: un meteo e un terreno alla volta
 * (due meteo non stanno insieme). Quelli che il membro porta con la sua abilità restano sempre.
 */
function fieldCombos(own: FieldCondition[], all: FieldCondition[]): FieldCondition[][] {
  const isWeather = (c: FieldCondition) => WEATHERS.includes(c);
  const options = (pick: (c: FieldCondition) => boolean) => {
    const mine = own.filter(pick);
    return mine.length ? [mine] : [[], ...all.filter(pick).map(c => [c])];
  };
  const combos = options(isWeather).flatMap(w => options(c => !isWeather(c)).map(t => [...w, ...t]));
  return combos.filter(c => c.length > own.length);
}


/**
 * Misure grezze del set: danno medio contro i bersagli della Coverage (i Pokémon più usati, o i 18 tipi neutri),
 * e il valore del colpo migliore contro ogni muro del formato, anche dopo il setup.
 */
interface Raw {
  species: string; expected: number; setupMove: string | null; bestMove: string | null;
  /** Con Tera o mossa Z (null se il set non ne ha): danno medio e valore dei colpi contro ogni muro. */
  oneUse: { kind: 'tera' | 'z'; name: string; expected: number; steps: number[] } | null;
  /** Per ogni muro: valore del colpo migliore e danno (0–1), senza e con il setup. */
  steps: number[]; hits: number[]; setupSteps: number[] | null; setupHits: number[] | null;
  /** Danno medio dopo una danza (null senza mossa di potenziamento). */
  setupExpected: number | null;
}

/**
 * Su cosa si misura il set. `power`: la Potenza del voto, contro i 18 Pokémon medi dei tipi (con e senza meta), senza muri.
 * `roles`: la vecchia misura che usano solo i Ruoli: danno contro i bersagli della Coverage e colpi contro i muri del formato.
 */
type Measure = 'power' | 'roles';

function measureSet(set: TeamSet, team: TeamSet[], data: EngineData, measure: Measure): Raw | null {
  const species = battleSpecies(set);
  if (!species) return null;
  const attacks = set.moves.some(m => (getMove(m)?.category ?? 'Status') !== 'Status');
  const { own, all } = conditionsOf(set, team);
  const combos = fieldCombos(own, all);
  // Poteri da una volta a partita (Tera, mossa Z): il valore base è senza, a parte la variante con
  const teraOk = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType;
  const zItem = dex.items.get(set.item);
  const zOk = !!zItem.zMoveType && set.moves.some(m => getMove(m)?.type === zItem.zMoveType);
  const oneUseVariants = [...(teraOk ? [{ tera: true, z: false }] : []), ...(zOk ? [{ tera: false, z: true }] : [])];
  let known = false;

  // Contro un bersaglio: il meteo del team vale metà (mai sotto il danno senza); `oneUse` prova Tera/Z e tiene il meglio
  const against = (target: Target, boosts?: HitOptions['boosts'], oneUse = false) => {
    const expected: number[] = [];
    const steps: number[] = [];
    let move: string | null = null;
    for (const variant of oneUse ? oneUseVariants : [{ tera: false, z: false }]) {
      const base = { ...variant, boosts };
      const off = bestHit(set, target, { ...base, conditions: own });
      // Col meteo del team: ogni combinazione possibile (un meteo e un terreno alla volta), quella che conviene di più
      const on = combos.reduce<Hit | null>((best, conditions) => {
        const hit = bestHit(set, target, { ...base, conditions });
        return (hit?.expected ?? 0) > (best?.expected ?? 0) ? hit : best;
      }, off);
      if (off || on) known = true;
      move ??= off?.move ?? on?.move ?? null;
      const better = (on?.expected ?? 0) >= (off?.expected ?? 0) ? on : off;
      // Un KO è un KO: oltre il 100% dei PS il danno non conta di più
      expected.push((Math.min(1, off?.expected ?? 0) + Math.min(1, better?.expected ?? 0)) / 2);
      steps.push((stepValue(off) + stepValue(better)) / 2);
    }
    const best = expected.indexOf(Math.max(...expected));
    return { expected: expected[best] ?? 0, step: steps[best] ?? 0, move };
  };

  const targets = measure === 'power' ? coverageTargets(data, 'types') : coverageTargets(data);
  // Danno medio pesato, e quale mossa è più spesso la migliore (per la scheda Potenza)
  const byMove = new Map<string, number>();
  const expected = targets.reduce((acc, target) => {
    const hit = against(target.set);
    if (hit.move) byMove.set(hit.move, (byMove.get(hit.move) ?? 0) + target.weight);
    return acc + target.weight * hit.expected;
  }, 0);
  const bestMove = [...byMove].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const defenders = measure === 'roles' ? defenderPanel(data) : [];
  const plain = defenders.map(defender => against(defender));
  // Ha mosse d'attacco ma la libreria non sa calcolarne nessuna: Pokémon sconosciuto, non conta
  if (attacks && !known) return null;
  const setup = attacks ? setupBoosts(set) : null;
  const boosted = setup ? defenders.map(defender => against(defender, setup.boosts)) : null;
  const setupExpected = setup ? targets.reduce((acc, target) => acc + target.weight * against(target.set, setup.boosts).expected, 0) : null;
  const oneUse = attacks && oneUseVariants.length ? {
    kind: teraOk ? 'tera' as const : 'z' as const,
    name: teraOk ? set.teraType! : zItem.name,
    expected: targets.reduce((acc, target) => acc + target.weight * Math.max(against(target.set, undefined, true).expected, against(target.set).expected), 0),
    steps: defenders.map((defender, d) => Math.max(plain[d].step, against(defender, undefined, true).step)),
  } : null;
  return {
    species: species.name, expected, setupMove: setup?.move ?? null, bestMove, oneUse, setupExpected,
    steps: plain.map(r => r.step), hits: plain.map(r => r.expected),
    setupSteps: boosted?.map(r => r.step) ?? null, setupHits: boosted?.map(r => r.expected) ?? null,
  };
}

/** Per misura, contenuto del set, formato, meta e condizioni del team: le proposte rifanno set uguali con oggetti nuovi. */
const raws = new Map<string, Raw | null>();
const RAW_LIMIT = 5000;

function rawOf(set: TeamSet, team: TeamSet[], data: EngineData, measure: Measure = 'power'): Raw | null {
  const key = `${measure}|${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${conditionsOf(set, team).all.join(',')}`;
  if (raws.has(key)) return raws.get(key)!;
  if (raws.size >= RAW_LIMIT) raws.clear();
  const value = measureSet(set, team, data, measure);
  raws.set(key, value);
  return value;
}

export interface OffenseReference {
  /** Danno medio contro i 18 Pokémon medi che vale Potenza 100. */
  power: number;
  /** Solo per i Ruoli: danno medio contro i bersagli della Coverage e valore medio dei colpi sui muri che valgono 100. */
  rolesPower: number;
  step: number;
  /** Gli attaccanti più usati del formato, dal miglior Wallbreaking e dal danno medio più alto (vuoti senza statistiche). */
  attackers: string[];
  byPower: string[];
}

const references = new Map<string, OffenseReference>();

/**
 * Il 100 della Potenza: il 3° miglior attaccante fra i più usati del formato (set più comune), misurato come i membri
 * contro i 18 Pokémon medi. Così 100 vuol dire "fra i migliori del meta", non una soglia che nessuno raggiunge.
 * Gli stessi attaccanti danno il 100 della vecchia misura dei Ruoli. Senza statistiche: i valori fissi di riserva.
 */
export function offenseReference(data: EngineData): OffenseReference {
  // Anche senza meta il riferimento usa le statistiche, se ci sono: mentre si caricano non devono restare quelle di riserva
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let reference = references.get(key);
  if (reference) return reference;
  const rules = rulesOf(data);
  const sets = topThreats(data.stats, REFERENCE_SCAN, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set
      && set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length >= 2 && !isDefensiveSet(set, rules));
  const measured = sets.map(set => rawOf(set, [set], data, 'power'))
    .filter((raw): raw is Raw => raw !== null)
    .map(raw => ({ species: raw.species, expected: raw.expected }));
  const forRoles = sets.map(set => rawOf(set, [set], data, 'roles'))
    .filter((raw): raw is Raw => raw !== null)
    .map(raw => ({ species: raw.species, expected: raw.expected, step: mean(raw.steps) }));
  const nth = (values: number[]) => values.sort((a, b) => b - a)[Math.min(REFERENCE_RANK, values.length) - 1];
  const power = measured.length ? nth(measured.map(r => r.expected)) : 0;
  const rolesPower = forRoles.length ? nth(forRoles.map(r => r.expected)) : 0;
  const step = forRoles.length ? nth(forRoles.map(r => r.step)) : 0;
  reference = {
    power: power > 0 ? power : POWER_FULL,
    rolesPower: rolesPower > 0 ? rolesPower : ROLES_POWER_FULL,
    step: step > 0 ? step : STEP_FULL,
    attackers: [...forRoles].sort((a, b) => b.step - a.step).map(r => r.species),
    byPower: [...measured].sort((a, b) => b.expected - a.expected).map(r => r.species),
  };
  references.set(key, reference);
  return reference;
}

/**
 * Offesa di un membro: la Potenza, il danno medio del colpo migliore contro il Pokémon medio di ognuno dei 18 tipi
 * (con e senza meta). Nel voto entrano metà del guadagno del setup e un quarto di Tera/Z. Null se la libreria non
 * conosce il Pokémon.
 */
export function memberOffense(set: TeamSet, team: TeamSet[], data: EngineData): MemberOffense | null {
  const raw = rawOf(set, team, data, 'power');
  if (!raw) return null;
  const ref = offenseReference(data);
  const power = toScore(raw.expected, ref.power);
  const setupPower = raw.setupExpected !== null ? toScore(Math.max(raw.expected, raw.setupExpected), ref.power) : power;
  const one = raw.oneUse;
  const oneUsePower = one ? toScore(one.expected, ref.power) : power;
  const withSetup = power + SETUP_SHARE * (setupPower - power);
  const powerInGrade = withSetup + ONE_USE_SHARE * (oneUsePower - power);
  const value = Math.round(powerInGrade);
  const coverTypes = teamCoverage([set], data, 'types').perMember[0];
  const coverMeta = usesMeta(data) ? teamCoverage([set], data, 'meta').perMember[0] : null;
  const total = Math.round(coverMeta === null
    ? OFFENSE_SHARES.power * powerInGrade + OFFENSE_SHARES.coverage * coverTypes
    : OFFENSE_SHARES.power * powerInGrade + (OFFENSE_SHARES.coverage / 2) * (coverTypes + coverMeta));
  return {
    species: raw.species, power, setupMove: raw.setupMove, bestMove: raw.bestMove,
    setupGain: Math.round(withSetup) - power, value, coverTypes, coverMeta, total,
    oneUse: one && { kind: one.kind, name: one.name }, oneUseGain: value - Math.round(withSetup), powerInGrade,
  };
}

/** La vecchia Offesa del membro, solo per i Ruoli (wallbreaker e sweeper): non entra nel voto e non si mostra. */
export interface RolesMemberOffense {
  wallbreaking: number;
  wallbreakingGain: number;
  value: number;
  bestMove: string | null;
  setupMove: string | null;
}

/**
 * La misura dei Ruoli, com'era prima della revisione: Potenza contro i bersagli della Coverage e Wallbreaking contro
 * i muri del formato (pesi 50 e 35), setup a metà del guadagno di Wallbreaking, Tera/Z a un quarto.
 */
export function rolesMemberOffense(set: TeamSet, team: TeamSet[], data: EngineData): RolesMemberOffense | null {
  const raw = rawOf(set, team, data, 'roles');
  if (!raw) return null;
  const ref = offenseReference(data);
  const power = toScore(raw.expected, ref.rolesPower);
  const wallbreaking = toScore(mean(raw.steps), ref.step);
  const withSetup = raw.setupSteps ? toScore(mean(raw.steps.map((x, d) => Math.max(x, raw.setupSteps![d]))), ref.step) : wallbreaking;
  const wallbreakingGain = Math.round(SETUP_SHARE * (withSetup - wallbreaking));
  const one = raw.oneUse;
  const powerInGrade = one ? power + ONE_USE_SHARE * (toScore(one.expected, ref.rolesPower) - power) : power;
  const wallOneUse = one ? ONE_USE_SHARE * (toScore(mean(one.steps), ref.step) - wallbreaking) : 0;
  const w = ROLES_WEIGHTS;
  const value = Math.round((w.power * powerInGrade + w.wallbreaking * (wallbreaking + wallbreakingGain + wallOneUse)) / (w.power + w.wallbreaking));
  return { wallbreaking, wallbreakingGain, value, bestMove: raw.bestMove, setupMove: raw.setupMove };
}

/** Media pesata per posizione: valori dal più alto al più basso, pesi 22/18/16/15/15/14% (rinormalizzati se sono meno di sei). */
export function rankWeighted(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  const weights = sorted.map((_, i) => RANK_WEIGHTS[Math.min(i, RANK_WEIGHTS.length - 1)]);
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round(sorted.reduce((acc, v, i) => acc + v * weights[i], 0) / total);
}

/**
 * Offesa del team: Potenza (media pesata per posizione dei membri) 60% e Coverage 40%; col meta la Coverage è metà
 * di tipi e metà del meta (20% e 20%), senza meta tutta di tipi.
 */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  const types = teamCoverage(team, data, 'types');
  const metaCoverage = usesMeta(data) ? teamCoverage(team, data, 'meta') : null;
  const coverageValue = metaCoverage ? Math.round((types.value + metaCoverage.value) / 2) : types.value;
  const ref = offenseReference(data);
  const members = team
    .map(set => memberOffense(set, team, data))
    .filter((m): m is MemberOffense => m !== null);
  const final = (power: number) => {
    if (!members.length) return 0;
    const coverage = metaCoverage
      ? (OFFENSE_SHARES.coverage / 2) * (types.value + metaCoverage.value)
      : OFFENSE_SHARES.coverage * types.value;
    return Math.round(OFFENSE_SHARES.power * power + coverage);
  };
  const power = rankWeighted(members.map(m => m.powerInGrade));
  const value = final(power);
  // Quanto vale il setup sull'Offesa finale: lo stesso conto senza la parte del setup
  const withoutSetup = final(rankWeighted(members.map(m => m.powerInGrade - Math.max(0, m.setupGain))));
  const styles = team.filter(set => battleSpecies(set)).map(attackStyle);
  return {
    attackers: { physical: styles.filter(s => s === 'physical').length, special: styles.filter(s => s === 'special').length, mixed: styles.filter(s => s === 'mixed').length },
    value,
    coverage: coverageValue,
    coverageTypes: { value: types.value, holes: types.holes, rows: types.rows },
    coverageMeta: metaCoverage && { value: metaCoverage.value, holes: metaCoverage.holes, rows: metaCoverage.rows },
    referenceAttackers: ref.byPower.slice(0, REFERENCE_RANK),
    power,
    setupGain: value - withoutSetup,
    setters: members.filter(m => m.setupMove).map(m => ({ species: m.species, move: m.setupMove! })),
    members,
  };
}
