import type { EngineData } from './data';
import { getSpecies } from './dex';
import { teamNeeds, type TeamNeeds } from './roles';
import type { TeamSet } from './sets';
import { checkScore, metaTypeWeights, topThreats, usageOf } from './stats';
import {
  coverageTable, defensiveMultiplier, weaknessTable, type CoverageRow, type TypeName, type WeaknessRow,
} from './types';

export const CHECK_THRESHOLD = 0.5;
export const THREAT_COUNT = 20;

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
  if (set.species === threat) return false;
  const score = checkScore(data.stats, threat, set.species);
  return score === null ? resistsAllStabs(set, threat) : score >= CHECK_THRESHOLD;
}

export function analyzeTeam(team: TeamSet[], data: EngineData): TeamAnalysis {
  const names = team.map(set => set.species);
  return {
    weakness: weaknessTable(team),
    coverage: coverageTable(team),
    needs: teamNeeds(team),
    threats: topThreats(data.stats, THREAT_COUNT, names).map(name => ({
      name,
      usage: usageOf(data.stats, name),
      handledBy: team.filter(set => checksThreat(data, set, name)).map(set => set.species),
    })),
    typeWeights: metaTypeWeights(data.stats),
  };
}
