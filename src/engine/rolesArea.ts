import type { EngineData } from './data';
import { battleName, battleSpecies } from './dex';
import { keyRoles, keyValue, MISSING_BELOW, needLabel, teamNeeds, type TeamNeeds } from './needs';
import type { Archetype } from './archetype';
import { LEVEL_KEYS, type Level, type LevelKey } from './roleLevels';
import type { Redundancy } from './rating';
import { secondaryRoles, subRoleReasons, type PrimaryFamily, type SubRoleReason, type SubRoleValues } from './subRoles';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';

/**
 * I Ruoli sono una lista, non un voto: per il tipo di team ogni voce è coperta (un membro col valore di team almeno
 * MISSING_BELOW) o manca. Nel voto entrano solo i malus delle mancanze (team di 6); in doppio anche il bonus dei minori coperti.
 * Calibrazione 2026-11-02 (banco): partite vere 50,4% → 52,4% (alto livello) e 53,1% → 55,8% (ladder).
 */
/** Malus di ogni voce essenziale mancante (solo team di 6 specie riconosciute). */
export const ESSENTIAL_POINTS = 4;
/** Malus di ogni voce importante mancante (solo team di 6 specie riconosciute). */
export const IMPORTANT_POINTS = 2;
/**
 * Bonus di ogni voce minore coperta, solo in doppio (le sue quattro minori sono scelte sulle partite vere del doppio).
 * Nel singolo dal 2026-11-21 (utente) i minori non danno punti: erano +1 l'uno senza tetto, in media +2,8 ai team da
 * torneo e +3,2 ai medi (National Dex OU), un regalo che non distingueva. Restano nella lista; il pivot ha il suo bonus,
 * solo se il team lo sfrutta (pivotBonus.ts).
 */
export const MINOR_POINTS = 1;
/** Quanto vale una voce minore coperta per il tipo di team: MINOR_POINTS in doppio, niente nel singolo. */
export const minorPointsFor = (archetype: Archetype): number => (archetype === 'doubles' ? MINOR_POINTS : 0);

/**
 * Il conteggio dei Ruoli, uguale ovunque (Panoramica, Coaching, sottoscheda Ruoli, carta del voto): coperti sul totale
 * delle sole essenziali e importanti (le minori non sono un difetto se mancano) e i punti dei Ruoli sul voto (i malus
 * delle mancanze; in doppio anche il bonus dei minori), es. "6/8 −6".
 */
export function rolesTally(roles: TeamRoles) {
  const counted = roles.rows.filter(r => r.level === 'essential' || r.level === 'important');
  const missingEssential = counted.filter(r => r.level === 'essential' && r.value < MISSING_BELOW).length;
  const missingImportant = counted.filter(r => r.level === 'important' && r.value < MISSING_BELOW).length;
  const missing = missingEssential + missingImportant;
  const points = roles.bonuses.reduce((n, b) => n + b.points, 0) - roles.failures.reduce((n, f) => n + f.points, 0);
  return { covered: counted.length - missing, total: counted.length, missing, missingEssential, missingImportant, points };
}

/** I punti col segno (− tipografico), vuoto se 0: la coda del conteggio ("8/8 +2"). */
export const rolesPointsLabel = (points: number): string => (points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '');

/** Il conteggio in testo: "8/8 +2", "6/8 −6", "8/8". */
export const rolesValue = (roles: TeamRoles): string => {
  const { covered, total, points } = rolesTally(roles);
  return [`${covered}/${total}`, rolesPointsLabel(points)].filter(Boolean).join(' ');
};

export interface RoleRow {
  key: LevelKey;
  level: Level;
  /** Valore del team per la voce: il migliore dei membri. */
  value: number;
  /**
   * Chi la porta, dal valore più alto (col credito del secondario), con la fonte (mossa, abilità o motivo misurato);
   * `secondary`: il sotto-ruolo è della famiglia non principale del membro.
   */
  by: { species: string; value: number; source: string; secondary?: boolean }[];
}

