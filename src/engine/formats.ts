import type { Item, Move, Species } from '@pkmn/dex';
import { gen9Tier, isSelectable, natDexTier } from './dex';
import type { Format, FormatId } from './format';
import { t, type Lang } from '../i18n';

/** Da dove vengono Pokémon, mosse e strumenti: tutto il National Dex o solo Scarlatto/Violetto. */
export type Pokedex = 'natdex' | 'sv';

interface FormatDef {
  source: string;
  banned: Set<string>;
  /** Teracristallizzazione ammessa (vietata in National Dex OU e UU). */
  tera: boolean;
  pokedex: Pokedex;
}

const ALWAYS = ['Illegal', 'Unreleased'];

const FORMATS: Record<FormatId, FormatDef> = {
  ou: { source: 'gen9nationaldex', banned: new Set(['Uber', 'AG', ...ALWAYS]), tera: false, pokedex: 'natdex' },
  ubers: { source: 'gen9nationaldexubers', banned: new Set(['AG', ...ALWAYS]), tera: true, pokedex: 'natdex' },
  uu: { source: 'gen9nationaldexuu', banned: new Set(['OU', 'UUBL', 'Uber', 'AG', ...ALWAYS]), tera: false, pokedex: 'natdex' },
  all: { source: 'gen9nationaldexubers', banned: new Set(), tera: true, pokedex: 'natdex' },
  gen9ou: { source: 'gen9ou', banned: new Set(['Uber', 'AG', ...ALWAYS]), tera: true, pokedex: 'sv' },
};

const FORMAT_IDS: FormatId[] = ['ou', 'ubers', 'uu', 'all', 'gen9ou'];

/** I formati per il menu, con le etichette nella lingua data. */
export const formatOptions = (lang: Lang = 'it'): { id: FormatId; label: string }[] =>
  FORMAT_IDS.map(id => ({ id, label: t(lang, id === 'all' ? 'format.allOption' : `format.${id}`) }));

export const formatLabel = (format: Format, lang: Lang = 'it'): string => t(lang, `format.${format.formatId}`);

/** Pokédex del menu: Gen 9, National Dex, Senza limiti. Ogni formato appartiene a uno solo. */
export type DexId = 'gen9' | 'natdex' | 'nolimits';

/** Per ogni Pokédex i suoi tier, nell'ordine del menu; Senza limiti ha un solo formato e nessun tier da scegliere. */
const DEX_TIERS: Record<DexId, { formatId: FormatId; tier: string }[]> = {
  gen9: [{ formatId: 'gen9ou', tier: 'OU' }],
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

/** Pokédex del formato: National Dex o solo Scarlatto/Violetto. */
export const pokedexOf = (format: Format): Pokedex => FORMATS[format.formatId].pokedex;
/** Pokédex di un formato dal suo id (per i dati, che conoscono solo l'id). */
export const pokedexOfId = (formatId: FormatId): Pokedex => FORMATS[formatId].pokedex;

/** In Scarlatto/Violetto esiste solo ciò che la libreria non segna come non standard (niente Mega, Z, mosse del passato). */
const inSV = (thing: { isNonstandard?: string | null }) => !thing.isNonstandard;

/** Il Pokémon esiste nel Pokédex del formato. */
export const speciesInPokedex = (species: Species, format: Format): boolean => pokedexOf(format) !== 'sv' || inSV(species);
/** La mossa esiste nel Pokédex del formato. */
export const moveInPokedex = (move: Move, format: Format): boolean => pokedexOf(format) !== 'sv' || inSV(move);
/** Lo strumento esiste nel Pokédex del formato. */
export const itemInPokedex = (item: Item, format: Format): boolean => pokedexOf(format) !== 'sv' || inSV(item);

/** Tier del Pokémon nel formato: quello di Gen 9 per Scarlatto/Violetto, altrimenti quello National Dex. */
export const tierIn = (species: Species, format: Format): string =>
  (pokedexOf(format) === 'sv' ? gen9Tier(species) : natDexTier(species));

export function isBannedIn(species: Species, format: Format): boolean {
  return !format.ignoreBans && FORMATS[format.formatId].banned.has(tierIn(species, format));
}

export function isLegalIn(species: Species, format: Format): boolean {
  return isSelectable(species) && speciesInPokedex(species, format) && !isBannedIn(species, format);
}
