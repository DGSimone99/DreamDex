import { battleAbility, battleSpecies, getMove, isDefined, toID } from './dex';
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

/** Nome breve del ruolo, per le carte del team (il nome completo va nel tooltip). */
export const roleShortLabel = (role: Role, lang: Lang = 'it'): string => t(lang, `roleShort.${role}`);

/** Ruoli essenziali: presenti in quasi tutti i team forti (campioni Smogon). */
export const ESSENTIAL_ROLES: Role[] = ['hazards', 'removal', 'pivot', 'speed'];
/** Ruoli utili: pesano la metà. La priorità manca in metà dei team forti: la sua assenza non è un difetto. */
export const DESIRABLE_ROLES: Role[] = ['wallbreaker', 'priority', 'physicalSweeper', 'specialSweeper', 'physicalWall', 'specialWall'];

/**
 * Come si contano i ruoli nel voto: ogni gruppo è soddisfatto da uno qualunque dei suoi ruoli.
 * Uno sweeper fisico o speciale basta (lo squilibrio fisico/speciale ha la sua penalità).
 */
export const ROLE_GROUPS: { roles: Role[]; weight: number }[] = [
  ...ESSENTIAL_ROLES.map(role => ({ roles: [role], weight: 1 })),
  { roles: ['wallbreaker'], weight: 0.5 },
  { roles: ['priority'], weight: 0.5 },
  { roles: ['physicalSweeper', 'specialSweeper'], weight: 0.5 },
  { roles: ['physicalWall'], weight: 0.5 },
  { roles: ['specialWall'], weight: 0.5 },
];

/** Quota (0–1) dei ruoli coperti dal team, pesata per gruppi. */
export function roleCoverage(present: Set<Role>): number {
  const total = ROLE_GROUPS.reduce((acc, g) => acc + g.weight, 0);
  const covered = ROLE_GROUPS.filter(g => g.roles.some(role => present.has(role))).reduce((acc, g) => acc + g.weight, 0);
  return covered / total;
}
/** Ruoli di cui uno stall ha bisogno: niente priorità, velocità o sweeper, per scelta. */
export const STALL_ROLES: Role[] = ['hazards', 'removal', 'physicalWall', 'specialWall'];
const WALLS: Role[] = ['physicalWall', 'specialWall'];

const RECOVERY_MOVES = new Set([
  'recover', 'roost', 'softboiled', 'slackoff', 'wish', 'rest', 'moonlight', 'synthesis', 'morningsun',
  'strengthsap', 'shoreup', 'milkdrink', 'leechseed', 'painsplit',
]);
const RECOVERY_ABILITIES = new Set(['poisonheal', 'regenerator']);
const SWEEPERS: Role[] = ['physicalSweeper', 'specialSweeper'];

/** Sweeper veloce con mossa di setup (Volcarona con Quiver Dance, Garchomp con Swords Dance): vince attaccando. */
const isFastSetupSweeper = (set: TeamSet, roles: Role[]) =>
  roles.includes('setup') && roles.some(r => SWEEPERS.includes(r)) && (battleSpecies(set)?.baseStats.spe ?? 0) >= 100;

/**
 * Membro "passivo" da stall: al massimo 2 mosse d'attacco, non uno sweeper veloce con setup, e un muro o con un recupero affidabile.
 * Si guarda il set, non solo le statistiche: un leggendario con quattro attacchi non è un muro da stall,
 * mentre Mega Sableye o Quagsire lo sono anche senza statistiche da muro.
 */
export function isPassive(set: TeamSet, roles: Role[] = detectRoles(set)): boolean {
  const attacks = set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length;
  if (attacks > 2 || isFastSetupSweeper(set, roles)) return false;
  const heals = set.moves.some(m => RECOVERY_MOVES.has(toID(m))) || RECOVERY_ABILITIES.has(toID(set.ability));
  return heals || roles.some(r => WALLS.includes(r));
}

/** Stall: almeno 5 membri passivi. */
export function isStall(team: TeamSet[], roles: Role[][] = team.map(detectRoles)): boolean {
  return team.filter((set, i) => isPassive(set, roles[i])).length >= 5;
}

