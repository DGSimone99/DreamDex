import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import type { Format, FormatId } from '../engine/format';
import { formatLabel } from '../engine/formats';
import { GAME_IDS, type GameId } from '../engine/games';
import {
  activeScope, clearScope, copyLists, countOf, createList, customIdOf, customScope, deleteList, LIST_CONTEXTS, renameList,
  setActive, type ListContext, type ListScope, type UserLists,
} from '../engine/lists';
import { t, type Lang } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './icons';
import type { ListUndo } from './UndoToast';

const isGame = (context: ListContext): context is GameId => (GAME_IDS as string[]).includes(context);

/** Il nome di una raccolta come lo mostra l'interfaccia: il formato o il gioco, "Universale", il nome dato dall'utente. */
export function scopeName(lists: UserLists, scope: ListScope, lang: Lang): string {
  if (scope === 'universal') return t(lang, 'lists.universal');
  const id = customIdOf(scope);
  if (id !== null) return lists.custom.find(c => c.id === id)?.name ?? id;
  return isGame(scope as ListContext) ? t(lang, `game.${scope as GameId}`) : formatLabel({ formatId: scope as FormatId } as Format, lang);
}

const ITEMS = '[role^="menuitem"]:not([aria-disabled="true"]), .lists-menu-input';

/** Frecce su e giù (in giro), Home e End fra le voci del menu; Invio e Spazio restano alla voce (il suo clic). */
function menuKeys(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(ITEMS)];
  if (!items.length) return;
  // Nel campo del nome Home e End restano al testo
  if ((e.key === 'Home' || e.key === 'End') && (e.target as HTMLElement).tagName === 'INPUT') return;
  e.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
    : e.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length - 1 : at - 1);
  items[next].focus();
}

/** Un menu che si apre sotto il suo pulsante: si chiude cliccando fuori o con Esc (il fuoco torna al pulsante). */
function useMenu(rootRef: RefObject<HTMLElement | null>, buttonRef: RefObject<HTMLButtonElement | null>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: globalThis.KeyboardEvent) => {
      // Esc nel campo del nome annulla solo il nome (lo gestisce il campo)
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('.lists-menu-form')) return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, rootRef, buttonRef]);
  return [open, setOpen] as const;
}

/** All'apertura il fuoco va sulla voce scelta (o sulla prima). */
function useFocusFirst(open: boolean, ref: RefObject<HTMLElement | null>, key?: string) {
  useEffect(() => {
    if (!open) return;
    const menu = ref.current;
    const target = menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>(ITEMS);
    target?.focus();
  }, [open, ref, key]);
}

/** Campo del nome dentro un menu: Invio conferma, Esc annulla (senza chiudere tutto il menu). */
function NameField({ label, initial, onDone, onCancel }: { label: string; initial: string; onDone: (name: string) => void; onCancel: () => void }) {
  const tr = useT();
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const ok = value.trim().length > 0;
  return (
    <form className="lists-menu-form" onSubmit={e => { e.preventDefault(); if (ok) onDone(value.trim()); }}>
      <input ref={input} className="lists-menu-input" aria-label={label} placeholder={tr('lists.namePlaceholder')} value={value} maxLength={40}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }} />
      <button type="submit" className="lists-menu-ok" disabled={!ok}>{tr('lists.nameOk')}</button>
    </form>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="lists-menu-group">
      <p id={id} className="lists-menu-head" role="presentation">{label}</p>
      {children}
    </div>
  );
}

interface Props {
  lists: UserLists;
  format: Format;
  /** Il contesto di adesso (il gioco o il formato). */
  context: ListContext;
  /** La raccolta che si guarda e si modifica. */
  shown: ListScope;
  onShow: (scope: ListScope) => void;
  onChange: (next: UserLists, undo?: ListUndo) => void;
}

/**
 * Testata delle Liste: "Liste: {raccolta} ▾" (con "attiva" se è quella che usano i suggerimenti) e il menu delle
 * raccolte (del formato, Universale, personalizzate, + Nuova raccolta…); "⋯" con Copia da… (aggiungi o sostituisci),
 * Rinomina, Svuota ed Elimina.
 */
