import { useState } from 'react';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { copyText } from './clipboard';

export function ShowdownPanel({ team, onImport }: { team: TeamSet[]; onImport: (team: TeamSet[]) => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const doImport = () => {
    const result = importShowdown(text);
    setErrors(result.errors);
    if (result.sets.length) onImport(result.sets);
  };

  return (
    <details className="popover">
      <summary>Import / Export</summary>
      <div>
        <textarea aria-label="Testo Showdown" rows={12} value={text} onChange={e => setText(e.target.value)} />
        <div className="actions">
          <button type="button" onClick={doImport}>Importa</button>
          <button type="button" onClick={() => { setText(exportShowdown(team)); setErrors([]); }}>Esporta team</button>
          <button type="button" onClick={() => copyText(text)}>Copia</button>
        </div>
        {errors.length > 0 && (
          <ul className="errors">{errors.map(error => <li key={error}>{error}</li>)}</ul>
        )}
      </div>
    </details>
  );
}
