import { useEffect, useLayoutEffect, useRef, type FocusEvent } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';
import { SMALL } from './useBackClose';

/**
 * Modifica annullabile delle Liste: una raccolta svuotata o sostituita (Copia da… › Sostituisci; `from` = la raccolta),
 * un Pokémon tolto da un box (`from` = il Pokémon, `to` = la lista).
 */
export interface ListUndo { kind: 'clearList' | 'listReplace' | 'listRemove'; from: string; to?: string }

/** Ultima modifica annullabile del team: membro rimosso o sostituito. */
export interface UndoAction {
  /** Cambia a ogni nuova azione: riparte il tempo. */
  id: number;
  /** Membro rimosso o sostituito (`setChange`: il suo set cambiato per intero nell'editor), o team caricato da un link, importato o preso dai team salvati (`loadSaved`, il nome in `from`). */
  kind: 'remove' | 'add' | 'replace' | 'paste' | 'setChange' | 'presets' | 'clear' | 'load' | 'import' | 'loadSaved' | ListUndo['kind'] | 'mySetDelete' | 'mySetOverwrite' | 'move' | 'savedDelete' | 'tournament' | 'plan';
  from: string;
  to?: string;
  /** Completa team: Pokémon aggiunti negli slot vuoti. */
  added?: number;
  /** Completa team partito da un team vuoto. */
  created?: boolean;
}

/** Quanto resta l'avviso, se non ci passi sopra: 3 secondi per un membro solo, 6 quando cambia tutto il team (o una lista
 *  intera). Sta al centro dello schermo: dura poco, e passandoci sopra si ferma (scelta dell'utente, 2026-11-14). */
export const UNDO_MS = 3000;
export const UNDO_BIG_MS = 6000;
const BIG: UndoAction['kind'][] = ['clear', 'load', 'import', 'loadSaved', 'presets', 'tournament', 'plan', 'clearList', 'listReplace', 'savedDelete'];
export const undoDuration = (kind: UndoAction['kind']) => (BIG.includes(kind) ? UNDO_BIG_MS : UNDO_MS);

/**
 * Il tempo di un avviso: `duration` ms dall'arrivo (o da quando cambia `id`), poi `onClose`; fermo finché ci sei sopra col
 * mouse o la tastiera. Restituisce i gestori da mettere sull'avviso.
 */
function useToastTimer(id: number, duration: number, onClose: () => void) {
  const remaining = useRef(duration);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current -= Date.now() - started.current;
  };
  const resume = () => {
    if (timer.current) return;
    started.current = Date.now();
    timer.current = setTimeout(() => close.current(), remaining.current);
  };

  useEffect(() => {
    remaining.current = duration;
    resume();
    return pause;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    onMouseEnter: pause,
    onMouseLeave: resume,
    onFocus: pause,
    onBlur: (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume(); },
  };
}

/**
 * Un avviso senza Annulla: il team copiato per Showdown (col voto del team), o un'aggiunta che non è passata perché la
 * specie è già nel team (`already`) o il team è pieno (`full`), col nome del Pokémon.
 */
export type DoneNote =
  | { id: number; kind: 'exported'; grade?: { grade: string; overall: number } | null }
  | { id: number; kind: 'already' | 'full'; name: string };

/**
 * Il momento "team pronto": lo stesso avviso di Annulla (al centro, bordo ciano, la barra del tempo), con la spunta verde,
 * "Team copiato per Showdown" e il voto del team; 3 secondi, fermo finché ci sei sopra, × per chiuderlo. Lo usano Esporta
 * nella barra del team ed Esporta per Showdown nel Coaching. Senza animazioni (prefers-reduced-motion) compare e basta.
 */
export function DoneToast({ note, onClose }: { note: DoneNote; onClose: () => void }) {
  const t = useT();
  const handlers = useToastTimer(note.id, UNDO_MS, onClose);
  return (
    <div key={note.id} className={`undo-toast done-toast${note.kind === 'exported' ? '' : ' skipped'}`} role="status" {...handlers}>
      <p className="undo-text">
        <Icon name={note.kind === 'exported' ? 'check' : 'warning'} />
        <strong>{note.kind === 'exported' ? t('showdown.quickCopied') : t(note.kind === 'full' ? 'team.addFull' : 'team.addAlready', { name: note.name })}</strong>
        {note.kind === 'exported' && note.grade && (
          <b className={`done-grade grade-${note.grade.grade}`}>
            <span className="visually-hidden">{t('showdown.readyGrade')} </span>{note.grade.grade} {note.grade.overall}
          </b>
        )}
      </p>
      <button type="button" className="undo-close" aria-label={t('undo.close')} onClick={onClose}><Icon name="close" /></button>
      <span className="undo-timer" aria-hidden="true" style={{ animationDuration: `${UNDO_MS}ms` }} />
    </div>
  );
}

