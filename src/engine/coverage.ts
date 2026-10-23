import { usesMeta } from './analysis';
import { bestHit, setKey, type FieldCondition, type Target } from './damage';
import type { EngineData } from './data';
import { battleAbility, battleSpecies, dex, getMove, toID } from './dex';
import { DEFAULT_FORMAT } from './format';
import { teraAllowed } from './formats';
import { enables } from './synergy';
import { mostCommonSet, type TeamSet } from './sets';
import { topThreats, usageOf } from './stats';
import { softScore } from './scale';
import { TYPES } from './types';

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

export interface CoverageTarget {
  /** Combinazione di tipi ("Water/Ground") o, senza meta, il tipo. */
  label: string;
  set: Target;
  /** Peso nella Coverage (somma 1). */
  weight: number;
}

/** Bersaglio neutro senza meta: statistiche 100 (Mew), 252 PS e il resto diviso fra le difese, nessuno strumento, solo il tipo. */
function neutralTarget(type: string): Target {
  return { species: 'Mew', item: '', ability: 'Synchronize', moves: [], nature: 'Hardy', evs: { hp: 252, def: 128, spd: 128 }, types: [type] };
}

const targetsCache = new Map<string, CoverageTarget[]>();

/**
 * Cosa deve colpire il team. Col meta: le combinazioni di tipi dei più usati, pesate per uso, ognuna col suo Pokémon
 * più usato e il suo set più comune (difese, abilità e strumento veri). Senza meta: i 18 tipi, stesso peso, bersaglio neutro.
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
    targets = TYPES.map(type => ({ label: type, set: neutralTarget(type), weight: 1 / TYPES.length }));
  }
  targetsCache.set(key, targets);
  return targets;
}

export interface TeamCoverage {
  /** 0–100: quota pesata dei bersagli coperti, con la profondità 70/20/10. */
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
  /** `partial`: superefficace ma solo da 3HKO (fra il 33% e il 50%): copre a metà. */
  coveredBy: { species: string; move: string; pct: number; partial: boolean }[];
}

/** Colpo migliore del set contro ogni bersaglio: danno (in quota dei PS, al massimo 1) e mossa; per contenuto del set. */
const hitsCache = new Map<string, { x: number; move: string }[]>();
const HITS_LIMIT = 5000;
function hitsOf(set: TeamSet, data: EngineData, targets: CoverageTarget[], kind: CoverageKind): { x: number; move: string }[] {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${kind === 'meta' && usesMeta(data)}|${!!data.stats}`;
  let hits = hitsCache.get(key);
  if (hits) return hits;
  if (hitsCache.size >= HITS_LIMIT) hitsCache.clear();
  // Copre chi ha il vantaggio di tipo: il colpo migliore fra quelli super efficaci (il danno neutro lo misura la Potenza).
  // Come nel resto dell'Offesa: il meteo che il membro porta con la sua abilità è sempre attivo, Tera e mosse Z contano a metà
  const conditions = ownConditions(set);
  const teraOk = teraAllowed({ ...DEFAULT_FORMAT, formatId: data.formatId ?? 'ou' }) && !!set.teraType;
  const zType = dex.items.get(set.item).zMoveType;
  const zOk = !!zType && set.moves.some(m => getMove(m)?.type === zType);
  hits = targets.map(target => {
    const base = bestHit(set, target.set, { superEffectiveOnly: true, conditions });
    const once = [teraOk && bestHit(set, target.set, { superEffectiveOnly: true, conditions, tera: true }), zOk && bestHit(set, target.set, { superEffectiveOnly: true, conditions, z: true })]
      .filter((hit): hit is NonNullable<typeof base> => !!hit);
    const x = Math.min(1, base?.expected ?? 0);
    const boosted = Math.max(x, ...once.map(hit => Math.min(1, hit.expected)));
    // Tera e mossa Z una volta a partita: un quarto di quello che aggiungono
    return { x: x + ONE_USE_COVER * (boosted - x), move: base?.move ?? once[0]?.move ?? '' };
  });
  hitsCache.set(key, hits);
  return hits;
}

/** Quanto copre un colpo superefficace: pieno da 2HKO, a metà da 3HKO, niente sotto. */
const creditOf = (x: number) => (x >= COVER_HIT ? 1 : x >= HOLE_HIT ? 0.5 : 0);
/** Profondità: i crediti dei membri dal più alto, al 70, 20 e 10%. */
/** Meteo e terreni che il set porta con la sua abilità: per lui sono sempre attivi. */
function ownConditions(set: TeamSet): FieldCondition[] {
  const ability = toID(battleAbility(set));
  return enables(set).filter(l => toID(l.via) === ability && l.condition !== 'trickroom').map(l => l.condition as FieldCondition);
}

const depthOf = (credits: number[]) => [...credits].sort((a, b) => b - a).reduce((acc, c, i) => acc + (COVERAGE_DEPTH[i] ?? 0) * c, 0);

/** Coverage del team: chi manda KO in due colpi ogni bersaglio, con la profondità; i buchi per nome. */
export function teamCoverage(team: TeamSet[], data: EngineData, kind: CoverageKind = usesMeta(data) ? 'meta' : 'types'): TeamCoverage {
  const targets = coverageTargets(data, kind);
  const hits = team.map(set => hitsOf(set, data, targets, kind));
  let value = 0;
  const holes: string[] = [];
  targets.forEach((target, i) => {
    value += target.weight * depthOf(hits.map(h => creditOf(h[i].x)));
    if (Math.max(0, ...hits.map(h => h[i].x)) < HOLE_HIT) holes.push(target.label);
  });
  return {
    // Lineare fino a 80, poi sempre più piano: anche ogni bersaglio coperto tre volte resta sotto 100
    value: softScore(value),
    holes,
    perMember: hits.map(h => Math.round(100 * targets.reduce((acc, target, i) => acc + creditOf(h[i].x) * target.weight, 0))),
    rows: targets.map((target, i) => {
      const coveredBy = team.flatMap((set, m) => (creditOf(hits[m][i].x) > 0
        ? [{ species: battleSpecies(set)?.name ?? set.species, move: hits[m][i].move, pct: Math.floor(100 * hits[m][i].x), partial: hits[m][i].x < COVER_HIT }]
        : []));
      return { label: target.label, species: target.set.species, weight: target.weight, level: Math.round(100 * depthOf(hits.map(h => creditOf(h[i].x)))), coveredBy };
    }),
  };
}
