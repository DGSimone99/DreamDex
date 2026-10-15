import { useState } from 'react';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { copyText } from './clipboard';
import { useLang, useT } from '../i18n/react';

export function ShowdownPanel({ team, onImport }: { team: TeamSet[]; onImport: (team: TeamSet[]) => void }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const doImport = () => {
    const result = importShowdown(text, lang);
    setErrors(result.errors);
    if (result.sets.length) onImport(result.sets);
  };

  return (
    <details className="popover">
      <summary>{t('showdown.title')}</summary>
      <div>
        <textarea aria-label={t('showdown.text')} rows={12} value={text} onChange={e => setText(e.target.value)} />
        <div className="actions">
          <button type="button" onClick={doImport}>{t('showdown.import')}</button>
          <button type="button" onClick={() => { setText(exportShowdown(team)); setErrors([]); }}>{t('showdown.export')}</button>
          <button type="button" onClick={() => copyText(text)}>{t('showdown.copy')}</button>
        </div>
        {errors.length > 0 && (
          <ul className="errors">{errors.map(error => <li key={error}>{error}</li>)}</ul>
        )}
      </div>
    </details>
  );
}
