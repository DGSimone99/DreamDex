import type { Lang } from '../i18n';
import type { Archetype } from './archetype';
import { rankedAdditions, rankedReplacements } from './coachFixes';
import type { EngineData } from './data';
import { searchCandidates, searchPool, type CandidateFilters } from './filters';
import type { Format } from './format';
import { improveReplacements, keepersFirst, type Replacement } from './replace';
import { scoreSets, suggest, type Suggestion } from './scoring';
import { battleName, getSpecies } from './dex';
import { GAMES, gameOf, obtainableIn, pokedexRank } from './games';
import { isUserBanned } from './lists';
import { defaultSet } from './sets';
import type { TeamSet } from './sets';
import { rulesOf } from './formatRules';
import { aloneGains, bestSwaps, rankByTeamGain, swapsPerMember, type SwapOption, type SwapReport, type TeamGain } from './teamGain';

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
/**
 * Nel gioco i tre starter evoluti vanno in cima alle aggiunte (nell'ordine del gioco), se non sono già nel team, si
 * possono avere e l'utente non li ha bannati; quelli che non erano in lista si valutano a parte. Senza gioco: la lista com'è.
 */
export function startersFirst(items: RankedCandidate[], team: TeamSet[], format: Format, data: EngineData, lang: Lang,
  rank: (list: (Suggestion | Replacement)[]) => RankedCandidate[]): RankedCandidate[] {
  const game = gameOf(format);
  // Senza statistiche (dati del formato in arrivo) la lista è vuota: niente starter da soli con set inventati
  if (!game || !data.stats) return items;
  const numbers = new Set(team.map(set => getSpecies(set.species)?.num));
  const starters = GAMES[game].starters.map(getSpecies)
    .filter(s => !!s && !numbers.has(s.num) && obtainableIn(s, format))
    .map(s => s!.name);
  const found = starters.map(name => items.find(item => battleName(item.set) === name)
    ?? rank(scoreSets(team, format, data, [defaultSet(data, name, format.genLimit)], lang))[0])
    .filter((item): item is RankedCandidate => !!item && !isUserBanned(item.set, data.userLists));
  const top = new Set(found.map(item => battleName(item.set)));
  return [...found, ...items.filter(item => !top.has(battleName(item.set)))].slice(0, MAX);
}

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
      return bestSwaps(team, data, lang, index => improveReplacements(team, index, format, data, swapsPerMember(rulesOf(data)), pool, lang, archetype), { archetype, report }).slice(0, MAX);
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
    // Nel gioco, a team vuoto: tutti gli ottenibili (evoluzioni finali) in ordine di Pokédex, senza voti né uso nel meta
    const game = gameOf(format);
    // (come senza gioco, aspetta le statistiche del formato: prima i set sarebbero inventati e i voti provvisori)
    if (game && team.length === 0) {
      if (!data.stats) return [];
      const order = (item: Suggestion) => { const s = getSpecies(battleName(item.set)); return s ? pokedexRank(s, game) : Infinity; };
      return aloneGains(suggest(team, format, data, Infinity, lang).sort((a, b) => order(a) - order(b)), data, lang);
    }
    const additions = data.stats ? rankedAdditions(team, format, data, POOL, lang, archetype, report).slice(0, MAX) : [];
    return startersFirst(additions, team, format, data, lang, rank);
  })();
  return { items, excluded: report.excluded };
}
