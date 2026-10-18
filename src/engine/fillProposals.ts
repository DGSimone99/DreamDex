import { fitsArchetype, teamArchetype, type Archetype, type FitArchetype, type TeamStyle } from './archetype';
import type { EngineData } from './data';
import { battleName, isMega, toID } from './dex';
import type { Format } from './format';
import { formatRules } from './formatRules';
import { pokedexOf } from './formats';
import { rateTeam } from './rating';
import { detectRoles, isPassive } from './roles';
import { suggest, type Suggestion } from './scoring';
import type { TeamSet } from './sets';
import { benefits, enables, type Condition } from './synergy';

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
export const MAX_ATTEMPTS = 8;

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
    const key = sets.map(s => `${formeId(s)}@${toID(s.item)}`).join('|');
    let value = memo.get(key);
    if (value === undefined) {
      value = rateTeam(sets, data, 'en')?.overall ?? -Infinity;
      memo.set(key, value);
    }
    return value;
  };

  /** I candidati per il prossimo slot, già ristretti e ordinati per voto del team (a pari voto, per punteggio). */
  const candidates = (current: TeamSet[], taken: Set<string>, last: boolean): TeamSet[] => {
    const all: Suggestion[] = suggest(current, { ...format, allowMultipleMegas: true }, data, Infinity, 'en')
      .filter(s => !taken.has(formeId(s.set)) && !deadEnds.has(formeId(s.set)));
    const pool = all.filter(s => !exclude.has(formeId(s.set)));
    const narrow = (list: Suggestion[], keep: (set: TeamSet) => boolean) => {
      const kept = list.filter(s => keep(s.set));
      return kept.length ? kept : list;
    };
    // Mai una seconda Mega; all'ultimo slot, una Mega se non c'è ancora
    const hasMega = current.some(isMega);
    const noSecondMega = (list: Suggestion[]) => (hasMega ? list.filter(s => !isMega(s.set)) : list);
    let list = noSecondMega(pool);
    if (choice.style) {
      const style = choice.style;
      if (!current.some(s => setsUp(s, style))) {
        // Chi porta lo stile: prima uno nuovo, poi (con meno priorità) uno già mostrato
        const fresh = list.filter(s => setsUp(s.set, style));
        const again = noSecondMega(all).filter(s => setsUp(s.set, style));
        list = fresh.length ? fresh : again.length ? again : list;
      } else if (current.filter(s => !setsUp(s, style) && uses(s, style)).length < (style === 'trickroom' ? 2 : 1)) {
        list = narrow(list, s => uses(s, style));
      }
    }
    if (choice.archetype) {
      // Muri fino alla quota del tipo, poi solo non-muri
      const quota = PASSIVE_QUOTA[choice.archetype];
      const walls = current.filter(passive).length;
      list = narrow(list, walls < quota ? passive : s => !passive(s));
      const fit = FIT[choice.archetype];
      if (fit && quota === 0) list = narrow(list, s => fitsArchetype(s, fit, rules));
    }
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
