import type { Species } from '@pkmn/dex';
import { battleSpecies, getSpecies, isMega, toID } from './dex';
import { EV_TOTAL, evTotal } from './statCalc';
import type { FormatId } from './format';
import type { TeamSet } from './sets';

/** Lo strumento che manca a una forma che esiste solo con quello (Zacian-Crowned senza Rusted Sword), o null. */
export function missingFormeItem(set: { species: string; item: string }): { forme: Species; base: Species; item: string } | null {
  const forme = getSpecies(set.species);
  if (!forme || forme.name === forme.baseSpecies) return null;
  const needed = forme.requiredItems ?? (forme.requiredItem ? [forme.requiredItem] : []);
  if (!needed.length || needed.some(name => toID(name) === toID(set.item ?? ''))) return null;
  // Necrozma-Ultra nasce da due forme: senza Ultranecrozium Z non si sa quale, resta com'è
  if (Array.isArray(forme.battleOnly)) return null;
  const base = getSpecies(typeof forme.battleOnly === 'string' ? forme.battleOnly : forme.baseSpecies);
  return base ? { forme, base, item: needed[0] } : null;
}

/** Il set con un'altra forma: l'abilità resta se la forma la può avere, altrimenti la sua prima. */
function asForme(set: TeamSet, forme: Species): TeamSet {
  const abilities = Object.values(forme.abilities).map(toID);
  return { ...set, species: forme.name, ability: !set.ability || abilities.includes(toID(set.ability)) ? set.ability : forme.abilities[0] };
}

/** I membri con più EV del massimo (510): il voto non si dà finché non si sistemano. */
export const overEvMembers = (team: TeamSet[]): TeamSet[] => team.filter(set => evTotal(set.evs ?? {}) > EV_TOTAL);

/** Formati senza Species Clause: Anything Goes e "Tutti i Pokémon (senza limiti)". */
const NO_SPECIES_CLAUSE = new Set<FormatId>(['gen9ag', 'all']);

/**
 * Species Clause (2026-11-08): come su Showdown, due membri con lo stesso numero di Pokédex non si possono avere (due
 * Clodsire, ma anche Rotom-Wash e Rotom-Heat, Arceus-Fire e Arceus-Water; la Mega è la stessa specie della base).
 * Gli indici dei membri che ripetono una specie già vista prima nel team; il voto non si dà finché non si sistemano.
 */
export function duplicateSpecies(team: TeamSet[], formatId: FormatId | undefined): number[] {
  if (formatId && NO_SPECIES_CLAUSE.has(formatId)) return [];
  const seen = new Set<number>();
  const repeated: number[] = [];
  team.slice(0, 6).forEach((set, i) => {
    const num = getSpecies(set.species)?.num;
    if (!num) return;
    if (seen.has(num)) repeated.push(i);
    else seen.add(num);
  });
  return repeated;
}

/** Perché il voto non si dà: EV oltre 510 o una specie doppia; null se si dà. */
export function blockedReason(team: TeamSet[], formatId: FormatId | undefined): 'ev' | 'species' | null {
  if (overEvMembers(team).length) return 'ev';
  if (duplicateSpecies(team, formatId).length) return 'species';
  return null;
}

/**
 * Il team come combatterebbe davvero, per il voto: al massimo 6 membri; una forma senza il suo strumento torna la forma
 * da cui nasce (Charizard-Mega-X con gli Avanzi è Charizard, Ogerpon-Wellspring senza maschera è Ogerpon); senza
 * "Più Mega ammesse" è Mega solo la prima del team, le altre combattono senza pietra.
 */
export function voteTeam(team: TeamSet[], allowMultipleMegas = false): TeamSet[] {
  let megaSeen = false;
  return team.slice(0, 6).map(set => {
    const missing = missingFormeItem(set);
    const fixed = missing ? asForme(set, missing.base) : set;
    if (!isMega(fixed)) return fixed;
    if (allowMultipleMegas || !megaSeen) { megaSeen = true; return fixed; }
    const forme = battleSpecies(fixed);
    const base = getSpecies(forme && forme.baseSpecies !== forme.name ? forme.baseSpecies : fixed.species);
    return base ? { ...asForme(fixed, base), item: '' } : { ...fixed, item: '' };
  });
}
