import { usesMeta, type TeamAnalysis } from './analysis';
import { COVERED_LEVEL, holdSeverity, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { battleName } from './dex';
import { ownersOf } from './needs';
import { summarizeTeam } from './overviewSummary';
import { ratingThreats, type TeamRating } from './rating';
import { LEVEL_KEYS, type LevelKey } from './roleLevels';
import type { TeamSet } from './sets';
import { poolMedian } from './speed';
import type { SpeedCondition } from './speedArea';
import { t, type Lang } from '../i18n';

export type CellState = 'ok' | 'minor' | 'bad';
/** resist: quanti membri reggono del tutto il tipo (Coverage tipi della Difesa). */
export interface TypeCell { type: string; defense: CellState; offense: CellState; defenseNote: string; offenseNote: string; resist: number }
/** soft: una mancanza che non toglie punti (voce minore, o team con meno di 6 membri). */
export interface RoleChip { need: LevelKey; level: 'essential' | 'important' | 'minor'; covered: boolean; owners: string[]; soft: boolean }
export interface SpeedLane { species: string; speed: number; share: number; above: boolean }
export interface ThreatPod { species: string; usage: number }
export interface DashboardData {
  coverage: { cells: TypeCell[]; defense: string; offense: string };
  /** members: i membri in ordine di team (le colonne della tabella dei ruoli), scritti come gli owners. */
  roles: { chips: RoleChip[]; members: string[]; value: string };
  speed: { lanes: SpeedLane[]; median: number | null; vsMeta: boolean; control: { condition: SpeedCondition; move: string; by: string[] }[]; value: string };
  /** metaOff: meta spento dall'utente (altrimenti, se non disponibile, mancano le statistiche). */
  threats: { pods: ThreatPod[]; total: number; available: boolean; metaOff: boolean };
}

/** I dati del cruscotto dell'Analisi; gli stati vengono da summarizeTeam e dalla gravità delle debolezze. */
export function dashboardData(team: TeamSet[], analysis: TeamAnalysis, rating: TeamRating, problems: CoachProblem[], data: EngineData, lang: Lang): DashboardData {
  const tiles = summarizeTeam(analysis, rating, problems, data);
  const tile = (key: string) => tiles.find(x => x.key === key)!;

  // Copertura: una cella per tipo, coi conti del voto (Coverage tipi della Difesa, pacchetto dell'Offesa) come il coach
  const offense = rating.offense.types;
  const cells: TypeCell[] = rating.defense.coverageTypes.rows.map(row => {
    const severity = holdSeverity(rating, row.type);
    const off = offense.rows.find(r => r.label === row.type);
    const hole = offense.holes.includes(row.type);
    const hitters = (off?.best ?? []).filter(b => b.credit > 0).map(b => b.species);
    return {
      type: row.type,
      defense: severity === 'serious' ? 'bad' : severity === 'minor' ? 'minor' : 'ok',
      offense: hole ? 'bad' : (off?.level ?? 0) < COVERED_LEVEL ? 'minor' : 'ok',
      defenseNote: row.heldBy.length ? t(lang, 'dash.heldBy', { list: row.heldBy.join(', ') }) : t(lang, 'dash.heldNone'),
      offenseNote: hole || !hitters.length ? t(lang, 'dash.offenseNone') : t(lang, 'dash.offenseBy', { list: hitters.join(', ') }),
      resist: row.heldBy.length,
    };
  });

  // Ruoli: tutti i livelli tranne gli ignorati
  const chips: RoleChip[] = [];
  for (const need of LEVEL_KEYS) {
    const level = analysis.needs.levels[need];
    if (level === 'ignored') continue;
    const owners = ownersOf(team, analysis.needs, need);
    chips.push({ need, level, covered: owners.length > 0, owners, soft: level === 'minor' || rating.provisional });
  }

  // Velocità: corsie dal più veloce
  const lanes: SpeedLane[] = rating.speed.members
    .map(m => ({ species: m.species, speed: m.speed, share: m.raw, above: m.raw > 0.5 }))
    .sort((a, b) => b.speed - a.speed);

  const available = !tile('meta').unavailable;
  const threats = ratingThreats(rating, data);
  return {
    coverage: { cells, defense: tile('defense').value, offense: tile('strength').value },
    // Ruoli: voci coperte sul totale (essenziali, importanti e minori), come nel pannello del voto
    roles: { chips, members: team.map(set => battleName(set)), value: `${rating.roles.covered}/${rating.roles.total}` },
    speed: {
      lanes, median: poolMedian(data), vsMeta: usesMeta(data),
      control: rating.speed.sources.map(s => ({ condition: s.condition, move: s.move, by: s.by })),
      value: tile('speed').value,
    },
    threats: {
      pods: threats.filter(x => !x.handledBy.length).sort((a, b) => b.usage - a.usage).map(x => ({ species: x.name, usage: x.usage })),
      total: threats.length,
      available,
      metaOff: !!data.ignoreMeta,
    },
  };
}
