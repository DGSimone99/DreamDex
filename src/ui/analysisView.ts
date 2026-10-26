import type { AreaKey } from './AreaDetail';

/** Cosa mostra la scheda Analisi: la Panoramica, il Coaching o un'area del voto (Bonus/Malus compreso). */
export type AnalysisView = 'overview' | 'coaching' | AreaKey;
