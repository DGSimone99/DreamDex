import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { Format } from '../engine/format';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './icons';
import { Sprite } from './Sprite';
import { UndoToast, type UndoAction } from './UndoToast';
import { loadSavedTeams, saveTeams, type SavedTeam } from '../storage';
import { useT } from '../i18n/react';

/** Il team caricato o salvato per ultimo: il nome va nella targa, il testo serve a capire se è stato cambiato dopo. */
type Current = { name: string; text: string };
const CURRENT_KEY = 'dreamdex.currentSaved';
const readCurrent = (): Current | null => {
  try { const raw = window.localStorage.getItem(CURRENT_KEY); return raw ? JSON.parse(raw) as Current : null; } catch { return null; }
};
const writeCurrent = (value: Current | null) => {
  try { if (value) window.localStorage.setItem(CURRENT_KEY, JSON.stringify(value)); else window.localStorage.removeItem(CURRENT_KEY); } catch { /* senza memoria del browser il nome dura solo fino a ricaricare */ }
};

export function SavedTeams({ team, format, plate, onLoad }: {
  team: TeamSet[];
  format: Format;
  /** Il titolo della targa del team: se c'è, la targa stessa apre il menu (con il nome del team caricato e la freccia) */
  plate?: ReactNode;
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
  const [current, setCurrentState] = useState<Current | null>(readCurrent);
  const setCurrent = (value: Current | null) => { setCurrentState(value); writeCurrent(value); };
  const text = useMemo(() => exportShowdown(team), [team]);
  // Il nome resta finché nel team c'è qualcuno; il pallino dice che il team non è più quello salvato
  const shown = team.length > 0 ? current : null;
  const changed = !!shown && shown.text !== text;
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
    if (update([...saved.filter(t => t.name !== trimmed), { name: trimmed, text, favorites, custom, format }])) setCurrent({ name: trimmed, text });
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
      <details className={`popover${plate ? ' plate-menu' : ''}`}>
        {plate ? (
          // Per i lettori di schermo il nome del menu viene prima ("Team salvati (2)"), poi il team caricato; il disegno della
          // targa (la parola Team e quanti sono) è nascosto: il titolo vero sta fuori dal menu
          <summary className="team-plate" title={t('saved.title', { n: saved.length })}>
            <span className="visually-hidden">{t('saved.title', { n: saved.length })}</span>
            {plate}
            {shown && <span className="plate-name">{shown.name}{changed && <span className="plate-dot" title={t('saved.changed')}><span className="visually-hidden">{t('saved.changed')}</span></span>}</span>}
            <span className="plate-arrow"><Icon name="down" /></span>
          </summary>
        ) : (
          <summary title={t('saved.title', { n: saved.length })}><Icon name="box" /><span className="btn-label">{t('saved.title', { n: saved.length })}</span></summary>
        )}
        <div className="saved-panel">
          {/* Il team caricato è cambiato: si salvano le modifiche sotto lo stesso nome, senza riscriverlo */}
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
                    setCurrent({ name: entry.name, text: exportShowdown(sets) });
                    onLoad(sets, entry.format);
                  }}>
                    <span className="saved-sprites" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, i) => {
                        const set = members.get(entry.name)?.[i];
                        return set ? <Sprite key={i} species={set.species} item={set.item} size={40} /> : <span key={i} className="saved-gap" />;
                      })}
                    </span>
                    <span className="saved-text">
                      <span className="saved-name">{entry.name}</span>
                      {entry.format && <span className="saved-format">{t(`format.${entry.format.formatId}`)}</span>}
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
