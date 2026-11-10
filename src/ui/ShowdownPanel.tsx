import { useState } from 'react';
import type { Format } from '../engine/format';
import { shareUrl } from '../share';
import { exportShowdown, importShowdown, type TeamSet } from '../engine/sets';
import { copyText } from './clipboard';
import { Icon } from './icons';
import { useLang, useT } from '../i18n/react';

export function ShowdownPanel({ team, format, tera = true, onImport }: { team: TeamSet[]; format: Format; /** Tera ammesso nel formato */ tera?: boolean; onImport: (team: TeamSet[]) => void }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyLink = async () => {
    if (await copyText(shareUrl(team, format))) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const doImport = () => {
    const result = importShowdown(text, lang);
    setErrors(result.errors);
    if (result.sets.length) onImport(result.sets);
  };

  return (
    <details className="popover">
      <summary><Icon name="paste" />{t('showdown.title')}</summary>
      <div>
        <textarea aria-label={t('showdown.text')} rows={12} value={text} onChange={e => setText(e.target.value)} />
        <div className="actions">
          <button type="button" onClick={doImport}>{t('showdown.import')}</button>
          <button type="button" onClick={() => { setText(exportShowdown(team, { tera })); setErrors([]); }}>{t('showdown.export')}</button>
          <button type="button" onClick={() => copyText(text)}>{t('showdown.copy')}</button>
          <button type="button" disabled={!team.length} onClick={copyLink}>{t('showdown.copyLink')}</button>
          {linkCopied && <span className="copied" role="status">{t('showdown.linkCopied')}</span>}
        </div>
        {errors.length > 0 && (
          <ul className="errors">{errors.map(error => <li key={error}>{error}</li>)}</ul>
        )}
      </div>
    </details>
  );
}
