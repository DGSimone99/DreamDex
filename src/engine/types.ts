import { battleSpecies, dex, getMove, getSpecies, isDefined, toID } from './dex';
import type { TeamSet } from './sets';

export const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;
export type TypeName = (typeof TYPES)[number];

/** Codici di damageTaken di Showdown: 0 neutro, 1 debole, 2 resiste, 3 immune. */
const CODE_TO_MULTIPLIER = [1, 2, 0.5, 0];

export function effectiveness(attack: TypeName, defTypes: readonly string[]): number {
  return defTypes.reduce((mult, defType) => {
    const code = dex.types.get(defType).damageTaken?.[attack] ?? 0;
    return mult * (CODE_TO_MULTIPLIER[code] ?? 1);
  }, 1);
}

const ABILITY_MODIFIERS: Record<string, Partial<Record<TypeName, number>>> = {
  levitate: { Ground: 0 },
  eartheater: { Ground: 0 },
  flashfire: { Fire: 0 },
  wellbakedbody: { Fire: 0 },
  waterabsorb: { Water: 0 },
  stormdrain: { Water: 0 },
  dryskin: { Water: 0 },
  voltabsorb: { Electric: 0 },
  lightningrod: { Electric: 0 },
  motordrive: { Electric: 0 },
  sapsipper: { Grass: 0 },
  thickfat: { Fire: 0.5, Ice: 0.5 },
  heatproof: { Fire: 0.5 },
  waterbubble: { Fire: 0.5 },
  purifyingsalt: { Ghost: 0.5 },
};

export function defensiveMultiplier(attack: TypeName, set: TeamSet): number {
  const species = battleSpecies(set);
  if (!species) return 1;
  const transformed = species.name !== getSpecies(set.species)?.name;
  const ability = transformed ? species.abilities[0] : set.ability;
  const base = effectiveness(attack, species.types);
  const modifier = ABILITY_MODIFIERS[toID(ability)]?.[attack];
  return modifier === undefined ? base : base * modifier;
}

export interface WeaknessRow {
  type: TypeName;
  multipliers: number[];
  weak: number;
  resist: number;
  pressure: number;
}

export function weaknessTable(team: TeamSet[]): WeaknessRow[] {
  return TYPES.map(type => {
    const multipliers = team.map(set => defensiveMultiplier(type, set));
    const weak = multipliers.filter(m => m > 1).length;
    const resist = multipliers.filter(m => m < 1).length;
    return { type, multipliers, weak, resist, pressure: Math.max(0, weak - resist) };
  });
}

export interface AttackMove {
  name: string;
  type: TypeName;
}

export function attackingMoves(set: TeamSet): AttackMove[] {
  return set.moves
    .map(getMove)
    .filter(isDefined)
    .filter(move => move.category !== 'Status')
    .map(move => ({ name: move.name, type: move.type as TypeName }));
}

function moveEffectiveness(move: AttackMove, defType: TypeName): number {
  if (toID(move.name) === 'freezedry' && defType === 'Water') return 2;
  return effectiveness(move.type, [defType]);
}

export function superEffectiveMove(set: TeamSet, defType: TypeName): string | null {
  return attackingMoves(set).find(move => moveEffectiveness(move, defType) > 1)?.name ?? null;
}

export interface CoverageRow {
  type: TypeName;
  hitters: { member: string; move: string }[];
}

export function coverageTable(team: TeamSet[]): CoverageRow[] {
  return TYPES.map(type => ({
    type,
    hitters: team.flatMap(set => {
      const move = superEffectiveMove(set, type);
      return move ? [{ member: set.species, move }] : [];
    }),
  }));
}
