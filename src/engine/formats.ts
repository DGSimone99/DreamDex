import type { Species } from '@pkmn/dex';
import { isSelectable, natDexTier } from './dex';
import type { Format, FormatId } from './format';
import { t, type Lang } from '../i18n';

interface FormatDef {
  source: string;
  banned: Set<string>;
  /** Teracristallizzazione ammessa (vietata in National Dex OU e UU). */
  tera: boolean;
}

const ALWAYS = ['Illegal', 'Unreleased'];

const FORMATS: Record<FormatId, FormatDef> = {
  ou: { source: 'gen9nationaldex', banned: new Set(['Uber', 'AG', ...ALWAYS]), tera: false },
  ubers: { source: 'gen9nationaldexubers', banned: new Set(['AG', ...ALWAYS]), tera: true },
  uu: { source: 'gen9nationaldexuu', banned: new Set(['OU', 'UUBL', 'Uber', 'AG', ...ALWAYS]), tera: false },
  all: { source: 'gen9nationaldexubers', banned: new Set(), tera: true },
};

const FORMAT_IDS: FormatId[] = ['ou', 'ubers', 'uu', 'all'];

/** I formati per il menu, con le etichette nella lingua data. */
export const formatOptions = (lang: Lang = 'it'): { id: FormatId; label: string }[] =>
  FORMAT_IDS.map(id => ({ id, label: t(lang, id === 'all' ? 'format.allOption' : `format.${id}`) }));

export const formatLabel = (format: Format, lang: Lang = 'it'): string => t(lang, `format.${format.formatId}`);

/** Cartella dei dati Smogon da usare. */
export function dataSource(format: Format): string {
  return FORMATS[format.formatId].source;
}

/** Tera ammesso nel formato: vietato in OU e UU. */
export function teraAllowed(format: Format): boolean {
  return FORMATS[format.formatId].tera;
}

export function isBannedIn(species: Species, format: Format): boolean {
  return !format.ignoreBans && FORMATS[format.formatId].banned.has(natDexTier(species));
}

export function isLegalIn(species: Species, format: Format): boolean {
  return isSelectable(species) && !isBannedIn(species, format);
}
