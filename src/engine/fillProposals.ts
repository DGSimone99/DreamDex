import { fitsArchetype, teamArchetype, type Archetype, type FitArchetype, type TeamStyle } from './archetype';
import type { EngineData } from './data';
import { isMega, toID } from './dex';
import type { Format } from './format';
import { formatRules } from './formatRules';
import { pokedexOf } from './formats';
import { rateTeam } from './rating';
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

/**
 * Completamenti del team del tipo (e dello stile) chiesti, uno alla volta, al massimo PROPOSALS_PER_ROUND.
 * Nessuna specie si ripete: `exclude` (id delle specie) parte con quelle già mostrate e cresce con ogni proposta.
 * Se il formato ammette le Mega, ogni proposta ha esattamente una Mega nel team (mai una seconda).
 */
export function* fillProposals(
  team: TeamSet[], choice: FillChoice, exclude: Set<string>, format: Format, data: EngineData,
): Generator<Proposal, void, undefined> {
  if (!data.stats || team.length >= 6) return;
  const rules = formatRules(format.formatId);
  const megasAllowed = pokedexOf(format) === 'natdex';
  // Strade che non hanno portato a nulla: si saltano nei tentativi successivi del giro (non diventano esclusioni mostrate)
  const deadEnds = new Set<string>();
  const memo = new Map<string, number>();
  const overallOf = (sets: TeamSet[]) => {
    const key = sets.map(s => toID(s.species)).join('|');
    let value = memo.get(key);
    if (value === undefined) {
      value = rateTeam(sets, data, 'en')?.overall ?? -Infinity;
      memo.set(key, value);
    }
    return value;
  };

  /** I candidati per il prossimo slot, già ristretti e ordinati per voto del team (a pari voto, per punteggio). */
  const candidates = (current: TeamSet[], taken: Set<string>, last: boolean): TeamSet[] => {
    const pool: Suggestion[] = suggest(current, { ...format, allowMultipleMegas: true }, data, Infinity, 'en')
      // Per specie del set: una Mega ha come specie la base con la pietra (Charizard @ Charizardite Y), come in exclude
      .filter(s => { const id = toID(s.set.species); return !taken.has(id) && !exclude.has(id) && !deadEnds.has(id); });
    const narrow = (list: Suggestion[], keep: (set: TeamSet) => boolean) => {
      const kept = list.filter(s => keep(s.set));
      return kept.length ? kept : list;
    };
    // Mai una seconda Mega; all'ultimo slot, una Mega se non c'è ancora
    const hasMega = current.some(isMega);
    let list = hasMega ? pool.filter(s => !isMega(s.set)) : pool;
    if (!hasMega && megasAllowed && last) list = narrow(list, isMega);
    if (choice.style) {
      const style = choice.style;
      if (!current.some(s => setsUp(s, style))) list = narrow(list, s => setsUp(s, style));
      else if (current.filter(s => !setsUp(s, style) && uses(s, style)).length < (style === 'trickroom' ? 2 : 1)) {
        list = narrow(list, s => uses(s, style));
      }
    }
    const fit = choice.archetype ? FIT[choice.archetype] : undefined;
    if (fit) list = narrow(list, s => fitsArchetype(s, fit, rules));
    let top = list.slice(0, last ? CANDIDATES : RATE_TOP).map(s => s.set);
    if (last) top = top.filter(set => matchesChoice([...current, set], choice, format)).slice(0, RATE_TOP);
    const scored = top.map((set, i) => ({ set, i, overall: overallOf([...current, set]) }));
    return scored.sort((a, b) => b.overall - a.overall || a.i - b.i).map(s => s.set);
  };

  /** Riempie gli slot che mancano; al penultimo slot prova qualche alternativa se l'ultimo non quadra. */
  const build = (current: TeamSet[], taken: Set<string>): TeamSet[] | null => {
    const left = 6 - current.length;
    const options = candidates(current, taken, left === 1);
    if (left === 1) return options.length ? [...current, options[0]] : null;
    const tries = left === 2 ? 1 + BACKTRACK_ALTERNATIVES : 1;
    for (const set of options.slice(0, tries)) {
      const done = build([...current, set], new Set([...taken, toID(set.species)]));
      if (done) return done;
    }
    return null;
  };

  let produced = 0;
  let attempts = 0;
  while (produced < PROPOSALS_PER_ROUND && attempts < MAX_ATTEMPTS) {
    const full = build(team, new Set());
    if (!full) {
      // Cambia strada: il primo candidato di questo giro non porta a un team valido
      const first = candidates(team, new Set(), team.length === 5)[0];
      if (!first) return;
      deadEnds.add(toID(first.species));
      attempts++;
      continue;
    }
    const added = full.slice(team.length);
    for (const set of added) exclude.add(toID(set.species));
    const rating = rateTeam(full, data, 'en');
    const found = teamArchetype(full, rules);
    if (!rating || !found) continue;
    produced++;
    yield { added, team: full, overall: rating.overall, grade: rating.grade, archetype: found.archetype, styles: found.styles };
  }
}
