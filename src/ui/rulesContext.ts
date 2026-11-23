import { createContext } from 'react';
import type { FormatRules } from '../engine/formatRules';

/** Le regole del formato scelto, per i pezzi che non ricevono i dati (la carta del tooltip: la lista dei ruoli del set). */
export const RulesContext = createContext<FormatRules | null>(null);
