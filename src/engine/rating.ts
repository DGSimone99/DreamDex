import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, toID } from './dex';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES } from './roles';
import { strengthComponent } from './scoring';
import type { TeamSet } from './sets';
import { usageOf } from './stats';
import { TYPES } from './types';

export type AreaKey = 'defense' | 'coverage' | 'threats' | 'roles' | 'strength';

/** Pesi delle aree nel voto complessivo. Somma = 1. */
export const AREA_WEIGHTS: Record<AreaKey, number> = {
  defense: 0.275,
  coverage: 0.2,
  threats: 0.2,
  roles: 0.175,
  strength: 0.15,
};

const AREA_LABELS: Record<AreaKey, string> = {
  defense: 'Difesa',
  coverage: 'Coverage',
  threats: 'Minacce',
  roles: 'Ruoli',
  strength: 'Forza',
};


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

export interface Redundancy {
  text: string;
  points: number;
}

export interface Redundancies {
  total: number;
  items: Redundancy[];
}

export interface TeamRating {
  /** Voto pesato delle aree, prima della penalità. */
  base: number;
  penalty: Redundancies;
  overall: number;
  grade: string;
  label: string;
  provisional: boolean;
  areas: RatingArea[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Penalità massima per ridondanze: da sole non possono affossare un team. */
export const MAX_PENALTY = 15;

const HAZARDS: Record<string, string> = {
  stealthrock: 'Stealth Rock', stoneaxe: 'Stealth Rock',
  spikes: 'Spikes', ceaselessedge: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web',
};
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);

/** Ruoli e tipi ripetuti senza bisogno: stesso hazard, più rimozioni, 3+ membri dello stesso tipo. */
export function roleAndTypeRedundancies(team: TeamSet[]): Redundancy[] {
  const items: Redundancy[] = [];
  const setters = new Map<string, number>();
  for (const set of team) {
    for (const hazard of new Set(set.moves.map(m => HAZARDS[toID(m)]).filter(Boolean))) {
      setters.set(hazard, (setters.get(hazard) ?? 0) + 1);
    }
  }
  for (const [hazard, n] of setters) if (n > 1) items.push({ text: `${n} setter di ${hazard}`, points: 2 * (n - 1) });
  const removers = team.filter(set => set.moves.some(m => REMOVAL.has(toID(m)))).length;
  if (removers > 1) items.push({ text: `${removers} rimozioni hazard`, points: removers - 1 });
  for (const type of TYPES) {
    const n = team.filter(set => (battleSpecies(set)?.types as readonly string[] | undefined)?.includes(type)).length;
    if (n >= 3) items.push({ text: `${n} membri di tipo ${type}`, points: n - 2 });
  }
  return items;
}

export function redundancies(team: TeamSet[], analysis: TeamAnalysis): Redundancies {
  const common = 1 / TYPES.length;
  const weaknesses = analysis.weakness
    .filter(row => row.weak - row.resist >= 2)
    .map(row => ({
      text: `${row.weak} membri deboli a ${row.type}, ${row.resist === 0 ? 'nessuno resiste' : `${row.resist} resistono`}`,
      points: (row.weak - row.resist - 1) * (analysis.typeWeights[row.type] >= common ? 2 : 1),
    }));
  const items = [...weaknesses, ...roleAndTypeRedundancies(team)];
  return { total: Math.min(MAX_PENALTY, sum(items.map(i => i.points))), items };
}
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

  const raw: Record<AreaKey, number | null> = { defense, coverage, threats, roles, strength };
  const areas = (Object.keys(AREA_WEIGHTS) as AreaKey[]).map(key => ({
    key,
    label: AREA_LABELS[key],
    value: raw[key] === null ? null : Math.round(100 * raw[key]!),
  }));
  const available = (Object.keys(AREA_WEIGHTS) as AreaKey[]).filter(key => raw[key] !== null);
  const base = Math.round(
    100 * sum(available.map(key => AREA_WEIGHTS[key] * raw[key]!)) / sum(available.map(key => AREA_WEIGHTS[key])),
  );
  const penalty = redundancies(team, analysis);
  const overall = Math.max(0, base - penalty.total);
  return { base, penalty, overall, ...gradeFor(overall), provisional: team.length < 6, areas };
}

