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

/** Nome della fonte dati in uso (per i messaggi): il Monotype su OU ha statistiche proprie. */
export const dataLabel = (format: Format, lang: Lang = 'it'): string =>
  dataSource(format) === 'gen9nationaldexmonotype' ? t(lang, 'format.monotypeData') : formatLabel(format, lang);

/** Cartella dei dati Smogon da usare: il Monotype ha un meta proprio solo sopra OU. */
export function dataSource(format: Format): string {
  if (format.monotype && format.formatId === 'ou') return 'gen9nationaldexmonotype';
  return FORMATS[format.formatId].source;
}

/** Tera ammesso nel formato: vietato in OU, UU e Monotype (il Monotype gioca col meta OU). */
export function teraAllowed(format: Format): boolean {
  return FORMATS[format.formatId].tera && dataSource(format) !== 'gen9nationaldexmonotype';
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