const HAZARD_MOVES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge']);
const REMOVAL_MOVES = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);
/** Mosse che controllano la velocità: paralisi, Sticky Web, Trick Room, Tailwind e mosse che rallentano. */
const SPEED_MOVES = new Set(['thunderwave', 'glare', 'nuzzle', 'stunspore', 'stickyweb', 'trickroom', 'tailwind', 'icywind', 'electroweb']);
/** Abilità che raddoppiano la velocità (col meteo o il campo giusto, o da sé). */
const SPEED_ABILITIES = new Set(['swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'surgesurfer', 'unburden', 'speedboost']);
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
  // Controllo velocità solo con mosse che la controllano: essere veloci è un'altra cosa (vedi teamRoles)
  if (ids.some(id => SPEED_MOVES.has(id))) roles.add('speed');
  if (moves.some(m => m.category === 'Status' && m.target === 'self'
    && ((m.boosts?.atk ?? 0) > 0 || (m.boosts?.spa ?? 0) > 0 || (m.boosts?.spe ?? 0) > 0))) roles.add('setup');
  const offense = Math.max(stats.atk, stats.spa);
  if (offense >= 120 || (offense >= 100 && BREAKER_ITEMS.has(item))) roles.add('wallbreaker');
  // Sweeper: attacca forte e può davvero muoversi per primo: velocità alta, Scarf o abilità di velocità,
  // un setup che alza la velocità, oppure un setup qualunque con una mossa a priorità (Kingambit, Raging Bolt).
  // Un Pokémon lento con un setup che alza solo l'attacco (Magearna con Calm Mind) è un wallbreaker, non uno sweeper.
  const fast = stats.spe >= 100 || item === 'choicescarf' || SPEED_ABILITIES.has(toID(battleAbility(set)));
  const selfBoost = (stat: 'atk' | 'spa' | 'spe') => moves.some(m => m.category === 'Status' && m.target === 'self' && (m.boosts?.[stat] ?? 0) > 0);
  const priority = moves.some(m => m.category !== 'Status' && m.priority > 0);
  const outspeeds = (stat: 'atk' | 'spa') => fast || selfBoost('spe') || (selfBoost(stat) && priority);
  const style = attackStyle(set);
  if (style === 'physical' && stats.atk >= 100 && outspeeds('atk')) roles.add('physicalSweeper');
  if (style === 'special' && stats.spa >= 100 && outspeeds('spa')) roles.add('specialSweeper');
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

/** Il membro è veloce: velocità di base almeno 100, Choice Scarf o un'abilità che raddoppia la velocità. */
export function isFast(set: TeamSet): boolean {
  const species = battleSpecies(set);
  return !!species && (species.baseStats.spe >= 100 || toID(set.item) === 'choicescarf' || SPEED_ABILITIES.has(toID(battleAbility(set))));
}

/**
 * Ruoli con cui si giudica il team (voto, bisogni, candidati): quelli del set, più la velocità per un membro veloce.
 * In singolo un team con membri veloci ha già la sua velocità, anche senza mosse di controllo velocità.
 */
export function teamRoles(set: TeamSet): Role[] {
  const roles = detectRoles(set);
  return isFast(set) && !roles.includes('speed') ? ROLE_ORDER.filter(role => role === 'speed' || roles.includes(role)) : roles;
}

export interface TeamNeeds {
  missingRoles: Role[];
  needStyle: 'physical' | 'special' | null;
}

export function teamNeeds(team: TeamSet[]): TeamNeeds {
  const present = new Set(team.flatMap(teamRoles));
  // Mancano i ruoli dei gruppi non coperti: con uno sweeper fisico, lo speciale non manca
  const missingRoles = ROLE_GROUPS.filter(g => !g.roles.some(role => present.has(role))).flatMap(g => g.roles);
  const styles = team.map(attackStyle);
  const physical = styles.filter(s => s === 'physical').length;
  const special = styles.filter(s => s === 'special').length;
  const needStyle = physical - special >= 2 ? 'special' : special - physical >= 2 ? 'physical' : null;
  return { missingRoles, needStyle };
}
