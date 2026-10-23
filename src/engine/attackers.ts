import type { Species } from '@pkmn/dex';
import { usesMeta } from './analysis';
import type { EngineData } from './data';
import { isDefensiveSet } from './defenders';
import { getMove } from './dex';
import { rulesOf } from './formatRules';
import { attackStyle } from './roles';
import { mostCommonSet, type TeamSet } from './sets';
import { tierSpecies } from './speed';
import { topThreats, usageOf } from './stats';

/** Quanti attaccanti per lato (fisici e speciali) misurano la Robustezza. */
export const PANEL_ATTACKERS = 10;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare gli attaccanti. */
const META_SCAN = 60;
/** Quante minacce del meta misurano la Coverage difensiva meta. */
const THREATS = 40;

const damaging = (set: TeamSet) => set.moves.filter(m => (getMove(m)?.category ?? 'Status') !== 'Status').length;

/** Set offensivo standard senza meta: 252 nella statistica d'attacco e in Velocità, natura che la alza, Life Orb. */
function standardAttacker(species: Species, side: 'atk' | 'spa'): TeamSet {
  return {
    species: species.name, item: 'Life Orb', ability: species.abilities[0], moves: [],
    nature: side === 'atk' ? 'Adamant' : 'Modest', evs: { [side]: 252, spe: 252 },
  };
}

const panels = new Map<string, { physical: TeamSet[]; special: TeamSet[] }>();

/**
 * Gli attaccanti contro cui si misura la Robustezza, uno per lato così nessuno resta vuoto.
 * Col meta: i più usati il cui set più comune attacca in quello stile (i misti in entrambi), con almeno due mosse
 * d'attacco e non difensivo. Senza meta: i completamente evoluti del tier con la statistica d'attacco più alta.
 */
export function attackerPanels(data: EngineData): { physical: TeamSet[]; special: TeamSet[] } {
  const formatId = data.formatId ?? 'ou';
  const meta = usesMeta(data);
  const key = `${formatId}|${meta}`;
  const cachedPanel = panels.get(key);
  if (cachedPanel) return cachedPanel;
  const rules = rulesOf(data);
  const physical: TeamSet[] = [];
  const special: TeamSet[] = [];
  if (meta) {
    for (const name of topThreats(data.stats, META_SCAN, [])) {
      const set = mostCommonSet(data.stats, name);
      if (!set || damaging(set) < 2 || isDefensiveSet(set, rules)) continue;
      const style = attackStyle(set);
      if ((style === 'physical' || style === 'mixed') && physical.length < PANEL_ATTACKERS) physical.push(set);
      if ((style === 'special' || style === 'mixed') && special.length < PANEL_ATTACKERS) special.push(set);
    }
  }
  // Se il meta non ne ha abbastanza (o senza meta) si completa coi più forti del tier
  const fill = (list: TeamSet[], side: 'atk' | 'spa') => {
    const taken = new Set(list.map(set => set.species));
    const extra = [...tierSpecies(formatId)]
      .filter(s => !taken.has(s.name) && !s.battleOnly)
      .sort((a, b) => b.baseStats[side] - a.baseStats[side])
      .slice(0, PANEL_ATTACKERS - list.length)
      .map(s => standardAttacker(s, side));
    return [...list, ...extra];
  };
  const result = { physical: fill(physical, 'atk'), special: fill(special, 'spa') };
  panels.set(key, result);
  return result;
}

const threatsCache = new Map<string, { set: TeamSet; weight: number }[]>();

/** Le minacce del meta per la Coverage difensiva: i 40 più usati con almeno una mossa d'attacco, pesati per uso. */
export function metaThreats(data: EngineData): { set: TeamSet; weight: number }[] {
  if (!usesMeta(data)) return [];
  const key = data.formatId ?? 'ou';
  const cachedThreats = threatsCache.get(key);
  if (cachedThreats) return cachedThreats;
  const sets = topThreats(data.stats, THREATS, [])
    .map(name => mostCommonSet(data.stats, name))
    .filter((set): set is TeamSet => !!set && damaging(set) > 0);
  const total = sets.reduce((acc, set) => acc + usageOf(data.stats, set.species), 0);
  const threats = sets.map(set => ({ set, weight: total ? usageOf(data.stats, set.species) / total : 1 / sets.length }));
  threatsCache.set(key, threats);
  return threats;
}
