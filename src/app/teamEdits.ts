import { useEffect, useRef, useState } from 'react';
import type { CoachFix } from '../engine/coachFixes';
import type { Proposal } from '../engine/coachProposals';
import type { EngineData } from '../engine/data';
import { battleName } from '../engine/dex';
import type { Format } from '../engine/format';
import type { FormatChoice } from '../engine/formatChoice';
import { teraAllowed } from '../engine/formats';
import { duplicateSpecies } from '../engine/legalTeam';
import type { MoveFix } from '../engine/moveFixes';
import { rateTeam, type TeamRating } from '../engine/rating';
import { exportShowdown, type TeamSet } from '../engine/sets';
import type { Lang } from '../i18n';
import { gameName } from '../i18n/game';
import type { SharedTeam } from '../share';
import { saveSession, type Session } from '../storage';
import { copyText } from '../ui/clipboard';
import type { MoveProposal } from '../ui/TeamPanel';
import type { DoneNote, UndoAction } from '../ui/UndoToast';

/** Una modifica del team che si può annullare: vale finché il team resta quello lasciato dall'azione. */
export type TeamUndo = UndoAction & { before: TeamSet[]; after: TeamSet[]; choice?: FormatChoice };

/**
 * Il team, salvato nel browser col formato, e quello che gli sta attorno: il membro da sostituire, la proposta di mossa
 * aperta nell'editor, l'avviso di Annulla e quello di "fatto". Un link con un team (#t=...) vince sulla sessione salvata;
 * quella resta recuperabile con Annulla.
 */
export function useTeamState(storage: Storage | undefined, choice: FormatChoice, shared: SharedTeam | null, session: Session | null) {
  const [initialTeam] = useState<TeamSet[]>(() => shared?.team ?? session?.team ?? []);
  const [team, setTeam] = useState<TeamSet[]>(initialTeam);
  useEffect(() => {
    if (storage) saveSession({ team, choice }, storage);
  }, [team, choice, storage]);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  // Proposta di mossa del coach, aperta nell'editor del membro: ogni modifica del team o chiusura dell'editor la toglie
  const [moveProposal, setMoveProposal] = useState<MoveProposal | null>(null);
  const proposalNonce = useRef(0);
  // Il team più recente, anche fra un clic e il disegno dopo: due aggiunte di fila contano la prima
  const teamNow = useRef(team);
  teamNow.current = team;
  const changeTeam = (next: TeamSet[]) => {
    const value = next.slice(0, 6);
    teamNow.current = value;
    setTeam(value);
    setMoveProposal(null);
    setReplaceIndex(null);
    return value;
  };
  const [undo, setUndo] = useState<TeamUndo | null>(() =>
    shared && session?.team.length
      ? { id: 0, kind: 'load', from: '', before: session.team, after: initialTeam, choice: session.choice }
      : null);
  const undoId = useRef(0);
  // Esporta (barra del team e Coaching): il testo per Showdown negli appunti e il momento "team pronto" col voto
  const [done, setDone] = useState<DoneNote | null>(null);
  return { initialTeam, team, changeTeam, teamNow, replaceIndex, setReplaceIndex, moveProposal, setMoveProposal, proposalNonce, undo, setUndo, undoId, done, setDone };
}

type TeamState = ReturnType<typeof useTeamState>;

interface EditContext {
  format: Format;
  data: EngineData;
  lang: Lang;
  rating: TeamRating | null;
  choice: FormatChoice;
  setChoice: (choice: FormatChoice) => void;
}

