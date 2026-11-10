import type { RankingParams, RankingResult } from './candidateRanking';
import type { FormatId } from './format';

/** I dati del formato per il calcolo in sottofondo: ogni parte grande è un numero (0 = assente), il resto com'è. */
export interface WorkerData {
  stats: number; sets: number; fallback: number; presets: number; fallbackPresets: number; fallbackStats: number; userLists: number;
  ignoreMeta?: boolean; allowMultipleMegas?: boolean; formatId?: FormatId;
}

export type WorkerRequest =
  | { kind: 'parts'; parts: [number, unknown][]; drop: number[] }
  | { kind: 'names'; names: unknown }
  | { kind: 'rank'; id: number; params: RankingParams; data: WorkerData };

export type WorkerResponse =
  | { id: number; ok: true; result: RankingResult }
  | { id: number; ok: false; error: string };
