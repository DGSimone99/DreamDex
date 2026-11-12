import { fitsArchetype, teamArchetype, type Archetype, type FitArchetype, type TeamStyle } from './archetype';
import { alignMoves, bestCoherentPreset } from './bestPreset';
import { coherenceGaps, contradictorySet, type Gap } from './coherence';
import type { EngineData } from './data';
import { applyFavorites, isUserFavorite } from './lists';
import { battleAbility, battleName, battleSpecies, isMega, toID } from './dex';
import type { Format } from './format';
import { formatRules } from './formatRules';
import { pokedexOf } from './formats';
import { rateTeam } from './rating';
import { detectRoles, isPassive } from './roles';
import { defensiveMultiplier, type TypeName } from './types';
import { scoreSets, suggest, type Suggestion } from './scoring';
import { asSetter, asUser, stylePool } from './styleSets';
import { presetsForSet, type TeamSet } from './sets';
import { benefits, enables, opposesWeather, type Condition } from './synergy';

/** Stili che si possono chiedere a Completa team: meteo e Trick Room (il "motore" del team). */
export type FillStyle = 'rain' | 'sun' | 'sand' | 'snow' | 'trickroom';
export const FILL_STYLES: FillStyle[] = ['rain', 'sun', 'sand', 'snow', 'trickroom'];

/**
 * Preferiti dell'utente tra i Pokémon nuovi: 'off' nessuna precedenza, 'priority' passano davanti a voto quasi pari,
 * 'only' i nuovi arrivano solo dai preferiti.
 */
export type FavoriteMode = 'off' | 'priority' | 'only';

/** Tipo e stile chiesti (null = qualsiasi), i preferiti e quali set dei membri attuali tenere. */
export interface FillChoice {
  archetype: Archetype | null;
  style: FillStyle | null;
  /** Senza, 'priority'. */
  favorites?: FavoriteMode;
  /** Uno per membro attuale, true = il set resta com'è; senza, si tengono tutti. */
  keepSets?: boolean[];
}

/** La scelta di partenza: il migliore, nessuna condizione, priorità ai preferiti, tutti i set tenuti. */
export const defaultChoice = (team: TeamSet[]): FillChoice =>
  ({ archetype: null, style: null, favorites: 'priority', keepSets: team.map(() => true) });

export interface Proposal {
  /** I Pokémon nuovi, nell'ordine in cui entrano. */
  added: TeamSet[];
  /** Il team attuale più i nuovi. */
  team: TeamSet[];
  overall: number;
  grade: string;
  archetype: Archetype;
  styles: TeamStyle[];
  /**
   * Cosa manca al team proposto (trappole, chi le toglie, tre deboli allo stesso tipo): [] se niente. Non vuoto solo
   * quando nessun completamento del giro ci riesce (di solito per colpa dei membri attuali).
   */
  gaps: Gap[];
  /** Posizioni dei membri attuali il cui set è cambiato (solo quelli senza "Tieni il set"). */
  changed: number[];
  /** Quanti dei nuovi sono preferiti dell'utente. */
  favorites: number;
}

export const PROPOSALS_PER_ROUND = 7;

/**
 * Come finisce un giro: 'complete' con PROPOSALS_PER_ROUND proposte; 'stopped' con meno, fermato dai tentativi a vuoto
 * (MAX_ATTEMPTS, o MAX_MISSES di fila) o da un buco che i candidati rimasti non chiudono: un altro giro, con più
 * esclusi e tentativi nuovi, può trovarne altre; 'exhausted' quando non c'è altro (nessun candidato per il primo posto, oppure nessuna proposta:
 * con gli stessi esclusi il giro dopo sarebbe identico).
 */
export type FillEnd = 'complete' | 'stopped' | 'exhausted';
/** Voto minimo di una proposta: sotto non si mostra, e il motore cerca un'altra strada. */
export const MIN_OVERALL = 70;
/** Candidati per slot, dopo le restrizioni di tipo, stile e Mega. */
export const CANDIDATES = 25;
/** Candidati per slot su cui si calcola il voto del team. */
export const RATE_TOP = 10;
/** Alternative provate al penultimo slot quando l'ultimo non trova un team del tipo chiesto. */
export const BACKTRACK_ALTERNATIVES = 3;
/**
 * Tentativi a vuoto, in tutto il giro, prima di arrendersi: ogni tentativo scarta una strada e ne prova un'altra, così
 * un giro difficile (es. Hyper Offense da zero) arriva più spesso a PROPOSALS_PER_ROUND.
 */
