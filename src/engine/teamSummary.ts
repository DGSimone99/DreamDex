import { cardRoles, weatherOf, type Archetype, type TeamStyle } from './archetype';
import type { Coaching } from './coach';
import type { EngineData } from './data';
import { battleName, toID } from './dex';
import { rulesOf } from './formatRules';
import type { Need } from './needs';
import type { DashboardData } from './overviewDashboard';
import type { TeamRating } from './rating';
import type { TeamSet } from './sets';
import { measuredSubRoles } from './subRoles';
import { conditionName } from './synergy';
import type { Lang } from '../i18n';

/** Offesa del membro (il numero della tabella di Offesa) da cui è un attaccante "top". */
export const TOP_ATTACKER = 85;
/** Mosse di campo mostrate nel Riassunto (id). */
export const FIELD_MOVES = ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'reflect', 'lightscreen', 'auroraveil', 'trickroom'];

/** items: nomi inglesi delle mosse (la vista li traduce); weather: già nella lingua dell'interfaccia. */
export interface FieldSetter { member: string; items: string[]; weather?: string }
export interface TeamSummary {
  archetype: Archetype | null;
  styles: TeamStyle[];
  attackers: string[];
  walls: string[];
  field: FieldSetter[];
  hits: { covered: number; total: number };
  /** Tipi che nessuno colpisce super efficace (vista ampia). */
  hitsMissing: string[];
  /** Gravi prima; resist: quanti membri resistono (0 = nessuno). */
  weak: { type: string; serious: boolean; resist: number }[];
  missingRoles: Need[];
  /** Ruoli essenziali e importanti, coperti o no (vista ampia). */
  keyRoles: { need: Need; covered: boolean }[];
  /** Offesa e Difesa del membro per nome in battaglia, come nelle tabelle delle schede (vista ampia). */
  offenseOf: Record<string, number>;
  defenseOf: Record<string, number>;
  /** null: meta spento o senza statistiche. */
  threats: { species: string; usage: number }[] | null;
}

/** I dati del Riassunto della Panoramica: solo riuso di ciò che il motore già calcola. */
export function teamSummary(team: TeamSet[], rating: TeamRating, coaching: Coaching, dash: DashboardData, data: EngineData, lang: Lang = 'it'): TeamSummary {
  const rules = rulesOf(data);
  const attackers: string[] = [];
  const walls: string[] = [];
  const field: FieldSetter[] = [];
  team.forEach(set => {
    const name = battleName(set);
    // Per nome: i membri senza Offesa non sono nella lista, gli indici non corrispondono al team
    const m = rating.offense.members.find(x => x.species === name);
    if (m && m.value >= TOP_ATTACKER) attackers.push(name);
    const roles = cardRoles(set, rules, measuredSubRoles(set, team, data));
    if (roles.includes('physicalWall') || roles.includes('specialWall')) walls.push(name);
    // Mosse di campo e meteo del membro
    const items = set.moves.filter(mv => FIELD_MOVES.includes(toID(mv)));
    const weather = weatherOf(set);
    if (items.length || weather) field.push({ member: name, items, ...(weather ? { weather: conditionName(weather.condition, lang) } : {}) });
  });

  const weak = coaching.problems
    .filter(p => p.key.startsWith('defense:'))
    .map(p => {
      const type = p.key.slice('defense:'.length);
      return { type, serious: p.severity === 'serious', resist: dash.coverage.cells.find(c => c.type === type)?.resist ?? 0 };
    })
    .sort((a, b) => Number(b.serious) - Number(a.serious));

  return {
    archetype: coaching.teamType?.archetype ?? null,
    styles: coaching.teamType?.styles ?? [],
    attackers,
    walls,
    field,
    hits: { covered: dash.coverage.cells.filter(c => c.offense === 'ok').length, total: dash.coverage.cells.length },
    hitsMissing: dash.coverage.cells.filter(c => c.offense !== 'ok').map(c => c.type),
    weak,
    missingRoles: dash.roles.chips.filter(c => c.level !== 'minor' && !c.covered).map(c => c.need),
    keyRoles: dash.roles.chips.filter(c => c.level !== 'minor').map(c => ({ need: c.need, covered: c.covered })),
    offenseOf: Object.fromEntries(rating.offense.members.map(m => [m.species, m.value])),
    defenseOf: Object.fromEntries(rating.defense.members.map(m => [m.species, m.value])),
    threats: dash.threats.available && !dash.threats.metaOff ? dash.threats.pods : null,
  };
}
