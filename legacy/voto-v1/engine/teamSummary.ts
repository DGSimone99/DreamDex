import { cardRoles, type Archetype, type TeamStyle } from './archetype';
import type { Coaching } from './coach';
import { teamCores, type Core } from './cores';
import type { EngineData } from './data';
import { battleName, getMove, toID } from './dex';
import { rulesOf } from './formatRules';
import type { DashboardData } from './overviewDashboard';
import type { TeamRating } from './rating';
import type { TeamSet } from './sets';
import { measuredSubRoles } from './subRoles';
import { hasSetup, HAZARD_MOVES } from './roles';
import { benefits, conditionName, enables } from './synergy';
import { teamLinks, type TeamLink } from './teamLinks';
import { gameName } from '../i18n/game';
import type { Lang } from '../i18n';

/** Offesa del membro (il numero della tabella di Offesa) da cui è un attaccante "top". */
export const TOP_ATTACKER = 85;
/** Mosse di schermo e Tailwind mostrate come condizioni (id). */
const SCREEN_MOVES = ['reflect', 'lightscreen', 'auroraveil', 'tailwind'];

/** Chi approfitta di una condizione; via: abilità o mossa (inglese) con cui la sfrutta, se c'è (gli schermi non l'hanno). */
export interface ConditionUser { name: string; via?: string }
/** Una condizione portata da un membro; key: id della condizione o della mossa di schermo; label già nella lingua dell'interfaccia. */
export interface ConditionRow { member: string; label: string; key: string; users: ConditionUser[] }
/** Hazard messi da un membro (nomi inglesi delle mosse, la vista li traduce). */
export interface HazardRow { member: string; moves: string[] }
export interface TeamSummary {
  archetype: Archetype | null;
  styles: TeamStyle[];
  attackers: string[];
  walls: string[];
  /** Offesa e Difesa del membro per nome in battaglia, come nelle tabelle delle schede. */
  offenseOf: Record<string, number>;
  defenseOf: Record<string, number>;
  conditions: ConditionRow[];
  hazards: HazardRow[];
  cores: Core[];
  links: TeamLink[];
}

/** I dati del Riassunto della Panoramica: riusa ciò che il motore già calcola e ne ricava core e legami di squadra. `_dash` resta per non cambiare la firma. */
export function teamSummary(team: TeamSet[], rating: TeamRating, coaching: Coaching, _dash: DashboardData, data: EngineData, lang: Lang = 'it'): TeamSummary {
  const rules = rulesOf(data);
  const attackers: string[] = [];
  const walls: string[] = [];
  const conditions: ConditionRow[] = [];
  const hazards: HazardRow[] = [];
  const named = team.map(set => ({ set, name: battleName(set), roles: cardRoles(set, rules, measuredSubRoles(set, team, data)) }));
  named.forEach(({ set, name, roles }) => {
    // Per nome: i membri senza Offesa non sono nella lista, gli indici non corrispondono al team
    const m = rating.offense.members.find(x => x.species === name);
    if (m && m.value >= TOP_ATTACKER) attackers.push(name);
    if (roles.includes('physicalWall') || roles.includes('specialWall')) walls.push(name);
    const others = named.filter(o => o.set !== set);
    // Meteo, campi e Trick Room: chi ne approfitta tra i compagni (mai il portatore stesso)
    for (const link of enables(set)) {
      const users = others.flatMap(o => {
        const use = benefits(o.set).find(b => b.condition === link.condition);
        return use ? [{ name: o.name, via: use.via }] : [];
      });
      conditions.push({ member: name, label: conditionName(link.condition, lang), key: link.condition, users });
    }
    // Schermi: servono ai membri con una mossa di potenziamento; Tailwind non ha un beneficiario fisso
    const ids = set.moves.map(toID);
    for (const key of SCREEN_MOVES) {
      if (!ids.includes(key)) continue;
      const users = key === 'tailwind' ? [] : others.filter(o => hasSetup(o.set)).map(o => ({ name: o.name }));
      conditions.push({ member: name, label: gameName('move', getMove(key)?.name ?? key, lang), key, users });
    }
    const mine = set.moves.filter(mv => HAZARD_MOVES.has(toID(mv)));
    if (mine.length) hazards.push({ member: name, moves: mine.map(mv => getMove(mv)?.name ?? mv) });
  });

  return {
    archetype: coaching.teamType?.archetype ?? null,
    styles: coaching.teamType?.styles ?? [],
    attackers,
    walls,
    offenseOf: Object.fromEntries(rating.offense.members.map(m => [m.species, m.value])),
    defenseOf: Object.fromEntries(rating.defense.members.map(m => [m.species, m.value])),
    conditions,
    hazards,
    cores: teamCores(team),
    links: teamLinks(team, attackers),
  };
}