export function ListsPicker({ lists, format, context, shown, onShow, onChange }: Props) {
  const tr = useT();
  const lang = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const pickMenu = useRef<HTMLDivElement>(null);
  const moreMenu = useRef<HTMLDivElement>(null);
  const [pickOpen, setPickOpen] = useMenu(rootRef, pickRef);
  const [moreOpen, setMoreOpen] = useMenu(rootRef, moreRef);
  const [creating, setCreating] = useState(false);
  // Passi del menu "⋯": le azioni, la raccolta da cui copiare, come copiarla, il nuovo nome
  const [step, setStep] = useState<{ kind: 'actions' } | { kind: 'source' } | { kind: 'mode'; from: ListScope } | { kind: 'rename' }>({ kind: 'actions' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const menuId = useId();
  useFocusFirst(pickOpen && !creating, pickMenu);
  useFocusFirst(moreOpen && step.kind !== 'rename', moreMenu, step.kind);

  const active = activeScope(lists, context);
  const name = (scope: ListScope) => scopeName(lists, scope, lang);
  const shownName = name(shown);
  const shownCustom = customIdOf(shown);
  const [shownFav, shownBan] = countOf(lists, shown);

  const counts = (scope: ListScope) => {
    const [fav, ban] = countOf(lists, scope);
    return { fav, ban, empty: fav + ban === 0 };
  };
  const hasData = (scope: ListScope) => !counts(scope).empty;
  const formats = LIST_CONTEXTS.filter(c => c === context || hasData(c));

  const openPick = () => { setMoreOpen(false); setCreating(false); setPickOpen(o => !o); };
  const openMore = () => { setPickOpen(false); setStep({ kind: 'actions' }); setMoreOpen(o => !o); };
  const closeAll = () => { setPickOpen(false); setMoreOpen(false); setCreating(false); setStep({ kind: 'actions' }); };

  const choose = (scope: ListScope) => {
    const next = setActive(lists, context, scope);
    if (next !== lists) onChange(next);
    onShow(scope);
    setNote(null);
    closeAll();
    pickRef.current?.focus();
  };
  const create = (title: string) => {
    const made = createList(lists, title);
    onChange(setActive(made.lists, context, customScope(made.id)));
    onShow(customScope(made.id));
    setNote(null);
    closeAll();
    pickRef.current?.focus();
  };
  const copy = (from: ListScope, mode: 'add' | 'replace') => {
    const result = copyLists(lists, from, shown, format, mode);
    onChange(result.lists, mode === 'replace' ? { kind: 'listReplace', from: shownName } : undefined);
    setNote(tr('lists.copied', { copied: result.copied, skipped: result.skipped, format: formatLabel(format, lang) }));
    closeAll();
    moreRef.current?.focus();
  };

  const entry = (scope: ListScope) => {
    const { fav, ban, empty } = counts(scope);
    const isActive = scope === active;
    const detail = empty ? tr('lists.emptyCount') : `${fav} · ${ban}`;
    return (
      <button key={scope} type="button" role="menuitemradio" aria-checked={scope === shown} tabIndex={-1}
        className={`lists-menu-item${scope === shown ? ' on' : ''}`} onClick={() => choose(scope)}>
        <span className="lists-menu-name">{name(scope)}</span>
        <em aria-hidden="true">{isActive && <b>{tr('lists.activeTag')}</b>}{isActive && ' · '}{detail}</em>
        <span className="visually-hidden">
          {isActive ? `, ${tr('lists.activeTag')}` : ''}, {empty ? tr('lists.emptyCount') : tr('lists.countsText', { fav, ban })}
        </span>
      </button>
    );
  };

  const sources = [...LIST_CONTEXTS, 'universal' as const, ...lists.custom.map(c => customScope(c.id))].filter(s => s !== shown && hasData(s));

  return (
    <div className="lists-picker" ref={rootRef}>
      <button ref={pickRef} type="button" className="lists-pick" aria-haspopup="menu" aria-expanded={pickOpen}
        aria-controls={pickOpen ? `${menuId}-pick` : undefined} onClick={openPick}>
        <small>{tr('lists.pickLabel')}</small>
        <span className="lists-pick-name">{shownName}</span>
        {shown === active && <span className="lists-act">{tr('lists.activeTag')}</span>}
        <span className="lists-chev" aria-hidden="true" />
        <span className="visually-hidden">{shown === active ? `, ${tr('lists.activeTag')}` : ''}</span>
      </button>
      <button ref={moreRef} type="button" className="lists-more" aria-haspopup="menu" aria-expanded={moreOpen}
        aria-label={tr('lists.more', { name: shownName })} title={tr('lists.moreShort')}
        aria-controls={moreOpen ? `${menuId}-more` : undefined} onClick={openMore}>
        <Icon name="dots" />
      </button>
      {pickOpen && (
        <div ref={pickMenu} id={`${menuId}-pick`} className="lists-menu" role="menu" aria-label={tr('lists.pickMenu')} onKeyDown={menuKeys}>
          <Group label={tr('lists.groupFormat')}>{formats.map(entry)}</Group>
          <Group label={tr('lists.groupEverywhere')}>{entry('universal')}</Group>
          <Group label={tr('lists.groupCustom')}>
            {lists.custom.map(c => entry(customScope(c.id)))}
            {creating
              ? <NameField label={tr('lists.newName')} initial="" onDone={create} onCancel={() => setCreating(false)} />
              : <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item new" onClick={() => setCreating(true)}>
                  <Icon name="plus" /> {tr('lists.new')}
                </button>}
          </Group>
        </div>
      )}
      {moreOpen && (
        <div ref={moreMenu} id={`${menuId}-more`} className="lists-menu more" role="menu" aria-label={tr('lists.more', { name: shownName })} onKeyDown={menuKeys}>
          {step.kind === 'actions' && <>
            <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" aria-disabled={!sources.length}
              onClick={() => { if (sources.length) setStep({ kind: 'source' }); }}>
              <span className="lists-menu-name">{tr('lists.copyFrom')}</span><em>{sources.length ? tr('lists.copyHint') : tr('lists.copyNone')}</em>
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" aria-disabled={shownCustom === null}
              onClick={() => { if (shownCustom !== null) setStep({ kind: 'rename' }); }}>
              <span className="lists-menu-name">{tr('lists.rename')}</span>{shownCustom === null && <em>{tr('lists.onlyCustom')}</em>}
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" aria-disabled={shownFav + shownBan === 0}
              onClick={() => {
                if (shownFav + shownBan === 0) return;
                onChange(clearScope(lists, shown), { kind: 'clearList', from: shownName });
                closeAll();
                moreRef.current?.focus();
              }}>
              <span className="lists-menu-name">{tr('lists.clearAll')}</span>
            </button>
            <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item danger" aria-disabled={shownCustom === null}
              onClick={() => { if (shownCustom !== null) { setConfirmDelete(true); setMoreOpen(false); } }}>
              <span className="lists-menu-name">{tr('lists.delete')}</span>{shownCustom === null && <em>{tr('lists.onlyCustom')}</em>}
            </button>
          </>}
          {step.kind === 'source' && (
            <Group label={tr('lists.copyInto', { name: shownName })}>
              {sources.map(scope => {
                const { fav, ban } = counts(scope);
                return (
                  <button key={scope} type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" onClick={() => setStep({ kind: 'mode', from: scope })}>
                    <span className="lists-menu-name">{name(scope)}</span><em aria-hidden="true">{fav} · {ban}</em>
                    <span className="visually-hidden">, {tr('lists.countsText', { fav, ban })}</span>
                  </button>
                );
              })}
            </Group>
          )}
          {step.kind === 'mode' && (
            <Group label={tr('lists.copyFromName', { name: name(step.from) })}>
              <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" onClick={() => copy(step.from, 'add')}>
                <span className="lists-menu-name">{tr('lists.copyAdd')}</span><em>{tr('lists.copyAddHint')}</em>
              </button>
              <button type="button" role="menuitem" tabIndex={-1} className="lists-menu-item" onClick={() => copy(step.from, 'replace')}>
                <span className="lists-menu-name">{tr('lists.copyReplace')}</span><em>{tr('lists.copyReplaceHint')}</em>
              </button>
            </Group>
          )}
          {step.kind === 'rename' && shownCustom !== null && (
            <NameField label={tr('lists.renameLabel')} initial={shownName}
              onDone={title => { onChange(renameList(lists, shownCustom, title)); closeAll(); moreRef.current?.focus(); }}
              onCancel={() => setStep({ kind: 'actions' })} />
          )}
        </div>
      )}
      {confirmDelete && shownCustom !== null && (
        <ConfirmDialog title={tr('lists.deleteTitle', { name: shownName })} text={tr('lists.deleteText')} confirm={tr('lists.delete')}
          onCancel={() => { setConfirmDelete(false); moreRef.current?.focus(); }}
          onConfirm={() => {
            setConfirmDelete(false);
            onChange(deleteList(lists, shownCustom));
            onShow(context);
            pickRef.current?.focus();
          }} />
      )}
      <p className="lists-note" role="status">{note ?? ''}</p>
    </div>
  );
}
