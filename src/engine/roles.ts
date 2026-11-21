import { battleAbility, battleSpecies, effectiveStats, getMove, hasPriorityAttack, isDefined, toID } from './dex';
import type { TeamSet } from './sets';
import { isOneType, type FormatRules } from './formatRules';
import { rolesListFor, setSubRoles, type Family, type SubRole } from './subRoles';
import { memoBySet } from './memo';
import { memberPower } from './power';
import { t, type Lang } from '../i18n';

/** I ruoli del motore sono i 17 sotto-ruoli (vedi subRoles.ts). */
export type Role = SubRole;

/**
 * Ruoli "legacy" (gli 11 di prima): restano solo per riconoscere gli archetipi (passivi, stall, adatti a un archetipo)
 * e i difensori del formato, che non devono cambiare. Non vanno mostrati né usati per il voto.
 */
export type LegacyRole =
  | 'hazards' | 'removal' | 'pivot' | 'priority' | 'speed'
  | 'setup' | 'wallbreaker' | 'physicalSweeper' | 'specialSweeper' | 'physicalWall' | 'specialWall';

const LEGACY_ORDER: LegacyRole[] = [
  'hazards', 'removal', 'pivot', 'priority', 'speed', 'setup', 'wallbreaker',
  'physicalSweeper', 'specialSweeper', 'physicalWall', 'specialWall',
];

/**
 * Un ruolo come lo si mostra: i sotto-ruoli, più "Attaccante" e "Muro", le due voci uniche del doppio (lì sweeper,
 * wallbreaker, fisico e speciale non si distinguono, come nel voto).
 */
export type ShownRole = SubRole | 'anyAttacker' | 'anyWall';
const isGrouped = (role: ShownRole | 'setup' | 'priority'): role is 'anyAttacker' | 'anyWall' => role === 'anyAttacker' || role === 'anyWall';
const SHOWN_ATTACK: SubRole[] = ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker', 'physicalAttacker', 'specialAttacker'];
const SHOWN_WALL: SubRole[] = ['physicalWall', 'specialWall'];

/**
 * I ruoli da mostrare: nel singolo la lista com'è; in doppio tutti i sotto-ruoli d'attacco diventano un solo
 * "Attaccante" e i due muri un solo "Muro", al posto del primo trovato. Gli altri restano dove sono.
 */
export function shownRoles(roles: readonly SubRole[], rules: FormatRules): ShownRole[] {
  if (!isOneType(rules)) return [...roles];
  const out: ShownRole[] = [];
  for (const role of roles) {
    const shown: ShownRole = SHOWN_ATTACK.includes(role) ? 'anyAttacker' : SHOWN_WALL.includes(role) ? 'anyWall' : role;
    if (!out.includes(shown)) out.push(shown);
  }
  return out;
}

/** Nome del ruolo nella lingua data (anche il setup, che compare sulle carte ma non è un ruolo del voto). */
export const roleLabel = (role: ShownRole | 'setup' | 'priority', lang: Lang = 'it'): string => (isGrouped(role) ? t(lang, `need.${role}`) : t(lang, `role.${role}`));

/** Il ruolo spiegato in una frase semplice, per i tooltip (Sweeper Fisico: "Veloce o potenziato, travolge…"). */
export const roleDescription = (role: ShownRole | 'setup' | 'priority', lang: Lang = 'it'): string => t(lang, `roleDesc.${role}`);

/** Nome breve del ruolo, per le carte del team (il nome completo va nel tooltip). */
export const roleShortLabel = (role: ShownRole | 'setup', lang: Lang = 'it'): string => (isGrouped(role) ? t(lang, `need.${role}`) : t(lang, `roleShort.${role}`));

/** Nome della famiglia (Attacco, Difesa, Campo, Disturbo). */
export const familyLabel = (family: Family, lang: Lang = 'it'): string => t(lang, `family.${family}`);

const WALLS: LegacyRole[] = ['physicalWall', 'specialWall'];

const RECOVERY_MOVES = new Set([
  'recover', 'roost', 'softboiled', 'slackoff', 'wish', 'rest', 'moonlight', 'synthesis', 'morningsun',
  'strengthsap', 'shoreup', 'milkdrink', 'leechseed', 'painsplit',
]);
const RECOVERY_ABILITIES = new Set(['poisonheal', 'regenerator']);
const SWEEPERS: LegacyRole[] = ['physicalSweeper', 'specialSweeper'];

