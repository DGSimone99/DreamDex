import type { Lang } from '../i18n';
import { analyzeTeam } from './analysis';
import { teamArchetype } from './archetype';
import { findProblems, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { battleName, battleSpecies } from './dex';
import type { Format } from './format';
import { rulesOf } from './formatRules';
import { improveReplacements } from './replace';
import { suggest } from './scoring';
import type { TeamSet } from './sets';
import { rankByTeamGain, SWAPS_PER_MEMBER, withCandidate } from './teamGain';

/** Un cambio proposto dal Coaching: sostituzione di un membro o aggiunta a un team incompleto. */
export interface CoachFix {
  kind: 'swap' | 'add';
  species: string;
  set: TeamSet;
  /** Membro sostituito (indice e nome); null per un'aggiunta. */
  index: number | null;
  member: string | null;
  /** Punti di voto in più: lo stesso numero che mostra Migliora team. */
  gain: number;
  /** Chiavi dei problemi che il cambio risolve del tutto. */
  solves: string[];
}

/** Candidati per le aggiunte, come la modalità Aggiungi della scheda Pokémon. */
const ADD_POOL = 100;

/**
 * I cambi che alzano il voto, presi dalla classifica di Migliora team: per membro (stesso set e stesso +N della
 * vista per membro) e, con 2–5 membri, le aggiunte. Per ognuno i problemi che spariscono nel team col cambio.
 */
export function coachFixes(team: TeamSet[], format: Format, data: EngineData, problems: CoachProblem[], lang: Lang): CoachFix[] {
  if (!data.stats || team.length < 2) return [];
  // Tipo di team riconosciuto, come le impostazioni predefinite del pannello
  const archetype = team.length === 6 ? teamArchetype(team, rulesOf(data))?.archetype : undefined;
  const base = (set: TeamSet) => battleSpecies(set)?.baseSpecies ?? set.species;
  const forme = (set: TeamSet) => battleSpecies(set)?.name ?? set.species;
  const now = [...new Set(problems.map(p => p.key))];
  const solvedBy = (after: TeamSet[]) => {
    const left = new Set(findProblems(after, format, analyzeTeam(after, data), [], lang).map(p => p.key));
    return now.filter(key => !left.has(key));
  };

  const fixes: CoachFix[] = [];
  team.forEach((member, index) => {
    // I preferiti non si propongono come membri da sostituire; niente doppioni (stesse regole di bestSwaps)
    if (member.favorite) return;
    const others = new Set(team.filter((_, i) => i !== index).map(base));
    const pool = improveReplacements(team, index, format, data, SWAPS_PER_MEMBER, undefined, lang, archetype)
      .filter(c => !others.has(base(c.set)) && forme(c.set) !== forme(member));
    for (const c of rankByTeamGain(pool, team, index, data, lang, true, archetype)) {
      if (!c.teamGain || c.teamGain.gain <= 0) continue;
      fixes.push({ kind: 'swap', species: c.species, set: c.set, index, member: battleName(member), gain: c.teamGain.gain, solves: solvedBy(withCandidate(team, c.set, index)) });
    }
  });
  if (team.length < 6) {
    for (const c of rankByTeamGain(suggest(team, format, data, ADD_POOL, lang), team, null, data, lang, true, undefined)) {
      if (!c.teamGain || c.teamGain.gain <= 0) continue;
      fixes.push({ kind: 'add', species: c.species, set: c.set, index: null, member: null, gain: c.teamGain.gain, solves: solvedBy(withCandidate(team, c.set, null)) });
    }
  }
  return fixes.sort((a, b) => b.gain - a.gain);
}

/** "Prima di tutto": più problemi gravi risolti, poi più minori, poi voto in più; null se nessuno risolve qualcosa. */
export function firstMove(fixes: CoachFix[], problems: CoachProblem[]): CoachFix | null {
  const serious = new Set(problems.filter(p => p.severity === 'serious').map(p => p.key));
  const count = (fix: CoachFix) => {
    const grave = fix.solves.filter(key => serious.has(key)).length;
    return { grave, minor: fix.solves.length - grave };
  };
  let best: { fix: CoachFix; grave: number; minor: number } | null = null;
  for (const fix of fixes) {
    if (!fix.solves.length) continue;
    const c = { fix, ...count(fix) };
    if (!best || c.grave > best.grave || (c.grave === best.grave && (c.minor > best.minor || (c.minor === best.minor && fix.gain > best.fix.gain)))) best = c;
  }
  return best?.fix ?? null;
}

/** I cambi che risolvono un problema, dal voto più alto, ogni specie una volta. */
export function fixesForProblem(fixes: CoachFix[], key: string, limit = 3): CoachFix[] {
  const seen = new Set<string>();
  return fixes
    .filter(fix => fix.solves.includes(key))
    .sort((a, b) => b.gain - a.gain)
    .filter(fix => !seen.has(fix.species) && !!seen.add(fix.species))
    .slice(0, limit);
}
