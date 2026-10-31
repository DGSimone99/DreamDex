import { threatScore, type TeamAnalysis } from './analysis';
import { weaknessSeverity, type CoachProblem } from './coach';
import type { EngineData } from './data';
import type { TeamRating } from './rating';
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

/** Come `signed` della UI: meno vero per i negativi, ±0 per zero. */
const signedNet = (n: number) => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '±0');

/** Stato da un valore 0–100 (stesse soglie dell'area Velocità). */
const byValue = (v: number): TileStatus => (v >= 70 ? 'good' : v >= 50 ? 'mid' : 'bad');

/** I dati delle sei tessere del Riassunto, nell'ordine di TileKey. */
export function summarizeTeam(analysis: TeamAnalysis, rating: TeamRating, problems: CoachProblem[], data: EngineData): SummaryTile[] {
  // Difesa: tipi senza debolezza da correggere
  const exposed = analysis.weakness.filter(r => weaknessSeverity(r) !== null);
  const defense: SummaryTile = {
    key: 'defense',
    value: `${analysis.weakness.length - exposed.length}/${analysis.weakness.length}`,
    missing: exposed.map(r => ({ kind: 'type', type: r.type })),
    status: problems.some(p => p.category === 'defense' && p.severity === 'serious') ? 'bad' : exposed.length ? 'mid' : 'good',
  };

  // Offesa: tipi colpiti super efficace
  const unhit = analysis.coverage.filter(r => r.hitters.length === 0);
  const strength: SummaryTile = {
    key: 'strength',
    value: `${analysis.coverage.length - unhit.length}/${analysis.coverage.length}`,
    missing: unhit.map(r => ({ kind: 'type', type: r.type })),
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

  // Meta: minacce con almeno un check
  const threats = analysis.threats;
  const score = threatScore(analysis);
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
  const bonusMalus: SummaryTile = { key: 'bonusMalus', value: signedNet(net), missing: [], status: net >= 0 ? 'good' : 'bad', items };

  return [defense, strength, roles, speed, meta, bonusMalus];
}
