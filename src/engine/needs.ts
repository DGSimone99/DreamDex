import { teamArchetype, type Archetype } from './archetype';
import { attackStyle, detectRoles, hasPriority, hasSpeedControl, isFast, roleLabel, type Role } from './roles';
import type { FormatRules } from './formatRules';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';

/**
 * Ciò di cui un team ha bisogno; "offense" è una minaccia offensiva qualunque (sweeper o wallbreaker),
 * "speed" la velocità (membri veloci o controllo velocità), "speedControl" solo le mosse che la controllano.
 */
export type Need = 'hazards' | 'removal' | 'pivot' | 'speed' | 'speedControl' | 'offense' | 'priority' | 'physicalWall' | 'specialWall';
export const NEEDS: Need[] = ['hazards', 'removal', 'pivot', 'speed', 'speedControl', 'offense', 'priority', 'physicalWall', 'specialWall'];

/**
 * Sotto-ruoli che soddisfano un bisogno. Priorità, velocità e controllo velocità non sono più ruoli:
 * si guardano le mosse e la velocità del membro (vedi meetsNeed). Provvisorio: i bisogni si riscrivono col nuovo voto dei Ruoli.
 */
export const NEED_ROLES: Record<Need, Role[]> = {
  hazards: ['hazards'], removal: ['removal'], pivot: ['pivot'], speed: [], speedControl: [],
  offense: ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker'], priority: [],
  physicalWall: ['physicalWall'], specialWall: ['specialWall'],
};

/** Pesi dei bisogni: essenziale, utile, non richiesto. */
export const ESSENTIAL = 1;
export const USEFUL = 0.4;
/** Un ruolo non richiesto dal tipo di team conta poco nel voto: averlo aggiunge, non averlo toglie appena. */
export const NOT_REQUIRED = 0.15;
const E = ESSENTIAL, U = USEFUL;

/**
 * Peso dei bisogni per archetipo. Uno stall non ha bisogno di minacce offensive né di velocità;
 * un hyper offense non ha bisogno di wall. Il controllo velocità è sempre utile, mai essenziale.
 */
export const NEEDS_BY_ARCHETYPE: Record<Archetype, Record<Need, number>> = {
  hyperOffense: { hazards: E, removal: U, pivot: U, speed: E, speedControl: U, offense: E, priority: U, physicalWall: 0, specialWall: 0 },
  bulkyOffense: { hazards: E, removal: E, pivot: E, speed: E, speedControl: U, offense: E, priority: U, physicalWall: U, specialWall: U },
  balance: { hazards: E, removal: E, pivot: E, speed: U, speedControl: U, offense: E, priority: U, physicalWall: E, specialWall: E },
  semiStall: { hazards: E, removal: E, pivot: U, speed: U, speedControl: U, offense: E, priority: 0, physicalWall: E, specialWall: E },
  stall: { hazards: E, removal: E, pivot: U, speed: 0, speedControl: U, offense: 0, priority: 0, physicalWall: E, specialWall: E },
};

/** Il membro soddisfa il bisogno: il controllo velocità vuole le mosse, la velocità basta che sia veloce. */
export function meetsNeed(need: Need, set: TeamSet, rules: FormatRules): boolean {
  if (need === 'priority') return hasPriority(set);
  if (need === 'speedControl') return hasSpeedControl(set);
  if (need === 'speed') return hasSpeedControl(set) || isFast(set);
  const roles = detectRoles(set, rules);
  return NEED_ROLES[need].some(role => roles.includes(role));
}

/** Attaccanti minimi perché un team tutto fisico o tutto speciale sia una scelta e non un caso. */
const ONE_STYLE_ATTACKERS = 4;

export interface TeamNeeds {
  /** Archetipo con cui si giudicano i ruoli: quello del team completo, "balance" per un team incompleto. */
  archetype: Archetype;
  weights: Record<Need, number>;
  /** Bisogni richiesti (peso > 0) e coperti. */
  covered: Need[];
  /** Bisogni richiesti e non coperti, col loro peso. */
  missing: { need: Need; weight: number }[];
  /** Bisogni non richiesti dal tipo di team ma coperti lo stesso. */
  extras: Need[];
  /** I ruoli che coprirebbero i bisogni mancanti (per il punteggio dei candidati). */
  missingRoles: Role[];
  /** Tipo di attaccante che manca del tutto (team con almeno 4 attaccanti tutti dello stesso tipo, non stall). */
  needStyle: 'physical' | 'special' | null;
  /** Regole del formato con cui sono stati riconosciuti i ruoli (per giudicare allo stesso modo i candidati). */
  rules: FormatRules;
}


/** Archetipo con cui giudicare i ruoli del team. */
export function needsArchetype(team: TeamSet[], rules: FormatRules): Archetype {
  return teamArchetype(team, rules)?.archetype ?? 'balance';
}

export function teamNeeds(team: TeamSet[], rules: FormatRules): TeamNeeds {
  const archetype = needsArchetype(team, rules);
  const weights = NEEDS_BY_ARCHETYPE[archetype];
  const required = NEEDS.filter(need => weights[need] > 0);
  const covered = required.filter(need => team.some(set => meetsNeed(need, set, rules)));
  const missing = required.filter(need => !covered.includes(need)).map(need => ({ need, weight: weights[need] }));
  const styles = team.map(attackStyle);
  const physical = styles.filter(s => s === 'physical' || s === 'mixed').length;
  const special = styles.filter(s => s === 'special' || s === 'mixed').length;
  const lopsided = archetype !== 'stall' && physical + special >= ONE_STYLE_ATTACKERS && (physical === 0 || special === 0);
  return {
    archetype, weights,
    covered,
    missing,
    extras: NEEDS.filter(need => weights[need] === 0 && team.some(set => meetsNeed(need, set, rules))),
    missingRoles: missing.flatMap(m => NEED_ROLES[m.need]),
    needStyle: lopsided ? (physical === 0 ? 'physical' : 'special') : null,
    rules,
  };
}

/** Quota (0–1) dei bisogni coperti, pesata come nella tabella dell'archetipo. */
export function needCoverage(needs: TeamNeeds): number {
  // Anche i ruoli non richiesti contano, poco: il 100 vuol dire tutti i ruoli coperti
  const weightOf = (need: Need) => needs.weights[need] || NOT_REQUIRED;
  const total = NEEDS.reduce((acc, need) => acc + weightOf(need), 0);
  const got = [...needs.covered, ...needs.extras].reduce((acc, need) => acc + weightOf(need), 0);
  return total > 0 ? got / total : 1;
}

/** Nome del bisogno: i ruoli col loro nome, più "Minaccia offensiva" e "Velocità" (membri veloci o controllo velocità). */
export function needLabel(need: Need, lang: Lang = 'it'): string {
  if (need === 'offense') return t(lang, 'need.offense');
  if (need === 'speed') return t(lang, 'need.speed');
  if (need === 'speedControl') return t(lang, 'role.speedControl');
  if (need === 'priority') return t(lang, 'role.priority');
  return roleLabel(need, lang);
}
