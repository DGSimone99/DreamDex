import type { Archetype } from './archetype';
import type { EngineData } from './data';
import { battleName, getSpecies, toID } from './dex';
import { teamNeeds, type TeamNeeds } from './needs';
import type { TeamSet } from './sets';
import { checkScore, metaTypeWeights, topThreats, usageOf } from './stats';
import {
  coverageTable, defensiveMultiplier, TYPES, weaknessTable, type CoverageRow, type TypeName, type WeaknessRow,
} from './types';

export const CHECK_THRESHOLD = 0.5;
export const THREAT_COUNT = 20;

/** Una minaccia del meta. In `analyzeTeam` i check vengono dalle statistiche Smogon (servono solo a classificare i candidati);
 * quello che si mostra viene dal voto: `ratingThreats`. */
export interface ThreatRow {
  name: string;
  usage: number;
  handledBy: string[];
}

export interface TeamAnalysis {
  weakness: WeaknessRow[];
  coverage: CoverageRow[];
  needs: TeamNeeds;
  threats: ThreatRow[];
  typeWeights: Record<TypeName, number>;
}

export function resistsAllStabs(set: TeamSet, threat: string): boolean {
  const species = getSpecies(threat);
  return !!species && species.types.every(type => defensiveMultiplier(type as TypeName, set) < 1);
}

export function checksThreat(data: EngineData, set: TeamSet, threat: string): boolean {
  const name = battleName(set);
  if (toID(name) === toID(threat)) return false;
  const score = checkScore(data.stats, threat, name);
  return score === null ? resistsAllStabs(set, threat) : score >= CHECK_THRESHOLD;
}

/** Tutti i tipi con lo stesso peso: la valutazione senza meta. */
export const UNIFORM_TYPE_WEIGHTS = Object.fromEntries(TYPES.map(type => [type, 1 / TYPES.length])) as Record<TypeName, number>;

/** Il voto usa il meta: ci sono le statistiche e la modalità senza meta non è scelta. */
export const usesMeta = (data: EngineData): boolean => !!data.stats && !data.ignoreMeta;

/** `forced`: giudica il team come quel tipo (vedi `teamNeeds`). */
export function analyzeTeam(team: TeamSet[], data: EngineData, forced?: Archetype): TeamAnalysis {
  const names = team.map(battleName);
  const meta = usesMeta(data);
  return {
    weakness: weaknessTable(team),
    coverage: coverageTable(team),
    needs: teamNeeds(team, data, undefined, forced),
    threats: (meta ? topThreats(data.stats, THREAT_COUNT, names) : []).map(name => ({
      name,
      usage: usageOf(data.stats, name),
      handledBy: team.filter(set => checksThreat(data, set, name)).map(battleName),
    })),
    typeWeights: meta ? metaTypeWeights(data.stats) : UNIFORM_TYPE_WEIGHTS,
  };
}
