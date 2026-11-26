import type { Species } from '@pkmn/dex';
import { gen9Tier, isSelectable, natDexTier, toID } from './dex';
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
  gen9ubers: { source: 'gen9ubers', banned: new Set(['AG', ...ALWAYS]), tera: true, pokedex: 'sv' },
  gen9uu: { source: 'gen9uu', banned: new Set(['OU', 'UUBL', 'Uber', 'AG', ...ALWAYS]), tera: true, pokedex: 'sv' },
  // Anything Goes: nessun Pokémon vietato, solo quelli ottenibili in Scarlatto/Violetto
  gen9ag: { source: 'gen9anythinggoes', banned: new Set(ALWAYS), tera: true, pokedex: 'sv' },
  // National Dex Doubles: i divieti sono una lista per nome di Showdown, nessun tier del singolo; Tera, Mega e Z ammesse
  natdexdoubles: { source: 'gen9nationaldexdoubles', banned: new Set(ALWAYS), tera: true, pokedex: 'natdex' },
};

const FORMAT_IDS: FormatId[] = ['ou', 'ubers', 'uu', 'all', 'gen9ou', 'gen9ubers', 'gen9uu', 'gen9ag', 'natdexdoubles'];

/** I formati per il menu, con le etichette nella lingua data. */
export const formatOptions = (lang: Lang = 'it'): { id: FormatId; label: string }[] =>
  FORMAT_IDS.map(id => ({ id, label: t(lang, id === 'all' ? 'format.allOption' : `format.${id}`) }));

export const formatLabel = (format: Format, lang: Lang = 'it'): string => t(lang, `format.${format.formatId}`);

/** Pokédex del menu: Gen 9, National Dex, Senza limiti. Ogni formato appartiene a uno solo. */
export type DexId = 'gen9' | 'natdex' | 'nolimits';

/** Tipo di lotta: singolo o doppio (due Pokémon per parte in campo). */
export type BattleId = 'singles' | 'doubles';
export const BATTLE_IDS: BattleId[] = ['singles', 'doubles'];

type TierEntry = { formatId: FormatId; tier: string };
/** Per ogni Pokédex e lotta i suoi tier, nell'ordine del menu; Senza limiti ha un solo formato e nessun tier da scegliere. */
const DEX_TIERS: Record<DexId, Record<BattleId, TierEntry[]>> = {
  gen9: {
    singles: [{ formatId: 'gen9ou', tier: 'OU' }, { formatId: 'gen9ubers', tier: 'Ubers' }, { formatId: 'gen9uu', tier: 'UU' }, { formatId: 'gen9ag', tier: 'Anything Goes' }],
    doubles: [],
  },
  natdex: {
    singles: [{ formatId: 'ou', tier: 'OU' }, { formatId: 'ubers', tier: 'Ubers' }, { formatId: 'uu', tier: 'UU' }],
    doubles: [{ formatId: 'natdexdoubles', tier: 'OU' }],
  },
  nolimits: { singles: [{ formatId: 'all', tier: '' }], doubles: [] },
};
export const DEX_IDS: DexId[] = ['gen9', 'natdex', 'nolimits'];

const entryOf = (formatId: FormatId): { dex: DexId; battle: BattleId; tier: string } => {
  for (const dex of DEX_IDS) for (const battle of BATTLE_IDS) {
    const entry = DEX_TIERS[dex][battle].find(x => x.formatId === formatId);
    if (entry) return { dex, battle, tier: entry.tier };
  }
  throw new Error(`Formato sconosciuto: ${formatId}`);
};

/** Il Pokédex del formato. */
export const dexOf = (formatId: FormatId): DexId => entryOf(formatId).dex;

/** I tier del Pokédex per quella lotta (vuoto se non c'è). */
export const tiersOf = (dex: DexId, battle: BattleId = 'singles'): TierEntry[] =>
  DEX_TIERS[dex][battle];

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

/** Tier del Pokémon nel formato: quello di Gen 9 per Scarlatto/Violetto, altrimenti quello National Dex. */
export const tierIn = (species: Species, format: Format): string =>
  (pokedexOf(format) === 'sv' ? gen9Tier(species) : natDexTier(species));

