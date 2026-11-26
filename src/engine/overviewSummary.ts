import type { TeamAnalysis } from './analysis';
import { signed } from '../i18n';
import { COVERED_LEVEL, holdSeverity, type CoachProblem } from './coach';
import type { EngineData } from './data';
import { ratingThreats, type TeamRating } from './rating';
import { LEVEL_KEYS, type LevelKey } from './roleLevels';
import { poolMedian } from './speed';

export type TileKey = 'defense' | 'strength' | 'roles' | 'speed' | 'meta' | 'bonusMalus';
export type TileStatus = 'good' | 'mid' | 'bad';
export type Missing = { kind: 'type'; type: string } | { kind: 'role'; need: LevelKey } | { kind: 'mon'; species: string };
export interface SpeedPoint { species: string; speed: number; share: number }
export interface SummaryTile {
  key: TileKey;
  status: TileStatus;
  value: string;
  missing: Missing[];
  unavailable?: boolean;
  speed?: { points: SpeedPoint[]; median: number | null; control: string[] };
  items?: { text: string; points: number }[];
}


/** Stato da un valore 0–100 (stesse soglie dell'area Velocità). */
const byValue = (v: number): TileStatus => (v >= 70 ? 'good' : v >= 50 ? 'mid' : 'bad');

/** I dati delle sei tessere del Riassunto, nell'ordine di TileKey. */
export function summarizeTeam(analysis: TeamAnalysis, rating: TeamRating, problems: CoachProblem[], data: EngineData): SummaryTile[] {
  // Difesa: tipi retti (Coverage tipi della Difesa, come il coach)
  const held = rating.defense.coverageTypes.rows;
  const exposed = held.filter(r => holdSeverity(rating, r.type) !== null);
  const defense: SummaryTile = {
    key: 'defense',
    value: `${held.length - exposed.length}/${held.length}`,
    missing: exposed.map(r => ({ kind: 'type', type: r.type })),
    status: problems.some(p => p.category === 'defense' && p.severity === 'serious') ? 'bad' : exposed.length ? 'mid' : 'good',
  };

  // Offesa: tipi coperti nel pacchetto dell'Offesa (livello 40, come il coach)
  const typeRows = rating.offense.types.rows;
  const unhit = typeRows.filter(r => r.level < COVERED_LEVEL);
  const strength: SummaryTile = {
    key: 'strength',
    value: `${typeRows.length - unhit.length}/${typeRows.length}`,
    missing: unhit.map(r => ({ kind: 'type', type: r.label })),
    status: unhit.length ? 'mid' : 'good',
  };

  // Ruoli: quelli che contano per l'archetipo (essenziali e importanti)
  const { levels, essentialMissing, importantMissing } = analysis.needs;
  const counted = LEVEL_KEYS.filter(k => levels[k] === 'essential' || levels[k] === 'important');
  const lacking = [...essentialMissing, ...importantMissing];
  const roles: SummaryTile = {
    key: 'roles',
    value: `${counted.length - lacking.length}/${counted.length}`,
    missing: lacking.map(need => ({ kind: 'role', need })),
    status: essentialMissing.length ? 'bad' : importantMissing.length ? 'mid' : 'good',
  };

  // Velocità: membri che superano oltre metà del gruppo
  const members = rating.speed.members;
  const speed: SummaryTile = {
    key: 'speed',
    value: `${members.filter(m => m.raw > 0.5).length}/${members.length}`,
    missing: [],
    status: byValue(rating.speed.value),
    speed: {
      points: members.map(m => ({ species: m.species, speed: m.speed, share: m.raw })),
      median: poolMedian(data),
      control: rating.speed.sources.map(s => s.move),
    },
  };

  // Meta: minacce che qualcuno regge (Coverage meta della Difesa)
  const threats = ratingThreats(rating, data);
  const score = rating.defense.coverageMeta?.value ?? null;
  const meta: SummaryTile = threats.length && score !== null
    ? {
      key: 'meta',
      value: `${threats.filter(t => t.handledBy.length > 0).length}/${threats.length}`,
      missing: threats.filter(t => !t.handledBy.length).map(t => ({ kind: 'mon', species: t.name })),
      status: byValue(score),
    }
    : { key: 'meta', value: '—', missing: [], status: 'mid', unavailable: true };

  // Bonus/Malus: netto e le due voci che pesano di più
  const net = rating.bonus.total - rating.penalty.total;
  const items = [
    ...rating.bonus.items.map(i => ({ text: i.text, points: i.points })),
    ...rating.penalty.items.map(i => ({ text: i.text, points: -i.points })),
  ].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 2);
  const bonusMalus: SummaryTile = { key: 'bonusMalus', value: signed(net, '±0'), missing: [], status: net >= 0 ? 'good' : 'bad', items };

  return [defense, strength, roles, speed, meta, bonusMalus];
}
