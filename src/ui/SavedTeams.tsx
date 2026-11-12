import { useRef, useState } from 'react';
import type { Format } from '../engine/format';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './icons';
import { UndoToast, type UndoAction } from './UndoToast';
import { loadSavedTeams, saveTeams, type SavedTeam } from '../storage';
import { useT } from '../i18n/react';

export function SavedTeams({ team, format, onLoad }: {
  team: TeamSet[];
  format: Format;
  onLoad: (team: TeamSet[], format?: Format) => void;
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

  const update = (next: SavedTeam[]) => {
    const ok = saveTeams(next);
    setFailed(!ok);
    if (ok) setSaved(next);
    return ok;
  };
  const store = (trimmed: string) => {
    const favorites = team.flatMap((set, i) => (set.favorite ? [i] : []));
    const custom = team.flatMap((set, i) => (set.customSkillset ? [i] : []));
    update([...saved.filter(t => t.name !== trimmed), { name: trimmed, text: exportShowdown(team), favorites, custom, format }]);
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
    if (update(saved.filter(s => s.name !== entry.name))) setUndo({ id: Date.now(), kind: 'savedDelete', from: entry.name, entry, index });
  };
  const closeOverwrite = () => { setOverwrite(null); nameRef.current?.focus(); };

  return (
    <>
      <details className="popover">
        <summary title={t('saved.title', { n: saved.length })}><Icon name="save" /><span className="btn-label">{t('saved.title', { n: saved.length })}</span></summary>
        <div className="saved-panel">
          {/* Salva: spento finché manca il nome o il team è vuoto */}
          <div className="saved-new">
            <input ref={nameRef} aria-label={t('saved.name')} value={name} placeholder={t('saved.namePlaceholder')} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
            <button type="button" onClick={save} disabled={!name.trim() || team.length === 0}>{t('saved.save')}</button>
          </div>
          {failed && (
            <p role="status" className="errors">
              {t('saved.failed')}
            </p>
          )}
          {saved.length === 0 ? <p className="saved-empty">{t('saved.empty')}</p> : (
            <ul className="saved-list">
              {saved.map(entry => (
                <li key={entry.name}>
                  <button type="button" className="saved-load" title={entry.name} onClick={() => onLoad(importShowdown(entry.text).sets.map((set, i) => ({
                    ...set,
                    ...(entry.favorites?.includes(i) ? { favorite: true } : {}),
                    ...(entry.custom?.includes(i) ? { customSkillset: true } : {}),
                  })), entry.format)}>{entry.name}</button>
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
