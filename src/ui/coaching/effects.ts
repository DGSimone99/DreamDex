import type { CoachProblem } from '../../engine/coach';
import type { CoachFix } from '../../engine/coachFixes';
import { areaValue, PROPOSAL_AREAS, type Proposal, type ProposalArea } from '../../engine/coachProposals';
import { battleSpecies } from '../../engine/dex';
import type { MoveFix } from '../../engine/moveFixes';
import { needLabel, type Need } from '../../engine/needs';
import type { LevelKey } from '../../engine/roleLevels';
import { rolesPointsLabel } from '../../engine/rolesArea';
import type { AreaSnapshot } from '../../engine/teamGain';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { problemEntries, type ProblemEntry } from '../ProblemPill';
import { typeColor } from '../Sprite';
import { gainText } from './gainText';

/** Le azioni sulle proposte: applicarle (Applica) e aprirle nella scheda Pokémon o nell'editor. */
export interface RowActions {
  onFix: (fix: CoachFix) => void; onMoveFix: (fix: MoveFix) => void; onApplyFix: (fix: CoachFix) => void; onApplyMove: (fix: MoveFix) => void;
  /** Applica il piano: tutti i suoi passi in ordine, con un solo Annulla (`to`: il voto dopo l'ultimo passo, "A 84"). */
  onApplyPlan?: (steps: Proposal[], to: string) => void;
}

/** Le debolezze in comune (un malus di Bonus/Malus) le dice già la Difesa ("0 reggono"): non si ripetono fra le pillole. */
export const shown = (p: CoachProblem) => !p.key.startsWith('redundancy:sharedWeak:');

/** Il nome dell'area come nelle schede (Offesa, Difesa, Velocità, Ruoli, Bonus/Malus) e le Regole. */
export const AREA_NAME: Record<ProposalArea, 'area.strength' | 'area.defense' | 'area.speed' | 'area.roles' | 'area.bonusMalus' | 'coach.area.rules'> = {
  strength: 'area.strength', defense: 'area.defense', speed: 'area.speed', roles: 'area.roles', bonusMalus: 'area.bonusMalus', rules: 'coach.area.rules',
};

/** Il valore di un'area da scrivere: Offesa, Difesa e Velocità arrotondate, Bonus/Malus col segno ("+6"), Ruoli "7/8 +2". */
function areaText(snapshot: AreaSnapshot, area: ProposalArea): string | null {
  if (area === 'rules') return null;
  if (area === 'roles') return [`${snapshot.roles.covered}/${snapshot.roles.total}`, rolesPointsLabel(snapshot.roles.points)].filter(Boolean).join(' ');
  if (area === 'bonusMalus') return gainText(snapshot.bonusMalus).replace('±0', '0');
  const v = snapshot[area];
  return v === null ? null : String(Math.round(v));
}

/** Un'area che cambia con una proposta: il nome e "da → a" (su o giù). */
export interface AreaMove { area: ProposalArea; from: string; to: string; up: boolean; delta: number }

/** Cosa fa una proposta: i problemi che risolve (pillole), le aree che salgono e quelle che scendono, i ruoli d'aiuto persi. */
export interface Effects { solved: ProblemEntry[]; ups: AreaMove[]; downs: AreaMove[]; lost: LevelKey[] }

/**
 * Cosa fa una proposta, per la carta grande e le righe: i problemi risolti (chi entra non "risolve" la minaccia che è lui
 * stesso), le aree che salgono e quelle che scendono ("da → a" dai valori del voto di ora e del voto col cambio, `after`,
 * già calcolati nella classifica) e i ruoli d'aiuto che il team perde (swapGuard.ts). Le Regole non hanno un valore: le
 * dice il problema risolto.
 */
export function effectsOf(p: Proposal, problems: CoachProblem[], before: AreaSnapshot | null): Effects {
  const solves = new Set(p.fix.solves);
  const self = p.kind === 'fix' ? p.fix.species : null;
  // Un problema delle Regole (due Mega, un Pokémon bannato) viene per primo: Showdown rifiuta il team finché c'è
  const solved = problemEntries(problems.filter(x => solves.has(x.key) && shown(x) && !(x.category === 'meta' && self && x.subjects?.includes(self))))
    .sort((a, b) => Number(isRule(b)) - Number(isRule(a)));
  const after = p.fix.after ?? null;
  const moves: AreaMove[] = [];
  if (before && after) {
    for (const area of PROPOSAL_AREAS) {
      const was = areaValue(before, area);
      const now = areaValue(after, area);
      const from = areaText(before, area);
      const to = areaText(after, area);
      if (was === null || now === null || was === now || from === null || to === null) continue;
      // Di quanto cambia (Ruoli: i ruoli coperti se cambiano, se no i punti)
      const delta = area === 'roles'
        ? Math.abs(after.roles.covered - before.roles.covered) || Math.abs(after.roles.points - before.roles.points)
        : Math.abs(now - was);
      moves.push({ area, from, to, up: now > was, delta });
    }
  }
  // Le aree che scendono dalla più colpita: la prima è la stessa che la riga della classifica scrive in rosso ("−3 Dif")
  const downs = moves.filter(m => !m.up).sort((a, b) => b.delta - a.delta);
  return { solved, ups: moves.filter(m => m.up), downs, lost: p.fix.lostHelpers ?? [] };
}

