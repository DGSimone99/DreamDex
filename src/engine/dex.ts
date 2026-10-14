import { Dex } from '@pkmn/dex';
import type { Move, Species } from '@pkmn/dex';
import type { Format } from './format';

export const dex = Dex.forGen(9);

export const toID = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

export const isDefined = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const EXCLUDED_NONSTANDARD = new Set(['CAP', 'LGPE', 'Custom', 'Future', 'Gigantamax']);
const BANNED_TIERS = new Set(['Uber', 'AG', 'Illegal', 'Unreleased']);

const excluded = (nonstandard: string | null | undefined) =>
  !!nonstandard && EXCLUDED_NONSTANDARD.has(nonstandard);

export function getSpecies(name: string): Species | null {
  if (!name) return null;
  const species = dex.species.get(name);
  return species?.exists ? species : null;
}

const PRIMAL_ORBS: Record<string, [base: string, forme: string]> = {
  redorb: ['Groudon', 'Groudon-Primal'],
  blueorb: ['Kyogre', 'Kyogre-Primal'],
};

/**
 * La specie in battaglia: Showdown esporta le Mega come specie base + pietra
 * (es. "Lopunny @ Lopunnite"), ma tipi, statistiche e dati Smogon sono della forma Mega.
 */
export function battleSpecies(set: { species: string; item: string }): Species | null {
  const species = getSpecies(set.species);
  if (!species || !set.item) return species;
  const item = dex.items.get(set.item);
  if (!item?.exists) return species;
  const megaStone = item.megaStone as unknown as Record<string, string> | undefined;
  const primal = PRIMAL_ORBS[item.id];
  const forme = megaStone?.[species.baseSpecies]
    ?? (primal && primal[0] === species.baseSpecies ? primal[1] : undefined);
  return (forme && getSpecies(forme)) || species;
}

/** Nome con cui la specie compare nelle statistiche Smogon. */
export const battleName = (set: { species: string; item: string }): string =>
  battleSpecies(set)?.name ?? set.species;

/** Vero se il set è una Mega in battaglia (pietra o forma Mega). Le forme Primal non contano. */
export const isMega = (set: { species: string; item: string }): boolean =>
  !!battleSpecies(set)?.isMega;

export function getMove(name: string): Move | null {
  if (!name) return null;
  const move = dex.moves.get(name);
  return move?.exists ? move : null;
}

export function isSelectable(species: Species): boolean {
  return !excluded(species.isNonstandard);
}

export function isLegal(species: Species): boolean {
  if (!isSelectable(species)) return false;
  const tier = String((species as { natDexTier?: string }).natDexTier ?? '').replace(/[()]/g, '');
  return !BANNED_TIERS.has(tier);
}

export function withinGen(species: Species, format: Format): boolean {
  return species.gen <= format.genLimit;
}

export function isAllowed(species: Species, format: Format): boolean {
  return isLegal(species) && withinGen(species, format);
}

export function speciesNames(): string[] {
  return dex.species.all().filter(s => s.exists && isSelectable(s)).map(s => s.name).sort();
}

export function moveNames(): string[] {
  return dex.moves
    .all()
    .filter(m => m.exists && !excluded(m.isNonstandard) && !m.isZ && !m.isMax)
    .map(m => m.name)
    .sort();
}

export function itemNames(): string[] {
  return dex.items.all().filter(i => i.exists && !excluded(i.isNonstandard)).map(i => i.name).sort();
}

export function natureNames(): string[] {
  return dex.natures.all().map(n => n.name).sort();
}
