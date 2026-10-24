import type { EngineData } from './data';
import { battleName } from './dex';
import { keyRoles, keyValue, needLabel, teamNeeds, type TeamNeeds } from './needs';
import { LEVEL_KEYS, type Level, type LevelKey } from './roleLevels';
import type { Redundancy } from './rating';
import { softScore } from './scale';
import { subRoleReasons, type SubRoleValues } from './subRoles';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';

/** Ogni ruolo minore aggiunge il 3% del suo valore di team, fino al 12% in tutto. */
export const MINOR_STEP = 0.03;
export const MINOR_CAP = 0.12;
/** Riferimento dell'area: base + extra = 1 vale come le altre aree al riferimento (scala morbida, 100 irraggiungibile). */
export const ROLES_FULL = 1;
/** Malus di ogni voce essenziale mancante (solo team di 6). */
export const ESSENTIAL_POINTS = 2;
/** Lo squilibrio degli attaccanti tiene il suo malus di sempre (testo "Nessun attaccante fisico/speciale"). */
export const ONE_STYLE_POINTS = 3;

export interface RoleRow {
  key: LevelKey;
  level: Level;
  /** Valore del team per la voce: il migliore dei membri. */
  value: number;
  /** Chi la porta, dal valore più alto, con la fonte (mossa, abilità o motivo misurato). */
  by: { species: string; value: number; source: string }[];
}

export interface TeamRoles {
  /** 0–100 (0 se il team è vuoto: allora l'area non c'è). */
  value: number;
  /** Media dei valori di team delle voci importanti (1 se l'archetipo non ne ha). */
  base: number;
  /** Extra dei minori, fino a MINOR_CAP. */
  extra: number;
  /** Voci dell'archetipo non ignorate, nell'ordine della tabella. */
  rows: RoleRow[];
  /** Mancanze essenziali come penalità (solo team di 6). */
  failures: Redundancy[];
  members: { species: string; values: SubRoleValues }[];
}

/** Punteggio puro dai valori di team: base degli importanti (1 senza importanti), extra dei minori, valore 0–99. */
export function rolesScore(importantValues: number[], minorValues: number[]): { base: number; extra: number; value: number } {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const base = importantValues.length ? importantValues.reduce((a, v) => a + clamp(v), 0) / importantValues.length : 1;
  const extra = Math.min(MINOR_CAP, MINOR_STEP * minorValues.reduce((a, v) => a + clamp(v), 0));
  return { base, extra, value: softScore((base + extra) / ROLES_FULL) };
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Mancanze essenziali di un team di 6: −2 per voce, più lo squilibrio degli attaccanti (−3). */
function essentialFailures(team: TeamSet[], needs: TeamNeeds, lang: Lang): Redundancy[] {
  if (team.length !== 6) return [];
  const archetype = t(lang, `archetype.${needs.archetype}`);
  const items: Redundancy[] = needs.essentialMissing.map(key => ({
    text: key === 'attacker'
      ? t(lang, 'rating.failure.noAttacker')
      : t(lang, 'rating.failure.missing', { archetype, role: lowerFirst(needLabel(key, lang)) }),
    points: ESSENTIAL_POINTS,
  }));
  if (needs.needStyle) items.push({ text: t(lang, 'rating.redundancy.oneStyle', { style: t(lang, `analysis.style.${needs.needStyle}`) }), points: ONE_STYLE_POINTS });
  return items;
}

/** Area Ruoli: voci importanti e minori dell'archetipo coi valori del team; le essenziali mancanti sono penalità. */
export function teamRolesArea(team: TeamSet[], data: EngineData, lang: Lang, given?: TeamNeeds): TeamRoles {
  if (team.length === 0) return { value: 0, base: 0, extra: 0, rows: [], failures: [], members: [] };
  const needs = given ?? teamNeeds(team, data);
  const reasons = team.map(set => subRoleReasons(set, team, data));
  const rows: RoleRow[] = LEVEL_KEYS.filter(key => needs.levels[key] !== 'ignored').map(key => {
    const by = team.map((set, i) => {
      const value = keyValue(needs.members[i] ?? {}, key);
      // La fonte del sotto-ruolo migliore dietro la voce (per "attacker": il miglior sotto-ruolo d'Attacco)
      const role = keyRoles(key).reduce((best, r) => ((needs.members[i]?.[r] ?? 0) > (needs.members[i]?.[best] ?? 0) ? r : best));
      const source = reasons[i].find(r => r.role === role)?.source ?? '';
      return { species: battleName(set), value, source };
    }).filter(b => b.value > 0).sort((a, b) => b.value - a.value);
    return { key, level: needs.levels[key], value: needs.values[key], by };
  });
  const of = (level: Level) => rows.filter(r => r.level === level).map(r => r.value);
  const score = rolesScore(of('important'), of('minor'));
  return {
    ...score, rows,
    failures: essentialFailures(team, needs, lang),
    members: team.map((set, i) => ({ species: battleName(set), values: needs.members[i] ?? {} })),
  };
}
