import { battleSpecies, getMove, toID } from './dex';
import { memberPower } from './power';
import { detectRoles, isFast, isPassive, isStall, type Role } from './roles';
import type { TeamSet } from './sets';
import { benefits, enables, type Condition } from './synergy';

/** Archetipi di Smogon, dal più offensivo al più difensivo. */
export type Archetype = 'hyperOffense' | 'bulkyOffense' | 'balance' | 'semiStall' | 'stall';
export type TeamStyle = 'rain' | 'sun' | 'sand' | 'snow' | 'trickroom' | 'webs' | 'voltturn' | 'screens';

export interface TeamArchetype {
  archetype: Archetype;
  /** Al massimo MAX_STYLES stili (meteo, Trick Room, Sticky Web, Volt-turn, Screens). */
  styles: TeamStyle[];
}

export const MAX_STYLES = 2;
/** Robustezza media (percentile) sotto cui un team offensivo non è "bulky". */
const BULKY = 55;
/** …e sotto cui un team senza muri passivi è Hyper Offense. */
const FRAIL = 65;
/** Membri veloci (o con un setup che alza la velocità) da cui un team senza muri passivi è Hyper Offense anche se robusto (Ubers). */
const HO_FAST_MEMBERS = 5;
/** Membri con un pivot offensivo perché il team sia Volt-turn. */
const VOLT_TURN_PIVOTS = 4;

const HEAL_MOVES = new Set([
  'recover', 'roost', 'softboiled', 'slackoff', 'wish', 'rest', 'moonlight', 'synthesis', 'morningsun',
  'strengthsap', 'shoreup', 'milkdrink',
]);
const HEAL_ABILITIES = new Set(['regenerator', 'poisonheal']);
const ATTACK_PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn']);
const CONDITION_STYLES: [Condition, TeamStyle][] = [['rain', 'rain'], ['sun', 'sun'], ['sand', 'sand'], ['snow', 'snow'], ['trickroom', 'trickroom']];

const heals = (set: TeamSet) => set.moves.some(m => HEAL_MOVES.has(toID(m))) || HEAL_ABILITIES.has(toID(set.ability));
const hasMove = (set: TeamSet, ids: Set<string>) => set.moves.some(m => ids.has(toID(m)));
/** Veloce di suo (statistica, Scarf, abilità) o con una mossa che gli alza la velocità (Dragon Dance, Quiver Dance…). */
const fastOrSpeedSetup = (set: TeamSet) => isFast(set)
  || set.moves.some(m => { const move = getMove(m); return move?.category === 'Status' && move.target === 'self' && (move.boosts?.spe ?? 0) > 0; });

/** Archetipo dal numero di muri passivi (e dal recupero e dalla robustezza per distinguere i team offensivi). */
function archetypeOf(team: TeamSet[]): Archetype {
  const roles = team.map(detectRoles);
  if (isStall(team, roles)) return 'stall';
  const passive = team.filter((set, i) => isPassive(set, roles[i])).length;
  if (passive === 4 || passive === 5) return 'semiStall';
  const healers = team.filter(heals).length;
  if (passive === 3 || (passive === 2 && healers >= 2)) return 'balance';
  const bulk = team.reduce((acc, set) => acc + (memberPower(set)?.bulk ?? 0), 0) / team.length;
  const sash = team.some(set => toID(set.item) === 'focussash');
  if (bulk < BULKY || (passive === 0 && (bulk < FRAIL || sash))) return 'hyperOffense';
  // In Ubers anche gli HO sono robusti: li distingue la velocità di quasi tutti i membri
  if (passive === 0 && team.filter(fastOrSpeedSetup).length >= HO_FAST_MEMBERS) return 'hyperOffense';
  return 'bulkyOffense';
}

/** Meteo e Trick Room contano come stile solo se qualcun altro li sfrutta (due membri lenti per Trick Room). */
function conditionStyles(team: TeamSet[]): TeamStyle[] {
  return CONDITION_STYLES
    .filter(([condition]) => {
      const setters = team.filter(set => enables(set).some(e => e.condition === condition && toID(e.via) !== 'chillyreception'));
      const users = team.filter(set => !setters.includes(set)
        && benefits(set).some(b => b.condition === condition && toID(b.via) !== 'weatherball'));
      return setters.length > 0 && users.length >= (condition === 'trickroom' ? 2 : 1);
    })
    .map(([, style]) => style);
}

