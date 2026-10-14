import { analyzeTeam } from './analysis';
import type { EngineData } from './data';
import { battleName } from './dex';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES } from './roles';
import { strengthComponent } from './scoring';
import type { TeamSet } from './sets';
import { teammatePct, usageOf } from './stats';
import { TYPES } from './types';

export type AreaKey = 'defense' | 'coverage' | 'threats' | 'roles' | 'strength' | 'synergy';

/** Pesi delle aree nel voto complessivo. Somma = 1. */
export const AREA_WEIGHTS: Record<AreaKey, number> = {
  defense: 0.25,
  coverage: 0.15,
  threats: 0.15,
  roles: 0.15,
  strength: 0.2,
  synergy: 0.1,
};

const AREA_LABELS: Record<AreaKey, string> = {
  defense: 'Difesa',
  coverage: 'Coverage',
  threats: 'Minacce',
  roles: 'Ruoli',
  strength: 'Forza',
  synergy: 'Sinergia',
};

/** Frequenza media di coppia (Smogon) oltre la quale la sinergia vale 100. */
export const SYNERGY_FULL = 0.25;

/**
 * Soglie tarate sui dati reali (2026-09, 1630+): team ben costruiti 86–87,
 * team casuali di Pokémon del meta mediana 77, team con membri inutili sotto 60.
 */
const GRADES: { min: number; grade: string; label: string }[] = [
  { min: 88, grade: 'S', label: 'Eccellente' },
  { min: 80, grade: 'A', label: 'Ottimo' },
  { min: 70, grade: 'B', label: 'Buono' },
  { min: 55, grade: 'C', label: 'Discreto' },
  { min: 0, grade: 'D', label: 'Debole' },
];

export interface RatingArea {
  key: AreaKey;
  label: string;
  /** 0–100, o null se mancano i dati per calcolarla. */
  value: number | null;
}

export interface TeamRating {
  overall: number;
  grade: string;
  label: string;
  provisional: boolean;
  areas: RatingArea[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

/**
 * Quanto il team è al sicuro da un tipo: 1 se qualcuno resiste e i deboli non superano chi resiste,
 * 0.5 se nessuno è debole né resiste, 0.25 con un debole scoperto, 0 con due o più.
 */
export function typeSafety(weak: number, resist: number): number {
  if (weak > resist) return weak - resist === 1 ? 0.25 : 0;
  return resist > 0 ? 1 : 0.5;
}

export function gradeFor(score: number): { grade: string; label: string } {
  const { grade, label } = GRADES.find(g => score >= g.min)!;
  return { grade, label };
}

function synergyOf(team: TeamSet[], data: EngineData): number | null {
  if (!data.stats || team.length < 2) return null;
  const names = team.map(battleName);
  const pairs: number[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      pairs.push((teammatePct(data.stats, names[i], names[j]) + teammatePct(data.stats, names[j], names[i])) / 2);
    }
  }
  return Math.min(1, mean(pairs) / SYNERGY_FULL);
}

export function rateTeam(team: TeamSet[], data: EngineData): TeamRating | null {
  if (team.length === 0) return null;
  const analysis = analyzeTeam(team, data);
  const weights = analysis.typeWeights;

  const defense = sum(analysis.weakness.map(row => weights[row.type] * typeSafety(row.weak, row.resist)));
  const coverage = sum(analysis.coverage.filter(row => row.hitters.length > 0).map(row => weights[row.type]));
  const threatTotal = sum(analysis.threats.map(t => t.usage));
  const threats = data.stats && threatTotal > 0
    ? sum(analysis.threats.filter(t => t.handledBy.length > 0).map(t => t.usage)) / threatTotal
    : null;
  const present = new Set(team.flatMap(detectRoles));
  const roles = (ESSENTIAL_ROLES.filter(r => present.has(r)).length + 0.5 * DESIRABLE_ROLES.filter(r => present.has(r)).length)
    / (ESSENTIAL_ROLES.length + 0.5 * DESIRABLE_ROLES.length);
  const strength = data.stats ? mean(team.map(set => strengthComponent(usageOf(data.stats, battleName(set))))) : null;
  const synergy = synergyOf(team, data);

  const raw: Record<AreaKey, number | null> = { defense, coverage, threats, roles, strength, synergy };
  const areas = (Object.keys(AREA_WEIGHTS) as AreaKey[]).map(key => ({
    key,
    label: AREA_LABELS[key],
    value: raw[key] === null ? null : Math.round(100 * raw[key]!),
  }));
  const available = (Object.keys(AREA_WEIGHTS) as AreaKey[]).filter(key => raw[key] !== null);
  const overall = Math.round(
    100 * sum(available.map(key => AREA_WEIGHTS[key] * raw[key]!)) / sum(available.map(key => AREA_WEIGHTS[key])),
  );
  return { overall, ...gradeFor(overall), provisional: team.length < 6, areas };
}

