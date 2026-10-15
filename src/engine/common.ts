import type { EngineData } from './data';
import { battleName, dex, getMove } from './dex';
import { parseSpread, presetsFor, type TeamSet } from './sets';
import { statsEntry } from './stats';

/** Una scelta frequente: quota d'uso nel formato, o null se viene dai preset Smogon. */
export interface CommonChoice {
  name: string;
  share: number | null;
}

export interface CommonChoices {
  items: CommonChoice[];
  abilities: CommonChoice[];
  natures: CommonChoice[];
  moves: CommonChoice[];
}

/** Sotto questa quota d'uso una scelta non è "comune". */
const MIN_SHARE = 0.05;

const ranked = (shares: Record<string, number>, name: (id: string) => string): CommonChoice[] =>
  Object.entries(shares)
    .filter(([, share]) => share >= MIN_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([id, share]) => ({ name: name(id), share }));

const unique = (names: string[]): CommonChoice[] =>
  [...new Set(names.filter(Boolean))].map(name => ({ name, share: null }));

/**
 * Strumenti, abilità, nature e mosse più usati dal membro: dalle statistiche del formato
 * (della forma in battaglia se ne ha, es. la Mega), altrimenti dai preset Smogon.
 */
export function commonChoices(data: EngineData, set: TeamSet): CommonChoices {
  const entry = statsEntry(data.stats, battleName(set)) ?? statsEntry(data.stats, set.species);
  if (entry) {
    const natures: Record<string, number> = {};
    for (const [spread, share] of Object.entries(entry.spreads)) {
      const { nature } = parseSpread(spread);
      natures[nature] = (natures[nature] ?? 0) + share;
    }
    return {
      items: ranked(entry.items, id => dex.items.get(id).name),
      abilities: ranked(entry.abilities, id => dex.abilities.get(id).name),
      natures: ranked(natures, name => name),
      moves: ranked(entry.moves, id => getMove(id)?.name ?? id),
    };
  }
  const sets = presetsFor(data, set.species).map(p => p.set);
  return {
    items: unique(sets.map(s => s.item)),
    abilities: unique(sets.map(s => s.ability)),
    natures: unique(sets.map(s => s.nature)),
    moves: unique(sets.flatMap(s => s.moves)),
  };
}
