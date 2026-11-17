import type { CoachAdvice, CoachProblem, ProblemCategory } from './coach';
import type { CoachFix } from './coachFixes';
import { leads } from './coachSteps';
import type { MoveFix } from './moveFixes';
import type { AreaSnapshot } from './teamGain';

/** Una proposta del Coaching: un cambio di Pokémon (sostituzione o aggiunta) o un cambio di mossa. */
export type Proposal = { kind: 'fix'; fix: CoachFix } | { kind: 'move'; fix: MoveFix };

/** Le alternative al massimo nella tendina di una riga ("Altre N"). */
export const MAX_ALTERNATIVES = 5;

/**
 * Una riga del Coaching: la proposta migliore del gruppo e, nella tendina, le altre del gruppo dalla più utile.
 * `lead`: il problema principale del gruppo (chiave), null per i cambi che alzano il voto senza risolvere problemi.
 */
export interface ProposalGroup {
  id: string;
  lead: string | null;
  /** La proposta migliore per prima, poi le alternative (al più MAX_ALTERNATIVES), dal voto più alto. */
  options: Proposal[];
}

/** Chi lascia il posto: il membro sostituito (o ritoccato, per una mossa), o un posto libero per un'aggiunta. */
const seatOf = (p: Proposal) => (p.kind === 'move' ? `move:${p.fix.index}` : p.fix.kind === 'add' ? 'add' : `swap:${p.fix.index}`);

/**
 * Le proposte del Coaching come righe, dalla più utile (+N più alto).
 *
 * Regola dei gruppi: due proposte stanno nella stessa riga se lasciano lo stesso posto (lo stesso membro sostituito,
 * un posto libero per le aggiunte, o le mosse dello stesso membro) e hanno lo stesso problema principale. Il problema
 * principale di una proposta è il primo, fra quelli che risolve, nell'ordine dei problemi del Coaching (gravi prima, poi
 * l'ordine delle categorie), contando solo quelli che possono guidare una proposta (`leads`: la coverage minore no); se ne
 * risolve solo di quelli, il primo di loro; se non ne risolve nessuno, il gruppo è "alza il voto" di quel posto.
 * Così ogni alternativa risolve almeno il problema principale della riga, e la lista non ripete righe quasi uguali
 * (cinque sostituti di Kingambit per le stesse minacce sono una riga con "Altre 4"). Nel gruppo le proposte vanno dal
 * voto più alto (a pari voto quella che risolve di più); la prima è la riga, le altre (al più MAX_ALTERNATIVES) la
 * tendina. Le righe vanno dal voto più alto della loro prima proposta; a pari voto prima chi risolve problemi gravi,
 * poi chi ne risolve di più, poi l'ordine del motore.
 *
 * Lo stesso Pokémon in posti diversi: se risolve gli stessi problemi (le stesse chiavi) è una riga sola, col posto
 * migliore; gli altri posti vanno nella sua tendina ("al posto di Iron Valiant"). Se risolve problemi diversi restano
 * righe diverse.
 */
