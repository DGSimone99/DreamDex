import type { Species } from '@pkmn/dex';
import { getSpecies, toID } from './dex';
import type { Format } from './format';

/** Giochi della serie principale che si possono scegliere (per ora Scarlatto e Violetto, in coppia). */
export type GameId = 'sv';
export const GAME_IDS: GameId[] = ['sv'];
/** La generazione di ogni gioco. */
export const GAME_GEN: Record<GameId, number> = { sv: 9 };

/** Pokédex del gioco preparato da fetch-data (`data/_games/<gioco>.json`): id delle specie dei Pokédex regionali, in ordine regionale. */
export interface GameDexFile { dex: string[] }

type Locked = Pick<Format, 'formatId' | 'meta' | 'genLimit' | 'ignoreBans' | 'allowMultipleMegas'>;

/** Il formato che ogni gioco impone: Scarlatto e Violetto = Gen 9 senza meta (Anything Goes, senza ban per tier). */
export const GAME_LOCK: Record<GameId, Locked> = {
  sv: { formatId: 'gen9ag', meta: false, genLimit: 9, ignoreBans: false, allowMultipleMegas: false },
};

/** Il formato col gioco scelto (e il suo blocco), o senza gioco (opzioni del gioco spente). */
export function withGame(format: Format, game: GameId | null): Format {
  if (!game) return { ...format, game: null, allPokedex: false, legendaries: false };
  return { ...format, ...GAME_LOCK[game], game };
}

export const gameOf = (format: Format): GameId | null => format.game ?? null;

/** Dati del gioco scritti a mano: starter evoluti, esclusive di una versione (id specie), forme di altre regioni catturabili. */
export interface GameInfo { starters: string[]; exclusives: Record<string, 'scarlet' | 'violet'>; extraFormes: string[] }

const family = (version: 'scarlet' | 'violet', ...ids: string[]) => Object.fromEntries(ids.map(id => [id, version]));

/**
 * Esclusive da https://www.serebii.net/scarletviolet/exclusives.shtml (Bulbapedia non si legge in automatico).
 * Vulpix/Ninetales e Sandshrew/Sandslash esclusivi sono le forme di Alola; Tauros: Paldea Fuoco in Scarlatto, Acqua in Violetto.
 */
export const GAMES: Record<GameId, GameInfo> = {
  sv: {
    starters: ['Meowscarada', 'Skeledirge', 'Quaquaval'],
    exclusives: {
      ...family('scarlet', 'vulpixalola', 'ninetalesalola', 'taurospaldeablaze', 'gligar', 'gliscor', 'larvitar', 'pupitar', 'tyranitar',
        'cranidos', 'rampardos', 'drifloon', 'drifblim', 'stunky', 'skuntank', 'deino', 'zweilous', 'hydreigon', 'skrelp', 'dragalge',
        'oranguru', 'cramorant', 'stonjourner', 'armarouge', 'greattusk', 'screamtail', 'brutebonnet', 'fluttermane', 'slitherwing',
        'sandyshocks', 'roaringmoon', 'koraidon', 'walkingwake', 'gougingfire', 'ragingbolt'),
      ...family('violet', 'sandshrewalola', 'sandslashalola', 'taurospaldeaaqua', 'aipom', 'ambipom', 'misdreavus', 'mismagius', 'gulpin',
        'swalot', 'bagon', 'shelgon', 'salamence', 'shieldon', 'bastiodon', 'clauncher', 'clawitzer', 'passimian', 'morpeko', 'dreepy',
        'drakloak', 'dragapult', 'eiscue', 'ceruledge', 'irontreads', 'ironbundle', 'ironhands', 'ironjugulis', 'ironmoth', 'ironthorns',
        'ironvaliant', 'miraidon', 'ironleaves', 'ironboulder', 'ironcrown'),
    },
    extraFormes: ['vulpixalola', 'ninetalesalola', 'sandshrewalola', 'sandslashalola'],
  },
};

const dexes = new Map<GameId, Set<string>>();
/** Posizione di ogni specie nel Pokédex regionale del gioco (l'ordine del file). */
const orders = new Map<GameId, Map<string, number>>();

/** Carica i Pokédex dei giochi (`loadGameDex`); senza, la scelta del gioco resta spenta. */
export function initGames(loaded: Partial<Record<GameId, GameDexFile>> | null): void {
  dexes.clear();
  orders.clear();
  for (const game of GAME_IDS) {
    const file = loaded?.[game];
    if (!file?.dex?.length) continue;
    dexes.set(game, new Set(file.dex));
    orders.set(game, new Map(file.dex.map((id, i) => [id, i])));
  }
}

export const gameReady = (game: GameId): boolean => dexes.has(game);

const LEGENDARY_TAGS = ['Restricted Legendary', 'Sub-Legendary', 'Mythical'];
/** Leggendario o misterioso (tag di @pkmn). */
export const isLegendary = (species: Species): boolean => (species.tags as string[]).some(tag => LEGENDARY_TAGS.includes(tag));

/** Forma di un'altra regione (Alola, Galar, Hisui): non segue la specie, conta solo se catturabile nel gioco. */
const otherRegion = (species: Species) => /^(Alola|Galar|Hisui)/.test(species.forme);

/** La specie (o la forma) si trova nei Pokédex regionali del gioco. */
function inGameDex(species: Species, game: GameId): boolean {
  if (otherRegion(species)) return GAMES[game].extraFormes.includes(species.id);
  return !!dexes.get(game)?.has(toID(species.baseSpecies));
}

/**
 * Il Pokémon si può avere nel gioco del formato: lui o una sua pre-evoluzione nei Pokédex del gioco (coppia di versioni);
 * con "Tutto il Pokédex" tutto ciò che esiste nel gioco. Leggendari e misteriosi solo con la loro opzione. Senza gioco: sempre.
 */
export function obtainableIn(species: Species, format: Format): boolean {
  const game = gameOf(format);
  if (!game) return true;
  if (species.isNonstandard) return false;
  if (isLegendary(species) && !format.legendaries) return false;
  if (format.allPokedex) return true;
  const seen = new Set<string>();
  for (let s: Species | null | undefined = species; s && !seen.has(s.id); s = s.prevo ? getSpecies(s.prevo) : null) {
    seen.add(s.id);
    if (inGameDex(s, game)) return true;
  }
  return false;
}

/** La versione in cui soltanto si trova il Pokémon (null se in entrambe o senza gioco). */
export function exclusiveOf(species: Species, format: Format): 'scarlet' | 'violet' | null {
  const game = gameOf(format);
  return game ? GAMES[game].exclusives[species.id] ?? null : null;
}

/**
 * Ordine del Pokédex nel gioco: prima chi sta nel Pokédex regionale (per posizione), poi gli altri (Tutto il Pokédex) per
 * numero nazionale. Le forme seguono la loro specie.
 */
export function pokedexRank(species: Species, game: GameId): number {
  const index = orders.get(game)?.get(toID(species.baseSpecies));
  return index !== undefined ? index : 100000 + species.num;
}