/** Tutte le modifiche del team: ognuna si annulla per qualche secondo con l'avviso di Annulla. */
export function teamEdits(state: TeamState, { format, data, lang, rating, choice, setChoice }: EditContext) {
  const { team, changeTeam, teamNow, moveProposal, setMoveProposal, proposalNonce, undo, setUndo, undoId, setDone } = state;
  const remember = (action: Omit<UndoAction, 'id'>, after: TeamSet[]) =>
    setUndo({ ...action, id: ++undoId.current, before: team, after });

  // La lista dei candidati si ricalcola in sottofondo: finché non è pronta mostra ancora quella del team di prima, col
  // Pokémon appena aggiunto. Una seconda aggiunta veloce non fa entrare la stessa specie due volte (Species Clause: il
  // voto si bloccava e la lista restava vuota) né un settimo membro: non passa e un avviso dice perché
  const addSet = (set: TeamSet) => {
    const current = teamNow.current;
    const name = battleName(set);
    if (current.length >= 6) { setDone({ id: ++undoId.current, kind: 'full', name }); return; }
    if (duplicateSpecies([...current, set], format.formatId).includes(current.length)) { setDone({ id: ++undoId.current, kind: 'already', name }); return; }
    changeTeam([...current, set]);
  };
  const replaceAt = (index: number, set: TeamSet) => {
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (team[index]) remember({ kind: 'replace', from: battleName(team[index]), to: battleName(set) }, after);
  };
  // Set incollato: stesso Pokémon con un altro set, o un Pokémon diverso al suo posto
  const pasteAt = (index: number, set: TeamSet) => {
    const before = team[index];
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (before) remember(before.species === set.species
      ? { kind: 'paste', from: battleName(before) }
      : { kind: 'replace', from: battleName(before), to: battleName(set) }, after);
  };
  // Set intero cambiato dall'editor (preset Smogon, I miei set, spread più usati). Più cambi di fila: Annulla riporta il
  // set di prima dell'ultimo
  const setChangeAt = (index: number, set: TeamSet) => {
    const before = team[index];
    // Lo stesso set riapplicato (il preset già in uso): niente cambia, niente avviso
    if (before && JSON.stringify(before) === JSON.stringify(set)) return;
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (before) remember({ kind: 'setChange', from: battleName(before) }, after);
  };
  // Migliora i set (il preset migliore per ogni membro), Completa team, team da torneo caricato o team svuotato
  const bulk = (kind: 'presets' | 'fill' | 'clear' | 'tournament', next: TeamSet[]) => {
    const after = changeTeam(next);
    remember(kind === 'clear' ? { kind: 'clear', from: '' }
      : kind === 'tournament' ? { kind: 'tournament', from: '' }
      : { kind: 'presets', from: String(rating?.overall ?? '—'), to: String(rateTeam(after, data, lang)?.overall ?? ''),
        added: after.length - team.length, created: team.length === 0 }, after);
  };
  // Team importato o caricato dai team salvati: si annulla con il formato di prima. A team vuoto non c'è niente da
  // riavere: niente avviso
  const loadTeam = (next: TeamSet[], action: Omit<UndoAction, 'id'>, nextChoice?: FormatChoice, again = false) => {
    // Lo stesso import ritoccato (Custom Skillset sbloccato): l'Annulla resta quello del team di prima dell'import
    const chained = again && undo && undo.kind === 'import' && undo.after === team ? undo : null;
    if (again && !chained) { changeTeam(next); return; }
    const before = chained ? chained.before : team;
    const after = changeTeam(next);
    if (nextChoice) setChoice(nextChoice);
    if (before.length) setUndo({ ...action, id: ++undoId.current, before, after, choice: chained ? chained.choice : nextChoice ? choice : undefined });
    else setUndo(null);
  };
  const removeAt = (index: number) => {
    const after = changeTeam(team.filter((_, i) => i !== index));
    remember({ kind: 'remove', from: battleName(team[index]) }, after);
  };
  const undoTeam = () => {
    if (!undo) return;
    changeTeam(undo.before);
    if (undo.choice) setChoice(undo.choice);
    setUndo(null);
  };

  // Una mossa al posto di un'altra nel membro `index`; niente se lo slot non ha più la mossa di partenza
  const applyMove = ({ index, slot, from, to }: { index: number; slot: number; from: string; to: string }) => {
    const set = team[index];
    if (!set || (set.moves[slot] ?? '') !== from) return false;
    const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
    moves[slot] = to;
    const after = changeTeam(team.map((s, i) => (i === index ? { ...s, moves } : s)));
    const name = (move: string) => (move ? gameName('move', move, lang) : '—');
    remember({ kind: 'move', from: battleName(set), to: `${name(from)} → ${name(to)}` }, after);
    return true;
  };
  // Il membro si cerca per nome e lo slot deve avere ancora la mossa di partenza: altrimenti la proposta è vecchia
  const proposalIndex = (fix: MoveFix) => {
    const index = team.findIndex(set => battleName(set) === fix.member);
    return index >= 0 && (team[index].moves[fix.slot] ?? '') === fix.from ? index : -1;
  };
  // Proposta del Coaching aperta nell'editor del membro
  const openMoveFix = (fix: MoveFix) => {
    const index = proposalIndex(fix);
    if (index < 0) return;
    setMoveProposal({ index, slot: fix.slot, from: fix.from, to: fix.to, gain: fix.gain, nonce: ++proposalNonce.current });
  };
  const finishProposal = (applied: boolean) => {
    if (!applied || !moveProposal || !applyMove(moveProposal)) setMoveProposal(null);
  };
  // Clic su una proposta del Coaching: si applica subito, come Applica nell'editor o una sostituzione dalla scheda Pokémon
  const applyMoveFix = (fix: MoveFix) => {
    const index = proposalIndex(fix);
    if (index >= 0) applyMove({ index, slot: fix.slot, from: fix.from, to: fix.to });
  };
  // Un consiglio della Sfida applicato (EV o mossa): l'avviso dice cosa è cambiato ("+32 EV in DifSp, −32 in Att")
  const applyTip = (index: number, set: TeamSet, change: string) => {
    const before = team[index];
    if (!before) return;
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    remember({ kind: 'move', from: battleName(before), to: change }, after);
  };
  const applyFix = (fix: CoachFix) => {
    if (fix.kind === 'swap') {
      // Il membro si cerca per nome: se non c'è più (consigli di un team precedente), niente
      const index = team.findIndex(set => battleName(set) === fix.member);
      if (index >= 0) replaceAt(index, fix.set);
    } else if (team.length < 6) {
      const after = changeTeam([...team, fix.set]);
      remember({ kind: 'add', from: battleName(fix.set) }, after);
    }
  };
  // Il piano del Coaching: i passi uno dopo l'altro, con gli stessi set di Applica su ognuno (sostituzione per nome, mossa
  // solo se lo slot ha ancora quella di partenza, aggiunta se c'è posto); un solo Annulla riporta il team di prima del piano
  const applyPlan = (steps: Proposal[], to: string) => {
    let next = team;
    let done = 0;
    for (const p of steps) {
      if (p.kind === 'move') {
        const fix = p.fix;
        const index = next.findIndex(set => battleName(set) === fix.member);
        if (index < 0 || (next[index].moves[fix.slot] ?? '') !== fix.from) continue;
        const moves = [0, 1, 2, 3].map(i => next[index].moves[i] ?? '');
        moves[fix.slot] = fix.to;
        next = next.map((s, i) => (i === index ? { ...s, moves } : s));
      } else if (p.fix.kind === 'swap') {
        const index = next.findIndex(set => battleName(set) === p.fix.member);
        if (index < 0) continue;
        next = next.map((s, i) => (i === index ? p.fix.set : s));
      } else if (next.length < 6) {
        next = [...next, p.fix.set];
      } else continue;
      done++;
    }
    if (!done) return;
    const after = changeTeam(next);
    remember({ kind: 'plan', from: rating ? `${rating.grade} ${rating.overall}` : '—', to, added: done }, after);
  };

  const exportTeam = async () => {
    const ok = await copyText(exportShowdown(team, { tera: teraAllowed(format) }));
    if (ok) setDone({ id: ++undoId.current, kind: 'exported', grade: rating ? { grade: rating.grade, overall: rating.overall } : null });
    return ok;
  };

  return { addSet, replaceAt, pasteAt, setChangeAt, bulk, loadTeam, removeAt, undoTeam, applyMove, openMoveFix, finishProposal, applyMoveFix, applyTip, applyFix, applyPlan, exportTeam };
}
