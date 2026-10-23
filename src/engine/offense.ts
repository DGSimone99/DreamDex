import { usesMeta } from './analysis';
import { coverageTargets, teamCoverage, type CoverageRow } from './coverage';
import { bestHit, setKey, type FieldCondition, type Hit, type HitOptions, type Target } from './damage';
import type { EngineData } from './data';
import { defenderPanel, isDefensiveSet, metaDefenderCount } from './defenders';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { rulesOf } from './formatRules';
import { mostCommonSet, type TeamSet } from './sets';
import { topThreats } from './stats';
import { softScore } from './scale';
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
export const OFFENSE_WEIGHTS = { power: 0.5, wallbreaking: 0.35 };
/** Il setup costa un turno libero: nel voto entra metà di quanto alza il Wallbreaking di squadra (il Potenziale). */
export const SETUP_SHARE = 0.5;
/** Quota della Coverage nell'Offesa del team (il resto è la media pesata dei membri). */
export const COVERAGE_SHARE = 0.25;
/** Pesi per posizione nel team, dal membro più offensivo al meno: un membro debole conta poco perché è in fondo. */
export const RANK_WEIGHTS = [0.30, 0.22, 0.17, 0.13, 0.10, 0.08];
/** Tera e mosse Z si usano una volta a partita: nel voto entra un quarto di quello che aggiungono. */
export const ONE_USE_SHARE = 0.25;

export interface MemberOffense {
  species: string;
  power: number;
  wallbreaking: number;
  /** La mossa di potenziamento del set (null se non ne ha). */
  setupMove: string | null;
  /** La mossa più spesso migliore contro i bersagli del meta (pesata per uso); null senza mosse d'attacco. */
  bestMove: string | null;
  /** Punti di Offesa del membro che vengono dal setup (già dentro `value`: metà del guadagno di Wallbreaking). */
  setupGain: number;
  /** Quanto il setup alza il Wallbreaking del membro nel voto (metà del guadagno dopo un uso). */
  wallbreakingGain: number;
  /** Tera o mossa Z del membro (una volta a partita), null se non ne ha. */
  oneUse: { kind: 'tera' | 'z'; name: string } | null;
  /** Punti di Offesa del membro che vengono da Tera/Z (già dentro `value`: un quarto del guadagno). */
  oneUseGain: number;
  /** Potenza con un quarto del guadagno di Tera/Z: è quella che entra nella Potenza del team. */
  powerInGrade: number;
  value: number;
  /** Bersagli della Coverage che manda KO in due colpi (la Coverage vera è del team). */
  covered: number;
}

export interface WallCell {
  /** Valore del colpo migliore: 0, 0,5 (3HKO), 1 (2HKO), 1,5 (OHKO). */
  step: number;
  /** Danno in % dei PS (al massimo 100). */
  pct: number;
  /** Lo stesso dopo il setup (null se il membro non ha una mossa di potenziamento). */
  setupStep: number | null;
  setupPct: number | null;
}

export interface CoverageDetail {
  value: number;
  /** Bersagli che nessuno colpisce super efficace al 33%. */
  holes: string[];
  /** Per ogni bersaglio: tipi, Pokémon, peso, quanto è coperto e chi lo copre (con quale mossa). */
  rows: CoverageRow[];
}

