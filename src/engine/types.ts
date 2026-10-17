import { battleAbility, battleSpecies, dex, getMove, isDefined, toID } from './dex';
import type { TeamSet } from './sets';
import { memoBySet } from './memo';

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
  const base = effectiveness(attack, species.types);
  const modifier = ABILITY_MODIFIERS[toID(battleAbility(set))]?.[attack];
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

/** Meteo e campo in gioco: cambiano il tipo di Weather Ball e Terrain Pulse. */
export interface Field {
  weather: 'sun' | 'rain' | 'sand' | 'snow' | null;
  terrain: 'electric' | 'grassy' | 'misty' | 'psychic' | null;
}

const WEATHER_SOURCES: Record<string, Field['weather']> = {
  drought: 'sun', orichalcumpulse: 'sun', desolateland: 'sun', sunnyday: 'sun',
  drizzle: 'rain', primordialsea: 'rain', raindance: 'rain',
  sandstream: 'sand', sandstorm: 'sand',
  snowwarning: 'snow', snowscape: 'snow', hail: 'snow', chillyreception: 'snow',
};
const TERRAIN_SOURCES: Record<string, Field['terrain']> = {
  electricsurge: 'electric', hadronengine: 'electric', electricterrain: 'electric',
  grassysurge: 'grassy', seedsower: 'grassy', grassyterrain: 'grassy',
  mistysurge: 'misty', mistyterrain: 'misty',
  psychicsurge: 'psychic', psychicterrain: 'psychic',
};
const WEATHER_BALL: Record<NonNullable<Field['weather']>, TypeName> = { sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice' };
const TERRAIN_PULSE: Record<NonNullable<Field['terrain']>, TypeName> = { electric: 'Electric', grassy: 'Grass', misty: 'Fairy', psychic: 'Psychic' };

/** Meteo e campo che il Pokémon porta da sé (abilità o mossa). */
export function ownField(set: TeamSet): Field {
  return ownFieldOf(set, null);
}
const ownFieldOf = memoBySet((set: TeamSet, _: null): Field => {
  const sources = [toID(battleAbility(set)), ...set.moves.map(toID)];
  return {
    weather: sources.map(id => WEATHER_SOURCES[id]).find(Boolean) ?? null,
    terrain: sources.map(id => TERRAIN_SOURCES[id]).find(Boolean) ?? null,
  };
});

/** Meteo e campo del team: quelli del primo membro che li porta. */
export function teamField(team: TeamSet[]): Field {
  const fields = team.map(ownField);
  return { weather: fields.find(f => f.weather)?.weather ?? null, terrain: fields.find(f => f.terrain)?.terrain ?? null };
}

/**
 * Mosse d'attacco col loro tipo in battaglia: Weather Ball e Terrain Pulse prendono il tipo del meteo o del campo
 * (quello che il Pokémon porta da sé vince su quello del team).
 */
export function attackingMoves(set: TeamSet, field: Field = ownField(set)): AttackMove[] {
  return attackingMovesOf(set, field);
}
const attackingMovesOf = memoBySet((set: TeamSet, field: Field): AttackMove[] => {
  const own = ownField(set);
  const weather = own.weather ?? field.weather;
  const terrain = own.terrain ?? field.terrain;
  return set.moves
    .map(getMove)
    .filter(isDefined)
    .filter(move => move.category !== 'Status')
    .map(move => {
      const id = toID(move.name);
      const type = id === 'weatherball' && weather ? WEATHER_BALL[weather]
        : id === 'terrainpulse' && terrain ? TERRAIN_PULSE[terrain]
        : move.type as TypeName;
      return { name: move.name, type };
    });
}, field => `${field.weather}|${field.terrain}`);

function moveEffectiveness(move: AttackMove, defType: TypeName): number {
  if (toID(move.name) === 'freezedry' && defType === 'Water') return 2;
  return effectiveness(move.type, [defType]);
}

export function superEffectiveMove(set: TeamSet, defType: TypeName, field?: Field): string | null {
  return attackingMoves(set, field).find(move => moveEffectiveness(move, defType) > 1)?.name ?? null;
}

/** Tutte le mosse super efficaci del set contro un tipo (`field`: meteo e campo del team). */
export function superEffectiveMoves(set: TeamSet, defType: TypeName, field?: Field): string[] {
  return attackingMoves(set, field).filter(move => moveEffectiveness(move, defType) > 1).map(move => move.name);
}

export interface CoverageRow {
  type: TypeName;
  hitters: { member: string; move: string }[];
}

export function coverageTable(team: TeamSet[]): CoverageRow[] {
  const field = teamField(team);
  return TYPES.map(type => ({
    type,
    hitters: team.flatMap(set => {
      const move = superEffectiveMove(set, type, field);
      return move ? [{ member: set.species, move }] : [];
    }),
  }));
}
