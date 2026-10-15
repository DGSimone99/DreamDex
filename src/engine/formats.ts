import type { Species } from '@pkmn/dex';
import { isSelectable, natDexTier } from './dex';
import type { Format, FormatId } from './format';

interface FormatDef {
  label: string;
  source: string;
  banned: Set<string>;
}

const ALWAYS = ['Illegal', 'Unreleased'];

const FORMATS: Record<FormatId, FormatDef> = {
  ou: { label: 'National Dex OU', source: 'gen9nationaldex', banned: new Set(['Uber', 'AG', ...ALWAYS]) },
  ubers: { label: 'National Dex Ubers', source: 'gen9nationaldexubers', banned: new Set(['AG', ...ALWAYS]) },
  uu: { label: 'National Dex UU', source: 'gen9nationaldexuu', banned: new Set(['OU', 'UUBL', 'Uber', 'AG', ...ALWAYS]) },
  all: { label: 'Tutti i Pokémon', source: 'gen9nationaldexubers', banned: new Set() },
};

export const FORMAT_OPTIONS: { id: FormatId; label: string }[] = [
  { id: 'ou', label: 'National Dex OU' },
  { id: 'ubers', label: 'National Dex Ubers' },
  { id: 'uu', label: 'National Dex UU' },
  { id: 'all', label: 'Tutti i Pokémon (senza limiti)' },
];

export const formatLabel = (format: Format): string => FORMATS[format.formatId].label;

/** Cartella dei dati Smogon da usare: il Monotype ha un meta proprio solo sopra OU. */
export function dataSource(format: Format): string {
  if (format.monotype && format.formatId === 'ou') return 'gen9nationaldexmonotype';
  return FORMATS[format.formatId].source;
}

export function isBannedIn(species: Species, format: Format): boolean {
  return !format.ignoreBans && FORMATS[format.formatId].banned.has(natDexTier(species));
}

/** Regole del team indipendenti dai ban: per ora il tipo del Monotype. */
export function meetsTeamRules(species: Species, format: Format): boolean {
  return !format.monotype || (species.types as readonly string[]).includes(format.monotype);
}

export function isLegalIn(species: Species, format: Format): boolean {
  return isSelectable(species) && !isBannedIn(species, format) && meetsTeamRules(species, format);
}
