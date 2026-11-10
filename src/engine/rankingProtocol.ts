import type { Archetype } from './archetype';
import type { RankingParams, RankingResult } from './candidateRanking';
import type { FormatId } from './format';
import type { Lang } from '../i18n';
import type { GainJob, TeamGain } from './teamGain';
import type { CoachAdvice, CoachProblem } from './coach';
import type { Format } from './format';
import type { TeamSet } from './sets';

/** I consigli del Coaching (coachAdvice) per un team: si calcolano in sottofondo come la lista dei candidati. */
export interface AdviceParams { team: TeamSet[]; format: Format; problems: CoachProblem[]; lang: Lang }

/** I dati del formato per il calcolo in sottofondo: ogni parte grande è un numero (0 = assente), il resto com'è. */
export interface WorkerData {
  stats: number; sets: number; fallback: number; presets: number; fallbackPresets: number; fallbackStats: number; userLists: number;
  ignoreMeta?: boolean; allowMultipleMegas?: boolean; formatId?: FormatId;
}

export type GainValue = TeamGain | 'excluded' | null;

/**
 * Le richieste a un calcolo in sottofondo. Una lista si fa in tre passi: `plan` (quali voti servono), `gains` (i voti,
 * divisi fra i calcoli in parallelo), `rank` (la lista coi voti già pronti). Con pochi voti basta `rank`.
 */
export type WorkerRequest =
  | { kind: 'parts'; parts: [number, unknown][]; drop: number[] }
  | { kind: 'names'; names: unknown }
  | { kind: 'plan'; id: number; params: RankingParams; data: WorkerData }
  | { kind: 'gains'; id: number; jobs: GainJob[]; lang: Lang; archetype?: Archetype; data: WorkerData }
  | { kind: 'rank'; id: number; params: RankingParams; data: WorkerData; primed: [string, GainValue][] }
  | { kind: 'advicePlan'; id: number; params: AdviceParams; data: WorkerData }
  | { kind: 'advice'; id: number; params: AdviceParams; data: WorkerData; primed: [string, GainValue][] };

export type WorkerResponse =
  | { id: number; ok: true; kind: 'plan'; jobs: GainJob[] }
  | { id: number; ok: true; kind: 'gains'; values: GainValue[] }
  | { id: number; ok: true; kind: 'rank'; result: RankingResult }
  | { id: number; ok: true; kind: 'advicePlan'; jobs: GainJob[] }
  | { id: number; ok: true; kind: 'advice'; advice: CoachAdvice }
  | { id: number; ok: false; error: string };
