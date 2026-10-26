import type { CoachProblem, ProblemCategory } from './coach';
import { t, type Lang, type MessageKey } from '../i18n';
import { typeName } from '../i18n/game';

export interface TodoItem { label: string; serious: boolean }
export interface TodoGroup {
  kind: 'weak' | 'threats' | 'illegal' | 'roles' | 'single';
  severity: 'serious' | 'minor';
  /** Il titolo del gruppo ("Debole a"); assente nelle righe singole. */
  title?: string;
  items: TodoItem[];
  /** Il testo della riga singola. */
  text?: string;
  category: ProblemCategory;
  /** Quanti problemi raccoglie. */
  count: number;
  /** I testi interi dei problemi raccolti, uno per riga nel tooltip (es. "Debole a Terra: 3 Deboli – 1 Resistono"). */
  details: string[];
}

type GroupKind = Exclude<TodoGroup['kind'], 'single'>;

const TITLES: Record<GroupKind, MessageKey> = {
  weak: 'dash.todo.weak',
  threats: 'dash.todo.threats',
  illegal: 'dash.todo.illegal',
  roles: 'dash.todo.roles',
};

/** La parte fissa di un testo prima del segnaposto `name` (es. "Ruoli mancanti: "). */
const before = (lang: Lang, key: MessageKey, name: string) => {
  const text = t(lang, key);
  return text.slice(0, text.indexOf(`{${name}}`));
};

/** La parte fissa subito dopo il segnaposto `name`, fino al segnaposto seguente (es. " non è legale in "). */
const after = (lang: Lang, key: MessageKey, name: string) => {
  const text = t(lang, key);
  const rest = text.slice(text.indexOf(`{${name}}`) + name.length + 2);
  const next = rest.indexOf('{');
  return next < 0 ? rest : rest.slice(0, next);
};

/** Il membro di un problema di legalità: "Garchomp: Mosse non legali…" o "Garchomp non è legale in…". */
function memberOf(problem: CoachProblem, lang: Lang): string {
  for (const key of ['coach.problem.illegal', 'coach.problem.gen'] as const) {
    const fixed = after(lang, key, 'species');
    const at = problem.text.indexOf(fixed);
    if (fixed && at > 0) return problem.text.slice(0, at);
  }
  const colon = problem.text.indexOf(': ');
  return colon > 0 ? problem.text.slice(0, colon) : problem.text;
}

/** I ruoli di "Ruoli mancanti: Hazard, Pivot" (le etichette non hanno virgole). */
function rolesOf(problem: CoachProblem, lang: Lang): string[] {
  const key = problem.key === 'roles:essential' ? 'coach.problem.missingRoles' : 'coach.problem.missingImportantRoles';
  const prefix = before(lang, key, 'roles');
  const list = problem.text.startsWith(prefix) ? problem.text.slice(prefix.length) : problem.text;
  return list.split(', ').filter(Boolean);
}

/** In che gruppo va un problema (null: riga singola) e coi suoi elementi. */
function classify(problem: CoachProblem, lang: Lang): { kind: GroupKind; labels: string[] } | null {
  const [, rest] = problem.key.split(/:(.*)/s);
  if (problem.category === 'defense') return { kind: 'weak', labels: [rest ? typeName(rest, lang) : problem.text] };
  if (problem.category === 'meta') return { kind: 'threats', labels: [rest ?? problem.text] };
  if (problem.category === 'rules' && problem.key !== 'rules:megas') return { kind: 'illegal', labels: [memberOf(problem, lang)] };
  if (problem.key === 'roles:essential' || problem.key === 'roles:important') return { kind: 'roles', labels: rolesOf(problem, lang) };
  return null;
}

/**
 * I problemi del Coaching raggruppati per la Panoramica: debolezze, minacce, legalità e ruoli mancanti in un gruppo
 * ciascuno, il resto in righe singole. Dentro un gruppo prima gli elementi gravi; prima i gruppi gravi, poi i minori,
 * a parità nell'ordine dei problemi.
 */
export function groupProblems(problems: CoachProblem[], lang: Lang): TodoGroup[] {
  const sorted = [...problems].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'serious' ? -1 : 1));
  const groups: (TodoGroup & { at: number })[] = [];
  const byKind = new Map<GroupKind, TodoGroup & { at: number }>();
  sorted.forEach((problem, at) => {
    const serious = problem.severity === 'serious';
    const match = classify(problem, lang);
    if (!match) {
      groups.push({ kind: 'single', severity: problem.severity, category: problem.category, text: problem.text, items: [], count: 1, details: [problem.text], at });
      return;
    }
    let group = byKind.get(match.kind);
    if (!group) {
      group = { kind: match.kind, severity: problem.severity, title: t(lang, TITLES[match.kind]), items: [], category: problem.category, count: 0, details: [], at };
      byKind.set(match.kind, group);
      groups.push(group);
    }
    group.count++;
    group.details.push(problem.text);
    if (serious) group.severity = 'serious';
    for (const label of match.labels) {
      // Un membro (o un ruolo) una volta sola: resta grave se uno dei suoi problemi lo è
      const seen = group.items.find(i => i.label === label);
      if (seen) seen.serious ||= serious;
      else group.items.push({ label, serious });
    }
  });
  for (const group of groups) group.items = [...group.items.filter(i => i.serious), ...group.items.filter(i => !i.serious)];
  const rank = (g: TodoGroup) => (g.severity === 'serious' ? 0 : 1);
  return groups
    .sort((a, b) => rank(a) - rank(b) || a.at - b.at)
    .map(({ at: _at, ...group }) => group);
}