export interface TeamOffense {
  /** 75% la media pesata dei membri, 25% la Coverage. */
  value: number;
  memberValue: number;
  /** Coverage nel voto: col meta la media di quella di tipi e di quella del meta, senza meta quella di tipi. */
  coverage: number;
  coverageTypes: CoverageDetail;
  /** null senza meta. */
  coverageMeta: CoverageDetail | null;
  power: number;
  /** Wallbreaking di squadra, senza e con il setup (chi ha una mossa di potenziamento la usa una volta). */
  wallbreaking: number;
  wallbreakingSetup: number;
  /** Punti di Offesa finale che vengono dal setup (nel voto ne entra metà del guadagno di Wallbreaking). */
  setupGain: number;
  setters: { species: string; move: string }[];
  members: MemberOffense[];
  /** Per ogni muro (ordine di `defenders`) e membro (ordine di `members`): soglia e danno, senza e con il setup. */
  walls: { species: string; cells: WallCell[] }[];
  /** I tre migliori attaccanti del meta: il 3° è il 100 di Potenza e Wallbreaking (vuoto senza statistiche). */
  referenceAttackers: string[];

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

/**
 * Soglia di una casella della tabella dei muri. Il valore può essere una media (Tera, Z e meteo contano a metà):
 * da 1,25 è un OHKO, da 0,75 un 2HKO, da 0,25 un 3HKO.
 */
export function stepBucket(step: number): 'ohko' | 'two' | 'three' | 'none' {
  return step >= 1.25 ? 'ohko' : step >= 0.75 ? 'two' : step >= 0.25 ? 'three' : 'none';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Dal rapporto col riferimento al punteggio: lineare fino a 80, poi sempre più piano (il 100 non si raggiunge). */
const toScore = (x: number, full: number) => softScore(x / full);

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

/** La mossa di potenziamento più forte del set: Attacco, Attacco Speciale, o Difesa con Body Press, dopo un uso. */
function setupBoosts(set: TeamSet): { move: string; boosts: NonNullable<HitOptions['boosts']> } | null {
  const bodyPress = set.moves.some(m => toID(m) === 'bodypress');
  let best: { move: string; boosts: NonNullable<HitOptions['boosts']> } | null = null;
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
    if (sum > bestSum) { best = { move: move.name, boosts }; bestSum = sum; }
  }
  return best;
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
}

function measureSet(set: TeamSet, team: TeamSet[], data: EngineData): Raw | null {
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

  const targets = coverageTargets(data);
  // Danno medio pesato, e quale mossa è più spesso la migliore (per la scheda Potenza)
  const byMove = new Map<string, number>();
  const expected = targets.reduce((acc, target) => {
    const hit = against(target.set);
    if (hit.move) byMove.set(hit.move, (byMove.get(hit.move) ?? 0) + target.weight);
    return acc + target.weight * hit.expected;
  }, 0);
  const bestMove = [...byMove].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const defenders = defenderPanel(data);
  const plain = defenders.map(defender => against(defender));
  // Ha mosse d'attacco ma la libreria non sa calcolarne nessuna: Pokémon sconosciuto, non conta
  if (attacks && !known) return null;
  const setup = attacks ? setupBoosts(set) : null;
  const boosted = setup ? defenders.map(defender => against(defender, setup.boosts)) : null;
  const oneUse = attacks && oneUseVariants.length ? {
    kind: teraOk ? 'tera' as const : 'z' as const,
    name: teraOk ? set.teraType! : zItem.name,
    expected: targets.reduce((acc, target) => acc + target.weight * Math.max(against(target.set, undefined, true).expected, against(target.set).expected), 0),
    steps: defenders.map((defender, d) => Math.max(plain[d].step, against(defender, undefined, true).step)),
  } : null;
  return {
    species: species.name, expected, setupMove: setup?.move ?? null, bestMove, oneUse,
    steps: plain.map(r => r.step), hits: plain.map(r => r.expected),
    setupSteps: boosted?.map(r => r.step) ?? null, setupHits: boosted?.map(r => r.expected) ?? null,
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
  /** Gli attaccanti più usati del formato, dal miglior Wallbreaking e dal danno medio più alto (vuoti senza statistiche). */
  attackers: string[];
  byPower: string[];
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
    byPower: [...measured].sort((a, b) => b.expected - a.expected).map(r => r.species),
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
  const base = Math.round(attackValue(power, wallbreaking));
  // Potenziale: col setup usato una volta il Wallbreaking sale; nel valore ne entra metà
  const withSetup = raw.setupSteps ? toScore(mean(raw.steps.map((x, d) => Math.max(x, raw.setupSteps![d]))), ref.step) : wallbreaking;
  const wallbreakingGain = Math.round(SETUP_SHARE * (withSetup - wallbreaking));
  const withoutOneUse = Math.round(attackValue(power, wallbreaking + wallbreakingGain));
  // Tera e mossa Z: un quarto di quello che aggiungono a Potenza e Wallbreaking
  const one = raw.oneUse;
  const powerInGrade = one ? power + ONE_USE_SHARE * (toScore(one.expected, ref.power) - power) : power;
  const wallOneUse = one ? ONE_USE_SHARE * (toScore(mean(one.steps), ref.step) - wallbreaking) : 0;
  const value = Math.round(attackValue(powerInGrade, wallbreaking + wallbreakingGain + wallOneUse));
  return {
    species: raw.species, power, wallbreaking, setupMove: raw.setupMove, bestMove: raw.bestMove,
    setupGain: withoutOneUse - base, wallbreakingGain, value, covered: 0,
    oneUse: one && { kind: one.kind, name: one.name }, oneUseGain: value - withoutOneUse, powerInGrade,
  };
}

/** Potenza e Wallbreaking nel valore d'attacco (pesi 50 e 35, rinormalizzati). */
function attackValue(power: number, wallbreaking: number): number {
  const w = OFFENSE_WEIGHTS;
  return (w.power * power + w.wallbreaking * wallbreaking) / (w.power + w.wallbreaking);
}

/** Media pesata per posizione: valori dal più alto al più basso, pesi 22/18/16/15/15/14% (rinormalizzati se sono meno di sei). */
export function rankWeighted(values: number[]): number {
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

/**
 * Offesa del team dalle sottostatistiche di squadra: Potenza (media pesata per posizione dei membri),
 * Wallbreaking (chi sfonda ogni muro, con la profondità), Setup (la win condition migliore più un po' della seconda),
 * combinate come per un membro; poi 75% questo e 25% la Coverage.
 */
export function teamOffense(team: TeamSet[], data: EngineData): TeamOffense {
  // Col meta due Coverage che si dividono a metà il peso: di tipi (stabile, classica) e del meta (quello che incontri)
  const types = teamCoverage(team, data, 'types');
  const metaCoverage = usesMeta(data) ? teamCoverage(team, data, 'meta') : null;
  const coverageValue = metaCoverage ? Math.round((types.value + metaCoverage.value) / 2) : types.value;
  const perMember = team.map((_, i) => (metaCoverage ? Math.round((types.perMember[i] + metaCoverage.perMember[i]) / 2) : types.perMember[i]));
  const ref = offenseReference(data);
  const raws = team.map(set => rawOf(set, team, data)).filter((r): r is Raw => r !== null);
  const members = team
    .map((set, i) => { const m = memberOffense(set, team, data); return m && { ...m, covered: perMember[i] }; })
    .filter((m): m is MemberOffense => m !== null);
  const defenders = defenderPanel(data);
  // Per ogni muro, i membri dal più forte: il team lo sfonda se qualcuno ci riesce, meglio se più di uno.
  // Ogni membro conta al massimo come un 2HKO: un solo OHKO non basta per il 100, servono più risposte
  const teamWall = (withSetup: boolean, oneUse = false) => mean(defenders.map((_, d) => {
    const best = raws
      .map(r => Math.min(STEP_2HKO, oneUse && r.oneUse ? r.oneUse.steps[d]
        : withSetup && r.setupSteps ? Math.max(r.steps[d], r.setupSteps[d]) : r.steps[d]))
      .sort((a, b) => b - a);
    return WALL_DEPTH.reduce((acc, share, i) => acc + share * (best[i] ?? 0), 0);
  }));
  const power = rankWeighted(members.map(m => m.powerInGrade));
  const wallbreaking = raws.length ? toScore(teamWall(false), TEAM_WALL_FULL) : 0;
  const wallbreakingSetup = raws.length ? toScore(teamWall(true), TEAM_WALL_FULL) : 0;
  // Potenziale: metà del guadagno di Wallbreaking col setup entra nel voto
  const wallbreakingOneUse = raws.length ? toScore(teamWall(false, true), TEAM_WALL_FULL) : 0;
  const effective = wallbreaking + SETUP_SHARE * (wallbreakingSetup - wallbreaking) + ONE_USE_SHARE * (wallbreakingOneUse - wallbreaking);
  const final = (wall: number) => members.length ? Math.round((1 - COVERAGE_SHARE) * attackValue(power, wall) + COVERAGE_SHARE * coverageValue) : 0;
  const value = final(effective);
  return {
    value,
    memberValue: members.length ? Math.round(attackValue(power, effective)) : 0,
    coverage: coverageValue,
    coverageTypes: { value: types.value, holes: types.holes, rows: types.rows },
    coverageMeta: metaCoverage && { value: metaCoverage.value, holes: metaCoverage.holes, rows: metaCoverage.rows },
    // Il riferimento della Potenza: i primi per danno medio, il 3° vale circa 93
    referenceAttackers: ref.byPower.slice(0, REFERENCE_RANK),
    power,
    wallbreaking,
    wallbreakingSetup,
    setupGain: value - final(wallbreaking),
    setters: members.filter(m => m.setupMove).map(m => ({ species: m.species, move: m.setupMove! })),
    members,
    walls: defenders.map((defender, d) => ({
      species: defender.species,
      cells: raws.map(r => ({
        // Troncato, non arrotondato: 32,9% non deve sembrare il 33% della soglia del 3HKO
        step: r.steps[d], pct: Math.floor(100 * r.hits[d]),
        setupStep: r.setupSteps ? Math.max(r.steps[d], r.setupSteps[d]) : null,
        setupPct: r.setupHits ? Math.floor(100 * Math.max(r.hits[d], r.setupHits[d])) : null,
      })),
    })),
    defenders: defenders.map(set => set.species),
    metaDefenders: metaDefenderCount(data),
  };
}
