import type { GameId } from './games';

export type FormatId = 'ou' | 'ubers' | 'uu' | 'all' | 'gen9ou' | 'gen9ubers' | 'gen9uu' | 'gen9ag';

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
  /** Se true, il voto usa il meta del formato (tipi pesati per uso, minacce, uso dei membri); se false, tutti i tipi pesano uguale. */
  meta: boolean;
  /** Gioco scelto (blocca il formato, vedi games.ts); null = nessun gioco. */
  game: GameId | null;
  /** Nel gioco: anche i Pokémon che arrivano solo con scambi o da altri giochi. */
  allPokedex: boolean;
  /** Nel gioco: leggendari e misteriosi tra i candidati. */
  legendaries: boolean;
}

export const DEFAULT_FORMAT: Format = {
  formatId: 'ou', genLimit: 9, minUsage: 0.01, allowMultipleMegas: false, ignoreBans: false, meta: true,
  game: null, allPokedex: false, legendaries: false,
};
