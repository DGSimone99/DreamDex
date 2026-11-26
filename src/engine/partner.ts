import type { FieldCondition } from './damage';
import { battleAbility, battleSpecies, toID } from './dex';
import type { TeamSet } from './sets';
import { enables } from './synergy';

/** Chi porta un meteo o un campo nel team e come (abilità o mossa): per dire "Sole · Ninetales". */
export interface FieldSource { condition: FieldCondition; species: string; via: string }

const WEATHERS: FieldCondition[] = ['sun', 'rain', 'sand', 'snow'];

/**
 * I meteo e i campi che il team può dare al membro oltre a quelli della sua abilità (sempre attivi per lui): per ognuno
 * chi lo porta, preferendo un'abilità (Siccità) a una mossa (Giorno di Sole). Anche una mossa del membro stesso conta.
 */
export function teamFieldSources(set: TeamSet, team: TeamSet[]): FieldSource[] {
  const ownAbility = toID(battleAbility(set));
  const own = new Set(enables(set).filter(l => toID(l.via) === ownAbility).map(l => l.condition));
  const out = new Map<FieldCondition, FieldSource & { ability: boolean }>();
  for (const member of team) {
    const ability = toID(battleAbility(member));
    for (const link of enables(member)) {
      if (link.condition === 'trickroom' || own.has(link.condition)) continue;
      const byAbility = toID(link.via) === ability;
      if (member === set && byAbility) continue;
      const prev = out.get(link.condition);
      if (prev && (prev.ability || !byAbility)) continue;
      out.set(link.condition, { condition: link.condition, species: battleSpecies(member)?.name ?? member.species, via: link.via, ability: byAbility });
    }
  }
  return [...out.values()].map(({ condition, species, via }) => ({ condition, species, via }));
}


/**
 * Le combinazioni col meteo e i campi del team (un meteo e un terreno alla volta; i propri restano sempre): per ognuna
 * le condizioni da passare al calcolo e quelle che arrivano dal team.
 */
export function teamFieldCombos(own: FieldCondition[], sources: FieldSource[]): { conditions: FieldCondition[]; added: FieldCondition[] }[] {
  const isWeather = (c: FieldCondition) => WEATHERS.includes(c);
  const options = (pick: (c: FieldCondition) => boolean): FieldCondition[][] => (own.some(pick) ? [[]] : [[], ...sources.map(s => s.condition).filter(pick).map(c => [c])]);
  return options(isWeather).flatMap(w => options(c => !isWeather(c)).map(t => [...w, ...t]))
    .filter(added => added.length > 0)
    .map(added => ({ conditions: [...own, ...added], added }));
}