/** Il nome corto di un'area per la riga della classifica ("Dif"), accanto al costo. */
export const AREA_SHORT: Record<Exclude<ProposalArea, 'rules'>, 'coach.short.strength' | 'coach.short.defense' | 'coach.short.speed' | 'coach.short.roles' | 'coach.short.bonusMalus'> = {
  strength: 'coach.short.strength', defense: 'coach.short.defense', speed: 'coach.short.speed', roles: 'coach.short.roles', bonusMalus: 'coach.short.bonusMalus',
};

/** L'area che scende di più con una proposta (il costo da mostrare nella riga), o null se non scende niente. */
export const biggestLoss = (downs: AreaMove[]): AreaMove | null =>
  downs.filter(m => m.area !== 'rules' && m.delta > 0).reduce<AreaMove | null>((best, m) => (!best || m.delta > best.delta ? m : best), null);

/** Le aree che scendono a parole, per lo screen reader: "Difesa scende di 3; Velocità scende di 2". */
export const lossText = (downs: AreaMove[], tr: ReturnType<typeof useT>) =>
  downs.filter(m => m.area !== 'rules').map(m => tr('coach.cost.drops', { area: tr(AREA_NAME[m.area]), n: m.delta })).join('; ');

/** Un problema delle Regole (Showdown rifiuta il team): primo fra i risolti e in rosso. */
export const isRule = (entry: ProblemEntry) => entry.problem.category === 'rules';

/** Il testo intero di un problema risolto (fumetti e lettori di schermo): il ruolo col suo nome, il resto col problema. */
export const solvedText = (entry: ProblemEntry, lang: ReturnType<typeof useLang>) => (entry.role ? needLabel(entry.role as Need, lang) : entry.problem.text);

/** Il nome della proposta per lo screen reader (e per il pulsante Applica): "Ting-Lu al posto di Kingambit, voto +3". */
export function proposalName(p: Proposal, tr: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>): string {
  const gain = gainText(p.fix.gain);
  if (p.kind === 'move') {
    const to = gameName('move', p.fix.to, lang);
    return p.fix.from
      ? tr('coach.row.moveName', { to, from: gameName('move', p.fix.from, lang), member: p.fix.member, gain })
      : tr('coach.row.moveNameEmpty', { to, member: p.fix.member, gain });
  }
  return p.fix.kind === 'add' ? tr('coach.row.addName', { species: p.fix.species, gain }) : tr('coach.row.swapName', { species: p.fix.species, member: p.fix.member ?? '', gain });
}

/** Il primo tipo di chi entra (o del membro che cambia mossa): il colore della zona del Pokémon, come le carte del team. */
export const firstType = (p: Proposal) => (battleSpecies(p.fix.set)?.types[0] as string | undefined) ?? '';

/** I tipi vicini al magenta: la loro luce nella carta farebbe concorrenza ad Applica (l'unico magenta della scheda). */
const NEAR_MAGENTA = new Set(['Psychic', 'Fairy']);

/**
 * La luce della fascia VS: il primo tipo; per Psico e Folletto il secondo tipo se c'è, altrimenti il colore del tipo
 * smorzato verso il grigio (resta riconoscibile ma non compete con Applica).
 */
export function heroTone(p: Proposal): string {
  const types = (battleSpecies(p.fix.set)?.types ?? []) as string[];
  const calm = types.find(t => !NEAR_MAGENTA.has(t));
  return calm ? typeColor(calm) : `color-mix(in srgb, ${typeColor(types[0] ?? '')} 45%, var(--faint))`;
}

/** Chi entra (o il membro che cambia mossa): lo sprite della proposta. */
export const subjectOf = (p: Proposal) => (p.kind === 'fix' ? p.fix.species : p.fix.member);
