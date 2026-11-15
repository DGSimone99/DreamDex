import { usesMeta } from './analysis';
import { bestHit, hasZMove, setKey, type FieldCondition, type Target } from './damage';
import type { EngineData } from './data';
import type { Species } from '@pkmn/dex';
import { battleAbility, battleSpecies, dex, getMove, isSelectable, toID } from './dex';
import { DEFAULT_FORMAT, type Format } from './format';
import { pokedexOf, speciesInPokedex, teraAllowed } from './formats';
import { enables } from './synergy';
import { mostCommonSet, type TeamSet } from './sets';
import { setupBoosts } from './setupBoosts';
import { topThreats, usageOf } from './stats';
import { softScore } from './scale';
import { bestAttackMultiplier, TYPES } from './types';

/** Quanti Pokémon del meta, dal più usato, danno le combinazioni di tipi da coprire. */
const TARGET_SCAN = 40;
/** Un membro copre un bersaglio se lo manda KO in due colpi. */
export const COVER_HIT = 0.5;
/** Sotto questo danno super efficace nessuno ha un vantaggio di tipo vero: è un buco (non arriva al KO in tre colpi). */
export const HOLE_HIT = 1 / 3;
/** Tera e mosse Z (una volta a partita) contano un quarto anche nella Coverage, come nel resto dell'Offesa. */
const ONE_USE_COVER = 0.25;
/** Profondità: il 1°, 2° e 3° membro che copre un bersaglio valgono 70, 20 e 10%. */
export const COVERAGE_DEPTH = [0.7, 0.2, 0.1];
/**
 * Nel meta come nei tipi, 70/20/10 (2026-11-13, era 50/30/20). Il 50/30/20 serviva quando il punto fisso per membro portava
 * un terzo dei team forti fra 95 e 100; tolto quello, su 710 team National Dex OU il livello resta quello di prima.
 */
export const META_DEPTH = [0.7, 0.2, 0.1];
/** I pesi della profondità per la misura: tipi e meta 70/20/10. */
export const depthWeights = (kind: CoverageKind): number[] => (kind === 'meta' ? META_DEPTH : COVERAGE_DEPTH);

export interface CoverageTarget {
  /** Combinazione di tipi ("Water/Ground") o, senza meta, il tipo. */
  label: string;
  set: Target;
  /** Peso nella Coverage (somma 1). */
  weight: number;
}

const pools = new Map<string, Species[]>();

/** I completamente evoluti del Pokédex del formato (in National Dex anche le Mega, in Gen 9 no; niente forme Totem). */
export function dexPool(format: Format): Species[] {
  const key = pokedexOf(format);
  let pool = pools.get(key);
  if (!pool) {
    pool = dex.species.all().filter(s => s.exists && !s.nfe && s.num > 0 && isSelectable(s) && speciesInPokedex(s, format) && !s.forme.includes('Totem'));
    pools.set(key, pool);
  }
  return pool;
}

const typeAverages = new Map<string, { hp: number; def: number; spd: number }>();

/**
 * Difese base medie del tipo: la media dei completamente evoluti del Pokédex del formato che hanno quel tipo
 * (in National Dex anche le Mega, in Gen 9 no; niente forme Totem). Un doppio tipo conta per entrambi i suoi tipi.
 */
