import { analyzeTeam, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleSpecies, toID } from './dex';
import { teamPower, type MemberPower } from './power';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES, isPassive, isStall, STALL_ROLES } from './roles';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { TYPES } from './types';
import { conditionConflicts, conditionLabel, viaName, unmetBeneficiaries, unusedEnablers, weakenedMoves, weatherMitigations } from './synergy';

export type AreaKey = 'defense' | 'coverage' | 'roles' | 'strength';

/** Pesi delle aree nel voto complessivo. Somma = 1. */
export const AREA_WEIGHTS: Record<AreaKey, number> = {
  defense: 0.325,
  coverage: 0.25,
  roles: 0.225,
  strength: 0.2,
};

/** Pesi per uno stall: la copertura conta la metà (attacca poco per scelta), il resto va alla difesa. */
export const STALL_AREA_WEIGHTS: Record<AreaKey, number> = {
  defense: AREA_WEIGHTS.defense + AREA_WEIGHTS.coverage / 2,
  coverage: AREA_WEIGHTS.coverage / 2,
  roles: AREA_WEIGHTS.roles,
  strength: AREA_WEIGHTS.strength,
};



/**
 * Soglie tarate sui dati reali (2026-09, 1630+): team ben costruiti 88–90,
 * team casuali di Pokémon del meta mediana 74, team con membri inutili sotto 60.
 */