/** Sweeper veloce con mossa di setup (Volcarona con Quiver Dance, Garchomp con Swords Dance): vince attaccando. */
const isFastSetupSweeper = (set: TeamSet, roles: LegacyRole[]) =>
  roles.includes('setup') && roles.some(r => SWEEPERS.includes(r)) && (battleSpecies(set)?.baseStats.spe ?? 0) >= 100;

/** Setup offensivo su statistiche da wallbreaker (Necrozma-Dusk-Mane con Dragon Dance, Groudon-Primal con Swords Dance): attacca, non fa da muro. */
const isSetupBreaker = (roles: LegacyRole[]) => roles.includes('setup') && roles.includes('wallbreaker');

/**
 * Membro "passivo" da stall: al massimo 2 mosse d'attacco, non uno sweeper veloce con setup né un wallbreaker con setup,
 * e un muro o con un recupero affidabile.
 * Si guarda il set, non solo le statistiche: un leggendario con quattro attacchi non è un muro da stall,
 * mentre Mega Sableye o Quagsire lo sono anche senza statistiche da muro.
 * Usa i ruoli legacy: gli archetipi non cambiano coi sotto-ruoli.
 */
export function isPassive(set: TeamSet, rules: FormatRules): boolean {
  const roles = legacyRoles(set, rules);
  const attacks = set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length;
  if (attacks > 2 || isFastSetupSweeper(set, roles) || isSetupBreaker(roles)) return false;
  const heals = set.moves.some(m => RECOVERY_MOVES.has(toID(m))) || RECOVERY_ABILITIES.has(toID(battleAbility(set)));
  if (heals || roles.some(r => WALLS.includes(r))) return true;
  // Muro senza recupero: attacca pochissimo e incassa molto (Lanturn con Scald, Toxic, Volt Switch: Offesa 12, Robustezza 76)
  const power = memberPower(set);
  return !!power && power.offense < PASSIVE_LOW_OFFENSE && power.bulk >= PASSIVE_MIN_BULK;
}
/** Percentili (statistiche base) sotto e sopra cui un membro senza recupero né statistiche da muro conta comunque come passivo. */
const PASSIVE_LOW_OFFENSE = 35;
const PASSIVE_MIN_BULK = 60;

/** Membri passivi di uno stall: tutti e 6. Con una o due minacce offensive il team è un semi-stall. */
export const STALL_PASSIVE = 6;

/** Stall: tutti e 6 i membri passivi. */
export function isStall(team: TeamSet[], rules: FormatRules): boolean {
  return team.filter(set => isPassive(set, rules)).length >= STALL_PASSIVE;
}

export const HAZARD_MOVES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge']);
/** Mosse che tolgono gli hazard (anche la Difesa le usa: con una di queste nel team la Stealth Rock pesa metà). */
export const REMOVAL_MOVES = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
export const PIVOT_MOVES = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);
/** Mosse che controllano la velocità: paralisi, Sticky Web, Trick Room, Tailwind e mosse che rallentano. */
const SPEED_MOVES = new Set(['thunderwave', 'glare', 'nuzzle', 'stunspore', 'stickyweb', 'trickroom', 'tailwind', 'icywind', 'electroweb']);
/** Abilità che raddoppiano la velocità (col meteo o il campo giusto, o da sé). */
export const SPEED_ABILITIES = new Set(['swiftswim', 'chlorophyll', 'sandrush', 'slushrush', 'surgesurfer', 'unburden', 'speedboost']);
const BREAKER_ITEMS = new Set(['choiceband', 'choicespecs', 'lifeorb']);

/** Sotto-ruoli del set (valore almeno 0,5): nel singolo nell'ordine delle famiglie, in doppio la lista del doppio (rolesListFor). */
export const detectRoles = memoBySet((set: TeamSet, rules: FormatRules): Role[] => rolesListFor(setSubRoles(set, rules), rules));

/** Il muro legacy (statistiche di base): lo usano i difensori del formato, da cui dipendono i numeri dell'Offesa. */
export const legacyWall = (set: TeamSet, rules: FormatRules): boolean => legacyRoles(set, rules).some(r => WALLS.includes(r));