export function typeAverage(type: string, data: EngineData): { hp: number; def: number; spd: number } {
  const format = { ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' };
  const key = `${pokedexOf(format)}|${type}`;
  let average = typeAverages.get(key);
  if (average) return average;
  const pool = dexPool(format).filter(s => (s.types as string[]).includes(type));
  const mean = (stat: (s: Species) => number) => Math.round(pool.reduce((acc, s) => acc + stat(s), 0) / Math.max(1, pool.length));
  average = { hp: mean(s => s.baseStats.hp), def: mean(s => s.baseStats.def), spd: mean(s => s.baseStats.spd) };
  typeAverages.set(key, average);
  return average;
}

const typeWeights = new Map<string, number>();

/**
 * Peso tipico del tipo: la mediana (non la media: Celesteela pesa 999 kg) dei completamente evoluti del Pokédex del formato
 * con quel tipo. Serve al manichino: prima era Mew, 4 kg, e Low Kick e Grass Knot facevano sempre 20 di potenza (2026-11-08).
 */
export function typeWeight(type: string, data: EngineData): number {
  const format = { ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' };
  const key = `${pokedexOf(format)}|${type}`;
  let weight = typeWeights.get(key);
  if (weight) return weight;
  const weights = dexPool(format).filter(s => (s.types as string[]).includes(type)).map(s => s.weightkg).sort((a, b) => a - b);
  weight = weights.length ? weights[Math.floor(weights.length / 2)] : 50;
  typeWeights.set(key, weight);
  return weight;
}

/**
 * Il Pokémon medio di un tipo: un solo tipo, le difese medie del tipo, 252 PS e il resto diviso fra le difese. Tiene
 * il peso tipico del tipo e uno strumento che non cambia il danno (Leftovers), come quasi tutti i Pokémon veri: Knock Off ×1,5 e Poltergeist
 * contano come in partita.
 */
function typeDummy(type: string, data: EngineData): Target {
  return { species: 'Mew', item: 'Leftovers', ability: 'Synchronize', moves: [], nature: 'Hardy', evs: { hp: 252, def: 128, spd: 128 }, types: [type], baseStats: typeAverage(type, data), weightkg: typeWeight(type, data) };
}

const targetsCache = new Map<string, CoverageTarget[]>();

/**
 * Cosa deve colpire il team. Col meta: le combinazioni di tipi dei più usati, pesate per uso, ognuna col suo Pokémon
 * più usato e il suo set più comune (difese, abilità e strumento veri). Senza meta: i 18 tipi, stesso peso, il Pokémon medio del tipo.
 */
/** Coverage di tipi (i 18 tipi, bersaglio neutro) o del meta (i Pokémon più usati). */
export type CoverageKind = 'types' | 'meta';

export function coverageTargets(data: EngineData, kind: CoverageKind = usesMeta(data) ? 'meta' : 'types'): CoverageTarget[] {
  const meta = kind === 'meta' && usesMeta(data);
  const key = `${data.formatId ?? 'ou'}|${meta}|${!!data.stats}`;
  let targets = targetsCache.get(key);
  if (targets) return targets;
  if (meta) {
    const byTypes = new Map<string, { set: TeamSet; usage: number }>();
    for (const name of topThreats(data.stats, TARGET_SCAN, [])) {
      const set = mostCommonSet(data.stats, name);
      const species = set && battleSpecies(set);
      if (!set || !species) continue;
      const label = [...species.types].sort().join('/');
      const entry = byTypes.get(label);
      // Il primo trovato è il più usato con quei tipi: rappresenta la combinazione
      if (entry) entry.usage += usageOf(data.stats, name);
      else byTypes.set(label, { set, usage: usageOf(data.stats, name) });
    }
    const total = [...byTypes.values()].reduce((a, e) => a + e.usage, 0);
    targets = [...byTypes].map(([label, e]) => ({ label, set: e.set, weight: total ? e.usage / total : 0 }));
  } else {
    targets = TYPES.map(type => ({ label: type, set: typeDummy(type, data), weight: 1 / TYPES.length }));
  }
  targetsCache.set(key, targets);
  return targets;
}

export interface TeamCoverage {
  /** 0–100: quota pesata dei bersagli coperti, con la profondità 70/20/10 nei tipi e nel meta. */
  value: number;
  /** Bersagli che nessuno porta al 33%. */
  holes: string[];
  /** Quota pesata (0–100) dei bersagli che ogni membro manda KO in due colpi (nell'ordine del team). */
  perMember: number[];
  /** Per ogni bersaglio: tipi, il Pokémon che lo rappresenta, il peso, quanto è coperto e chi lo copre (con quale mossa). */
  rows: CoverageRow[];
}

export interface CoverageRow {
  label: string;
  species: string;
  weight: number;
  /** Quanto è coperto: 0, 70, 90 o 100% (1°, 2° e 3° membro che lo manda KO in due colpi). */
  level: number;
  /** `partial`: superefficace ma solo da 3HKO (fra il 33% e il 50%): copre a metà (mai nel meta). */
  coveredBy: { species: string; move: string; pct: number; partial: boolean }[];
  /** Il set del bersaglio (nel meta: il set più usato della minaccia), per la carta del Pokémon. */
  set: TeamSet;
  /**
   * Solo nel meta, una casella per membro nell'ordine del team: danno % del colpo semplice (senza Tera, Z e setup;
   * -1 se il motore non conosce il membro) e dopo una danza (null senza mossa di potenziamento). Null nei tipi.
   * `mult`: il moltiplicatore di tipo migliore fra le mosse d'attacco del membro sul bersaglio (null senza mosse o se sconosciuto).
   * `move`: la mossa del colpo semplice migliore (null se nessuna lo colpisce o se sconosciuto).
   */
  cells: { pct: number; setupPct: number | null; mult: number | null; move: string | null }[] | null;
}

/** Colpo migliore del set contro ogni bersaglio: danno (in quota dei PS, al massimo 1) e mossa; per contenuto del set. */
interface CoverHit { x: number; move: string; plain: number; setup: number | null }
const hitsCache = new Map<string, CoverHit[]>();
const HITS_LIMIT = 5000;
function hitsOf(set: TeamSet, data: EngineData, targets: CoverageTarget[], kind: CoverageKind): CoverHit[] {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${kind}|${!!data.stats}`;
  let hits = hitsCache.get(key);
  if (hits) return hits;
  if (hitsCache.size >= HITS_LIMIT) hitsCache.clear();
  // Nei tipi copre chi ha il vantaggio di tipo (solo i colpi super efficaci); nel meta conta il colpo migliore di qualunque tipo.
  // Come nel resto dell'Offesa: il meteo che il membro porta con la sua abilità è sempre attivo, Tera e mosse Z contano un quarto
  const conditions = ownConditions(set);
  const teraOk = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType;
  const zOk = hasZMove(set);
  const superEffectiveOnly = kind !== 'meta';
  // La danza si mostra solo nella tabella del meta: non entra nel credito
  const setup = kind === 'meta' ? setupBoosts(set) : null;
  hits = targets.map(target => {
    const base = bestHit(set, target.set, { superEffectiveOnly, conditions });
    const once = [teraOk && bestHit(set, target.set, { superEffectiveOnly, conditions, tera: true }), zOk && bestHit(set, target.set, { superEffectiveOnly, conditions, z: true })]
      .filter((hit): hit is NonNullable<typeof base> => !!hit);
    const x = Math.min(1, base?.expected ?? 0);
    const boosted = Math.max(x, ...once.map(hit => Math.min(1, hit.expected)));
    // Tera e mossa Z una volta a partita: un quarto di quello che aggiungono
    const danced = setup ? Math.max(x, Math.min(1, bestHit(set, target.set, { superEffectiveOnly, conditions, boosts: setup.boosts })?.expected ?? 0)) : null;
    return { x: x + ONE_USE_COVER * (boosted - x), move: base?.move ?? once[0]?.move ?? '', plain: x, setup: danced };
  });
  hitsCache.set(key, hits);
  return hits;
}

/** Quanto copre un colpo: pieno da 2HKO; a metà da 3HKO solo nei tipi (nel meta un 3HKO neutro lo fa quasi chiunque). */
const creditOf = (x: number, kind: CoverageKind) => (x >= COVER_HIT ? 1 : kind === 'types' && x >= HOLE_HIT ? 0.5 : 0);
/** Profondità: i crediti dei membri dal più alto, al 70, 20 e 10%. */
/** Meteo e terreni che il set porta con la sua abilità: per lui sono sempre attivi. */
export function ownConditions(set: TeamSet): FieldCondition[] {
  const ability = toID(battleAbility(set));
  return enables(set).filter(l => toID(l.via) === ability && l.condition !== 'trickroom').map(l => l.condition as FieldCondition);
}

const depthOf = (credits: number[], kind: CoverageKind) => [...credits].sort((a, b) => b - a).reduce((acc, c, i) => acc + (depthWeights(kind)[i] ?? 0) * c, 0);

/** Coverage del team: chi manda KO in due colpi ogni bersaglio, con la profondità; i buchi per nome. */
export function teamCoverage(team: TeamSet[], data: EngineData, asked: CoverageKind = usesMeta(data) ? 'meta' : 'types'): TeamCoverage {
  // Senza meta la Coverage "meta" è quella di tipi (bersagli, regola e memoria dei calcoli): una sola misura per tipo
  const kind: CoverageKind = asked === 'meta' && usesMeta(data) ? 'meta' : 'types';
  const targets = coverageTargets(data, kind);
  const hits = team.map(set => hitsOf(set, data, targets, kind));
  let value = 0;
  const holes: string[] = [];
  // Nel meta è un buco chi nessuno manda KO in due colpi; nei tipi chi nessuno porta al 33% super efficace
  const holeBelow = kind === 'meta' ? COVER_HIT : HOLE_HIT;
  targets.forEach((target, i) => {
    value += target.weight * depthOf(hits.map(h => creditOf(h[i].x, kind)), kind);
    if (Math.max(0, ...hits.map(h => h[i].x)) < holeBelow) holes.push(target.label);
  });
  const known = team.map(set => !!battleSpecies(set));
  const pctOf = (x: number) => Math.floor(100 * Math.min(1, x));
  return {
    // Lineare: ogni bersaglio coperto tre volte vale 100
    value: softScore(value),
    holes,
    perMember: hits.map(h => Math.round(100 * targets.reduce((acc, target, i) => acc + creditOf(h[i].x, kind) * target.weight, 0))),
    rows: targets.map((target, i) => {
      const coveredBy = team.flatMap((set, m) => (creditOf(hits[m][i].x, kind) > 0
        ? [{ species: battleSpecies(set)?.name ?? set.species, move: hits[m][i].move, pct: Math.floor(100 * hits[m][i].x), partial: hits[m][i].x < COVER_HIT }]
        : []));
      const targetTypes = target.set.types ?? battleSpecies(target.set)?.types ?? [];
      const targetAbility = battleAbility(target.set);
      const cells = kind === 'meta'
        ? hits.map((h, m) => (known[m]
          ? { pct: pctOf(h[i].plain), setupPct: h[i].setup === null ? null : pctOf(h[i].setup), mult: bestAttackMultiplier(team[m], targetTypes, targetAbility), move: h[i].move || null }
          : { pct: -1, setupPct: null, mult: null, move: null }))
        : null;
      return { label: target.label, species: target.set.species, set: target.set, weight: target.weight, level: Math.round(100 * depthOf(hits.map(h => creditOf(h[i].x, kind)), kind)), coveredBy, cells };
    }),
  };
}