/** Archetipi per cui ha senso cercare un singolo Pokémon (Balance: ci rientrerebbero quasi tutti). */
export type FitArchetype = 'stall' | 'hyperOffense' | 'bulkyOffense';
export const FIT_ARCHETYPES: FitArchetype[] = ['stall', 'hyperOffense', 'bulkyOffense'];
/** Offesa (percentile) da cui un membro passivo è un attaccante (Kyurem con Roost), non un muro da stall. */
const STALL_MAX_OFFENSE = 85;
/** Offesa minima di un attaccante veloce da Hyper Offense. */
const FAST_ATTACKER_OFFENSE = 65;
/** Offesa e robustezza minime di un membro da Bulky Offense. */
const BULKY_MEMBER = 60;

/** Il Pokémon, col suo set, è adatto a un team dell'archetipo dato. */
export function fitsArchetype(set: TeamSet, archetype: FitArchetype): boolean {
  const power = memberPower(set);
  if (!power) return false;
  const roles = detectRoles(set);
  const stall = isPassive(set, roles) && power.offense < STALL_MAX_OFFENSE;
  if (archetype === 'stall') return stall;
  if (stall) return false;
  if (archetype === 'bulkyOffense') return power.offense >= BULKY_MEMBER && power.bulk >= BULKY_MEMBER;
  const fast = (battleSpecies(set)?.baseStats.spe ?? 0) >= 100 || toID(set.item) === 'choicescarf';
  const sweeper = roles.includes('physicalSweeper') || roles.includes('specialSweeper');
  const lead = toID(set.item) === 'focussash' && roles.includes('hazards');
  return (sweeper && (fast || roles.includes('setup'))) || (power.offense >= FAST_ATTACKER_OFFENSE && fast) || lead;
}

/** Ruoli della carta del team: quelli del motore più il meteo, che compare solo lì. */
export type CardRole = Role | 'weather';
const WEATHERS: Condition[] = ['rain', 'sun', 'sand', 'snow'];

/** Il meteo che il membro porta, con abilità o mossa (non la neve di passaggio di Chilly Reception). */
export function weatherOf(set: TeamSet): { condition: Condition; via: string } | null {
  const link = enables(set).find(e => WEATHERS.includes(e.condition) && toID(e.via) !== 'chillyreception');
  return link ? { condition: link.condition, via: link.via } : null;
}

const OFFENSIVE_ROLES: Role[] = ['physicalSweeper', 'specialSweeper', 'wallbreaker'];
const WALL_ROLES: Role[] = ['physicalWall', 'specialWall'];
const SUPPORT_ROLES: Role[] = ['hazards', 'removal', 'pivot', 'priority', 'speed', 'setup'];

/**
 * Ruoli da mostrare sulla carta del team: il ruolo principale (che cosa fa: sweeper, wallbreaker o wall;
 * il wall prima solo per un muro da stall) e un ruolo di supporto. Il setup si salta per uno sweeper, che lo implica.
 * Chi porta il meteo lo mostra come supporto. Senza ruolo principale, due ruoli di supporto.
 */
export function cardRoles(set: TeamSet): CardRole[] {
  const roles = detectRoles(set);
  const order = fitsArchetype(set, 'stall') ? [...WALL_ROLES, ...OFFENSIVE_ROLES] : [...OFFENSIVE_ROLES, ...WALL_ROLES];
  const main = order.find(role => roles.includes(role));
  const weather: CardRole[] = weatherOf(set) ? ['weather'] : [];
  const support = SUPPORT_ROLES.filter(role => roles.includes(role));
  if (!main) return [...weather, ...support].slice(0, 2);
  const sweeper = main === 'physicalSweeper' || main === 'specialSweeper';
  return [main, ...weather, ...support.filter(role => !(sweeper && role === 'setup'))].slice(0, 2);
}

/** Tipo di team con archetipo e stili, solo per un team completo. */
export function teamArchetype(team: TeamSet[]): TeamArchetype | null {
  if (team.length < 6 || team.some(set => !battleSpecies(set))) return null;
  const moveIds = new Set(team.flatMap(set => set.moves.map(toID)));
  const styles: TeamStyle[] = [
    ...conditionStyles(team),
    ...(moveIds.has('stickyweb') ? ['webs' as const] : []),
    ...(team.filter(set => hasMove(set, ATTACK_PIVOTS)).length >= VOLT_TURN_PIVOTS ? ['voltturn' as const] : []),
    ...(moveIds.has('reflect') && moveIds.has('lightscreen') ? ['screens' as const] : []),
  ];
  return { archetype: archetypeOf(team), styles: styles.slice(0, MAX_STYLES) };
}
