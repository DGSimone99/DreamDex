export interface Format {
  id: 'gen9nationaldex';
  /** Generazione d'origine massima per specie/forme (1–9). */
  genLimit: number;
  /** Uso minimo (frazione 0–1) per essere candidato. */
  minUsage: number;
  /** Se true, più Mega nello stesso team sono accettate (formati personalizzati, hackrom). */
  allowMultipleMegas: boolean;
}

export const DEFAULT_FORMAT: Format = { id: 'gen9nationaldex', genLimit: 9, minUsage: 0.01, allowMultipleMegas: false };
