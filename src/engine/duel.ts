import { bestHit, setKey, type HitOptions } from './damage';
import { battleSpecies } from './dex';
import type { TeamDefense } from './defense';
import { conditionsOf } from './offense';
import type { TeamSet } from './sets';
import { speedStat } from './speed';
import { speedOptions } from './speedArea';

/**
 * Il duello con una minaccia del meta (2026-11-17, utente): il membro entra gratis (dopo un KO), e lo batte se lo manda
 * KO prima di andare KO lui. Più veloce: gli bastano tanti colpi quanti ne servono alla minaccia; più lento: uno in meno;
 * stessa velocità: metà. Una mossa con priorità che lo manda KO in tempo vince sempre. Niente setup della minaccia.
 */
export type DuelOutcome = 0 | 0.5 | 1;

/** Colpi per mandare KO con un danno medio `x` (frazione dei PS); Infinity se non fa danni. */
export const hitsToKO = (x: number): number => (x > 0 ? Math.ceil(1 / x - 1e-9) : Infinity);

/** Velocità del membro in campo col suo team: Sciarpa, natura ed EV, più meteo, campo o Booster Energy (non setup, Web, Tailwind). */
export function fieldSpeed(set: TeamSet, team: TeamSet[]): number {
  const factor = Math.max(1, ...speedOptions(set, team).filter(o => o.condition === 'weather' || o.condition === 'booster' || o.condition === 'unburden').map(o => o.memberFactor));
  return Math.floor(speedStat(set).value * factor);
}

/** Velocità della minaccia: il suo set più usato, coi suoi meteo e campi (Chlorophyll col suo sole, la sua Booster). */
const threatSpeed = (threat: TeamSet): number => fieldSpeed(threat, [threat]);

/**
 * Il duello di un membro con una minaccia. `incoming`: il danno della minaccia sul membro (lo stesso della Coverage meta
 * della Difesa, frazione dei PS).
 */
export function duel(member: TeamSet, team: TeamSet[], threat: TeamSet, incoming: number, rules: Pick<HitOptions, 'doubles'> = {}): DuelOutcome {
  const conditions = conditionsOf(member, team).all;
  const out = bestHit(member, threat, { conditions, ...rules })?.expected ?? 0;
  const kIn = hitsToKO(incoming);
  // Con la priorità colpisce sempre per primo
  const prio = bestHit(member, threat, { conditions, priorityOnly: true, ...rules })?.expected ?? 0;
  if (hitsToKO(prio) <= kIn) return 1;
  const kOut = hitsToKO(out);
  if (kOut === Infinity) return 0;
  const mine = fieldSpeed(member, team), theirs = threatSpeed(threat);
  if (mine > theirs) return kOut <= kIn ? 1 : 0;
  if (mine < theirs) return kOut < kIn ? 1 : 0;
  return kOut < kIn ? 1 : kOut === kIn ? 0.5 : 0;
}

const cache = new Map<string, DuelOutcome>();
const CACHE_LIMIT = 50000;

export interface DuelRow {
  species: string;
  /** Il miglior duello del team: 1 qualcuno lo batte prima, 0.5 solo a pari velocità, 0 nessuno. */
  best: DuelOutcome;
  /** Chi lo batte prima (o a pari velocità). */
  winners: string[];
}

/** Per ogni minaccia del meta che nessuno regge (Coverage meta della Difesa): chi la batte nel duello. */
export function unheldDuels(team: TeamSet[], defense: TeamDefense, rules: Pick<HitOptions, 'doubles'> = {}): DuelRow[] {
  const known = team.filter(set => !!battleSpecies(set));
  // Il Coaching rifà il voto di centinaia di team simili: un duello dipende dal membro, dal meteo e dai campi del team
  // e dalla sua velocità in campo, non dal resto del team
  const memberKeys = known.map(member => `${setKey(member)}|${conditionsOf(member, known).all.join(',')}|${fieldSpeed(member, known)}`);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  return (defense.coverageMeta?.rows ?? [])
    .filter(row => !row.heldBy.some(h => !h.partial))
    .map(row => {
      const outcomes = known.map((member, m) => {
        const pct = row.hits?.[m]?.pct ?? 0;
        const key = `${memberKeys[m]}|${setKey(row.set)}|${pct}|${!!rules.doubles}`;
        let outcome = cache.get(key);
        if (outcome === undefined) cache.set(key, outcome = duel(member, known, row.set, pct / 100, rules));
        return outcome;
      });
      const best = Math.max(0, ...outcomes) as DuelOutcome;
      return { species: row.species, best, winners: known.filter((_, m) => outcomes[m] > 0 && outcomes[m] === best).map(s => battleSpecies(s)!.name) };
    });
}
