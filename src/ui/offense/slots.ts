import { battleSpecies } from '../../engine/dex';
import type { TeamSet } from '../../engine/sets';

/**
 * Per ogni slot del team, l'indice del membro corrispondente tra quelli dell'Offesa (valido anche per `walls[].cells`),
 * oppure `null` se il motore lo ha scartato. Si scorrono insieme team e membri: uno slot prende il primo membro non ancora
 * usato con lo stesso nome in battaglia (es. le Mega), così due membri della stessa specie restano distinti.
 */
export function offenseSlots(team: TeamSet[], members: { species: string }[]): (number | null)[] {
  let next = 0;
  return team.map(set => {
    const name = battleSpecies(set)?.name ?? set.species;
    for (let i = next; i < members.length; i++) {
      if (members[i].species === name) {
        next = i + 1;
        return i;
      }
    }
    return null;
  });
}
