import { battleSpecies, getMove, isDefined, toID } from './dex';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';

export type Role =
  | 'hazards' | 'removal' | 'pivot' | 'priority' | 'speed'
  | 'setup' | 'wallbreaker' | 'physicalSweeper' | 'specialSweeper' | 'physicalWall' | 'specialWall';

export const ROLE_ORDER: Role[] = [
  'hazards', 'removal', 'pivot', 'priority', 'speed', 'setup', 'wallbreaker',
  'physicalSweeper', 'specialSweeper', 'physicalWall', 'specialWall',
];

/** Nome del ruolo nella lingua data. */
export const roleLabel = (role: Role, lang: Lang = 'it'): string => t(lang, `role.${role}`);

export const ESSENTIAL_ROLES: Role[] = ['hazards', 'removal', 'pivot', 'priority', 'speed'];
export const DESIRABLE_ROLES: Role[] = ['wallbreaker', 'physicalSweeper', 'specialSweeper', 'physicalWall', 'specialWall'];

const HAZARD_MOVES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge']);
const REMOVAL_MOVES = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);
const SPEED_MOVES = new Set(['trickroom', 'thunderwave', 'tailwind', 'stickyweb']);
const BREAKER_ITEMS = new Set(['choiceband', 'choicespecs', 'lifeorb']);

export function detectRoles(set: TeamSet): Role[] {
  const species = battleSpecies(set);
  if (!species) return [];
  const ids = set.moves.map(toID);
  const moves = set.moves.map(getMove).filter(isDefined);
  const stats = species.baseStats;
  const item = toID(set.item);
  const roles = new Set<Role>();

  if (ids.some(id => HAZARD_MOVES.has(id))) roles.add('hazards');
  if (ids.some(id => REMOVAL_MOVES.has(id))) roles.add('removal');
  if (ids.some(id => PIVOT_MOVES.has(id))) roles.add('pivot');
  if (moves.some(m => m.category !== 'Status' && m.priority > 0)) roles.add('priority');
  if (stats.spe >= 100 || item === 'choicescarf' || ids.some(id => SPEED_MOVES.has(id))) roles.add('speed');
  if (moves.some(m => m.category === 'Status' && m.target === 'self'
    && ((m.boosts?.atk ?? 0) > 0 || (m.boosts?.spa ?? 0) > 0 || (m.boosts?.spe ?? 0) > 0))) roles.add('setup');
  const offense = Math.max(stats.atk, stats.spa);
  if (offense >= 120 || (offense >= 100 && BREAKER_ITEMS.has(item))) roles.add('wallbreaker');
  // Sweeper: attacca forte e ha un modo di superare in velocità (velocità alta, Scarf o setup)
  const fast = stats.spe >= 100 || item === 'choicescarf';
  const boosts = (stat: 'atk' | 'spa') => moves.some(m => m.category === 'Status' && m.target === 'self'
    && ((m.boosts?.[stat] ?? 0) > 0 || (m.boosts?.spe ?? 0) > 0));
  const style = attackStyle(set);
  if (style === 'physical' && stats.atk >= 100 && (fast || boosts('atk'))) roles.add('physicalSweeper');
  if (style === 'special' && stats.spa >= 100 && (fast || boosts('spa'))) roles.add('specialSweeper');
  if (stats.def >= 100 && stats.hp + stats.def >= 190) roles.add('physicalWall');
  if (stats.spd >= 100 && stats.hp + stats.spd >= 190) roles.add('specialWall');

  return ROLE_ORDER.filter(role => roles.has(role));
}

export type AttackStyle = 'physical' | 'special' | 'mixed' | 'none';

export function attackStyle(set: TeamSet): AttackStyle {
  const moves = set.moves.map(getMove).filter(isDefined);
  const physical = moves.filter(m => m.category === 'Physical').length;
  const special = moves.filter(m => m.category === 'Special').length;
  if (physical === 0 && special === 0) return 'none';
  if (physical > special) return 'physical';
  if (special > physical) return 'special';
  return 'mixed';
}

export interface TeamNeeds {
  missingRoles: Role[];
  needStyle: 'physical' | 'special' | null;
}

export function teamNeeds(team: TeamSet[]): TeamNeeds {
  const present = new Set(team.flatMap(detectRoles));
  const missingRoles = [...ESSENTIAL_ROLES, ...DESIRABLE_ROLES].filter(role => !present.has(role));
  const styles = team.map(attackStyle);
  const physical = styles.filter(s => s === 'physical').length;
  const special = styles.filter(s => s === 'special').length;
  const needStyle = physical - special >= 2 ? 'special' : special - physical >= 2 ? 'physical' : null;
  return { missingRoles, needStyle };
}
