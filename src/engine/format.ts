import type { GameId } from './games';

/**
 * La generazione più recente: i dati del Pokédex (dex.ts), il calcolo dei danni (damage.ts) e il limite di generazione
 * di base. I formati delle generazioni passate dovranno sceglierla per formato, e togliere dexGen9Only in vite.config.ts.
 */
export const LATEST_GEN = 9;

export type FormatId = 'ou' | 'ubers' | 'uu' | 'all' | 'gen9ou' | 'gen9ubers' | 'gen9uu' | 'gen9ag' | 'natdexdoubles';

export interface Format {
  formatId: FormatId;
  /** Generazione d'origine massima per specie/forme (1–9). */
  genLimit: number;
  /** Uso minimo (frazione 0–1) per essere candidato. */
  minUsage: number;
  /** Se true, più Mega nello stesso team sono accettate (formati personalizzati, hackrom). */
  allowMultipleMegas: boolean;
  /** Se true, nessun Pokémon è bannato nel formato scelto. */
  ignoreBans: boolean;
  /** Se true, il voto usa il meta del formato (tipi pesati per uso, minacce, uso dei membri); se false (Giochi, No Format), tutti i tipi pesano uguale. Lo decide la famiglia del formato (formatChoice.ts). */
  meta: boolean;
  /** Gioco scelto (blocca il formato, vedi games.ts); null = nessun gioco. */
  game: GameId | null;
  /** Nel gioco: anche i Pokémon che arrivano solo con scambi o da altri giochi. */
  allPokedex: boolean;
  /** Nel gioco: leggendari e misteriosi tra i candidati. */
  legendaries: boolean;
}

export const DEFAULT_FORMAT: Format = {
  formatId: 'ou', genLimit: LATEST_GEN, minUsage: 0.01, allowMultipleMegas: false, ignoreBans: false, meta: true,
  game: null, allPokedex: false, legendaries: false,
};
