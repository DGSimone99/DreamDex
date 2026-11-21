import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Format } from '../engine/format';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './icons';
import { Sprite } from './Sprite';
import { UndoToast, type UndoAction } from './UndoToast';
import { loadSavedTeams, saveTeams, type SavedTeam } from '../storage';
import { useT } from '../i18n/react';
import { hint } from './MoveTip';

/** Il team caricato o salvato per ultimo: il nome va nella targa, il testo serve a capire se è stato cambiato dopo. */
type Current = { name: string; text: string };
const CURRENT_KEY = 'dreamdex.currentSaved';
// Il menu (nella barra del team) e il nome sulla targa leggono lo stesso valore: sta nella memoria del browser, e chi lo
// cambia avvisa gli altri. Senza memoria del browser resta qui fino a ricaricare
let memoryCurrent: string | null = null;
const listeners = new Set<() => void>();
const readRaw = (): string | null => {
  try { return window.localStorage.getItem(CURRENT_KEY); } catch { return memoryCurrent; }
};
const parseCurrent = (raw: string | null): Current | null => {
  try { return raw ? JSON.parse(raw) as Current : null; } catch { return null; }
};
const writeCurrent = (value: Current | null) => {
  const raw = value ? JSON.stringify(value) : null;
  try { if (raw) window.localStorage.setItem(CURRENT_KEY, raw); else window.localStorage.removeItem(CURRENT_KEY); } catch { memoryCurrent = raw; }
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Il team salvato in uso (null se nessuno). */
function useCurrent(): Current | null {
  const raw = useSyncExternalStore(subscribe, readRaw, readRaw);
  return useMemo(() => parseCurrent(raw), [raw]);
}
/** Il nome sulla targa vale finché nel team c'è qualcuno; `changed` se il team non è più quello salvato. */
function useShown(team: TeamSet[]) {
  const current = useCurrent();
  const text = useMemo(() => exportShowdown(team), [team]);
  const shown = team.length > 0 ? current : null;
  return { current, text, shown, changed: !!shown && shown.text !== text };
}

/** Sulla targa del team, dopo il numero: il nome del team salvato in uso, col pallino giallo se è stato cambiato dopo. */
export function SavedPlateName({ team }: { team: TeamSet[] }) {
  const t = useT();
  const { shown, changed } = useShown(team);
  if (!shown) return null;
  return (
    <span className="plate-name">{shown.name}{changed && <span className="plate-dot" {...hint(t('saved.changed'))}><span className="visually-hidden">{t('saved.changed')}</span></span>}</span>
  );
}

/**
 * Team salvati: una linguetta della barra del team (accanto a Importa ed Esporta) che apre il menu: salva il team attuale,
 * salva le modifiche al team caricato, e la lista dei team salvati (si caricano col clic, × li elimina con Annulla).
 */
export function SavedTeams({ team, format, onLoad }: {
  team: TeamSet[];
  format: Format;
  onLoad: (team: TeamSet[], format: Format | undefined, name: string) => void;
}) {
  const t = useT();
  const [saved, setSaved] = useState<SavedTeam[]>(() => loadSavedTeams());
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  // Un nome già usato: prima di sostituire quel team si chiede
  const [overwrite, setOverwrite] = useState<string | null>(null);
  // Team eliminato: si può rimettere con Annulla
  const [undo, setUndo] = useState<(UndoAction & { entry: SavedTeam; index: number }) | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Dopo Salva un fumetto verde come quello di Esporta dice per un attimo che il team è salvato
  const [done, setDone] = useState(0);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(doneTimer.current), []);
  const { current, text, shown, changed } = useShown(team);
  const setCurrent = writeCurrent;
  // Caricando un team salvato si ricorda il nome di prima: se Annulla riporta il team di prima, torna anche il suo nome
  const beforeLoad = useRef<{ current: Current | null; text: string; loaded: string } | null>(null);
  useEffect(() => {
    const back = beforeLoad.current;
    if (!back || text === back.loaded) return;
    beforeLoad.current = null;
    if (text === back.text) setCurrent(back.current);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  // Per ogni team salvato i suoi Pokémon (gli sprite piccoli della riga), letti una volta sola
  const members = useMemo(() => new Map(saved.map(entry => [entry.name, importShowdown(entry.text).sets.slice(0, 6)])), [saved]);

  const update = (next: SavedTeam[]) => {
    const ok = saveTeams(next);
    setFailed(!ok);
    if (ok) setSaved(next);
    return ok;
  };
  const store = (trimmed: string) => {
    const favorites = team.flatMap((set, i) => (set.favorite ? [i] : []));
    const custom = team.flatMap((set, i) => (set.customSkillset ? [i] : []));
    if (update([...saved.filter(t => t.name !== trimmed), { name: trimmed, text, favorites, custom, format }])) {
      setCurrent({ name: trimmed, text });
      setDone(Date.now());
      clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(0), 1800);
    }
    setName('');
  };
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || team.length === 0) return;
    if (saved.some(entry => entry.name === trimmed)) setOverwrite(trimmed);
    else store(trimmed);
  };
  const remove = (entry: SavedTeam) => {
    const index = saved.indexOf(entry);
    if (current?.name === entry.name) setCurrent(null);
    if (update(saved.filter(s => s.name !== entry.name))) setUndo({ id: Date.now(), kind: 'savedDelete', from: entry.name, entry, index });
  };
  const closeOverwrite = () => { setOverwrite(null); nameRef.current?.focus(); };

  return (
    <>
      <details className="popover saved-menu">
        {/* Il nome per i lettori di schermo dice anche quanti sono ("Team salvati (2)"); a vista la parola e il numero a parte */}
        <summary {...hint(t('saved.title', { n: saved.length }))}>
          <span className="visually-hidden">{t('saved.title', { n: saved.length })}</span>
          <Icon name="box" /><span className="btn-label" aria-hidden="true">{t('saved.label')}</span>
          {saved.length > 0 && <span className="saved-count" aria-hidden="true">{saved.length}</span>}
        </summary>
        <div className="saved-panel">
          {/* Il team caricato è cambiato: una riga lo dice (caricarne un altro si può comunque annullare), e si salvano le
              modifiche sotto lo stesso nome, senza riscriverlo */}
          {changed && shown && <p className="saved-unsaved"><Icon name="warning" />{t('saved.unsaved')}</p>}
          {changed && shown && (
            <button type="button" className="saved-update" onClick={() => store(shown.name)}>
              <Icon name="check" /><span>{t('saved.update', { name: shown.name })}</span>
            </button>
          )}
          {/* Salva: spento finché manca il nome o il team è vuoto */}
          <div className="saved-new">
            <input ref={nameRef} aria-label={t('saved.name')} value={name} placeholder={t('saved.namePlaceholder')} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
            <button type="button" onClick={save} disabled={!name.trim() || team.length === 0}>{t('saved.save')}</button>
            {done > 0 && <span key={done} className="export-note done" role="status"><Icon name="check" />{t('saved.done')}</span>}
          </div>
          {failed && (
            <p role="status" className="errors">
              {t('saved.failed')}
            </p>
          )}
          {saved.length === 0 ? <p className="saved-empty">{t('saved.empty')}</p> : (
            <ul className="saved-list">
              {saved.map(entry => (
                <li key={entry.name} className={shown?.name === entry.name ? 'current' : undefined}>
                  <button type="button" className="saved-load" title={entry.name} aria-label={entry.name} onClick={() => {
                    const sets = importShowdown(entry.text).sets.map((set, i) => ({
                      ...set,
                      ...(entry.favorites?.includes(i) ? { favorite: true } : {}),
                      ...(entry.custom?.includes(i) ? { customSkillset: true } : {}),
                    }));
                    const loaded = exportShowdown(sets);
                    beforeLoad.current = { current, text, loaded };
                    setCurrent({ name: entry.name, text: loaded });
                    onLoad(sets, entry.format, entry.name);
                  }}>
                    {/* Solo i Pokémon che il team ha (niente caselle vuote); quanti sono lo dice "n/6" accanto al nome */}
                    <span className="saved-sprites" aria-hidden="true">
                      {(members.get(entry.name) ?? []).map((set, i) => <Sprite key={i} species={set.species} item={set.item} size={40} />)}
                    </span>
                    <span className="saved-text">
                      <span className="saved-name">{entry.name}</span>
                      <span className="saved-meta">
                        <span className="saved-size" aria-hidden="true">{members.get(entry.name)?.length ?? 0}/6</span>
                        {entry.format && <span className="saved-format">{entry.format.game ? t(`game.${entry.format.game}`) : t(`format.${entry.format.formatId}`)}</span>}
                      </span>
                    </span>
                  </button>
                  <button type="button" className="saved-delete" aria-label={t('saved.delete', { name: entry.name })} title={t('saved.delete', { name: entry.name })}
                    onClick={() => remove(entry)}><Icon name="close" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
      {overwrite !== null && (
        <ConfirmDialog title={t('saved.overwriteTitle')} text={t('saved.overwriteText', { name: overwrite })} confirm={t('saved.overwrite')}
          onConfirm={() => { store(overwrite); closeOverwrite(); }} onCancel={closeOverwrite} />
      )}
      {undo && (
        <UndoToast action={undo} onClose={() => setUndo(null)}
          onUndo={() => {
            // Torna al suo posto; un team salvato nel frattempo con lo stesso nome resta quello nuovo
            if (saved.some(s => s.name === undo.entry.name)) return setUndo(null);
            const next = [...saved];
            next.splice(Math.min(undo.index, next.length), 0, undo.entry);
            if (update(next)) setUndo(null);
          }} />
      )}
    </>
  );
}
