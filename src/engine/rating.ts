import { analyzeTeam, threatScore, usesMeta, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, toID } from './dex';
import { hitQuality, memberPower, teamPower, type MemberPower } from './power';
import { attackStyle, detectRoles, isPassive, isStall, teamRoles } from './roles';
import { rulesOf, type FormatRules } from './formatRules';
import { needCoverage } from './needs';
import { strengthComponent } from './scoring';
import { usageOf } from './stats';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { effectiveness, superEffectiveMoves, TYPES } from './types';
import { conditionConflicts, conditionLabel, enables, viaName, unmetBeneficiaries, unusedEnablers, weakenedMoves, weatherMitigations } from './synergy';

export type AreaKey = 'defense' | 'coverage' | 'roles' | 'strength' | 'meta';
/** Le aree del voto senza meta. */
type BaseArea = Exclude<AreaKey, 'meta'>;
const BASE_AREAS: BaseArea[] = ['defense', 'coverage', 'roles', 'strength'];

/** Pesi delle aree nel voto senza meta. Somma = 1. */
export const AREA_WEIGHTS: Record<BaseArea, number> = {
  defense: 0.284375,
  coverage: 0.21875,
  roles: 0.196875,
  strength: 0.3,
};

/** Pesi per uno stall: la copertura conta la metà (attacca poco per scelta), il resto va alla difesa. */
export const STALL_AREA_WEIGHTS: Record<BaseArea, number> = {
  defense: AREA_WEIGHTS.defense + AREA_WEIGHTS.coverage / 2,
  coverage: AREA_WEIGHTS.coverage / 2,
  roles: AREA_WEIGHTS.roles,
  strength: AREA_WEIGHTS.strength,
};



/** Peso dell'area Meta nel voto col meta; il resto è il voto senza meta. */
export const META_WEIGHT = 0.2;
/** Nell'area Meta: quota delle minacce gestite (il resto è l'uso dei membri nel formato). */
export const META_THREATS = 2 / 3;
/** Punteggio meta che vale l'area piena: i team Smogon stanno intorno a questo valore. */
export const META_FULL = 0.78;

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

