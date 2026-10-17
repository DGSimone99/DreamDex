import type { Species } from '@pkmn/dex';
import { usesMeta } from './analysis';
import type { EngineData } from './data';
import { battleAbility, battleName, battleSpecies, dex, effectiveStats, getMove, isLegal, toID } from './dex';
import { rulesOf } from './formatRules';
import { attackStyle, detectRoles } from './roles';
import type { TeamSet } from './sets';
import { metaSpeed, speedStat } from './speed';
import { topThreats } from './stats';
import { enables } from './synergy';
import { defensiveMultiplier, superEffectiveMoves, teamField, TYPES, type TypeName } from './types';

/**
 * Scheda dei membri: il profilo di ogni Pokémon del team con le statistiche reali del set
 * (EV, natura, strumento, abilità) e un voto nel suo ruolo. Solo informativo: il voto del team non lo usa.
 */

export type MemberRole = 'sweeper' | 'wallbreaker' | 'wall' | 'pivot' | 'support';
export type SupportTag = 'hazards' | 'removal' | 'pivot' | 'status' | 'recovery' | 'disruption' | 'sacrifice' | 'setup' | 'priority' | 'weather';

export interface MemberSheetRow {
  species: string;
  item: string;
  role: MemberRole;
  /** Voto nel ruolo, 0–100. */
  grade: number;
  /** Velocità reale; `share`: quota delle minacce più usate (col meta) o di tutti i Pokémon (senza) più lenti. */
  speed: { value: number; share: number; vsMeta: boolean };
  /** Statistica d'attacco reale con strumento e abilità; `share`: quota dei Pokémon (al massimo investimento) che colpiscono meno forte. */
  attack: { value: number; kind: 'physical' | 'special' | 'mixed' | null; boostItem: string | null; boostAbility: string | null; share: number };
  /** Tipi colpiti super efficace (col meteo e il campo del team). */
  coverage: TypeName[];
  /** PS e difese reali; `share`: quota dei Pokémon (al massimo investimento) che incassano meno. */
  bulk: { hp: number; def: number; spd: number; share: number };
  typing: { resist: TypeName[]; immune: TypeName[]; weak: { type: TypeName; double: boolean }[] };
  support: SupportTag[];
}