export const MAX_ATTEMPTS = 32;
/** Tentativi a vuoto di fila, dall'ultima proposta: un giro che non trova più strade si ferma prima di MAX_ATTEMPTS. */
export const MAX_MISSES = 16;
/** Pokémon fuori dal meta valutati per slot quando serve chi porta o sfrutta lo stile. */
export const STYLE_POOL = 20;
/** Membri che sfruttano il meteo, oltre a chi lo porta (se ce ne sono abbastanza). */
export const WEATHER_USERS = 2;
/** Precedenza, in punti di voto, per chi sfrutta il meteo negli altri slot: vince con fino a 3 punti in meno, non oltre. */
export const WEATHER_BONUS = 3;
/** Quanti tra chi sfrutta il meteo si aggiungono ai candidati valutati in uno slot libero. */
export const WEATHER_EXTRA = 3;
/** Negli slot prima dell'ultimo, precedenza in punti di voto per chi porta un ruolo che manca (trappole, chi le toglie). */
export const COHERENCE_BONUS = 3;
/** All'ultimo slot, quanti candidati senza buchi si controllano al massimo per tipo e stile prima di accettarne con buchi. */
export const COHERENT_CHECKS = 50;
/** Con 'priority', una proposta con preferiti passa davanti a una senza che ha fino a 5 punti di voto in più. */
export const FILL_FAVORITE_MARGIN = 5;

/**
 * Ordine delle proposte: con 'priority' conta il voto più FILL_FAVORITE_MARGIN se c'è almeno un preferito (a pari
 * valore, più preferiti, poi il voto); negli altri modi solo il voto.
 */
export function proposalOrder(a: Proposal, b: Proposal, mode: FavoriteMode): number {
  if (mode !== 'priority') return b.overall - a.overall;
  const key = (p: Proposal) => p.overall + (p.favorites > 0 ? FILL_FAVORITE_MARGIN : 0);
  return key(b) - key(a) || b.favorites - a.favorites || b.overall - a.overall;
}

/** Il team completo ha il tipo e lo stile chiesti (secondo teamArchetype). */
export function matchesChoice(team: TeamSet[], choice: FillChoice, format: Format): boolean {
  const found = teamArchetype(team, formatRules(format.formatId));
  if (!found) return false;
  if (choice.archetype && found.archetype !== choice.archetype) return false;
  return !choice.style || found.styles.includes(choice.style);
}

// Chi porta la condizione e chi la sfrutta, con le stesse eccezioni di teamArchetype
const setsUp = (set: TeamSet, condition: Condition) => enables(set).some(e => e.condition === condition && toID(e.via) !== 'chillyreception');
const uses = (set: TeamSet, condition: Condition) => benefits(set).some(b => b.condition === condition && toID(b.via) !== 'weatherball');
const FIT: Partial<Record<Archetype, FitArchetype>> = { stall: 'stall', semiStall: 'stall', hyperOffense: 'hyperOffense', bulkyOffense: 'bulkyOffense' };

/**
 * Muri passivi da raggiungere per tipo (come li conta la regola dei muri di teamArchetype): Stall 6, Semi-Stall 4–5,
 * Balance 3, Offense nessuno. In National Dex OU il tipo si riconosce dal recupero e dalla velocità: la quota resta la
 * strada per costruire, e matchesChoice controlla il tipo con la regola del formato.
 */
