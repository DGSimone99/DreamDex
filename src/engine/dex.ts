import { Dex } from '@pkmn/dex';
import type { Move, Species } from '@pkmn/dex';
import { LATEST_GEN, type Format } from './format';

export const dex = Dex.forGen(LATEST_GEN);

// Il voto la chiede milioni di volte sugli stessi nomi (mosse, abilità, strumenti): si ricorda il risultato
const ids = new Map<string, string>();
export const toID = (text: string): string => {
  let id = ids.get(text);
  if (id === undefined) {
    id = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ids.size >= 50000) ids.clear();
    ids.set(text, id);
  }
  return id;
};

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
// Dipende solo da specie e strumento: si calcola una volta per coppia (il voto la chiede migliaia di volte)
const battleSpeciesCache = new Map<string, Map<string, Species | null>>();
export function battleSpecies(set: { species: string; item: string }): Species | null {
  let byItem = battleSpeciesCache.get(set.species);
  if (!byItem) battleSpeciesCache.set(set.species, (byItem = new Map()));
  let cached = byItem.get(set.item);
  if (cached === undefined) {
    cached = findBattleSpecies(set);
    byItem.set(set.item, cached);
  }
  return cached;
}

/**
 * Forme che il Pokémon prende sempre in battaglia, senza strumento: Terapagos entra Terastal (Tera Shift), Palafin
 * combatte Hero (Zero to Hero dopo il primo cambio), Wishiwashi in banco (Schooling dal livello 20). Nelle statistiche
 * Smogon restano col nome base (`battleName`).
 */
const ALWAYS_FORMES: Record<string, string> = { terapagos: 'Terapagos-Terastal', palafin: 'Palafin-Hero', wishiwashi: 'Wishiwashi-School' };
const ALWAYS_BASE = new Map(Object.entries(ALWAYS_FORMES).map(([base, forme]) => [forme, base]));

function findBattleSpecies(set: { species: string; item: string }): Species | null {
  const species = getSpecies(set.species);
  const always = species && ALWAYS_FORMES[species.id];
  if (always) return getSpecies(always) ?? species;
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
  // Mega e Primal hanno una sola abilità: vale anche se il set dichiara quella della forma base (Groudon-Primal con Drought)
  if (forme && (forme.isMega || forme.isPrimal)) return forme.abilities[0];
  return forme && forme.name !== getSpecies(set.species)?.name ? forme.abilities[0] : set.ability;
}

/**
 * Priorità della mossa col set: quella della mossa più quella dell'abilità. Gale Wings +1 alle mosse Volante (a PS pieni:
 * conta come sempre, come le altre priorità), Triage +3 alle mosse che curano o assorbono (Draining Kiss, Drain Punch).
 * Prankster vale solo per le mosse di stato, che non attaccano.
 */
export function movePriority(set: { species: string; item: string; ability: string }, move: Move): number {
  const ability = toID(battleAbility(set));
  if (ability === 'galewings' && move.type === 'Flying') return move.priority + 1;
  if (ability === 'triage' && (move.flags.heal || move.drain)) return move.priority + 3;
  return move.priority;
}

/** Il set ha una mossa d'attacco con priorità (anche dall'abilità: Gale Wings, Triage). */
export function hasPriorityAttack(set: { species: string; item: string; ability: string; moves: string[] }): boolean {
  // Upper Hand funziona solo contro una mossa con priorità: non è una priorità su cui contare
  return set.moves.some(m => { const move = getMove(m); return !!move && move.category !== 'Status' && move.id !== 'upperhand' && movePriority(set, move) > 0; });
}

/** Abilità che cambiano sempre una statistica (in battaglia): Huge Power raddoppia l'Attacco, Fur Coat la Difesa… */
export const STAT_ABILITIES: Record<string, Partial<Record<'atk' | 'def' | 'spa' | 'spd', number>>> = {
  hugepower: { atk: 2 }, purepower: { atk: 2 }, gorillatactics: { atk: 1.5 },
  // Hustle: Attacco ×1,5 ma le mosse fisiche mirano all'80%: in tutto ×1,2
  hustle: { atk: 1.2 },
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
export const battleName = (set: { species: string; item: string }): string => {
  const name = battleSpecies(set)?.name;
  return (name && ALWAYS_BASE.has(name) ? getSpecies(ALWAYS_BASE.get(name)!)?.name : name) ?? set.species;
};

/** Vero se il set è una Mega in battaglia (pietra o forma Mega). Le forme Primal non contano. */
export const isMega = (set: { species: string; item: string }): boolean =>
  !!battleSpecies(set)?.isMega;

const moveCache = new Map<string, Move | null>();
export function getMove(name: string): Move | null {
  if (!name) return null;
  let move = moveCache.get(name);
  if (move === undefined) {
    const found = dex.moves.get(name);
    move = found?.exists ? found : null;
    moveCache.set(name, move);
  }
  return move;
}

export function isSelectable(species: Species): boolean {
  // Le forme Gigantamax risultano "Past" ma non esistono in National Dex
  return !excluded(species.isNonstandard) && !species.forme.endsWith('Gmax');
}

export function isLegal(species: Species): boolean {
  if (!isSelectable(species)) return false;
  return !BANNED_TIERS.has(natDexTier(species));
}

/** Tier aggiornati da Showdown (`npm run fetch-data`): National Dex e Gen 9; senza, quelli della libreria. */
export interface TierOverrides {
  natdex: Record<string, string>;
  gen9: Record<string, string>;
}
let tierOverrides: TierOverrides | null = null;
export function initTiers(tiers: TierOverrides | null): void {
  tierOverrides = tiers;
}

/**
 * Tier National Dex ripulito dalle parentesi ('' se assente). Quello di Showdown aggiorna il tier della libreria
 * (Slowbro passato da OU a UU), ma solo dove la libreria ne ha uno: le forme senza tier restano come sono.
 */
export function natDexTier(species: Species): string {
  const library = String((species as { natDexTier?: string }).natDexTier ?? '');
  return (library ? tierOverrides?.natdex[species.id] ?? library : '').replace(/[()]/g, '');
}

/** Tier di Gen 9 (Scarlatto/Violetto), con lo stesso aggiornamento da Showdown. */
export function gen9Tier(species: Species): string {
  const library = String(species.tier ?? '');
  return (library ? tierOverrides?.gen9[species.id] ?? library : '').replace(/[()]/g, '');
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
