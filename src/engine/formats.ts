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

/** Pokédex del menu: Gen 9 (in arrivo), National Dex, Senza limiti. Ogni formato appartiene a uno solo. */
export type DexId = 'gen9' | 'natdex' | 'nolimits';

/** Per ogni Pokédex i suoi tier, nell'ordine del menu; Senza limiti ha un solo formato e nessun tier da scegliere. */
const DEX_TIERS: Record<DexId, { formatId: FormatId; tier: string }[]> = {
  gen9: [],
  natdex: [{ formatId: 'ou', tier: 'OU' }, { formatId: 'ubers', tier: 'Ubers' }, { formatId: 'uu', tier: 'UU' }],
  nolimits: [{ formatId: 'all', tier: '' }],
};
export const DEX_IDS: DexId[] = ['gen9', 'natdex', 'nolimits'];

/** Il Pokédex del formato. */
export const dexOf = (formatId: FormatId): DexId => DEX_IDS.find(dex => DEX_TIERS[dex].some(x => x.formatId === formatId))!;

/** I tier del Pokédex (vuoto se non ancora disponibile). */
export const tiersOf = (dex: DexId): { formatId: FormatId; tier: string }[] => DEX_TIERS[dex];

/** Il formato scelto passando a un altro Pokédex: lo stesso tier se c'è (OU resta OU), altrimenti il primo. */
export function formatInDex(dex: DexId, current: FormatId): FormatId | null {
  const tiers = DEX_TIERS[dex];
  const tier = DEX_TIERS[dexOf(current)].find(x => x.formatId === current)?.tier;
  return (tiers.find(x => x.tier === tier) ?? tiers[0])?.formatId ?? null;
}

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
