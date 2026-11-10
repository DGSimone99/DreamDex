import { useState } from 'react';
import type { Format } from '../engine/format';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { Icon } from './icons';
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

  const update = (next: SavedTeam[]) => {
    const ok = saveTeams(next);
    setFailed(!ok);
    if (ok) setSaved(next);
  };
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || team.length === 0) return;
    const favorites = team.flatMap((set, i) => (set.favorite ? [i] : []));
    const custom = team.flatMap((set, i) => (set.customSkillset ? [i] : []));
    update([...saved.filter(t => t.name !== trimmed), { name: trimmed, text: exportShowdown(team), favorites, custom, format }]);
    setName('');
  };

  return (
    <details className="popover">
      <summary><Icon name="save" />{t('saved.title', { n: saved.length })}</summary>
      <div>
        <div className="actions">
          <input aria-label={t('saved.name')} value={name} placeholder={t('saved.namePlaceholder')} onChange={e => setName(e.target.value)} />
          <button type="button" onClick={save}>{t('saved.save')}</button>
        </div>
        {failed && (
          <p role="status" className="errors">
            {t('saved.failed')}
          </p>
        )}
        <ul>
          {saved.map(entry => (
            <li key={entry.name} className="actions">
              <button type="button" onClick={() => onLoad(importShowdown(entry.text).sets.map((set, i) => ({
                ...set,
                ...(entry.favorites?.includes(i) ? { favorite: true } : {}),
                ...(entry.custom?.includes(i) ? { customSkillset: true } : {}),
              })), entry.format)}>{entry.name}</button>
              <button type="button" aria-label={t('saved.delete', { name: entry.name })} onClick={() => update(saved.filter(s => s.name !== entry.name))}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
