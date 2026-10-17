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

/** Ultraesplosione: Necrozma-Dusk-Mane o Dawn-Wings con l'Ultranecrozium Z diventa Necrozma-Ultra (come una Mega). */
const ULTRA_BURST = { item: 'ultranecroziumz', itemName: 'Ultranecrozium Z', from: ['Necrozma-Dusk-Mane', 'Necrozma-Dawn-Wings'], forme: 'Necrozma-Ultra' };

/**
 * Forma da mettere nel team per una forma che esiste solo in battaglia grazie a uno strumento
 * (Necrozma-Ultra → Dusk-Mane se il set è fisico, Dawn-Wings se speciale), con quello strumento; null per le altre.
 */
export function teamFormeOf(speciesName: string, evs: Partial<Record<'atk' | 'spa', number>> = {}): { species: string; item: string } | null {
  if (getSpecies(speciesName)?.name !== ULTRA_BURST.forme) return null;
  const special = (evs.spa ?? 0) > (evs.atk ?? 0);
  return { species: ULTRA_BURST.from[special ? 1 : 0], item: ULTRA_BURST.itemName };
}

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
  // Solo la forma base può evolvere (Slowbro-Galar con Slowbronite resta Slowbro-Galar)
  const forme = megaStone?.[species.name]
    ?? (primal && primal[0] === species.name ? primal[1] : undefined)
    ?? (item.id === ULTRA_BURST.item && ULTRA_BURST.from.includes(species.name) ? ULTRA_BURST.forme : undefined)
    ?? itemFormes().get(`${species.name}|${item.id}`);
  return (forme && getSpecies(forme)) || species;
}

let itemFormeCache: Map<string, string> | null = null;
/** Altre forme da battaglia attivate dallo strumento tenuto: Zacian con Rusted Sword → Zacian-Crowned. */
function itemFormes(): Map<string, string> {
  if (!itemFormeCache) {
    itemFormeCache = new Map(dex.species.all()
      // Le forme Tera (Ogerpon) arrivano con la Teracristallizzazione, non con lo strumento
      .filter(s => s.exists && typeof s.battleOnly === 'string' && s.requiredItem && !s.isMega && !s.isPrimal && !s.name.endsWith('-Tera'))
      .map(s => [`${s.battleOnly}|${toID(s.requiredItem!)}`, s.name] as [string, string]));
  }
  return itemFormeCache;
}

/** Abilità in battaglia: una forma Mega/Primal usa la propria abilità, non quella del set base. */
export function battleAbility(set: { species: string; item: string; ability: string }): string {
  const forme = battleSpecies(set);
  return forme && forme.name !== getSpecies(set.species)?.name ? forme.abilities[0] : set.ability;
}

/** Abilità che cambiano sempre una statistica (in battaglia): Huge Power raddoppia l'Attacco, Fur Coat la Difesa… */
const STAT_ABILITIES: Record<string, Partial<Record<'atk' | 'def' | 'spa' | 'spd', number>>> = {
  hugepower: { atk: 2 }, purepower: { atk: 2 }, gorillatactics: { atk: 1.5 }, hustle: { atk: 1.5 },
  furcoat: { def: 2 }, icescales: { spd: 2 }, parentalbond: { atk: 1.25, spa: 1.25 },
};

/** Statistiche base della forma in battaglia, con l'effetto delle abilità che le cambiano sempre. */
export function effectiveStats(set: { species: string; item: string; ability: string }): Species['baseStats'] {
  const species = battleSpecies(set);
  const base = species?.baseStats ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const mult = STAT_ABILITIES[toID(battleAbility(set))];
  if (!mult) return base;
  const stats = { ...base };
  for (const [stat, m] of Object.entries(mult) as ['atk' | 'def' | 'spa' | 'spd', number][]) stats[stat] = Math.round(base[stat] * m);
  return stats;
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
  // Le forme Gigantamax risultano "Past" ma non esistono in National Dex
  return !excluded(species.isNonstandard) && !species.forme.endsWith('Gmax');
}

export function isLegal(species: Species): boolean {
  if (!isSelectable(species)) return false;
  return !BANNED_TIERS.has(natDexTier(species));
}

/** Tier National Dex aggiornati da Showdown (`npm run fetch-data`); senza, quelli della libreria. */
let tierOverrides: Record<string, string> | null = null;
export function initTiers(tiers: Record<string, string> | null): void {
  tierOverrides = tiers;
}

/**
 * Tier National Dex ripulito dalle parentesi ('' se assente). Quello di Showdown aggiorna il tier della libreria
 * (Slowbro passato da OU a UU), ma solo dove la libreria ne ha uno: le forme senza tier restano come sono.
 */
export function natDexTier(species: Species): string {
  const library = String((species as { natDexTier?: string }).natDexTier ?? '');
  return (library ? tierOverrides?.[species.id] ?? library : '').replace(/[()]/g, '');
}

/** Scegliibile nel teambuilder: niente forme che esistono solo in battaglia (tranne Mega e Primal). */
/**
 * Forma solo estetica (Greninja-Bond, Vivillon, Pikachu col cappello…): stesse statistiche e tipi della specie base
 * e abilità che la base ha già. Nei suggerimenti e nella ricerca sarebbe un doppione della base.
 */
export function isCosmeticForme(species: Species): boolean {
  if (species.name === species.baseSpecies || species.battleOnly) return false;
  const base = dex.species.get(species.baseSpecies);
  if (!base?.exists) return false;
  const abilities = Object.values(base.abilities);
  return JSON.stringify(species.baseStats) === JSON.stringify(base.baseStats)
    && species.types.join() === base.types.join()
    && Object.values(species.abilities).every(a => abilities.includes(a));
}

export function isTeambuildable(species: Species): boolean {
  return species.exists && isSelectable(species) && (!species.battleOnly || !!species.isMega || !!species.isPrimal);
}

export function withinGen(species: Species, format: Format): boolean {
  return species.gen <= format.genLimit;
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
