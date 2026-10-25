import { useEffect, useId, useRef, useState } from 'react';
import type { TeamSet } from '../engine/sets';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { MY_SETS_MAX } from '../storage';
import { Icon } from './icons';
import {
  deleteMySet, mySetByName, mySetIndex, mySetsOf, overwriteMySet, renameMySet, saveMySet, setMySets, useMySets,
} from './mySets';
import { UndoToast, type UndoAction } from './UndoToast';

/**
 * I miei set: un campo dove scrivere il nome con il salvataggio attaccato (sovrascrive se il nome esiste già),
 * e un elenco dove applicare, rinominare o eliminare. Sovrascrivere ed eliminare si possono annullare.
 */
export function MySetsField({ set, onApply }: { set: TeamSet; onApply: (saved: TeamSet) => void }) {
  const t = useT();
  const lang = useLang();
  const species = set.species;
  const mine = useMySets(species);
  const current = mySetIndex(mine, set);
  const [name, setName] = useState('');
  // Il campo mostra il nome del set salvato uguale a quello attuale; scrivendo diventa il nome del prossimo salvataggio
  const currentName = current >= 0 ? mine[current].name : '';
  useEffect(() => { setName(currentName); }, [currentName]);
  const existing = name.trim() ? mySetByName(mine, name) : -1;
  const full = mine.length >= MY_SETS_MAX;
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [undo, setUndo] = useState<(UndoAction & { before: ReturnType<typeof mySetsOf> }) | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) { setOpen(false); setRenaming(null); } };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const remember = (kind: 'mySetDelete' | 'mySetOverwrite', from: string) =>
    setUndo({ id: Date.now(), kind, from, before: mySetsOf(species) });

  const save = () => {
    if (existing >= 0) {
      remember('mySetOverwrite', mine[existing].name);
      overwriteMySet(species, existing, set);
    } else {
      saveMySet(species, set, n => t('editor.mySetName', { n }), name);
    }
  };
  const canSave = existing >= 0 || (!full && current < 0);
  const saveLabel = existing >= 0 ? t('editor.overwriteSet', { name: mine[existing].name }) : t('editor.saveSet');

  return (
    <div className="field my-sets-field" ref={root}>
      <span className="field-head">{t('editor.mySets')}</span>
      <div className="joined">
        <span className="my-sets-input">
          <input
            aria-label={t('editor.mySets')}
            placeholder={t('editor.mySetsPlaceholder')}
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSave) { e.preventDefault(); save(); } else if (e.key === 'Escape') setOpen(false); }}
          />
          <button type="button" className="my-sets-toggle" aria-label={t('editor.mySetsShow')} aria-expanded={open} aria-controls={listId}
            disabled={mine.length === 0} onClick={() => setOpen(o => !o)}>
            <Icon name="next" />
          </button>
        </span>
        <button type="button" className={`save-set${existing >= 0 ? ' overwrite' : ''}`} aria-label={saveLabel} disabled={!canSave}
          title={!canSave && full ? t('editor.saveSetFull') : saveLabel} onClick={save}>
          <Icon name={existing >= 0 ? 'overwrite' : 'save'} />
        </button>
      </div>
      {open && mine.length > 0 && (
        <ul className="my-sets-list" id={listId} role="listbox" aria-label={t('combobox.options', { label: t('editor.mySets') })}>
          {mine.map((saved, i) => (
            <li key={`${saved.name}-${i}`} className={i === current ? 'current' : undefined}>
              {renaming === i ? (
                <input autoFocus aria-label={t('editor.renameInput', { name: saved.name })} value={draft} maxLength={40}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); renameMySet(species, i, draft); setRenaming(null); }
                    else if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); }
                  }} />
              ) : (
                <span role="option" aria-selected={i === current} tabIndex={0} className="my-set-option"
                  onClick={() => { onApply(saved.set); setOpen(false); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApply(saved.set); setOpen(false); } }}>
                  <strong>{saved.name}</strong>
                  <small>{saved.set.moves.filter(Boolean).map(move => gameName('move', move, lang)).join(' · ')}</small>
                </span>
              )}
              <button type="button" className="my-set-rename" aria-label={t('editor.renameSet', { name: saved.name })}
                onClick={() => { setRenaming(i); setDraft(saved.name); }}><Icon name="edit" /></button>
              <button type="button" className="my-set-delete" aria-label={t('editor.deleteNamed', { name: saved.name })}
                onClick={() => { remember('mySetDelete', saved.name); deleteMySet(species, i); }}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      )}
      {undo && (
        <UndoToast action={undo} onClose={() => setUndo(null)}
          onUndo={() => { setMySets(species, undo.before); setUndo(null); }} />
      )}
    </div>
  );
}
