import { teamArchetype, type Archetype } from './archetype';
import { battleName } from './dex';
import { roleLabel } from './roles';
import { rulesOf, type FormatRules } from './formatRules';
import type { EngineData } from './data';
import type { TeamSet } from './sets';
import { creditedValues, FAMILIES, measuredSubRoles, primaryFamily, type PrimaryFamily, type SubRole, type SubRoleValues } from './subRoles';
import { GROUP_ROLES, isGroupKey, LEVEL_KEYS, levelOf, type Level, type LevelKey } from './roleLevels';
import { t, type Lang } from '../i18n';

/**
 * Ciò di cui un team ha bisogno: una voce della tabella dei livelli (un sotto-ruolo, o "attacker" = un attaccante qualunque).
 * Priorità e controllo velocità non sono bisogni: li misura l'area Velocità.
 */
export type Need = LevelKey;

/** Pesi dei livelli per i candidati: essenziale, importante, minore. */
export const ESSENTIAL = 1;
export const USEFUL = 0.4;
/** Un ruolo minore conta poco: averlo aggiunge, non averlo toglie appena. */
export const NOT_REQUIRED = 0.15;
export const LEVEL_WEIGHT: Record<Level, number> = { essential: ESSENTIAL, important: USEFUL, minor: NOT_REQUIRED, ignored: 0 };

/** Sotto il valore di team 0,5 la voce manca (stessa soglia con cui un membro "ha" un sotto-ruolo, rolesList). */
export const MISSING_BELOW = 0.5;

export interface TeamNeeds {
  /** Archetipo con cui si giudicano i ruoli: quello del team completo, "balance" per un team incompleto. */
  archetype: Archetype;
  /** Livello di ogni voce per l'archetipo, con l'interruttore applicato. */
  levels: Record<LevelKey, Level>;
  /** Valore del team per voce: il migliore dei membri ("attacker": il miglior sotto-ruolo d'Attacco). */
  values: Record<LevelKey, number>;
  /** Voci essenziali e importanti che mancano (valore del team sotto MISSING_BELOW), nell'ordine della tabella. */
  essentialMissing: LevelKey[];
  importantMissing: LevelKey[];
  /** I sotto-ruoli che coprirebbero le voci mancanti (per il punteggio dei candidati). */
  missingRoles: SubRole[];
  /** Valori misurati di ogni membro, nell'ordine del team (grezzi, per la scheda). */
  members: SubRoleValues[];
  /** Famiglia principale di ogni membro fra Attacco e muri (null se non ha nessuna delle due). */
  primary: (PrimaryFamily | null)[];
  /** Valori di ogni membro col credito del secondario per l'archetipo: da questi vengono i valori di team. */
  credited: SubRoleValues[];
  /** Regole del formato con cui sono stati riconosciuti i ruoli (per giudicare allo stesso modo i candidati). */
  rules: FormatRules;
}

/** Archetipo con cui giudicare i ruoli del team. */
export function needsArchetype(team: TeamSet[], rules: FormatRules): Archetype {
  return teamArchetype(team, rules)?.archetype ?? 'balance';
}

/** I sotto-ruoli dietro una voce: i gruppi degli attaccanti (almeno uno Sweeper, un Wallbreaker, un fisico, uno speciale) o il sotto-ruolo stesso. */
export const keyRoles = (key: LevelKey): SubRole[] => (isGroupKey(key) ? GROUP_ROLES[key] : [key]);

/** Valore di una voce per un membro (o un candidato): il miglior sotto-ruolo dietro la voce. */
export const keyValue = (v: SubRoleValues, key: LevelKey): number => Math.max(0, ...keyRoles(key).map(r => v[r] ?? 0));

/** Chi copre una voce: i membri col valore misurato (col credito del secondario) almeno MISSING_BELOW, come i bisogni. */
export const ownersOf = (team: TeamSet[], needs: Pick<TeamNeeds, 'credited' | 'members'>, need: Need): string[] =>
  team.filter((_, i) => keyValue(needs.credited[i] ?? needs.members[i] ?? {}, need) >= MISSING_BELOW).map(set => battleName(set));

/** `forced`: livelli e credito dei ruoli secondo quel tipo di team invece di quello riconosciuto. */
export function teamNeeds(team: TeamSet[], data: EngineData, members?: SubRoleValues[], forced?: Archetype): TeamNeeds {
  const rules = rulesOf(data);
  const archetype = forced ?? needsArchetype(team, rules);
  const measured = members ?? team.map(set => measuredSubRoles(set, team, data));
  const levels = Object.fromEntries(LEVEL_KEYS.map(k => [k, levelOf(archetype, k)])) as Record<LevelKey, Level>;
  // Il secondario conta secondo l'archetipo (stall 0, semi-stall metà, altrimenti pieno); i grezzi restano in `members`
  const primary = team.map((set, i) => primaryFamily(set, measured[i] ?? {}));
  const credited = team.map((_, i) => creditedValues(measured[i] ?? {}, primary[i], archetype));
  const values = Object.fromEntries(LEVEL_KEYS.map(k => [k, Math.max(0, ...credited.map(m => keyValue(m, k)))])) as Record<LevelKey, number>;
  const missing = (level: Level) => LEVEL_KEYS.filter(k => levels[k] === level && values[k] < MISSING_BELOW);
  const essentialMissing = missing('essential');
  const importantMissing = missing('important');
  // Lo squilibrio fra attaccanti fisici e speciali lo dicono le righe "Attaccante fisico" e "Attaccante speciale", col
  // livello del tipo di team (2026-11-05: tolto il malus a parte "un solo stile", che contava due volte la stessa mancanza)
  return {
    archetype, levels, values, essentialMissing, importantMissing,
    missingRoles: [...new Set([...essentialMissing, ...importantMissing].flatMap(keyRoles))],
    members: measured, primary, credited,
    rules,
  };
}

/** Nome del bisogno: i sotto-ruoli col loro nome, "Sweeper", "Wallbreaker", "Attaccante fisico" / "Attaccante speciale" per i gruppi. */
export function needLabel(need: Need, lang: Lang = 'it'): string {
  return isGroupKey(need) ? t(lang, `need.${need}`) : roleLabel(need, lang);
}