/** Ruoli legacy del set (solo per archetipi e difensori, vedi LegacyRole). */
export const legacyRoles = memoBySet((set: TeamSet, rules: FormatRules): LegacyRole[] => {
  const species = battleSpecies(set);
  if (!species) return [];
  const ids = set.moves.map(toID);
  const moves = set.moves.map(getMove).filter(isDefined);
  const stats = effectiveStats(set);
  const item = toID(set.item);
  const roles = new Set<LegacyRole>();

  if (ids.some(id => HAZARD_MOVES.has(id))) roles.add('hazards');
  if (ids.some(id => REMOVAL_MOVES.has(id))) roles.add('removal');
  if (ids.some(id => PIVOT_MOVES.has(id))) roles.add('pivot');
  if (hasPriorityAttack(set)) roles.add('priority');
  // Controllo velocità solo con mosse che la controllano: essere veloci è un'altra cosa (vedi isFast)
  if (ids.some(id => SPEED_MOVES.has(id))) roles.add('speed');
  // Setup: mosse che alzano attacco, attacco speciale o velocità; anche la Difesa con Body Press, che colpisce con la Difesa
  const bodyPress = ids.includes('bodypress');
  if (moves.some(m => m.category === 'Status' && m.target === 'self'
    && ((m.boosts?.atk ?? 0) > 0 || (m.boosts?.spa ?? 0) > 0 || (m.boosts?.spe ?? 0) > 0 || (bodyPress && (m.boosts?.def ?? 0) > 0)))) roles.add('setup');
  const offense = Math.max(stats.atk, stats.spa);
  if (offense >= 120 || (offense >= 100 && BREAKER_ITEMS.has(item))) roles.add('wallbreaker');
  // Sweeper: attacca forte e può davvero muoversi per primo: velocità alta, Scarf o abilità di velocità,
  // un setup che alza la velocità, oppure un setup qualunque con una mossa a priorità (Kingambit, Raging Bolt).
  // Un Pokémon lento con un setup che alza solo l'attacco (Magearna con Calm Mind) è un wallbreaker, non uno sweeper.
  const fast = stats.spe >= 100 || item === 'choicescarf' || SPEED_ABILITIES.has(toID(battleAbility(set)));
  const selfBoost = (stat: 'atk' | 'spa' | 'spe') => moves.some(m => m.category === 'Status' && m.target === 'self' && (m.boosts?.[stat] ?? 0) > 0);
  const priority = hasPriorityAttack(set);
  const outspeeds = (stat: 'atk' | 'spa') => fast || selfBoost('spe') || (selfBoost(stat) && priority);
  const style = attackStyle(set);
  if (style === 'physical' && stats.atk >= 100 && outspeeds('atk')) roles.add('physicalSweeper');
  if (style === 'special' && stats.spa >= 100 && outspeeds('spa')) roles.add('specialSweeper');
  // Muro: difese alte; con un set offensivo, in Ubers, servono difese alte anche per il formato (Zacian-Crowned no)
  const defensiveSet = moves.filter(m => m.category !== 'Status').length <= 2 && !roles.has('setup');
  const walls = (stat: 'def' | 'spd') => stats[stat] >= 100 && stats.hp + stats[stat] >= 190
    && (defensiveSet || stats.hp * stats[stat] >= rules.offensiveWallBulk);
  if (walls('def')) roles.add('physicalWall');
  if (walls('spd')) roles.add('specialWall');

  return LEGACY_ORDER.filter(role => roles.has(role));
});

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

/** Mossa d'attacco con priorità (filtro di ricerca, non un ruolo). */
export function hasPriority(set: TeamSet): boolean {
  return hasPriorityAttack(set);
}

/** Mossa che controlla la velocità: paralisi, Sticky Web, Trick Room, Tailwind, mosse che rallentano (filtro, non un ruolo). */
export function hasSpeedControl(set: TeamSet): boolean {
  return set.moves.some(m => SPEED_MOVES.has(toID(m)));
}

/** Setup: una mossa di stato che alza attacco, attacco speciale o velocità (la Difesa con Body Press). Filtro ed etichetta, non un ruolo. */
export function hasSetup(set: TeamSet): boolean {
  const moves = set.moves.map(getMove).filter(isDefined);
  const bodyPress = moves.some(m => m.id === 'bodypress');
  return moves.some(m => m.category === 'Status' && m.target === 'self'
    && ((m.boosts?.atk ?? 0) > 0 || (m.boosts?.spa ?? 0) > 0 || (m.boosts?.spe ?? 0) > 0 || (bodyPress && (m.boosts?.def ?? 0) > 0)));
}
