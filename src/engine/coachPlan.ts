import type { Lang } from '../i18n';
import type { Proposal, ProposalGroup } from './coachProposals';
import type { EngineData } from './data';
import { battleName } from './dex';
import { gradeFor, rateTeam } from './rating';
import type { TeamSet } from './sets';
import { withCandidate } from './teamGain';

/** I passi del piano al più. */
export const PLAN_STEPS = 3;
/** Le proposte provate al più (ognuna è un voto da rifare). */
export const PLAN_TRIES = 8;

/** Un passo del piano: la proposta (la riga della classifica, con l'alternativa scelta) e il voto vero dopo di lei e quelle prima. */
export interface PlanStep {
  groupId: string;
  proposal: Proposal;
  overall: number;
  grade: string;
}

/** Il posto che una proposta occupa: il membro sostituito o ritoccato (un indice), o un posto libero. */
const seatOf = (p: Proposal): number | 'add' => (p.kind === 'move' ? p.fix.index : p.fix.kind === 'add' ? 'add' : p.fix.index ?? 'add');

/** Il team con la proposta fatta: sostituzione e mossa al posto del membro (il set della mossa è già quello col cambio), aggiunta in fondo. */
const applied = (team: TeamSet[], p: Proposal): TeamSet[] => withCandidate(team, p.fix.set, seatOf(p) === 'add' ? null : (seatOf(p) as number));

/**
 * Il piano: i cambi migliori da fare insieme. Si scorre la classifica (dalla più utile, con l'alternativa scelta di ogni
 * riga) e si prende una proposta solo se non tocca un posto già preso da un passo (lo stesso membro sostituito o ritoccato;
 * le aggiunte vanno bene finché restano posti liberi) e non porta una specie già entrata. Dopo ogni passo il voto vero del
 * team coi cambi fatti fin lì (rateTeam): un passo resta solo se alza il voto (due cambi che risolvono la stessa cosa non
 * si sommano: il secondo si salta e si prova il seguente). Al più PLAN_STEPS passi e PLAN_TRIES voti da rifare.
 * `start`: il voto di ora (quello che l'app mostra).
 */
export function coachPlan(groups: ProposalGroup[], pickOf: (g: ProposalGroup) => Proposal, team: TeamSet[], data: EngineData, lang: Lang, start: number, max = PLAN_STEPS): PlanStep[] {
  const steps: PlanStep[] = [];
  const seats = new Set<number>();
  const species = new Set(team.map(battleName));
  let free = Math.max(0, 6 - team.length);
  let current = team;
  let overall = start;
  let tries = 0;
  for (const group of groups) {
    if (steps.length >= max || tries >= PLAN_TRIES) break;
    const p = pickOf(group);
    const seat = seatOf(p);
    if (seat === 'add' ? free === 0 : seats.has(seat)) continue;
    const incoming = p.kind === 'fix' ? battleName(p.fix.set) : null;
    if (incoming && species.has(incoming)) continue;
    const next = applied(current, p);
    tries++;
    const after = rateTeam(next, data, lang)?.overall ?? null;
    if (after === null || after <= overall) continue;
    steps.push({ groupId: group.id, proposal: p, overall: after, grade: gradeFor(after, lang).grade });
    if (seat === 'add') free--; else seats.add(seat);
    if (incoming) species.add(incoming);
    current = next;
    overall = after;
  }
  return steps;
}