const PASSIVE_QUOTA: Record<Archetype, number> = { stall: 6, semiStall: 4, balance: 3, hyperOffense: 0, bulkyOffense: 0 };
/** Un Pokémon si distingue per forma in battaglia: Charizard, Charizard-Mega-X e Charizard-Mega-Y sono tre Pokémon. */
export const formeId = (set: TeamSet) => toID(battleName(set));
const sameGap = (a: Gap, b: Gap) => a.kind === b.kind && (a.kind !== 'weakness' || (b.kind === 'weakness' && a.type === b.type));
const ROLE_GAPS = ['hazards', 'removal'] as const;
const sameSet = (a: TeamSet, b: TeamSet) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Completamenti del team del tipo (e dello stile) chiesti, uno alla volta, al massimo PROPOSALS_PER_ROUND.
 * Nessun Pokémon si ripete: `exclude` (forme) parte con quelle già mostrate e cresce con ogni proposta; fa eccezione
 * chi porta lo stile, che torna solo quando non ce n'è uno nuovo. Se il formato ammette le Mega, ogni proposta ne ha
 * una (mai una seconda). I nuovi non hanno mai set contraddittori. Trappole, chi le toglie e debolezze in comune
 * (`coherenceGaps`) sono rigide: una proposta con un buco esce solo se nessun candidato del giro lo può chiudere (es.
 * cinque membri e nessuno che toglie le trappole), oppure, se nessuna proposta del giro ci riesce, le migliori con la
 * nota (`gaps`). I preferiti seguono `choice.favorites`; i membri con `keepSets[i] === false` prendono il preset
 * migliore e sensato (`changed`).
 * Dopo ogni tentativo a vuoto produce `null`: chi consuma il generatore può rendere il controllo. Alla fine restituisce
 * come è finito il giro (`FillEnd`).
 */
