import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleSpecies, toID } from './dex';
import { teamPower, type MemberPower } from './power';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES } from './roles';
import type { TeamSet } from './sets';
import { TYPES } from './types';
import { CONDITION_LABELS, unmetBeneficiaries, unusedEnablers, weatherMitigations } from './synergy';

export type AreaKey = 'defense' | 'coverage' | 'roles' | 'strength';

/** Pesi delle aree nel voto complessivo. Somma = 1. */
export const AREA_WEIGHTS: Record<AreaKey, number> = {
  defense: 0.325,
  coverage: 0.25,
  roles: 0.225,
  strength: 0.2,
};

const AREA_LABELS: Record<AreaKey, string> = {
  defense: 'Difesa',
  coverage: 'Coverage',
  roles: 'Ruoli',
  strength: 'Forza',
};


/**
 * Soglie tarate sui dati reali (2026-09, 1630+): team ben costruiti 88–90,
 * team casuali di Pokémon del meta mediana 74, team con membri inutili sotto 60.
 */
const GRADES: { min: number; grade: string; label: string }[] = [
  { min: 90, grade: 'S', label: 'Eccellente' },
  { min: 82, grade: 'A', label: 'Ottimo' },
  { min: 70, grade: 'B', label: 'Buono' },
  { min: 60, grade: 'C', label: 'Discreto' },
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
  bonus: Redundancies;
  /** Forza dei singoli membri dalle statistiche base. */
  power: MemberPower[];
  overall: number;
  grade: string;
  label: string;
  provisional: boolean;
  areas: RatingArea[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Penalità massima per ridondanze: da sole non possono affossare un team. */
export const MAX_PENALTY = 15;
/** Bonus massimo per debolezze smorzate dal meteo: il meteo non è sempre attivo. */
export const MAX_BONUS = 6;

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
  const dependencies = [
    ...unmetBeneficiaries(team).map(i => ({ text: `${i.member} ha ${i.via} ma il team non porta ${CONDITION_LABELS[i.condition]}`, points: 3 })),
    ...unusedEnablers(team).map(i => i.selfBoost
      ? { text: `${i.via} di ${i.member} potenzia solo le sue mosse`, points: 1 }
      : { text: `${i.via} di ${i.member} non sfruttato`, points: 2 }),
  ];
  const items = [...weaknesses, ...roleAndTypeRedundancies(team), ...dependencies];
  return { total: Math.min(MAX_PENALTY, sum(items.map(i => i.points))), items };
}

/**
 * Quanto il team è al sicuro da un tipo: 1 se qualcuno resiste e i deboli non superano chi resiste,
 * 0.5 se nessuno è debole né resiste, 0.25 con un debole scoperto, 0 con due o più.
 */
export function typeSafety(weak: number, resist: number): number {
  if (weak > resist) return weak - resist === 1 ? 0.25 : 0;
  return resist > 0 ? 1 : 0.5;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** +2 per ogni membro che il meteo/campo del team riporta da debole a neutro, fino a MAX_BONUS. */
export function weatherBonus(team: TeamSet[]): Redundancies {
  const items = weatherMitigations(team)
    .map(m => ({ m, neutral: m.members.filter(x => x.to <= 1) }))
    .filter(x => x.neutral.length > 0)
    .map(({ m, neutral }) => ({
      text: `${capitalize(CONDITION_LABELS[m.condition])} di ${m.source.split(' (')[0]} smorza ${m.type}: ${neutral.map(x => x.species).join(', ')}`,
      points: 2 * neutral.length,
    }));
  return { total: Math.min(MAX_BONUS, sum(items.map(i => i.points))), items };
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
  const present = new Set(team.flatMap(detectRoles));
  const roles = (ESSENTIAL_ROLES.filter(r => present.has(r)).length + 0.5 * DESIRABLE_ROLES.filter(r => present.has(r)).length)
    / (ESSENTIAL_ROLES.length + 0.5 * DESIRABLE_ROLES.length);
  const power = teamPower(team);
  const strength = power.value === null ? null : power.value / 100;

  const raw: Record<AreaKey, number | null> = { defense, coverage, roles, strength };
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
  const bonus = weatherBonus(team);
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  return { base, penalty, bonus, power: power.members, overall, ...gradeFor(overall), provisional: team.length < 6, areas };
}

