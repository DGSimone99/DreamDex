import type { AreaKey, DetailArea } from './AreaDetail';

/** Le schede di Analisi: la Panoramica, il Coaching o un'area del voto (Bonus/Malus compreso). */
export type TabView = 'overview' | 'coaching' | AreaKey;

/**
 * Cosa apre Analisi: una scheda, o i Ruoli, che non hanno più una scheda loro: 'roles' apre Bonus/Malus sulla
 * sottoscheda Ruoli (lo usano i link del voto, della Panoramica e del Coaching, e uno stato salvato prima del cambio).
 */
export type AnalysisView = TabView | DetailArea;

/** Dove porta una vista: la scheda e, per i Ruoli, la sottoscheda. */
export const resolveView = (view: AnalysisView): { tab: TabView; sub?: string } =>
  (view === 'roles' ? { tab: 'bonusMalus', sub: 'roles' } : { tab: view });
