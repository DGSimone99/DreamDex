import { useEffect, useRef } from 'react';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { PokemonIcon } from './PokemonName';

/** Ultima modifica annullabile del team: membro rimosso o sostituito. */
export interface UndoAction {
  /** Cambia a ogni nuova azione: riparte il tempo. */
  id: number;
  /** Membro rimosso o sostituito, o team caricato da un link. */
  kind: 'remove' | 'add' | 'replace' | 'paste' | 'presets' | 'clear' | 'load' | 'clearList' | 'mySetDelete' | 'mySetOverwrite' | 'move' | 'savedDelete';
  from: string;
  to?: string;
  /** Preset migliori: Pokémon aggiunti negli slot vuoti. */
  added?: number;
  /** Completa team partito da un team vuoto. */
  created?: boolean;
}

/** Quanto resta l'avviso, se non ci passi sopra. */
export const UNDO_MS = 5000;

/** Avviso in basso con Annulla e ×: sparisce dopo 5 secondi, fermo finché ci sei sopra col mouse o la tastiera. */
export function UndoToast({ action, onUndo, onClose }: { action: UndoAction; onUndo: () => void; onClose: () => void }) {
  const t = useT();
  const remaining = useRef(UNDO_MS);
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
    remaining.current = UNDO_MS;
    resume();
    return pause;
  }, [action.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      key={action.id}
      className="undo-toast"
      role="status"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume(); }}
    >
      <p className="undo-text">
        {action.kind === 'move' ? t('undo.move', { member: action.from, change: action.to ?? '' })
          : action.kind === 'clearList' ? t('undo.listCleared', { list: action.from })
          : action.kind === 'mySetDelete' ? t('undo.mySetDeleted', { name: action.from })
          : action.kind === 'savedDelete' ? t('undo.savedDeleted', { name: action.from })
          : action.kind === 'mySetOverwrite' ? t('undo.mySetOverwritten', { name: action.from })
          : action.kind === 'load' ? t('undo.loaded')
          : action.kind === 'clear' ? t('undo.cleared')
          : action.kind === 'presets' && action.created ? t('undo.created', { to: action.to ?? '' })
          : action.kind === 'presets' ? (action.added
            ? t(action.added === 1 ? 'undo.filledOne' : 'undo.filledMany', { n: action.added, from: action.from, to: action.to ?? '' })
            : t('undo.presets', { from: action.from, to: action.to ?? '' })) : <>
        <PokemonIcon name={action.from} />
        <strong>{action.from}</strong>{' '}
        {action.kind === 'remove' ? t('undo.removed') : action.kind === 'add' ? t('undo.added') : action.kind === 'paste' ? t('undo.pasted') : (
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
      <span className="undo-timer" aria-hidden="true" style={{ animationDuration: `${UNDO_MS}ms` }} />
    </div>
  );
}
