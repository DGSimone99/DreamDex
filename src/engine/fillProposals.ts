import { fitsArchetype, teamArchetype, type Archetype, type FitArchetype, type TeamStyle } from './archetype';
import type { EngineData } from './data';
import { battleAbility, battleName, isMega, toID } from './dex';
import type { Format } from './format';
import { formatRules } from './formatRules';
import { pokedexOf } from './formats';
import { rateTeam } from './rating';
import { detectRoles, isPassive } from './roles';
import { scoreSets, suggest, type Suggestion } from './scoring';
import { asSetter, asUser, stylePool } from './styleSets';
import type { TeamSet } from './sets';
import { benefits, enables, opposesWeather, type Condition } from './synergy';

/** Stili che si possono chiedere a Completa team: meteo e Trick Room (il "motore" del team). */
export type FillStyle = 'rain' | 'sun' | 'sand' | 'snow' | 'trickroom';
export const FILL_STYLES: FillStyle[] = ['rain', 'sun', 'sand', 'snow', 'trickroom'];

/** Tipo e stile chiesti; null = qualsiasi. */
export interface FillChoice {
  archetype: Archetype | null;
  style: FillStyle | null;
}

export interface Proposal {
  /** I Pokémon nuovi, nell'ordine in cui entrano. */
  added: TeamSet[];
  /** Il team attuale più i nuovi. */
  team: TeamSet[];
  overall: number;
  grade: string;
  archetype: Archetype;
  styles: TeamStyle[];
}

export const PROPOSALS_PER_ROUND = 5;
/** Candidati per slot, dopo le restrizioni di tipo, stile e Mega. */
export const CANDIDATES = 25;
/** Candidati per slot su cui si calcola il voto del team. */
export const RATE_TOP = 10;
/** Alternative provate al penultimo slot quando l'ultimo non trova un team del tipo chiesto. */
export const BACKTRACK_ALTERNATIVES = 3;
/** Tentativi a vuoto, in tutto il giro, prima di arrendersi. */
export const MAX_ATTEMPTS = 5;
/** Pokémon fuori dal meta valutati per slot quando serve chi porta o sfrutta lo stile. */
export const STYLE_POOL = 20;
/** Membri che sfruttano il meteo, oltre a chi lo porta (se ce ne sono abbastanza). */
export const WEATHER_USERS = 3;

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

/** Muri passivi da raggiungere per tipo (come li conta teamArchetype): Stall 6, Semi-Stall 4–5, Balance 3, Offense nessuno. */
const PASSIVE_QUOTA: Record<Archetype, number> = { stall: 6, semiStall: 4, balance: 3, hyperOffense: 0, bulkyOffense: 0 };
/** Un Pokémon si distingue per forma in battaglia: Charizard, Charizard-Mega-X e Charizard-Mega-Y sono tre Pokémon. */
const formeId = (set: TeamSet) => toID(battleName(set));

/**
 * Completamenti del team del tipo (e dello stile) chiesti, uno alla volta, al massimo PROPOSALS_PER_ROUND.
 * Nessun Pokémon si ripete: `exclude` (forme) parte con quelle già mostrate e cresce con ogni proposta; fa eccezione
 * chi porta lo stile, che torna solo quando non ce n'è uno nuovo. Se il formato ammette le Mega, ogni proposta ne ha
 * una (mai una seconda). Dopo ogni tentativo a vuoto produce `null`: chi consuma il generatore può rendere il controllo.
 */
