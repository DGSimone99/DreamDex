import { usesMeta } from './analysis';
import { bestHit, setKey, type Target } from './damage';
import type { EngineData } from './data';
import { battleSpecies } from './dex';
import { mostCommonSet, type TeamSet } from './sets';
import { topThreats, usageOf } from './stats';
import { TYPES } from './types';

/** Quanti Pokémon del meta, dal più usato, danno le combinazioni di tipi da coprire. */
const TARGET_SCAN = 40;
/** Un membro copre un bersaglio se lo manda KO in due colpi. */
export const COVER_HIT = 0.5;
/** Sotto questo danno nessuno lo scalfisce davvero: è un buco (non arriva al KO in tre colpi). */
export const HOLE_HIT = 1 / 3;
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
export function coverageTargets(data: EngineData): CoverageTarget[] {
  const key = `${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let targets = targetsCache.get(key);
  if (targets) return targets;
  if (usesMeta(data)) {
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
}

/** Danno (in quota dei PS, al massimo 1) del colpo migliore del set contro ogni bersaglio; per contenuto del set. */
const hitsCache = new Map<string, number[]>();
const HITS_LIMIT = 5000;
function hitsOf(set: TeamSet, data: EngineData, targets: CoverageTarget[]): number[] {
  const key = `${setKey(set)}|${data.formatId ?? 'ou'}|${usesMeta(data)}|${!!data.stats}`;
  let hits = hitsCache.get(key);
  if (hits) return hits;
  if (hitsCache.size >= HITS_LIMIT) hitsCache.clear();
  hits = targets.map(target => Math.min(1, bestHit(set, target.set)?.expected ?? 0));
  hitsCache.set(key, hits);
  return hits;
}

/** Coverage del team: chi manda KO in due colpi ogni bersaglio, con la profondità; i buchi per nome. */
export function teamCoverage(team: TeamSet[], data: EngineData): TeamCoverage {
  const targets = coverageTargets(data);
  const hits = team.map(set => hitsOf(set, data, targets));
  let value = 0;
  const holes: string[] = [];
  targets.forEach((target, i) => {
    const covering = hits.filter(h => h[i] >= COVER_HIT).length;
    value += target.weight * COVERAGE_DEPTH.slice(0, covering).reduce((a, b) => a + b, 0);
    if (Math.max(0, ...hits.map(h => h[i])) < HOLE_HIT) holes.push(target.label);
  });
  return {
    value: Math.round(100 * value),
    holes,
    perMember: hits.map(h => Math.round(100 * targets.reduce((acc, target, i) => acc + (h[i] >= COVER_HIT ? target.weight : 0), 0))),
  };
}
