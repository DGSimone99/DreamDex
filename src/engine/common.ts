import type { EngineData } from './data';
import { battleName, dex, getMove, getSpecies } from './dex';
import { ownDataOnly, parseSpread, presetsForSet, STAT_IDS, type StatID, type TeamSet } from './sets';
import { findByName, statsEntry } from './stats';

/** Una scelta frequente: quota d'uso nel formato, o null se viene dai preset Smogon. */
export interface CommonChoice {
  name: string;
  share: number | null;
}

/** Natura ed EV che si usano insieme. */
export interface CommonSpread {
  nature: string;
  evs: Partial<Record<StatID, number>>;
  share: number | null;
}

export interface CommonChoices {
  items: CommonChoice[];
  abilities: CommonChoice[];
  natures: CommonChoice[];
  moves: CommonChoice[];
  teraTypes: CommonChoice[];
  spreads: CommonSpread[];
  /** Formato da cui vengono le quote, se non è quello scelto (es. un Pokémon vietato: "gen9nationaldexubers"). */
  source: string | null;
}

/** Spread pronti: fino a 5, al massimo 4 dalle statistiche (così c'è posto per un set del formato); altri formati solo fino a 3. */
const MAX_SPREADS = 5;
const MAX_STATS_SPREADS = 4;
const MIN_SPREADS = 3;

const spreadKey = (s: { nature: string; evs: Partial<Record<StatID, number>> }) =>
  `${s.nature}:${STAT_IDS.map(stat => s.evs[stat] ?? 0).join('/')}`;

/** Spread delle statistiche (fino a 4), poi quelli dei set del formato (fino a 5); i set di altri formati solo se non si arriva a 3. */
function mergeSpreads(fromStats: CommonSpread[], own: TeamSet[], other: TeamSet[]): CommonSpread[] {
  const seen = new Set(fromStats.map(spreadKey));
  const result = fromStats.slice(0, MAX_STATS_SPREADS);
  const add = (sets: TeamSet[], limit: number) => {
    for (const set of sets) {
      if (result.length >= limit) return;
      const spread = { nature: set.nature, evs: set.evs, share: null };
      if (!set.nature || seen.has(spreadKey(spread))) continue;
      seen.add(spreadKey(spread));
      result.push(spread);
    }
  };
  add(own, MAX_SPREADS);
  add(other, MIN_SPREADS);
  return result;
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
  // Prima il formato scelto; poi quello in cui il Pokémon è più giocato (forma in battaglia, specie, forma base)
  const own = statsEntry(data.stats, battleName(set)) ?? statsEntry(data.stats, set.species);
  const base = getSpecies(set.species)?.baseSpecies ?? set.species;
  // Doppio: per chi ha dati di doppio mai le più usate di un altro formato (sets.ts ownDataOnly)
  const other = own || ownDataOnly(data, battleName(set)) ? undefined
    : [battleName(set), set.species, base].map(name => findByName(data.fallbackStats ?? undefined, name)).find(Boolean);
  const entry = own ?? other;
  const source = other?.format ?? null;
  const presets = presetsForSet(data, set);
  const sets = presets.map(p => p.set);
  // Set del formato scelto e di altri formati (questi ultimi solo per completare gli spread)
  const ownFormats = new Set((findByName(data.presets ?? undefined, set.species) ?? []).map(p => p.format));
  const ownSets = presets.filter(p => ownFormats.has(p.format)).map(p => p.set);
  const otherSets = presets.filter(p => !ownFormats.has(p.format)).map(p => p.set);
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
      teraTypes: ranked(entry.teraTypes, name => name),
      spreads: mergeSpreads(Object.entries(entry.spreads)
        .filter(([, share]) => share >= MIN_SHARE)
        .sort((a, b) => b[1] - a[1])
        .map(([spread, share]) => ({ ...parseSpread(spread), share })), ownSets, otherSets),
      source,
    };
  }
  return {
    items: unique(sets.map(s => s.item)),
    abilities: unique(sets.map(s => s.ability)),
    natures: unique(sets.map(s => s.nature)),
    moves: unique(sets.flatMap(s => s.moves)),
    teraTypes: unique(sets.map(s => s.teraType ?? '')),
    spreads: mergeSpreads([], ownSets, otherSets),
    source: null,
  };
}
