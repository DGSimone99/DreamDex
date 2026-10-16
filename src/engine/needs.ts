import { teamArchetype, type Archetype } from './archetype';
import { attackStyle, roleLabel, teamRoles, type Role } from './roles';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';

/** Ciò di cui un team ha bisogno; "offense" è una minaccia offensiva qualunque (sweeper o wallbreaker). */
export type Need = 'hazards' | 'removal' | 'pivot' | 'speed' | 'offense' | 'priority' | 'physicalWall' | 'specialWall';
export const NEEDS: Need[] = ['hazards', 'removal', 'pivot', 'speed', 'offense', 'priority', 'physicalWall', 'specialWall'];

/** Ruoli che soddisfano un bisogno. */
export const NEED_ROLES: Record<Need, Role[]> = {
  hazards: ['hazards'], removal: ['removal'], pivot: ['pivot'], speed: ['speed'],
  offense: ['physicalSweeper', 'specialSweeper', 'wallbreaker'], priority: ['priority'],
  physicalWall: ['physicalWall'], specialWall: ['specialWall'],
};

/**
 * Peso dei bisogni per archetipo: 1 essenziale, 0,5 utile, 0 non richiesto.
 * Uno stall non ha bisogno di minacce offensive né di velocità; un hyper offense non ha bisogno di wall.
 */
export const NEEDS_BY_ARCHETYPE: Record<Archetype, Record<Need, number>> = {
  hyperOffense: { hazards: 1, removal: 0.5, pivot: 0.5, speed: 1, offense: 1, priority: 0.5, physicalWall: 0, specialWall: 0 },
  bulkyOffense: { hazards: 1, removal: 1, pivot: 1, speed: 1, offense: 1, priority: 0.5, physicalWall: 0.5, specialWall: 0.5 },
  balance: { hazards: 1, removal: 1, pivot: 1, speed: 0.5, offense: 1, priority: 0.5, physicalWall: 1, specialWall: 1 },
  semiStall: { hazards: 1, removal: 1, pivot: 0.5, speed: 0.5, offense: 1, priority: 0, physicalWall: 1, specialWall: 1 },
  stall: { hazards: 1, removal: 1, pivot: 0.5, speed: 0, offense: 0, priority: 0, physicalWall: 1, specialWall: 1 },
};

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
  /** I ruoli che coprirebbero i bisogni mancanti (per il punteggio dei candidati). */
  missingRoles: Role[];
  /** Tipo di attaccante che manca del tutto (team con almeno 4 attaccanti tutti dello stesso tipo, non stall). */
  needStyle: 'physical' | 'special' | null;
}

export const needCovered = (need: Need, present: Set<Role>): boolean => NEED_ROLES[need].some(role => present.has(role));

/** Archetipo con cui giudicare i ruoli del team. */
export function needsArchetype(team: TeamSet[]): Archetype {
  return teamArchetype(team)?.archetype ?? 'balance';
}

export function teamNeeds(team: TeamSet[]): TeamNeeds {
  const archetype = needsArchetype(team);
  const weights = NEEDS_BY_ARCHETYPE[archetype];
  const present = new Set(team.flatMap(teamRoles));
  const required = NEEDS.filter(need => weights[need] > 0);
  const missing = required.filter(need => !needCovered(need, present)).map(need => ({ need, weight: weights[need] }));
  const styles = team.map(attackStyle);
  const physical = styles.filter(s => s === 'physical' || s === 'mixed').length;
  const special = styles.filter(s => s === 'special' || s === 'mixed').length;
  const lopsided = archetype !== 'stall' && physical + special >= ONE_STYLE_ATTACKERS && (physical === 0 || special === 0);
  return {
    archetype, weights,
    covered: required.filter(need => needCovered(need, present)),
    missing,
    missingRoles: missing.flatMap(m => NEED_ROLES[m.need]),
    needStyle: lopsided ? (physical === 0 ? 'physical' : 'special') : null,
  };
}

/** Quota (0–1) dei bisogni coperti, pesata come nella tabella dell'archetipo. */
export function needCoverage(needs: TeamNeeds): number {
  const total = NEEDS.reduce((acc, need) => acc + needs.weights[need], 0);
  const missing = needs.missing.reduce((acc, m) => acc + m.weight, 0);
  return total > 0 ? (total - missing) / total : 1;
}

/** Nome del bisogno: i ruoli col loro nome, più "Minaccia offensiva" e "Velocità" (controllo o membri veloci). */
export function needLabel(need: Need, lang: Lang = 'it'): string {
  if (need === 'offense') return t(lang, 'need.offense');
  if (need === 'speed') return t(lang, 'need.speed');
  return roleLabel(need, lang);
}
