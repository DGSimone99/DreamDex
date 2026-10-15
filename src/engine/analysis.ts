import type { EngineData } from './data';
import { battleName, getSpecies, toID } from './dex';
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
  const name = battleName(set);
  if (toID(name) === toID(threat)) return false;
  const score = checkScore(data.stats, threat, name);
  return score === null ? resistsAllStabs(set, threat) : score >= CHECK_THRESHOLD;
}

export function analyzeTeam(team: TeamSet[], data: EngineData): TeamAnalysis {
  const names = team.map(battleName);
  return {
    weakness: weaknessTable(team),
    coverage: coverageTable(team),
    needs: teamNeeds(team),
    threats: topThreats(data.stats, THREAT_COUNT, names).map(name => ({
      name,
      usage: usageOf(data.stats, name),
      handledBy: team.filter(set => checksThreat(data, set, name)).map(battleName),
    })),
    typeWeights: metaTypeWeights(data.stats),
  };
}

/** Quota (0–100) delle minacce del meta gestite dal team, pesata per uso. null senza dati Smogon. */
export function threatScore(analysis: TeamAnalysis): number | null {
  const total = analysis.threats.reduce((acc, t) => acc + t.usage, 0);
  if (total === 0) return null;
  const handled = analysis.threats.filter(t => t.handledBy.length > 0).reduce((acc, t) => acc + t.usage, 0);
  return Math.round((100 * handled) / total);
}