/** Mosse, abilità, strumenti e Pokémon vietati per nome in un formato (da Showdown, `npm run fetch-data`). */
export interface FormatBans {
  moves: string[];
  abilities: string[];
  items: string[];
  species: string[];
}
let bans: Partial<Record<FormatId, FormatBans>> | null = null;
export function initBans(loaded: Partial<Record<FormatId, FormatBans>> | null): void {
  bans = loaded;
}

export function isBannedIn(species: Species, format: Format): boolean {
  if (format.ignoreBans) return false;
  return FORMATS[format.formatId].banned.has(tierIn(species, format))
    || !!bans?.[format.formatId]?.species.some(name => toID(name) === species.id);
}

/** Il nome (mossa, abilità o strumento) è vietato nel formato con quell'id. */
export function isBannedName(formatId: FormatId | undefined, kind: 'moves' | 'abilities' | 'items', name: string): boolean {
  const list = formatId ? bans?.[formatId] : undefined;
  return !!list && !!name && list[kind].some(n => toID(n) === toID(name));
}

/** Mosse, abilità e strumento del set vietati nel formato (Shed Tail in Gen 9 OU, King's Rock…). */
export function bannedParts(set: { moves: string[]; ability: string; item: string }, format: Format): { moves: string[]; ability: string | null; item: string | null } {
  const list = format.ignoreBans ? null : bans?.[format.formatId];
  if (!list) return { moves: [], ability: null, item: null };
  const has = (names: string[], name: string) => !!name && names.some(n => toID(n) === toID(name));
  return {
    moves: set.moves.filter(move => has(list.moves, move)),
    ability: has(list.abilities, set.ability) ? set.ability : null,
    item: has(list.items, set.item) ? set.item : null,
  };
}

/** Perché un Pokémon non è legale nel formato (null se lo è): per spiegarlo invece di dire solo "non legale". */
export type IllegalReason = { kind: 'notSelectable' } | { kind: 'notInPokedex' } | { kind: 'tier'; tier: string } | { kind: 'banned' };
export function illegalReason(species: Species, format: Format): IllegalReason | null {
  if (!isSelectable(species)) return { kind: 'notSelectable' };
  if (!speciesInPokedex(species, format)) return { kind: 'notInPokedex' };
  if (format.ignoreBans) return null;
  const tier = tierIn(species, format);
  if (FORMATS[format.formatId].banned.has(tier)) return { kind: 'tier', tier };
  if (bans?.[format.formatId]?.species.some(name => toID(name) === species.id)) return { kind: 'banned' };
  return null;
}

export function isLegalIn(species: Species, format: Format): boolean {
  return isSelectable(species) && speciesInPokedex(species, format) && !isBannedIn(species, format);
}

/** Il formato nell'indirizzo del Pokédex di Smogon (/dex/sv/pokemon/<nome>/<formato>/); null senza un formato Smogon. */
const SMOGON_FORMATS: Record<FormatId, string | null> = {
  ou: 'national-dex', ubers: 'national-dex-ubers', uu: 'national-dex-uu', all: null,
  gen9ou: 'ou', gen9ubers: 'uber', gen9uu: 'uu', gen9ag: 'ag',
  // Nessun indirizzo dell'analisi in doppio: si apre la pagina generale del Pokémon
  natdexdoubles: null,
};

/**
 * Pagina del Pokémon sul Pokédex di Smogon: l'analisi del formato se `analysed` (ci sono suoi preset Smogon
 * per quel formato), altrimenti la pagina generale. I formati dell'app sono tutti di Scarlatto/Violetto (sv).
 */
export function smogonUrl(speciesName: string, format: Format, analysed: boolean): string {
  const slug = speciesName.toLowerCase().replace(/['’.:%]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tier = analysed ? SMOGON_FORMATS[format.formatId] : null;
  return `https://www.smogon.com/dex/sv/pokemon/${slug}/${tier ? `${tier}/` : ''}`;
}

/** Il Pokémon ha un'analisi Smogon nel formato: un preset che viene proprio dalla fonte del formato. */
export const hasSmogonAnalysis = (presets: { format: string }[], format: Format): boolean =>
  !!SMOGON_FORMATS[format.formatId] && presets.some(p => p.format === FORMATS[format.formatId].source);