/** Spazio minimo fra il nome del membro e il pulsante Set per l'avviso su una riga (sotto, resta al centro). */
const DOCK_MIN = 300;

/**
 * Con l'editor di un membro aperto l'avviso al centro coprirebbe i suoi comandi: diventa una riga sola nella testata
 * dell'editor, nello spazio vuoto fra il nome del membro e il pulsante Set (misurato a ogni disegno e quando la finestra
 * cambia). Telefono e tablet (l'editor copre lo schermo) o spazio troppo stretto: resta dove sta di solito.
 */
function useDock(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const title = document.querySelector('.slot.open .editor-title')?.getBoundingClientRect();
      const actions = document.querySelector('.slot.open .editor-actions')?.getBoundingClientRect();
      const small = typeof window.matchMedia === 'function' && window.matchMedia(SMALL).matches;
      const left = title ? title.right + 16 : 0;
      const right = actions ? actions.left - 16 : 0;
      if (!on || small || !title || !actions || right - left < DOCK_MIN) {
        el.classList.remove('docked');
        el.style.removeProperty('left'); el.style.removeProperty('top'); el.style.removeProperty('max-width');
        return;
      }
      el.classList.add('docked');
      el.style.left = `${(left + right) / 2}px`;
      el.style.top = `${(actions.top + actions.bottom) / 2}px`;
      el.style.maxWidth = `${right - left}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  return ref;
}

/**
 * Avviso al centro dell'area di lavoro con Annulla e ×: sparisce dopo 3 o 6 secondi, fermo finché ci sei sopra col mouse o
 * la tastiera. `docked`: con l'editor aperto si mette in una riga nella sua testata (useDock), senza coprirne i comandi.
 */
export function UndoToast({ action, onUndo, onClose, docked = false }: { action: UndoAction; onUndo: () => void; onClose: () => void; docked?: boolean }) {
  const t = useT();
  const duration = undoDuration(action.kind);
  const handlers = useToastTimer(action.id, duration, onClose);
  const dock = useDock(docked);

  return (
    <div
      key={action.id}
      ref={dock}
      className="undo-toast"
      role="status"
      {...handlers}
    >
      <p className="undo-text">
        {action.kind === 'move' ? t('undo.move', { member: action.from, change: action.to ?? '' })
          : action.kind === 'clearList' ? t('undo.listCleared', { list: action.from })
          : action.kind === 'listReplace' ? t('undo.listReplaced', { list: action.from })
          : action.kind === 'mySetDelete' ? t('undo.mySetDeleted', { name: action.from })
          : action.kind === 'savedDelete' ? t('undo.savedDeleted', { name: action.from })
          : action.kind === 'mySetOverwrite' ? t('undo.mySetOverwritten', { name: action.from })
          : action.kind === 'load' ? t('undo.loaded')
          : action.kind === 'import' ? t('undo.imported')
          : action.kind === 'loadSaved' ? t('undo.loadedSaved', { name: action.from })
          : action.kind === 'clear' ? t('undo.cleared')
          : action.kind === 'tournament' ? t('undo.tournament')
          : action.kind === 'plan' ? t(action.added === 1 ? 'undo.planOne' : 'undo.plan', { n: action.added ?? 0, from: action.from, to: action.to ?? '' })
          : action.kind === 'presets' && action.created ? t('undo.created', { to: action.to ?? '' })
          : action.kind === 'presets' ? (action.added
            ? t(action.added === 1 ? 'undo.filledOne' : 'undo.filledMany', { n: action.added, from: action.from, to: action.to ?? '' })
            : t('undo.presets', { from: action.from, to: action.to ?? '' })) : <>
        <PokemonIcon name={action.from} />
        <strong>{action.from}</strong>{' '}
        {action.kind === 'listRemove' ? t('undo.listRemoved', { list: action.to ?? '' }) : action.kind === 'remove' ? t('undo.removed') : action.kind === 'add' ? t('undo.added') : action.kind === 'paste' ? t('undo.pasted') : action.kind === 'setChange' ? t('undo.setChanged') : (
          <>
            <Icon name="swap" /> {t('undo.replacedWith')}{' '}
            <PokemonIcon name={action.to ?? ''} />
            <strong>{action.to}</strong>
          </>
        )}
        </>}
      </p>
      <div className="undo-actions">
        <button type="button" className="undo-button" onClick={onUndo}><Icon name="undo" /> {t('undo.undo')}</button>
        <button type="button" className="undo-close" aria-label={t('undo.close')} onClick={onClose}><Icon name="close" /></button>
      </div>
      <span className="undo-timer" aria-hidden="true" style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
}