export function* fillProposals(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData,
): Generator<Proposal | null, void, undefined> {
  if (!data.stats || team.length >= 6) return;
  const rules = formatRules(format.formatId);
  const megasAllowed = pokedexOf(format) === 'natdex';
  const passive = (set: TeamSet) => isPassive(set, detectRoles(set, rules));
  // Strade che non hanno portato a nulla: si saltano nei tentativi successivi del giro (non diventano esclusioni mostrate)
  const deadEnds = new Set<string>();
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
    const all: Suggestion[] = suggest(current, { ...format, allowMultipleMegas: true }, data, Infinity, 'en')
      .filter(s => !taken.has(formeId(s.set)) && !deadEnds.has(formeId(s.set)) && !(style && opposesWeather(s.set, style)));
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
      if (needSetter || needUsers) {
        // Oltre al meta, tutto il Pokédex: chi può portare o sfruttare lo stile, col set adattato
        const adapt = needSetter ? asSetter : asUser;
        // Prima di valutarli: solo chi serve a questo slot, non è nel meta e non è già preso, al massimo STYLE_POOL
        // (per chi lo porta, a parte, anche quelli già mostrati, che possono tornare)
        const inMeta = new Set(all.map(s => formeId(s.set)));
        const usable = stylePool(current, style, format, data)
          .filter(set => !inMeta.has(formeId(set)) && !taken.has(formeId(set)) && !deadEnds.has(formeId(set))
            && !opposesWeather(set, style) && adapt(set, style, format.genLimit) !== null);
        const wanted = [
          ...usable.filter(set => !exclude.has(formeId(set))).slice(0, STYLE_POOL),
          ...(needSetter ? usable.filter(set => exclude.has(formeId(set))).slice(0, STYLE_POOL) : []),
        ];
        const extras = scoreSets(current, { ...format, allowMultipleMegas: true }, data, wanted, 'en');
        const adapted = (source: Suggestion[]) => {
          const seen = new Set<string>();
          return source
            .map(s => { const set = adapt(s.set, style, format.genLimit); return set ? { ...s, set } : null; })
            .filter((s): s is Suggestion => !!s && !seen.has(formeId(s.set)) && !!seen.add(formeId(s.set)))
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
        const order = needSetter && style === 'trickroom' ? [slow(fresh), slow(again), fresh, again]
          : needSetter ? [byAbility(fresh), byAbility(again), fresh, again]
          : style === 'trickroom' ? [fresh] : [byAbility(fresh), fresh];
        // La prima opzione che ha anche qualcuno adatto al tipo chiesto (es. un muro lento per Stall + Trick Room)
        list = order.find(option => option.length && byType(option, false).length) ?? order.find(option => option.length) ?? list;
      }
    }
    list = byType(list, true);
    let top = list.slice(0, last ? CANDIDATES : RATE_TOP).map(s => s.set);
    if (last) {
      // Ultimo slot: solo chi completa il tipo e lo stile chiesti; tra questi una Mega, se non c'è ancora e ce n'è una che va bene
      const fits = (set: TeamSet) => matchesChoice([...current, set], choice, format);
      const megas = !hasMega && megasAllowed ? list.filter(s => isMega(s.set)).slice(0, CANDIDATES).map(s => s.set).filter(fits) : [];
      top = megas.length ? megas.slice(0, RATE_TOP) : top.filter(fits).slice(0, RATE_TOP);
    }
    const scored = top.map((set, i) => ({ set, i, overall: overallOf([...current, set]) }));
    return scored.sort((a, b) => b.overall - a.overall || a.i - b.i).map(s => s.set);
  };

  /** Riempie gli slot che mancano; al penultimo slot prova qualche alternativa se l'ultimo non quadra. */
  const build = (current: TeamSet[], taken: Set<string>, first: TeamSet[]): TeamSet[] | null => {
    const left = 6 - current.length;
    const options = current.length === team.length ? first : candidates(current, taken, left === 1);
    if (left === 1) return options.length ? [...current, options[0]] : null;
    const tries = left === 2 ? 1 + BACKTRACK_ALTERNATIVES : 1;
    for (const set of options.slice(0, tries)) {
      const done = build([...current, set], new Set([...taken, formeId(set)]), first);
      if (done) return done;
    }
    return null;
  };

  let produced = 0;
  let attempts = 0;
  while (produced < PROPOSALS_PER_ROUND && attempts < MAX_ATTEMPTS) {
    const first = candidates(team, new Set(), team.length === 5);
    if (!first.length) return;
    const full = build(team, new Set(), first);
    if (!full) {
      // Cambia strada: il primo candidato di questo giro non porta a un team valido
      deadEnds.add(formeId(first[0]));
      attempts++;
      yield null;
      continue;
    }
    const added = full.slice(team.length);
    for (const set of added) exclude.add(formeId(set));
    const rating = rateTeam(full, data, 'en');
    const found = teamArchetype(full, rules);
    if (!rating || !found) continue;
    produced++;
    yield { added, team: full, overall: rating.overall, grade: rating.grade, archetype: found.archetype, styles: found.styles };
  }
}
