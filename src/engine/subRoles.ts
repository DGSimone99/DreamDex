import { battleAbility, battleSpecies, getMove, isDefined, toID } from './dex';
import type { FormatRules } from './formatRules';
import type { TeamSet } from './sets';
import { statLines } from './statCalc';
import { attackStyle } from './roles';

export type Family = 'attack' | 'defense' | 'field' | 'disruption';
export type SubRole = 'physicalSweeper' | 'specialSweeper' | 'physicalBreaker' | 'specialBreaker'
  | 'physicalWall' | 'specialWall' | 'recovery' | 'hazards' | 'removal' | 'pivot' | 'screens'
  | 'dot' | 'debuff' | 'phazer' | 'taunt' | 'encore' | 'itemRemoval';

/** Le sotto-ruoli di ogni famiglia, nell'ordine della tabella della specifica. */
export const FAMILIES: Record<Family, SubRole[]> = {
  attack: ['physicalSweeper', 'specialSweeper', 'physicalBreaker', 'specialBreaker'],
  defense: ['physicalWall', 'specialWall', 'recovery'],
  field: ['hazards', 'removal', 'pivot', 'screens'],
  disruption: ['dot', 'debuff', 'phazer', 'taunt', 'encore', 'itemRemoval'],
};

/** Sotto-ruoli misurati: famiglia Attacco, muri e Recupero. */
export const MEASURED: SubRole[] = [...FAMILIES.attack, 'physicalWall', 'specialWall', 'recovery'];

/** Valori 0-1 per sotto-ruolo; solo le voci > 0. */
export type SubRoleValues = Partial<Record<SubRole, number>>;

export interface StatusSource {
  move: string;
  dot: number;
  debuff: number;
  status: 'tox' | 'brn' | 'psn' | 'par' | 'slp' | 'yawn' | 'trap' | 'salt' | 'seed';
}

const ORDER: SubRole[] = (Object.values(FAMILIES) as SubRole[][]).flat();

/** I sotto-ruoli con valore almeno `min`, nell'ordine delle famiglie. */
export const rolesList = (v: SubRoleValues, min = 0.5): SubRole[] => ORDER.filter(r => (v[r] ?? 0) >= min);

/** Indice di muro: PS x Dif e PS x DifSp sulle statistiche reali (livello 100), con i moltiplicatori di strumento e abilità. */
export function wallIndex(set: TeamSet): { physical: number; special: number } {
  const species = battleSpecies(set);
  if (!species) return { physical: 0, special: 0 };
  const lines = statLines(set);
  const value = (id: string) => lines.find(l => l.stat === id)?.value ?? 0;
  const item = toID(set.item);
  const ability = toID(battleAbility(set));
  let def = 1;
  let spd = 1;
  if (item === 'assaultvest') spd *= 1.5;
  // Eviolite conta solo su chi non è completamente evoluto
  if (item === 'eviolite' && (species.evos?.length ?? 0) > 0) { def *= 1.5; spd *= 1.5; }
  if (ability === 'furcoat') def *= 2;
  if (ability === 'icescales') spd *= 2;
  if (ability === 'marvelscale' && (item === 'flameorb' || item === 'toxicorb')) def *= 1.5;
  return { physical: value('hp') * value('def') * def, special: value('hp') * value('spd') * spd };
}

/** Valore di ogni stato: danno nel tempo e debuff, prima di probabilità e immunità. */
const STATUS_TABLE: Record<StatusSource['status'], { dot: number; debuff: number }> = {
  tox: { dot: 1, debuff: 0 }, brn: { dot: 0.5, debuff: 0.25 }, psn: { dot: 0.5, debuff: 0 },
  par: { dot: 0, debuff: 0.25 }, slp: { dot: 0, debuff: 1 }, yawn: { dot: 0, debuff: 0.5 },
  trap: { dot: 0.25, debuff: 0 }, salt: { dot: 1, debuff: 0 }, seed: { dot: 0.5, debuff: 0 },
};
const VOLATILE_STATUS: Record<string, StatusSource['status']> = {
  yawn: 'yawn', leechseed: 'seed', saltcure: 'salt', partiallytrapped: 'trap',
};

/** Fonti di stato del set, già x probabilità x precisione (solo il sonno), prima delle immunità. */
export function statusSources(set: TeamSet): StatusSource[] {
  const serene = toID(battleAbility(set)) === 'serenegrace';
  const out: StatusSource[] = [];
  const add = (move: string, status: StatusSource['status'] | undefined, chance: number, accuracy: number) => {
    if (!status || !STATUS_TABLE[status]) return;
    const k = chance * (status === 'slp' ? accuracy : 1);
    out.push({ move, status, dot: STATUS_TABLE[status].dot * k, debuff: STATUS_TABLE[status].debuff * k });
  };
  for (const m of set.moves.map(getMove).filter(isDefined)) {
    const accuracy = m.accuracy === true ? 1 : (m.accuracy ?? 100) / 100;
    const direct = (m.status as StatusSource['status'] | undefined) ?? VOLATILE_STATUS[m.volatileStatus ?? ''];
    add(m.name, direct, 1, accuracy);
    const secondaries = m.secondaries ?? (m.secondary ? [m.secondary] : []);
    for (const sec of secondaries) {
      const status = (sec.status as StatusSource['status'] | undefined) ?? VOLATILE_STATUS[sec.volatileStatus ?? ''];
      add(m.name, status, Math.min(1, ((sec.chance ?? 100) / 100) * (serene ? 2 : 1)), accuracy);
    }
  }
  return out;
}

