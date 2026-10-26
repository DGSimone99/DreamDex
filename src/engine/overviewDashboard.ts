import type { TeamAnalysis } from './analysis';
import { weaknessSeverity, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { battleName } from './dex';
import { ownersOf } from './needs';
import { summarizeTeam } from './overviewSummary';
import type { TeamRating } from './rating';
import { LEVEL_KEYS, type LevelKey } from './roleLevels';
import type { TeamSet } from './sets';
import { poolMedian, speedTier } from './speed';
import type { SpeedCondition } from './speedArea';
import { usesMeta } from './analysis';
import { t, type Lang } from '../i18n';

export type CellState = 'ok' | 'minor' | 'bad';
export interface TypeCell { type: string; defense: CellState; offense: CellState; defenseNote: string; offenseNote: string }
export interface RoleChip { need: LevelKey; level: 'essential' | 'important' | 'minor'; covered: boolean; owners: string[] }
export interface SpeedLane { species: string; speed: number; share: number; above: boolean; outspeeds: string[]; outspedBy: string[] }
export interface ThreatPod { species: string; usage: number }
export interface DashboardData {
  coverage: { cells: TypeCell[]; defense: string; offense: string };
  roles: { chips: RoleChip[]; value: string };
  speed: { lanes: SpeedLane[]; median: number | null; vsMeta: boolean; control: { condition: SpeedCondition; move: string; by: string[] }[]; value: string };
  /** metaOff: meta spento dall'utente (altrimenti, se non disponibile, mancano le statistiche). */
  threats: { pods: ThreatPod[]; total: number; available: boolean; metaOff: boolean };
}

/** Quanti vicini del meta si mostrano per corsia. */
const NEAR = 3;

/** I dati del cruscotto dell'Analisi; gli stati vengono da summarizeTeam e dalla gravità delle debolezze. */
export function dashboardData(team: TeamSet[], analysis: TeamAnalysis, rating: TeamRating, problems: CoachProblem[], data: EngineData, lang: Lang): DashboardData {
  const tiles = summarizeTeam(analysis, rating, problems, data);
  const tile = (key: string) => tiles.find(x => x.key === key)!;

  // Copertura: una cella per tipo, difesa e offesa
  const cells: TypeCell[] = analysis.weakness.map((row, i) => {
    const severity = weaknessSeverity(row);
    const hitters = analysis.coverage[i]?.hitters.length ?? 0;
    return {
      type: row.type,
      defense: severity === 'serious' ? 'bad' : severity === 'minor' ? 'minor' : 'ok',
      offense: hitters ? 'ok' : 'bad',
      defenseNote: `${t(lang, row.weak === 1 ? 'dash.weak1' : 'dash.weakN', { n: row.weak })}, ${t(lang, row.resist === 1 ? 'dash.resist1' : 'dash.resistN', { n: row.resist })}`,
      offenseNote: hitters ? t(lang, 'dash.offenseHit', { n: hitters }) : t(lang, 'dash.offenseNone'),
    };
  });

  // Ruoli: tutti i livelli tranne gli ignorati
  const chips: RoleChip[] = [];
  for (const need of LEVEL_KEYS) {
    const level = analysis.needs.levels[need];
    if (level === 'ignored') continue;
    const owners = ownersOf(team, analysis.needs, need);
    chips.push({ need, level, covered: owners.length > 0, owners });
  }

  // Velocità: corsie dal più veloce, coi vicini del meta
  const lanes: SpeedLane[] = rating.speed.members.map(m => {
    const set = team.find(s => s.species === m.species || battleName(s) === m.species);
    const tier = set ? speedTier(set, data) : null;
    return {
      species: m.species, speed: m.speed, share: m.raw, above: m.raw > 0.5,
      outspeeds: (tier?.slower ?? []).slice(0, NEAR).map(r => r.species),
      outspedBy: (tier?.faster ?? []).slice(0, NEAR).map(r => r.species),
    };
  }).sort((a, b) => b.speed - a.speed);

  const available = !tile('meta').unavailable;
  return {
    coverage: { cells, defense: tile('defense').value, offense: tile('strength').value },
    roles: { chips, value: tile('roles').value },
    speed: {
      lanes, median: poolMedian(data), vsMeta: usesMeta(data),
      control: rating.speed.sources.map(s => ({ condition: s.condition, move: s.move, by: s.by })),
      value: tile('speed').value,
    },
    threats: {
      pods: analysis.threats.filter(x => !x.handledBy.length).sort((a, b) => b.usage - a.usage).map(x => ({ species: x.name, usage: x.usage })),
      total: analysis.threats.length,
      available,
      metaOff: !!data.ignoreMeta,
    },
  };
}
