import type { Species } from '@pkmn/dex';
import { usesMeta } from './analysis';
import type { EngineData } from './data';
import { rulesOf, type FormatRules } from './formatRules';
import { isPassive, legacyWall } from './roles';
import { mostCommonSet, type TeamSet } from './sets';
import { tierSpecies } from './speed';
import { topThreats } from './stats';

/** Quanti difensori del formato si usano per misurare l'Offesa. */
export const PANEL_SIZE = 12;
/** Quanti Pokémon del meta, dal più usato, si scorrono per trovare i difensivi. */
const META_SCAN = 60;

const bulkIndex = (s: Species) => s.baseStats.hp * (s.baseStats.def + s.baseStats.spd);
/** EV in PS e difese da cui un set conta come difensore: Kingambit o Urshifu con statistiche da muro ma set offensivo no. */
const WALL_INVESTMENT = 400;
/** Senza meta: Pokémon più difensivi che offensivi, mai forme solo da battaglia (le Mega senza pietra). */
const naturalWall = (s: Species) => !s.battleOnly && Math.max(s.baseStats.def, s.baseStats.spd) >= Math.max(s.baseStats.atk, s.baseStats.spa);

/** Set difensivo standard: 252 PS e 252 nella difesa più alta, natura che la alza, Leftovers, prima abilità. */
function standardWall(species: Species): TeamSet {
  const side = species.baseStats.def >= species.baseStats.spd ? 'def' : 'spd';
  return {
    species: species.name, item: 'Leftovers', ability: species.abilities[0], moves: [],
    nature: side === 'def' ? 'Bold' : 'Calm', evs: { hp: 252, [side]: 252 },
  };
}

/** Set difensivo: passivo o muro (regola legacy: il pannello e i numeri dell'Offesa non cambiano), con almeno 400 EV fra PS e difese. */
export function isDefensiveSet(set: TeamSet, rules: FormatRules): boolean {
  const investment = (set.evs.hp ?? 0) + (set.evs.def ?? 0) + (set.evs.spd ?? 0);
  return (isPassive(set, rules) || legacyWall(set, rules)) && investment >= WALL_INVESTMENT;
}

const panels = new Map<string, TeamSet[]>();
const metaCounts = new Map<string, number>();

/**
 * I difensori contro cui si misura l'Offesa. Col meta: i più usati il cui set più comune è difensivo
 * (passivo o muro, con almeno 400 EV fra PS e difese), col loro spread, strumento e abilità più comuni.
 * Senza meta (o senza statistiche): i più robusti del tier fra quelli più difensivi che offensivi, con un set difensivo standard. Se il meta non ne ha abbastanza si completa col tier.
 */
export function defenderPanel(data: EngineData): TeamSet[] {
  const formatId = data.formatId ?? 'ou';
  const meta = usesMeta(data);
  const key = `${formatId}|${meta}`;
  let panel = panels.get(key);
  if (panel) return panel;
  const rules = rulesOf(data);
  const fromMeta: TeamSet[] = [];
  if (meta) {
    for (const name of topThreats(data.stats, META_SCAN, [])) {
      const set = mostCommonSet(data.stats, name);
      if (!set) continue;
      if (isDefensiveSet(set, rules)) fromMeta.push(set);
      if (fromMeta.length === PANEL_SIZE) break;
    }
  }
  const taken = new Set(fromMeta.map(set => set.species));
  const fromTier = [...tierSpecies(formatId)]
    .filter(s => !taken.has(s.name) && naturalWall(s))
    .sort((a, b) => bulkIndex(b) - bulkIndex(a))
    .slice(0, PANEL_SIZE - fromMeta.length)
    .map(standardWall);
  panel = [...fromMeta, ...fromTier];
  panels.set(key, panel);
  metaCounts.set(key, fromMeta.length);
  return panel;
}

/** Quanti difensori del pannello vengono dal meta (i primi); gli altri sono i più robusti del tier. */
export function metaDefenderCount(data: EngineData): number {
  defenderPanel(data);
  return metaCounts.get(`${data.formatId ?? 'ou'}|${usesMeta(data)}`) ?? 0;
}