const RECOVERY: Record<string, number> = {
  recover: 1, roost: 1, slackoff: 1, softboiled: 1, milkdrink: 1, moonlight: 1, synthesis: 1, morningsun: 1,
  shoreup: 1, strengthsap: 1, wish: 1, rest: 0.5, painsplit: 0.5, leechseed: 0.25,
};
const HAZARDS: Record<string, number> = { stealthrock: 1, spikes: 1, stoneaxe: 1, ceaselessedge: 1, toxicspikes: 0.75 };
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);
const PIVOT = new Set(['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'shedtail', 'chillyreception']);
const PHAZER = new Set(['haze', 'clearsmog', 'whirlwind', 'roar', 'dragontail', 'circlethrow']);
const SNOW = new Set(['snowscape', 'chillyreception']);

/** Soglia di statistica reale (Att/AttSp o Vel) per contare come attaccante o veloce. */
const STAT_MIN = 300;

/** Sotto-ruoli del solo set (senza meta): gli attaccanti sono un'approssimazione, i muri usano l'indice reale. */
export function setSubRoles(set: TeamSet, rules: FormatRules): SubRoleValues {
  const species = battleSpecies(set);
  if (!species) return {};
  const moves = set.moves.map(getMove).filter(isDefined);
  const ids: string[] = moves.map(m => m.id);
  const item = toID(set.item);
  const ability = toID(battleAbility(set));
  const v: SubRoleValues = {};
  const put = (role: SubRole, value: number) => { if (value > (v[role] ?? 0)) v[role] = value; };

  // Attacco: statistica reale e stile d'attacco; lo sweeper deve anche muoversi per primo
  const lines = statLines(set);
  const stat = (id: string) => lines.find(l => l.stat === id)?.value ?? 0;
  const style = attackStyle(set);
  const selfBoost = (s: 'atk' | 'spa' | 'spe') => moves.some(m => m.category === 'Status' && m.target === 'self' && (m.boosts?.[s] ?? 0) > 0);
  const priority = moves.some(m => m.category !== 'Status' && m.priority > 0);
  const fast = stat('spe') >= STAT_MIN || item === 'choicescarf';
  if (style === 'physical' && stat('atk') >= STAT_MIN) {
    put('physicalBreaker', 1);
    if (fast || selfBoost('spe') || (selfBoost('atk') && priority)) put('physicalSweeper', 1);
  }
  if (style === 'special' && stat('spa') >= STAT_MIN) {
    put('specialBreaker', 1);
    if (fast || selfBoost('spe') || (selfBoost('spa') && priority)) put('specialSweeper', 1);
  }

  // Difesa
  const wall = wallIndex(set);
  if (wall.physical >= rules.wallIndex.physical) put('physicalWall', 1);
  if (wall.special >= rules.wallIndex.special) put('specialWall', 1);
  ids.forEach(id => put('recovery', RECOVERY[id] ?? 0));
  if (ability === 'regenerator') put('recovery', 1);

  // Campo
  ids.forEach(id => put('hazards', HAZARDS[id] ?? 0));
  if (ids.some(id => REMOVAL.has(id))) put('removal', 1);
  if (ids.some(id => PIVOT.has(id))) put('pivot', 1);
  const clay = item === 'lightclay' ? 1 : 0.75;
  const veil = ids.includes('auroraveil');
  const snow = ability === 'snowwarning' || ids.some(id => SNOW.has(id));
  const reflect = ids.includes('reflect');
  const lightScreen = ids.includes('lightscreen');
  // Aurora Veil vale 1 solo con la neve (qui solo se il set la porta da sé; la neve del team la vede il team)
  if ((reflect && lightScreen) || (veil && snow)) put('screens', clay);
  else if (reflect || lightScreen || veil) put('screens', 0.6 * clay);

  // Disturbo
  for (const s of statusSources(set)) {
    put('dot', Math.min(1, s.dot));
    put('debuff', Math.min(1, s.debuff));
  }
  if (ids.some(id => PHAZER.has(id)) || ability === 'unaware') put('phazer', 1);
  if (ids.includes('taunt')) put('taunt', 1);
  if (ids.includes('encore')) put('encore', 1);
  if (ids.includes('knockoff')) put('itemRemoval', 1);
  if (ids.includes('trick') || ids.includes('switcheroo')) put('itemRemoval', item.startsWith('choice') ? 1 : 0.5);

  return v;
}
