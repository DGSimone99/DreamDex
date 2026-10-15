import { useState } from 'react';
import type { Format } from '../engine/format';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { Icon } from './icons';
import { loadSavedTeams, saveTeams, type SavedTeam } from '../storage';

export function SavedTeams({ team, format, onLoad }: {
  team: TeamSet[];
  format: Format;
  onLoad: (team: TeamSet[], format?: Format) => void;
}) {
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
      <summary>Team salvati ({saved.length})</summary>
      <div>
        <div className="actions">
          <input aria-label="Nome team" value={name} placeholder="Nome del team" onChange={e => setName(e.target.value)} />
          <button type="button" onClick={save}>Salva team</button>
        </div>
        {failed && (
          <p role="status" className="errors">
            Salvataggio non riuscito: il browser non permette di salvare dati per questa pagina.
          </p>
        )}
        <ul>
          {saved.map(t => (
            <li key={t.name} className="actions">
              <button type="button" onClick={() => onLoad(importShowdown(t.text).sets.map((set, i) => ({
                ...set,
                ...(t.favorites?.includes(i) ? { favorite: true } : {}),
                ...(t.custom?.includes(i) ? { customSkillset: true } : {}),
              })), t.format)}>{t.name}</button>
              <button type="button" aria-label={`Elimina ${t.name}`} onClick={() => update(saved.filter(s => s.name !== t.name))}><Icon name="close" /></button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