export interface TeamRoles {
  /** Voci coperte e voci in tutto (essenziali, importanti e minori del tipo di team). */
  covered: number;
  total: number;
  /** Voci dell'archetipo non ignorate, nell'ordine della tabella. */
  rows: RoleRow[];
  /** Mancanze essenziali e importanti come malus (solo team di 6 specie riconosciute). */
  failures: Redundancy[];
  /** Voci minori coperte come bonus: solo in doppio (minorPointsFor), nel singolo sempre vuoto. */
  bonuses: Redundancy[];
  /**
   * Valori grezzi e motivi di ogni membro (per le schede delle famiglie), la famiglia principale e i valori col
   * credito del secondario (senza: uguali ai grezzi).
   */
  members: { species: string; values: SubRoleValues; reasons: SubRoleReason[]; primary: PrimaryFamily | null; credited?: SubRoleValues }[];
}

/**
 * Malus di un team di 6: −4 per ogni essenziale mancante, −2 per ogni importante mancante. Contano 6 specie riconosciute,
 * come nel resto del voto: con una specie sconosciuta il team è provvisorio e i ruoli mancanti non costano (2026-11-08).
 */
function roleFailures(team: TeamSet[], needs: TeamNeeds, lang: Lang): Redundancy[] {
  if (team.filter(set => !!battleSpecies(set)).length !== 6) return [];
  const archetype = t(lang, `archetype.${needs.archetype}`);
  const missing = (keys: LevelKey[], text: 'rating.failure.missing' | 'rating.failure.missingImportant', points: number, catalog: 'essentialRole' | 'importantRole') =>
    keys.map(key => ({ text: t(lang, text, { archetype, role: needLabel(key, lang) }), points, catalog }));
  return [
    ...missing(needs.essentialMissing, 'rating.failure.missing', ESSENTIAL_POINTS, 'essentialRole'),
    ...missing(needs.importantMissing, 'rating.failure.missingImportant', IMPORTANT_POINTS, 'importantRole'),
  ];
}

/** Ruoli: la lista delle voci del tipo di team coi valori del team; le mancanze sono malus, in doppio i minori coperti bonus. */
export function teamRolesArea(team: TeamSet[], data: EngineData, lang: Lang, given?: TeamNeeds): TeamRoles {
  if (team.length === 0) return { covered: 0, total: 0, rows: [], failures: [], bonuses: [], members: [] };
  const needs = given ?? teamNeeds(team, data);
  const reasons = team.map(set => subRoleReasons(set, team, data));
  const rows: RoleRow[] = LEVEL_KEYS.filter(key => needs.levels[key] !== 'ignored').map(key => {
    const by = team.map((set, i) => {
      const values = needs.credited[i] ?? {};
      const value = keyValue(values, key);
      // La fonte del sotto-ruolo migliore dietro la voce (per i gruppi: il lato che vale di più)
      const role = keyRoles(key).reduce((best, r) => ((values[r] ?? 0) > (values[best] ?? 0) ? r : best));
      const source = reasons[i].find(r => r.role === role)?.source ?? '';
      const secondary = secondaryRoles(needs.primary[i] ?? null).includes(role);
      return secondary ? { species: battleName(set), value, source, secondary } : { species: battleName(set), value, source };
    }).filter(b => b.value > 0).sort((a, b) => b.value - a.value);
    return { key, level: needs.levels[key], value: needs.values[key], by };
  });
  const covered = rows.filter(r => r.value >= MISSING_BELOW);
  return {
    covered: covered.length, total: rows.length, rows,
    failures: roleFailures(team, needs, lang),
    bonuses: minorPointsFor(needs.archetype) > 0
      ? covered.filter(r => r.level === 'minor').map(r => ({ text: t(lang, 'rating.bonus.minorRole', { role: needLabel(r.key, lang) }), points: minorPointsFor(needs.archetype), catalog: 'minorRole' as const }))
      : [],
    members: team.map((set, i) => ({
      species: battleName(set), values: needs.members[i] ?? {}, reasons: reasons[i],
      primary: needs.primary[i] ?? null, credited: needs.credited[i] ?? needs.members[i] ?? {},
    })),
  };
}
