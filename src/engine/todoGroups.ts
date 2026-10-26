import type { CoachProblem, ProblemCategory } from './coach';

/** Un elemento di un gruppo: il dato non tradotto (tipo, specie, membro, voce dei ruoli); il nome si fa al momento di mostrarlo. */
export interface TodoItem { subject: string; serious: boolean }
export interface TodoGroup {
  kind: 'weak' | 'threats' | 'illegal' | 'roles' | 'single';
  severity: 'serious' | 'minor';
  items: TodoItem[];
  /** Il testo della riga singola. */
  text?: string;
  category: ProblemCategory;
  /** Quanti problemi raccoglie. */
  count: number;
  /** I testi interi dei problemi raccolti (tooltip e dettaglio nella densità ampia). */
  details: string[];
}

type GroupKind = Exclude<TodoGroup['kind'], 'single'>;

/** In che gruppo va un problema (null: riga singola). Senza `subjects` resta una riga singola. */
function kindOf(problem: CoachProblem): GroupKind | null {
  if (!problem.subjects?.length) return null;
  if (problem.category === 'defense') return 'weak';
  if (problem.category === 'meta') return 'threats';
  if (problem.category === 'rules' && problem.key !== 'rules:megas') return 'illegal';
  if (problem.key === 'roles:essential' || problem.key === 'roles:important') return 'roles';
  return null;
}

/**
 * I problemi del Coaching raggruppati per la Panoramica: debolezze, minacce, legalità e ruoli mancanti in un gruppo
 * ciascuno, il resto in righe singole. Dentro un gruppo prima gli elementi gravi; prima i gruppi gravi, poi i minori,
 * a parità nell'ordine dei problemi. Legge solo i dati dei problemi (`subjects`), mai i testi.
 */
export function groupProblems(problems: CoachProblem[]): TodoGroup[] {
  const sorted = [...problems].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'serious' ? -1 : 1));
  const groups: (TodoGroup & { at: number })[] = [];
  const byKind = new Map<GroupKind, TodoGroup & { at: number }>();
  sorted.forEach((problem, at) => {
    const serious = problem.severity === 'serious';
    const kind = kindOf(problem);
    if (!kind) {
      groups.push({ kind: 'single', severity: problem.severity, category: problem.category, text: problem.text, items: [], count: 1, details: [problem.text], at });
      return;
    }
    let group = byKind.get(kind);
    if (!group) {
      group = { kind, severity: problem.severity, items: [], category: problem.category, count: 0, details: [], at };
      byKind.set(kind, group);
      groups.push(group);
    }
    group.count++;
    group.details.push(problem.text);
    if (serious) group.severity = 'serious';
    for (const subject of problem.subjects ?? []) {
      // Un membro (o un ruolo) una volta sola: resta grave se uno dei suoi problemi lo è
      const seen = group.items.find(i => i.subject === subject);
      if (seen) seen.serious ||= serious;
      else group.items.push({ subject, serious });
    }
  });
  for (const group of groups) group.items = [...group.items.filter(i => i.serious), ...group.items.filter(i => !i.serious)];
  const rank = (g: TodoGroup) => (g.severity === 'serious' ? 0 : 1);
  return groups
    .sort((a, b) => rank(a) - rank(b) || a.at - b.at)
    .map(({ at: _at, ...group }) => group);
}