export function* fillProposals(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData, minOverall = MIN_OVERALL,
): Generator<Proposal | null, FillEnd, undefined> {
  if (!data.stats || team.length >= 6) return 'exhausted';
  const rules = formatRules(format.formatId);
  // Già mostrati prima di questo giro: i candidati del giro sono tutti gli altri
  const shownBefore = new Set(exclude);
  const megasAllowed = pokedexOf(format) === 'natdex';
  const passive = (set: TeamSet) => isPassive(set, rules);
  const favoriteMode = choice.favorites ?? 'priority';
  const favorite = (set: TeamSet) => isUserFavorite(set, data.userLists);
  // Con 'only' i nuovi arrivano solo dai preferiti
  const allowed = (set: TeamSet) => favoriteMode !== 'only' || favorite(set);
  /**
   * Il set (dopo `adapt`, se c'è) se non è contraddittorio; se lo è, il primo preset dello stesso Pokémon (stessa
   * forma) che non lo è; se nessuno va, null e il Pokémon si scarta.
   */
  const sensible = (set: TeamSet, adapt: (set: TeamSet) => TeamSet | null = s => s): TeamSet | null => {
    const first = adapt(set);
    if (first && !contradictorySet(first)) return first;
    for (const preset of presetsForSet(data, set, format.genLimit)) {
      if (formeId(preset.set) !== formeId(set)) continue;
      const next = adapt(preset.set);
      if (next && !contradictorySet(next)) return next;
    }
    return null;
  };
  const sensibleAll = (source: Suggestion[], adapt?: (set: TeamSet) => TeamSet | null) =>
    source.map(s => { const set = sensible(s.set, adapt); return set ? (set === s.set ? s : { ...s, set }) : null; })
      .filter((s): s is Suggestion => !!s);
  // Ruoli per set (gli stessi set tornano a ogni slot)
  const roleSets = new Map<TeamSet, string[]>();
  const rolesOf = (set: TeamSet) => {
    let roles = roleSets.get(set);
    if (!roles) roleSets.set(set, (roles = detectRoles(set, rules) as string[]));
    return roles;
  };
  // Strade che non hanno portato a nulla: si saltano nei tentativi successivi del giro (non diventano esclusioni mostrate)
  const deadEnds = new Set<string>();
  // Portatori dello stile già usati in questo giro: tornando, si alternano invece di ripetere sempre il primo
  const setterUses = new Map<string, number>();
  const byRotation = (source: Suggestion[]) => {
    const uses = (s: Suggestion) => setterUses.get(formeId(s.set)) ?? 0;
    const least = Math.min(...source.map(uses));
    return source.filter(s => uses(s) === least);
  };
  // Voto del team per forma e strumento (le Mega dello stesso Pokémon hanno voti diversi)
  const memo = new Map<string, number>();
  const overallOf = (sets: TeamSet[]) => {
    // Lo stesso Pokémon può arrivare con set diversi (del meta o adattati allo stile)
    const key = sets.map(s => `${formeId(s)}@${toID(s.item)}@${toID(s.ability)}@${s.moves.map(toID).join('.')}`).join('|');
    let value = memo.get(key);
    if (value === undefined) {
      value = rateTeam(sets, data, 'en')?.overall ?? -Infinity;
      memo.set(key, value);
    }
    return value;
  };

  /** I candidati per il prossimo slot, già ristretti e ordinati per voto del team (a pari voto, per punteggio). */
  const candidates = (current: TeamSet[], taken: Set<string>, last: boolean): TeamSet[] => {
    // Con un meteo, fuori chi ne porta un altro o ne dipende (Swampert-Mega con Swift Swim in un team neve)
    const style = choice.style;
    // Mai un set contraddittorio: si passa al preset successivo del Pokémon, o lo si scarta
    const all: Suggestion[] = sensibleAll(suggest(current, { ...format, allowMultipleMegas: true }, data, Infinity, 'en')
      .filter(s => !taken.has(formeId(s.set)) && !deadEnds.has(formeId(s.set)) && !(style && opposesWeather(s.set, style)) && allowed(s.set)));
    const pool = all.filter(s => !exclude.has(formeId(s.set)));
    const narrow = (list: Suggestion[], keep: (set: TeamSet) => boolean) => {
      const kept = list.filter(s => keep(s.set));
      return kept.length ? kept : list;
    };
    /** Muri fino alla quota del tipo, poi solo non-muri (e per gli Offense chi è adatto); con `fallback`, se nessuno va, la lista com'è. */
    const byType = (source: Suggestion[], fallback: boolean): Suggestion[] => {
      if (!choice.archetype) return source;
      const quota = PASSIVE_QUOTA[choice.archetype];
      const walls = current.filter(passive).length;
      const kept = source.filter(s => (walls < quota ? passive(s.set) : !passive(s.set)));
      let result = kept.length || !fallback ? kept : source;
      const fit = FIT[choice.archetype];
      if (fit && quota === 0 && result.length) result = narrow(result, s => fitsArchetype(s, fit, rules));
      return result;
    };
    // Mai una seconda Mega; all'ultimo slot, una Mega se non c'è ancora
    const hasMega = current.some(isMega);
    const noSecondMega = (list: Suggestion[]) => (hasMega ? list.filter(s => !isMega(s.set)) : list);
    let list = noSecondMega(pool);
    if (choice.style) {
      const style = choice.style;
      const needSetter = !current.some(s => setsUp(s, style));
      // Trick Room: dopo chi la porta, tutti lenti; meteo: almeno WEATHER_USERS che lo sfruttino
      const needUsers = !needSetter && (style === 'trickroom' || current.filter(s => !setsUp(s, style) && uses(s, style)).length < WEATHER_USERS);
      // Slot libero di un team meteo: chi lo sfrutta (anche fuori dal meta) entra tra i candidati, senza restringere la lista
      const freeWeatherSlot = !needSetter && !needUsers && style !== 'trickroom';
      if (needSetter || needUsers || freeWeatherSlot) {
        // Oltre al meta, tutto il Pokédex: chi può portare o sfruttare lo stile, col set adattato
        const adapt = needSetter ? asSetter : asUser;
        // Prima di valutarli: solo chi serve a questo slot, non è nel meta e non è già preso, al massimo STYLE_POOL
        // (per chi lo porta, a parte, anche quelli già mostrati, che possono tornare)
        const inMeta = new Set(all.map(s => formeId(s.set)));
        const usable = stylePool(current, style, format, data)
          .filter(set => !inMeta.has(formeId(set)) && !taken.has(formeId(set)) && !deadEnds.has(formeId(set))
            && !opposesWeather(set, style) && allowed(set) && adapt(set, style, format.genLimit) !== null);
        const wanted = [
          ...usable.filter(set => !exclude.has(formeId(set))).slice(0, freeWeatherSlot ? 2 * WEATHER_EXTRA : STYLE_POOL),
          ...(needSetter ? usable.filter(set => exclude.has(formeId(set))).slice(0, STYLE_POOL) : []),
        ];
        const extras = scoreSets(current, { ...format, allowMultipleMegas: true }, data, wanted, 'en');
        const adapted = (source: Suggestion[]) => {
          const seen = new Set<string>();
          return sensibleAll(source, set => adapt(set, style, format.genLimit))
            .filter(s => !seen.has(formeId(s.set)) && !!seen.add(formeId(s.set)))
            .sort((a, b) => b.score - a.score);
        };
        const fresh = noSecondMega(adapted([...pool, ...extras.filter(s => !exclude.has(formeId(s.set)))]));
        // Chi porta lo stile può tornare (con meno priorità) quando non ce n'è uno nuovo; gli altri no
        const again = needSetter ? noSecondMega(adapted([...all, ...extras])) : [];
        // Per portarlo: prima per abilità (Snow Warning, Drizzle…), nuovo o già mostrato, poi con una mossa
        // (e così per sfruttarlo: prima Slush Rush, Swift Swim…, poi una mossa; per Trick Room conta la lentezza)
        const links = needSetter ? enables : benefits;
        const byAbility = (source: Suggestion[]) => source.filter(s => links(s.set).some(e => e.condition === style && toID(e.via) === toID(battleAbility(s.set))));
        // Trick Room: chi la porta è lento anche lui, se si può
        const slow = (source: Suggestion[]) => source.filter(s => uses(s.set, 'trickroom'));
        // I già mostrati si alternano dentro il loro gruppo (per abilità, lenti, con la mossa)
        const order = needSetter && style === 'trickroom' ? [slow(fresh), byRotation(slow(again)), fresh, byRotation(again)]
          : needSetter ? [byAbility(fresh), byRotation(byAbility(again)), fresh, byRotation(again)]
          : style === 'trickroom' ? [fresh] : [byAbility(fresh), fresh];
        // La prima opzione che ha anche qualcuno adatto al tipo chiesto (es. un muro lento per Stall + Trick Room)
        if (freeWeatherSlot) {
          const known = new Set(list.map(s => formeId(s.set)));
          list = [...list, ...fresh.filter(s => !known.has(formeId(s.set)))];
        } else {
          list = order.find(option => option.length && byType(option, false).length) ?? order.find(option => option.length) ?? list;
        }
      }
    }
    list = byType(list, true);
    // Trappole e chi le toglie: se i ruoli che mancano sono tanti quanti i posti liberi, questo posto ne porta uno
    const missing = ROLE_GAPS.filter(role => !current.some(s => rolesOf(s).includes(role)));
    const brings = (set: TeamSet) => missing.some(role => rolesOf(set).includes(role));
    if (!last && missing.length >= 6 - current.length) list = narrow(list, s => brings(s));
    let top = list.slice(0, last ? CANDIDATES : RATE_TOP).map(s => s.set);
    // Negli slot liberi si valutano anche i migliori tra chi sfrutta il meteo, così la precedenza può contare
    if (style && style !== 'trickroom') {
      const shown = new Set(top.map(formeId));
      top = [...top, ...list.filter(s => !shown.has(formeId(s.set)) && !setsUp(s.set, style) && uses(s.set, style)).slice(0, WEATHER_EXTRA).map(s => s.set)];
    }
    if (last) {
      // Ultimo slot: solo chi completa il tipo e lo stile chiesti, e tra questi chi lascia meno buchi di coerenza (prima
      // chi non ne lascia nessuno, cercato in tutta la lista: il controllo dei buchi è veloce, quello del tipo meno);
      // tra quelli scelti una Mega, se non c'è ancora e ce n'è una che va bene
      const fits = (set: TeamSet) => matchesChoice([...current, set], choice, format);
      const gapCount = (set: TeamSet) => coherenceGaps([...current, set], rules).length;
      const counted = list.map(s => ({ set: s.set, gaps: gapCount(s.set) }));
      const fewest = Math.min(...counted.map(c => c.gaps));
      let chosen = counted.filter(c => c.gaps === fewest).slice(0, COHERENT_CHECKS).map(c => c.set).filter(fits);
      // Nessuno dei migliori per buchi completa il tipo: come prima i primi candidati, e tra loro chi lascia meno buchi
      if (!chosen.length) {
        const fitting = [...new Set([...top, ...list.filter(s => isMega(s.set)).slice(0, CANDIDATES).map(s => s.set)])].filter(fits);
        const least = Math.min(...fitting.map(gapCount));
        chosen = fitting.filter(set => gapCount(set) === least);
      }
      const megas = !hasMega && megasAllowed ? chosen.filter(isMega) : [];
      top = (megas.length ? megas : chosen).slice(0, RATE_TOP);
    }
    // Negli slot liberi chi sfrutta il meteo ha una piccola precedenza (vale WEATHER_BONUS punti di voto): coverage ed equilibrio restano prima
    const bonus = (set: TeamSet) => (style && style !== 'trickroom' && !setsUp(set, style) && uses(set, style) ? WEATHER_BONUS : 0);
    // Allo stesso modo, negli slot prima dell'ultimo, chi porta un ruolo che manca (COHERENCE_BONUS); all'ultimo i buchi
    // hanno già deciso chi resta
    const coherence = (set: TeamSet) => (!last && brings(set) ? COHERENCE_BONUS : 0);
    const scored = top.map((set, i) => ({ set, i, rank: overallOf([...current, set]) + bonus(set) + coherence(set) }))
      .sort((a, b) => b.rank - a.rank || a.i - b.i);
    // Con 'priority', a voto quasi pari (FAVORITE_MARGIN) i preferiti dell'utente passano davanti
    return (favoriteMode === 'priority' ? applyFavorites(scored, s => favorite(s.set), s => s.rank) : scored).map(s => s.set);
  };

  // Candidati del giro (senza i già mostrati prima), per capire se un buco si poteva chiudere: calcolati la prima volta che servono
  let pool: TeamSet[] | null = null;
  const roundPool = () => (pool ??= sensibleAll(suggest(team, { ...format, allowMultipleMegas: true }, data, Infinity, 'en')
    .filter(s => !shownBefore.has(formeId(s.set)) && !(choice.style && opposesWeather(s.set, choice.style)) && allowed(s.set)))
    .map(s => s.set));
  const resists = (set: TeamSet, type: TypeName) => defensiveMultiplier(type, set) < 1;
  /**
   * Un buco che i membri attuali rendono inevitabile: nessun candidato del giro porta il ruolo che manca o resiste al
   * tipo; con un solo posto libero, nessun candidato lo chiude da solo.
   */
  const forced = (gap: Gap): boolean => {
    const source = roundPool();
    if (team.length === 5) return !source.some(set => !coherenceGaps([...team, set], rules).some(other => sameGap(gap, other)));
    if (gap.kind !== 'weakness') return !source.some(set => rolesOf(set).includes(gap.kind));
    const weakNow = team.filter(s => defensiveMultiplier(gap.type, s) > 1).length;
    return weakNow >= 3 && !team.some(s => resists(s, gap.type)) && !source.some(set => resists(set, gap.type));
  };
  /** Con un solo posto libero: il minimo di buchi che un candidato del giro può lasciare (sotto non si scende). */
  let leastGaps: number | undefined;
  const fewestPossible = () => (leastGaps ??= Math.min(...roundPool().map(set => coherenceGaps([...team, set], rules).length)));
  /** I buchi del team che si potevano chiudere (vuoto: la proposta si può mostrare). */
  const avoidable = (full: TeamSet[]): Gap[] => {
    const gaps = coherenceGaps(full, rules);
    if (!gaps.length || (team.length === 5 && gaps.length <= fewestPossible())) return [];
    return gaps.filter(gap => !forced(gap));
  };

  /**
   * Riempie gli slot che mancano; al penultimo slot prova qualche alternativa se l'ultimo non quadra o lascia buchi
   * che si potevano chiudere (tra i team con buchi, quello con meno).
   */
  const build = (current: TeamSet[], taken: Set<string>, first: TeamSet[]): TeamSet[] | null => {
    const left = 6 - current.length;
    const options = current.length === team.length ? first : candidates(current, taken, left === 1);
    if (left === 1) return options.length ? [...current, options[0]] : null;
    const tries = left === 2 ? 1 + BACKTRACK_ALTERNATIVES : 1;
    let best: TeamSet[] | null = null;
    for (const set of options.slice(0, tries)) {
      const done = build([...current, set], new Set([...taken, formeId(set)]), first);
      if (!done) continue;
      if (!avoidable(done).length) return done;
      if (!best || coherenceGaps(done, rules).length < coherenceGaps(best, rules).length) best = done;
    }
    return best;
  };

  /** Il membro nuovo da saltare nei tentativi dopo: il più debole (statistiche base) tra `among`, mai chi porta lo stile. */
  const weakestOf = (among: TeamSet[], added: TeamSet[]) =>
    [...among].filter(s => !(choice.style && setsUp(s, choice.style)))
      .sort((a, b) => (battleSpecies(a)?.bst ?? 0) - (battleSpecies(b)?.bst ?? 0))[0] ?? added[added.length - 1];
  // Proposte con buchi che si potevano chiudere: si mostrano solo se nessuna proposta del giro ci riesce
  const held: Proposal[] = [];
  let produced = 0;
  let attempts = 0;
  // Tentativi a vuoto dall'ultima proposta
  let misses = 0;
  // Nessun candidato per il primo posto senza strade scartate in questo giro: i Pokémon nuovi sono davvero finiti
  let empty = false;
  while (produced < PROPOSALS_PER_ROUND && misses < MAX_MISSES && attempts < MAX_ATTEMPTS) {
    const first = candidates(team, new Set(), team.length === 5);
    if (!first.length) { empty = !deadEnds.size; break; }
    const full = build(team, new Set(), first);
    if (!full) {
      // Cambia strada: il primo candidato di questo giro non porta a un team valido
      deadEnds.add(formeId(first[0]));
      attempts++;
      misses++;
      yield null;
      continue;
    }
    // Membri senza "Tieni il set": il preset migliore e sensato, uno dopo l'altro, solo se alza il voto del team e mai
    // a costo del tipo o dello stile chiesti né di un buco di coerenza nuovo (es. Garchomp che perde Stealth Rock)
    const changed: number[] = [];
    let final = full;
    team.forEach((member, i) => {
      if (choice.keepSets?.[i] !== false) return;
      const next = bestCoherentPreset(final, i, data, format.genLimit);
      if (next === member) return;
      const aligned = { ...next, moves: alignMoves(member.moves, next.moves) };
      if (sameSet(aligned, member)) return;
      const trial = final.map((s, j) => (j === i ? aligned : s));
      if (overallOf(trial) <= overallOf(final)) return;
      if (!matchesChoice(trial, choice, format)) return;
      const before = coherenceGaps(final, rules);
      if (coherenceGaps(trial, rules).some(gap => !before.some(other => sameGap(gap, other)))) return;
      final = trial;
      changed.push(i);
    });
    const added = final.slice(team.length);
    const rating = rateTeam(final, data, 'en');
    const found = teamArchetype(final, rules);
    if (!rating || !found || rating.overall < minOverall) {
      // Sotto il voto minimo non si mostra: si scarta il membro più debole e si riprova
      deadEnds.add(formeId(weakestOf(added, added)));
      attempts++;
      misses++;
      yield null;
      continue;
    }
    const proposal: Proposal = { added, team: final, overall: rating.overall, grade: rating.grade, archetype: found.archetype,
      styles: found.styles, gaps: coherenceGaps(final, rules), changed, favorites: added.filter(favorite).length };
    const open = avoidable(final);
    if (open.length) {
      // Un buco che un altro candidato poteva chiudere: la proposta resta da parte e si cambia strada; se tra i
      // candidati rimasti nessuno lo chiude più, il giro finisce qui
      held.push(proposal);
      // Una Mega che chiuderebbe il buco non entra se il team ne ha già una
      const megaIn = final.some(isMega);
      const left = roundPool().filter(set => !exclude.has(formeId(set)) && !deadEnds.has(formeId(set)) && !(megaIn && isMega(set)));
      const closable = open.some(gap => (gap.kind === 'weakness' ? left.some(set => resists(set, gap.type))
        : left.some(set => rolesOf(set).includes(gap.kind))));
      if (!closable) break;
      const weak = open.flatMap(gap => (gap.kind === 'weakness' ? added.filter(s => defensiveMultiplier(gap.type, s) > 1) : []));
      deadEnds.add(formeId(weakestOf(weak.length ? weak : added, added)));
      attempts++;
      misses++;
      yield null;
      continue;
    }
    for (const set of added) exclude.add(formeId(set));
    if (choice.style) for (const set of added) if (setsUp(set, choice.style)) setterUses.set(formeId(set), (setterUses.get(formeId(set)) ?? 0) + 1);
    produced++;
    misses = 0;
    yield proposal;
  }
  const end = (): FillEnd => (produced >= PROPOSALS_PER_ROUND ? 'complete' : empty || !produced ? 'exhausted' : 'stopped');
  if (produced) return end();
  // Nessuna proposta senza buchi evitabili: le migliori con la nota, senza Pokémon nuovi in comune (chi porta lo stile può tornare)
  for (const proposal of held.sort((a, b) => b.overall - a.overall)) {
    if (produced >= PROPOSALS_PER_ROUND) break;
    const fresh = (set: TeamSet) => !exclude.has(formeId(set)) || !!(choice.style && setsUp(set, choice.style));
    if (!proposal.added.every(fresh)) continue;
    for (const set of proposal.added) exclude.add(formeId(set));
    produced++;
    yield proposal;
  }
  return end();
}