const statAt100 = (base: number, ev: number, mult: number) => Math.floor((Math.floor(2 * base + 31 + Math.floor(ev / 4)) + 5) * mult);
const hpAt100 = (base: number, ev: number) => (base === 1 ? 1 : 2 * base + 31 + Math.floor(ev / 4) + 110);
const natureMult = (nature: string, stat: string) => {
  const n = dex.natures.get(nature || 'Serious');
  return n.plus === stat ? 1.1 : n.minus === stat ? 0.9 : 1;
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Oggetti di tipo: +20% alle mosse di quel tipo (si conta come +20% all'attacco). */
const TYPE_ITEMS = ['blackglasses', 'charcoal', 'mysticwater', 'magnet', 'miracleseed', 'nevermeltice', 'blackbelt', 'poisonbarb',
  'softsand', 'sharpbeak', 'twistedspoon', 'silverpowder', 'hardstone', 'spelltag', 'dragonfang', 'metalcoat', 'silkscarf', 'fairyfeather'];
/** Strumenti che aumentano i danni: Choice, Life Orb, le maschere di Ogerpon, Soul Dew, i globi dei leggendari, Thick Club, Light Ball. */
const ATTACK_ITEMS: Record<string, (category: 'Physical' | 'Special') => number> = {
  choiceband: c => (c === 'Physical' ? 1.5 : 1), choicespecs: c => (c === 'Special' ? 1.5 : 1), lifeorb: () => 1.3, expertbelt: () => 1.1,
  cornerstonemask: () => 1.2, wellspringmask: () => 1.2, hearthflamemask: () => 1.2, souldew: () => 1.2,
  adamantcrystal: () => 1.2, lustrousglobe: () => 1.2, griseouscore: () => 1.2, thickclub: c => (c === 'Physical' ? 2 : 1), lightball: () => 2,
  ...Object.fromEntries(TYPE_ITEMS.map(id => [id, () => 1.2])),
};
/** Abilità che aumentano i danni (quelle che cambiano la statistica sono già in effectiveStats). */
const ATTACK_ABILITIES: Record<string, number> = {
  adaptability: 1.33, technician: 1.2, sheerforce: 1.3, toughclaws: 1.3, sharpness: 1.3, ironfist: 1.2, strongjaw: 1.3,
  pixilate: 1.2, aerilate: 1.2, refrigerate: 1.2, galvanize: 1.2, supremeoverlord: 1.2, protean: 1.2, libero: 1.2,
  transistor: 1.3, dragonsmaw: 1.3, punkrock: 1.3, rockypayload: 1.3, swordofruin: 1.25, beadsofruin: 1.25, guts: 1.3,
};
/** Abilità che aiutano a incassare. */
const BULK_ABILITIES: Record<string, number> = {
  intimidate: 1.2, multiscale: 1.3, shadowshield: 1.3, filter: 1.15, solidrock: 1.15, prismarmor: 1.15, thickfat: 1.1,
  unaware: 1.2, regenerator: 1.1, marvelscale: 1.15, icescales: 1.2, fluffy: 1.15,
};
/** Mosse con cui Contrary alza invece di abbassare (Serperior con Leaf Storm). */
const CONTRARY_MOVES = new Set(['leafstorm', 'dracometeor', 'overheat', 'superpower', 'vcreate']);
const SPEED_SETUP = new Set(['dragondance', 'quiverdance', 'shellsmash', 'shiftgear', 'agility', 'rockpolish', 'victorydance', 'tidyup', 'filletaway', 'trailblaze', 'flamecharge']);
const SETUP = new Set(['swordsdance', 'nastyplot', 'calmmind', 'bulkup', 'dragondance', 'quiverdance', 'shellsmash', 'shiftgear', 'victorydance',
  'tidyup', 'curse', 'coil', 'agility', 'rockpolish', 'tailglow', 'geomancy', 'bellydrum', 'filletaway']);
const RECOVERY = new Set(['recover', 'roost', 'softboiled', 'slackoff', 'wish', 'rest', 'moonlight', 'synthesis', 'morningsun', 'strengthsap', 'shoreup', 'milkdrink', 'lifedew', 'junglehealing']);
const PIVOTS = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'chillyreception', 'shedtail']);
/** Valore delle mosse di supporto (2,5 punti = supporto pieno). */
const UTILITY: Record<string, number> = {
  stealthrock: 1, spikes: 1, stoneaxe: 1, ceaselessedge: 1, toxicspikes: 0.6, stickyweb: 1,
  defog: 1, rapidspin: 1, mortalspin: 1, tidyup: 0.6, courtchange: 0.8,
  uturn: 0.6, voltswitch: 0.6, flipturn: 0.6, partingshot: 0.8, teleport: 0.5, shedtail: 0.8, chillyreception: 0.7,
  thunderwave: 0.7, glare: 0.7, nuzzle: 0.5, stunspore: 0.5, trickroom: 0.8, tailwind: 0.8, icywind: 0.4,
  willowisp: 0.7, toxic: 0.6, spore: 1, sleeppowder: 0.7, yawn: 0.5, haze: 0.5, clearsmog: 0.4,
  knockoff: 0.4, encore: 0.5, taunt: 0.4, trick: 0.4, switcheroo: 0.4, healingwish: 0.6, lunardance: 0.6, memento: 0.5,
  reflect: 0.7, lightscreen: 0.7, auroraveil: 1, whirlwind: 0.5, roar: 0.5, dragontail: 0.4, wish: 0.4, healbell: 0.4, fakeout: 0.3, destinybond: 0.3,
};
const TAGS: [SupportTag, string[]][] = [
  ['hazards', ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge']],
  ['removal', ['defog', 'rapidspin', 'mortalspin', 'courtchange', 'tidyup']],
  ['pivot', [...PIVOTS]],
  ['status', ['willowisp', 'toxic', 'thunderwave', 'spore', 'sleeppowder', 'yawn', 'glare', 'nuzzle', 'stunspore']],
  ['recovery', [...RECOVERY]],
  ['disruption', ['taunt', 'encore', 'knockoff', 'trick', 'switcheroo', 'haze', 'clearsmog', 'whirlwind', 'roar', 'dragontail']],
  ['sacrifice', ['healingwish', 'lunardance', 'memento', 'destinybond']],
];

/** Riferimenti: tutti i completamente evoluti legali al massimo investimento nella statistica misurata. */
let pools: { attack: number[]; bulk: number[]; speed: number[] } | null = null;
function referencePools() {
  if (!pools) {
    const legal = dex.species.all().filter(s => s.exists && !s.nfe && isLegal(s));
    const sorted = (f: (s: Species) => number) => legal.map(f).sort((a, b) => a - b);
    pools = {
      attack: sorted(s => Math.max(statAt100(s.baseStats.atk, 252, 1.1), statAt100(s.baseStats.spa, 252, 1.1))),
      bulk: sorted(s => hpAt100(s.baseStats.hp, 252) * (statAt100(s.baseStats.def, 252, 1.1) + statAt100(s.baseStats.spd, 4, 1)) / 2),
      speed: sorted(s => statAt100(s.baseStats.spe, 252, 1.1)),
    };
  }
  return pools;
}
const share = (pool: number[], value: number) => pool.filter(v => v < value).length / pool.length;

/** Pesi delle componenti per ruolo (somma 1). */
const ROLE_WEIGHTS: Record<MemberRole, Partial<Record<keyof Components, number>>> = {
  sweeper: { speed: 0.3, attack: 0.3, coverage: 0.15, boost: 0.1, bulk: 0.1, typing: 0.05 },
  wallbreaker: { attack: 0.4, coverage: 0.2, speed: 0.15, bulk: 0.1, typing: 0.1, boost: 0.05 },
  wall: { bulk: 0.35, typing: 0.25, recovery: 0.15, support: 0.2, attack: 0.05 },
  pivot: { speed: 0.25, support: 0.25, bulk: 0.15, typing: 0.15, attack: 0.1, coverage: 0.1 },
  support: { support: 0.35, bulk: 0.2, typing: 0.15, speed: 0.15, recovery: 0.15 },
};
/** Ogni componente è piena da qui in su: non serve la perfezione. */
const COMPONENT_FULL = 0.85;

interface Components {
  speed: number; attack: number; coverage: number; bulk: number; typing: number; recovery: number; support: number; boost: number;
}

/** Ruoli plausibili per il set: il voto è quello del ruolo in cui il set rende meglio. */
function plausibleRoles(set: TeamSet, c: Components, setupMove: boolean, wallStats: boolean): MemberRole[] {
  const evs = set.evs ?? {};
  const ids = set.moves.map(toID);
  const attacks = set.moves.filter(m => { const move = getMove(m); return move && move.category !== 'Status'; }).length;
  const noEvs = Object.values(evs).every(v => !v);
  const roles: MemberRole[] = [];
  // Offensivo: 2+ attacchi con EV in attacco o un setup, oppure 3+ attacchi (Hoopa-Unbound con Assault Vest)
  const invests = noEvs || Math.max(evs.atk ?? 0, evs.spa ?? 0) >= 64 || (ids.includes('bodypress') && (evs.def ?? 0) >= 128);
  if ((attacks >= 2 && (invests || setupMove)) || attacks >= 3) roles.push('sweeper', 'wallbreaker');
  if (noEvs || (evs.hp ?? 0) + (evs.def ?? 0) + (evs.spd ?? 0) >= 252 || wallStats) roles.push('wall');
  if (c.support >= 0.4) roles.push('support');
  if (ids.some(id => PIVOTS.has(id))) roles.push('pivot');
  return roles.length ? roles : ['support'];
}

function rowFor(set: TeamSet, data: EngineData, threats: string[] | null, field: ReturnType<typeof teamField>): MemberSheetRow {
  const ref = referencePools();
  const stats = effectiveStats(set);
  const species = battleSpecies(set);
  const ability = toID(battleAbility(set));
  const item = toID(set.item);
  const ids = set.moves.map(toID);
  const evs = set.evs ?? {};
  const style = attackStyle(set);

  // Attacco: statistica reale × strumento × abilità; misto = media tra fisico e speciale
  const contrary = ability === 'contrary' && ids.some(id => CONTRARY_MOVES.has(id));
  const booster = (ability === 'protosynthesis' || ability === 'quarkdrive') && item === 'boosterenergy' ? 1.3 : 1;
  const raw = (key: 'atk' | 'spa', category: 'Physical' | 'Special') =>
    statAt100(stats[key], evs[key] ?? 0, natureMult(set.nature, key)) * (ATTACK_ITEMS[item]?.(category) ?? 1)
    * (ATTACK_ABILITIES[ability] ?? 1) * booster * (contrary ? 1.5 : 1);
  const attackValue = style === 'physical' ? raw('atk', 'Physical') : style === 'special' ? raw('spa', 'Special')
    : style === 'mixed' ? (raw('atk', 'Physical') + raw('spa', 'Special')) / 2 : 0;
  // Chi aumenta l'attacco: lo strumento (Life Orb, Choice…) e l'abilità (Pixilate, Technician…)
  const boostItem = ATTACK_ITEMS[item] && (style === 'physical' ? ATTACK_ITEMS[item]('Physical') : ATTACK_ITEMS[item]('Special')) > 1 ? set.item : null;
  const boostAbility = ATTACK_ABILITIES[ability] || contrary || booster > 1 ? battleAbility(set) : null;

  // Velocità: reale, con Scarf; un setup di velocità vale +50%
  const speedValue = speedStat(set).value;
  const effectiveSpeed = speedValue * (ids.some(id => SPEED_SETUP.has(id)) ? 1.5 : 1);
  const rivals = threats?.map(name => metaSpeed(data, name)) ?? [];
  const speedShare = rivals.length ? rivals.filter(r => r < speedValue).length / rivals.length : share(ref.speed, speedValue);

  // Robustezza: PS e difese reali, Eviolite, Assault Vest, abilità difensive; la Focus Sash tiene in campo un lead
  const def = statAt100(stats.def, evs.def ?? 0, natureMult(set.nature, 'def'));
  const spd = statAt100(stats.spd, evs.spd ?? 0, natureMult(set.nature, 'spd'));
  const hp = hpAt100(stats.hp, evs.hp ?? 0);
  const bulkDef = def * (item === 'eviolite' && species?.nfe ? 1.5 : 1);
  const bulkSpd = spd * (item === 'eviolite' && species?.nfe ? 1.5 : 1) * (item === 'assaultvest' ? 1.5 : 1);
  const bulkValue = hp * (bulkDef + bulkSpd) / 2 * (BULK_ABILITIES[ability] ?? 1)
    * (['leftovers', 'blacksludge', 'heavydutyboots'].includes(item) ? 1.05 : 1);
  const bulkShare = Math.max(share(ref.bulk, bulkValue), item === 'focussash' ? 0.4 : 0);

  // Tipi: resistenze, immunità, debolezze
  const multipliers = TYPES.map(type => ({ type, mult: defensiveMultiplier(type, set) }));
  const typeScore = (m: number) => (m <= 0.25 ? 1 : m === 0.5 ? 0.8 : m === 1 ? 0.5 : m === 2 ? 0.15 : 0);
  const typing = clamp01((sum(multipliers.map(x => typeScore(x.mult))) / TYPES.length - 0.35) / 0.4);

  const coverage = TYPES.filter(type => superEffectiveMoves(set, type, field).length > 0);
  const recovery = ids.some(id => RECOVERY.has(id)) || ['regenerator', 'poisonheal'].includes(ability) ? 1
    : ['leftovers', 'blacksludge'].includes(item) ? 0.4 : 0;
  const weather = enables(set).length > 0;
  const supportValue = clamp01((sum(ids.map(id => UTILITY[id] ?? 0)) + (weather ? 1 : 0)) / 2.5);
  const setupMove = ids.some(id => SETUP.has(id)) || (ids.includes('irondefense') && ids.includes('bodypress')) || contrary;
  const priority = set.moves.some(m => { const move = getMove(m); return !!move && move.priority > 0 && move.category !== 'Status'; });

  const c: Components = {
    speed: share(ref.speed, effectiveSpeed), attack: share(ref.attack, attackValue), coverage: clamp01(coverage.length / 9),
    bulk: bulkShare, typing, recovery, support: supportValue, boost: setupMove ? 1 : priority ? 0.6 : 0,
  };
  const roles = detectRoles(set, rulesOf(data));
  const wallStats = roles.includes('physicalWall') || roles.includes('specialWall');
  const scoreAs = (role: MemberRole) => {
    const weights = ROLE_WEIGHTS[role];
    // Uno sweeper con priorità (Kingambit con Sucker Punch) colpisce per primo anche se lento
    const parts = role === 'sweeper' && priority ? { ...c, speed: Math.max(c.speed, 0.75) } : c;
    return sum((Object.keys(weights) as (keyof Components)[]).map(key => weights[key]! * Math.min(1, parts[key] / COMPONENT_FULL)));
  };
  const best = plausibleRoles(set, c, setupMove, wallStats)
    .map(role => ({ role, score: scoreAs(role) }))
    .sort((a, b) => b.score - a.score)[0];

  const support: SupportTag[] = TAGS.filter(([, list]) => ids.some(id => list.includes(id))).map(([tag]) => tag);
  if (setupMove) support.push('setup');
  if (priority) support.push('priority');
  if (weather) support.push('weather');

  return {
    species: battleName(set), item: set.item, role: best.role, grade: Math.round(100 * best.score),
    speed: { value: speedValue, share: speedShare, vsMeta: rivals.length > 0 },
    attack: { value: Math.round(attackValue), kind: style === 'none' ? null : style, boostItem, boostAbility, share: c.attack },
    coverage,
    bulk: { hp, def, spd, share: bulkShare },
    typing: {
      resist: multipliers.filter(x => x.mult > 0 && x.mult < 1).map(x => x.type),
      immune: multipliers.filter(x => x.mult === 0).map(x => x.type),
      weak: multipliers.filter(x => x.mult > 1).map(x => ({ type: x.type, double: x.mult >= 4 })),
    },
    support,
  };
}

/** La scheda di tutti i membri, col meteo e il campo del team e (col meta) contro le minacce più usate. */
export function memberSheet(team: TeamSet[], data: EngineData): MemberSheetRow[] {
  const threats = usesMeta(data) ? topThreats(data.stats, 20, team.map(battleName)) : null;
  const field = teamField(team);
  return team.filter(set => battleSpecies(set)).map(set => rowFor(set, data, threats, field));
}
