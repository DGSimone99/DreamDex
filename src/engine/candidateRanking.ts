import type { Lang } from '../i18n';
import type { Archetype } from './archetype';
import { rankedAdditions, rankedReplacements } from './coachFixes';
import type { EngineData } from './data';
import { searchCandidates, searchPool, type CandidateFilters } from './filters';
import type { Format } from './format';
import { improveReplacements, keepersFirst, type Replacement } from './replace';
import type { Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { bestSwaps, rankByTeamGain, SWAPS_PER_MEMBER, type SwapOption, type SwapReport, type TeamGain } from './teamGain';

/** Candidati in tutto; il voto del team si calcola sui primi POOL per punteggio. */
export const MAX = 50;
const POOL = 100;

/** Un candidato della lista: aggiunta, sostituto o scambio libero, col voto che darebbe al team. */
export type RankedCandidate = (Suggestion | Replacement) & { teamGain?: TeamGain; replaces?: number; alternatives?: SwapOption[] };

/** Tutto quello che decide la lista dei candidati (oltre ai dati). */
export interface RankingParams {
  team: TeamSet[];
  replaceIndex: number | null;
  format: Format;
  scope: 'add' | 'all';
  archetype?: Archetype;
  /** Ricerca e filtri già "stabili" (dopo il ritardo di battitura). */
  applied: CandidateFilters;
  filtering: boolean;
  lang: Lang;
}

export interface RankingResult {
  items: RankedCandidate[];
  /** Quanti cambi ha escluso il tipo di team scelto (per dire perché la lista è vuota). */
  excluded: number;
}

/**
 * La lista dei candidati della scheda Pokémon: prima i migliori per punteggio, poi ordinati per il voto che darebbero
 * al team. È il calcolo lento dell'app (un voto intero per ogni candidato): nel browser gira in sottofondo
 * (rankingWorker.ts), così il team si aggiorna subito e la lista arriva appena è pronta.
 */
export function rankCandidates(params: RankingParams, data: EngineData): RankingResult {
  const { team, format, archetype, applied, filtering, lang } = params;
  const report: SwapReport = { excluded: 0 };
  const replaceIndex = params.replaceIndex !== null && params.replaceIndex < team.length ? params.replaceIndex : null;
  const rank = (list: (Suggestion | Replacement)[], sort = true) => rankByTeamGain(list, team, replaceIndex, data, lang, sort, archetype, report).slice(0, MAX);
  const items = ((): RankedCandidate[] => {
    if (replaceIndex === null && team.length >= 2 && (params.scope === 'all' || team.length >= 6)) {
      // Raccomandazioni libere: per ogni candidato, il membro che conviene di più sostituire
      const pool = filtering ? searchPool(team, format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      return bestSwaps(team, data, lang, index => improveReplacements(team, index, format, data, SWAPS_PER_MEMBER, pool, lang, archetype), { archetype, report }).slice(0, MAX);
    }
    if (replaceIndex !== null) {
      // Con ricerca o filtri i sostituti vengono da tutto il Pokédex, non solo dalle statistiche
      const pool = filtering ? searchPool(team.filter((_, i) => i !== replaceIndex), format, data, applied) : undefined;
      if (!pool && !data.stats) return [];
      // Senza filtri: la classifica condivisa col Coaching. Chi porta il meteo/campo necessario resta in cima
      return keepersFirst(pool ? rank(improveReplacements(team, replaceIndex, format, data, POOL, pool, lang, archetype))
        : rankedReplacements(team, replaceIndex, format, data, POOL, lang, archetype, report).slice(0, MAX));
    }
    if (filtering) return rank(searchCandidates(team, format, data, applied, POOL, lang));
    return data.stats ? rankedAdditions(team, format, data, POOL, lang, archetype, report).slice(0, MAX) : [];
  })();
  return { items, excluded: report.excluded };
}