/** L'area Meta scomposta: minacce gestite e uso dei membri nel formato (0–100). */
export interface MetaScore {
  threats: number;
  usage: number;
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
  /** Dettaglio dell'area Meta, o null se il voto è senza meta. */
  meta: MetaScore | null;
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

/** Forza sotto cui un membro senza utilità chiave è considerato debole. */
export const WEAK_POWER = 30;
/** Ruoli che danno al team un'utilità chiave anche a un Pokémon debole (Delibird con Spikes). */
const UTILITY_ROLES = ['hazards', 'removal', 'speed'] as const;

/** Il membro porta un'utilità chiave: hazard, rimozione, controllo velocità, meteo, campo o Trick Room. */
function bringsUtility(set: TeamSet, rules: FormatRules): boolean {
  const roles = detectRoles(set, rules);
  return UTILITY_ROLES.some(role => roles.includes(role)) || enables(set).length > 0;
}
/** Attaccanti minimi perché un team tutto fisico o tutto speciale sia una scelta e non un caso. */
const ONE_STYLE_ATTACKERS = 4;

/**
 * Membri deboli senza utilità chiave (−3, −7, −12…; non dipende dal meta: Pelipper che porta la pioggia è esente)
 * e team senza attaccanti fisici o speciali (−3; mai per uno stall, che attacca poco per scelta).
 */
export function memberIssues(team: TeamSet[], lang: Lang, rules: FormatRules): Redundancy[] {
  const items: Redundancy[] = [];
  const roles = team.map(set => detectRoles(set, rules));
  // La penalità cresce col numero di membri deboli: −3, −7, −12… (il k-esimo pesa 2 + k)
  let weak = 0;
  for (const [i, set] of team.entries()) {
    const power = memberPower(set);
    // Un muro passivo si giudica dalla sua robustezza (Mega Sableye), gli altri dalla forza complessiva
    if (power && (isPassive(set, roles[i]) ? power.bulk : power.power) < WEAK_POWER && !bringsUtility(set, rules)) {
      weak += 1;
      items.push({ text: t(lang, 'rating.redundancy.weakMember', { member: battleName(set) }), points: 2 + weak });
    }
  }
  if (!isStall(team, roles)) {
    const styles = team.map(attackStyle);
    const physical = styles.filter(s => s === 'physical' || s === 'mixed').length;
    const special = styles.filter(s => s === 'special' || s === 'mixed').length;
    if (physical + special >= ONE_STYLE_ATTACKERS && (physical === 0 || special === 0)) {
      const missing = physical === 0 ? 'physical' : 'special';
      items.push({ text: t(lang, 'rating.redundancy.oneStyle', { style: t(lang, `analysis.style.${missing}`) }), points: 3 });
    }
  }
  return items;
}

/** Regole del formato: in Ubers e UU un team completo senza hazard perde punti. */
export function formatIssues(team: TeamSet[], rules: FormatRules, lang: Lang = 'it'): Redundancy[] {
  const hazards = team.some(set => detectRoles(set, rules).includes('hazards'));
  return rules.noHazardsPenalty > 0 && team.length === 6 && !hazards
    ? [{ text: t(lang, 'rating.redundancy.noHazards'), points: rules.noHazardsPenalty }]
    : [];
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
  const items = [
    ...weaknesses, ...roleAndTypeRedundancies(team, lang), ...dependencies, ...weatherClashes(team, lang),
    ...memberIssues(team, lang, analysis.needs.rules), ...formatIssues(team, analysis.needs.rules, lang),
  ];
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

/**
 * Tera come via d'uscita (Gen 9): +1 per ogni tipo a cui il team è debole (più deboli che resistenti)
 * e che il Tera dichiarato di un membro fa resistere, fino al limite del formato. Non cambia la difesa del team:
 * il Tera si usa una volta sola per partita.
 */
export function teraBonus(team: TeamSet[], analysis: TeamAnalysis, cap: number, lang: Lang = 'it'): Redundancy[] {
  if (cap <= 0) return [];
  const items: Redundancy[] = [];
  for (const row of analysis.weakness.filter(r => r.weak > r.resist)) {
    const member = team.find(set => (TYPES as readonly string[]).includes(set.teraType ?? '')
      && effectiveness(row.type, [set.teraType!]) < 1);
    if (!member) continue;
    items.push({ text: t(lang, 'rating.bonus.tera', { tera: typeName(member.teraType!, lang), member: battleName(member), type: typeName(row.type, lang) }), points: 1 });
    if (items.length === cap) break;
  }
  return items;
}

export function gradeFor(score: number, lang: Lang = 'it'): { grade: string; label: string } {
  const { grade } = GRADES.find(g => score >= g.min)!;
  return { grade, label: t(lang, `grade.${grade}`) };
}

export function rateTeam(team: TeamSet[], data: EngineData, lang: Lang = 'it'): TeamRating | null {
  if (team.length === 0) return null;
  const analysis = analyzeTeam(team, data);
  const weights = analysis.typeWeights;

  const rules = rulesOf(data);
  const memberRoles = team.map(set => teamRoles(set, rules));
  // Stall riconosciuto "senza esagerare": a metà tra la valutazione normale e quella da stall
  const archetype = isStall(team, memberRoles) ? 'stall' as const : null;
  // Nello stall un muro passivo non deve fare danni: conta la sua robustezza, e i suoi colpi valgono pieni
  const passive = archetype ? team.map((set, i) => isPassive(set, memberRoles[i])) : [];

  const defense = sum(analysis.weakness.map(row => weights[row.type] * typeSafety(row.weak, row.resist)));
  // Ogni tipo vale secondo il colpo migliore che lo prende: un Close Combat di Alakazam non vale uno di Great Tusk
  const quality = (set: TeamSet, i: number, move: string) => (passive[i] ? 1 : hitQuality(set, move));
  const coverage = sum(TYPES.map(type => weights[type]
    * Math.max(0, ...team.flatMap((set, i) => superEffectiveMoves(set, type).map(move => quality(set, i, move))))));
  // Ruoli richiesti in base all'archetipo del team (uno stall non ha bisogno di sweeper, un hyper offense di wall)
  const roles = needCoverage(analysis.needs);
  const power = teamPower(team, passive, rules);
  const weightsFor = archetype ? STALL_AREA_WEIGHTS : AREA_WEIGHTS;
  const strength = power.value === null ? null : power.value / 100;

  const raw: Record<AreaKey, number | null> = { defense, coverage, roles, strength, meta: null };
  const available = BASE_AREAS.filter(key => raw[key] !== null);
  let score = sum(available.map(key => weightsFor[key] * raw[key]!)) / sum(available.map(key => weightsFor[key]));
  // Col meta: minacce gestite e uso dei membri contano per un quinto, il resto è il voto senza meta
  let meta: MetaScore | null = null;
  if (usesMeta(data)) {
    const threats = (threatScore(analysis) ?? 50) / 100;
    const usage = sum(team.map(set => strengthComponent(usageOf(data.stats, battleName(set))))) / team.length;
    meta = { threats: Math.round(100 * threats), usage: Math.round(100 * usage) };
    raw.meta = Math.min(1, (META_THREATS * threats + (1 - META_THREATS) * usage) / META_FULL);
    score = (1 - META_WEIGHT) * score + META_WEIGHT * raw.meta;
  }
  const areas = (Object.keys(raw) as AreaKey[])
    .filter(key => key !== 'meta' || meta)
    .map(key => ({
      key,
      label: t(lang, `area.${key}`),
      value: raw[key] === null ? null : Math.round(100 * raw[key]!),
    }));
  const base = Math.round(100 * score);
  const penalty = redundancies(team, analysis, lang);
  const weather = weatherBonus(team, lang);
  const tera = teraBonus(team, analysis, rules.teraBonusCap, lang);
  const bonus = { total: Math.min(MAX_BONUS, weather.total + sum(tera.map(i => i.points))), items: [...weather.items, ...tera] };
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  return { base, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: team.length < 6, areas, archetype, meta };
}