export function proposalGroups(problems: CoachProblem[], advice: Pick<CoachAdvice, 'fixes' | 'moves'>): ProposalGroup[] {
  const order = new Map<string, number>();
  const serious = new Set<string>();
  [...problems]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Number(b.p.severity === 'serious') - Number(a.p.severity === 'serious') || a.i - b.i)
    .forEach(({ p }, i) => {
      if (!order.has(p.key)) order.set(p.key, i);
      if (p.severity === 'serious') serious.add(p.key);
    });
  const byKey = new Map(problems.map(p => [p.key, p]));
  const leadOf = (solves: string[]): string | null => {
    const known = [...new Set(solves)].filter(k => order.has(k)).sort((a, b) => order.get(a)! - order.get(b)!);
    return known.find(k => leads(byKey.get(k)!)) ?? known[0] ?? null;
  };
  const all: Proposal[] = [...advice.fixes.map(fix => ({ kind: 'fix' as const, fix })), ...(advice.moves ?? []).map(fix => ({ kind: 'move' as const, fix }))];
  const solved = (p: Proposal) => p.fix.solves.filter(k => order.has(k)).length;
  const seriousSolved = (p: Proposal) => p.fix.solves.filter(k => serious.has(k)).length;
  const better = (a: Proposal, b: Proposal) => b.fix.gain - a.fix.gain || seriousSolved(b) - seriousSolved(a) || solved(b) - solved(a);
  const groups = new Map<string, { id: string; lead: string | null; items: { p: Proposal; i: number }[] }>();
  all.forEach((p, i) => {
    const lead = leadOf(p.fix.solves);
    const id = `${seatOf(p)}|${lead ?? ''}`;
    let group = groups.get(id);
    if (!group) groups.set(id, (group = { id, lead, items: [] }));
    group.items.push({ p, i });
  });
  const sorted = [...groups.values()]
    .map(g => ({ ...g, items: g.items.sort((a, b) => better(a.p, b.p) || a.i - b.i) }))
    .sort((a, b) => better(a.items[0].p, b.items[0].p) || a.items[0].i - b.items[0].i);
  // Lo stesso Pokémon che entra in posti diversi risolvendo le stesse cose: una riga sola (la migliore), gli altri posti
  // nella sua tendina dopo le sue alternative
  const sameKey = (p: Proposal) => (p.kind === 'fix'
    ? `${p.fix.species}|${[...new Set(p.fix.solves.filter(k => order.has(k)))].sort().join(',')}` : null);
  const merged: typeof sorted = [];
  const byMon = new Map<string, (typeof sorted)[number]>();
  for (const g of sorted) {
    const key = sameKey(g.items[0].p);
    const host = key ? byMon.get(key) : undefined;
    if (host) { host.items.push(...g.items); continue; }
    if (key) byMon.set(key, g);
    merged.push(g);
  }
  return merged.map(g => {
    const [first, ...rest] = g.items;
    return { id: g.id, lead: g.lead, options: [first, ...rest.sort((a, b) => better(a.p, b.p) || a.i - b.i)].slice(0, MAX_ALTERNATIVES + 1).map(x => x.p) };
  });
}

/** I problemi che almeno una proposta del Coaching risolve (le pillole delle aree sono link solo per loro). */
export function solvedKeys(advice: Pick<CoachAdvice, 'fixes' | 'moves'>): Set<string> {
  return new Set([...advice.fixes, ...(advice.moves ?? [])].flatMap(f => f.solves));
}

/** Le aree come le mostra il Coaching nelle righe: le quattro del voto, i Ruoli e le Regole (senza valore). */
export type ProposalArea = 'strength' | 'defense' | 'speed' | 'roles' | 'bonusMalus' | 'rules';

/** L'area di un problema nelle righe: le stesse delle testate delle aree (Ruoli e Bonus divisi nei loro due nomi). */
export function areaOfProblem(category: ProblemCategory): ProposalArea {
  switch (category) {
    case 'defense': case 'meta': return 'defense';
    case 'coverage': case 'metaHit': return 'strength';
    case 'roles': return 'roles';
    case 'rules': return 'rules';
    default: return 'bonusMalus';
  }
}

/** L'ordine delle aree nelle righe e nella riga verde: Offesa, Difesa, Velocità, Ruoli, Bonus/Malus, Regole. */
export const PROPOSAL_AREAS: ProposalArea[] = ['strength', 'defense', 'speed', 'roles', 'bonusMalus', 'rules'];

/** Il valore di un'area come numero da confrontare (più alto è meglio); null senza valore (o le Regole). */
export function areaValue(snapshot: AreaSnapshot, area: ProposalArea): number | null {
  if (area === 'rules') return null;
  if (area === 'roles') return snapshot.roles.covered * 1000 + snapshot.roles.points;
  if (area === 'bonusMalus') return snapshot.bonusMalus;
  const v = snapshot[area];
  return v === null ? null : Math.round(v);
}