const GRADES: { min: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' }[] = [
  { min: 90, grade: 'S' },
  { min: 82, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 0, grade: 'D' },
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
  /** Archetipo riconosciuto che cambia il calcolo dei ruoli (per ora solo lo stall). */
  archetype: 'stall' | null;
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
export function roleAndTypeRedundancies(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const items: Redundancy[] = [];
  const setters = new Map<string, number>();
  for (const set of team) {
    for (const hazard of new Set(set.moves.map(m => HAZARDS[toID(m)]).filter(Boolean))) {
      setters.set(hazard, (setters.get(hazard) ?? 0) + 1);
    }
  }
  for (const [hazard, n] of setters) if (n > 1) items.push({ text: t(lang, 'rating.redundancy.setters', { n, hazard: gameName('move', hazard, lang) }), points: 2 * (n - 1) });
  const removers = team.filter(set => set.moves.some(m => REMOVAL.has(toID(m)))).length;
  if (removers > 1) items.push({ text: t(lang, 'rating.redundancy.removers', { n: removers }), points: removers - 1 });
  for (const type of TYPES) {
    const n = team.filter(set => (battleSpecies(set)?.types as readonly string[] | undefined)?.includes(type)).length;
    if (n >= 3) items.push({ text: t(lang, 'rating.redundancy.sameType', { n, type: typeName(type, lang) }), points: n - 2 });
  }
  return items;
}

/** Meteo/campi in conflitto (−3) e mosse indebolite dal meteo del team (−2 STAB, −1 coverage). */
export function weatherClashes(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return [
    ...conditionConflicts(team, lang).map(c => ({ text: t(lang, 'rating.redundancy.conflict', { kind: t(lang, `conflict.${c.kind}`), list: c.setters.join(', ') }), points: 3 })),
    ...weakenedMoves(team).map(w => ({
      text: t(lang, 'rating.redundancy.weakens', { condition: cap(conditionLabel(w.condition, lang)), setter: w.setter, type: typeName(w.type, lang), member: w.member }),
      points: w.stab ? 2 : 1,
    })),
  ];
}

export function redundancies(team: TeamSet[], analysis: TeamAnalysis, lang: Lang = 'it'): Redundancies {
  const common = 1 / TYPES.length;
  const weaknesses = analysis.weakness
    .filter(row => row.weak - row.resist >= 2)
    .map(row => ({
      text: t(lang, 'rating.redundancy.sharedWeak', {
        n: row.weak, type: typeName(row.type, lang),
        resistText: row.resist === 0 ? t(lang, 'rating.redundancy.noneResist') : t(lang, 'rating.redundancy.someResist', { n: row.resist }),
      }),
      points: (row.weak - row.resist - 1) * (analysis.typeWeights[row.type] >= common ? 2 : 1),
    }));
  const dependencies = [
    ...unmetBeneficiaries(team).map(i => ({ text: t(lang, 'rating.redundancy.unmet', { member: i.member, via: viaName(i.via, lang), condition: conditionLabel(i.condition, lang) }), points: 3 })),
    ...unusedEnablers(team).map(i => ({ text: t(lang, 'rating.redundancy.unused', { via: viaName(i.via, lang), member: i.member }), points: 2 })),
  ];
  const items = [...weaknesses, ...roleAndTypeRedundancies(team, lang), ...dependencies, ...weatherClashes(team, lang)];
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
export function weatherBonus(team: TeamSet[], lang: Lang = 'it'): Redundancies {
  const items = weatherMitigations(team)
    .map(m => ({ m, neutral: m.members.filter(x => x.to <= 1) }))
    .filter(x => x.neutral.length > 0)
    .map(({ m, neutral }) => ({
      text: t(lang, 'rating.bonus.mitigates', {
        condition: capitalize(conditionLabel(m.condition, lang)), setter: m.source.split(' (')[0],
        type: typeName(m.type, lang), member: neutral.map(x => x.species).join(', '),
      }),
      points: 2 * neutral.length,
    }));
  return { total: Math.min(MAX_BONUS, sum(items.map(i => i.points))), items };
}

export function gradeFor(score: number, lang: Lang = 'it'): { grade: string; label: string } {
  const { grade } = GRADES.find(g => score >= g.min)!;
  return { grade, label: t(lang, `grade.${grade}`) };
}

export function rateTeam(team: TeamSet[], data: EngineData, lang: Lang = 'it'): TeamRating | null {
  if (team.length === 0) return null;
  const analysis = analyzeTeam(team, data);
  const weights = analysis.typeWeights;

  const defense = sum(analysis.weakness.map(row => weights[row.type] * typeSafety(row.weak, row.resist)));
  const coverage = sum(analysis.coverage.filter(row => row.hitters.length > 0).map(row => weights[row.type]));
  const memberRoles = team.map(detectRoles);
  const present = new Set(memberRoles.flat());
  const usual = (ESSENTIAL_ROLES.filter(r => present.has(r)).length + 0.5 * DESIRABLE_ROLES.filter(r => present.has(r)).length)
    / (ESSENTIAL_ROLES.length + 0.5 * DESIRABLE_ROLES.length);
  // Stall riconosciuto "senza esagerare": a metà tra la valutazione normale e quella da stall
  const archetype = isStall(team, memberRoles) ? 'stall' as const : null;
  const roles = archetype ? (usual + STALL_ROLES.filter(r => present.has(r)).length / STALL_ROLES.length) / 2 : usual;
  // Nello stall un muro passivo non deve fare danni: conta la sua robustezza
  const power = teamPower(team, archetype ? team.map((set, i) => isPassive(set, memberRoles[i])) : []);
  const weightsFor = archetype ? STALL_AREA_WEIGHTS : AREA_WEIGHTS;
  const strength = power.value === null ? null : power.value / 100;

  const raw: Record<AreaKey, number | null> = { defense, coverage, roles, strength };
  const areas = (Object.keys(AREA_WEIGHTS) as AreaKey[]).map(key => ({
    key,
    label: t(lang, `area.${key}`),
    value: raw[key] === null ? null : Math.round(100 * raw[key]!),
  }));
  const available = (Object.keys(AREA_WEIGHTS) as AreaKey[]).filter(key => raw[key] !== null);
  const base = Math.round(
    100 * sum(available.map(key => weightsFor[key] * raw[key]!)) / sum(available.map(key => weightsFor[key])),
  );
  const penalty = redundancies(team, analysis, lang);
  const bonus = weatherBonus(team, lang);
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  return { base, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: team.length < 6, areas, archetype };
}

