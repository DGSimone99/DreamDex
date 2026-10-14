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
