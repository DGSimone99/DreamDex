import type { EngineData } from '../engine/data';
import { battleName } from '../engine/dex';
import type { TeamSet } from '../engine/sets';
import { statsEntry } from '../engine/stats';
import { Sprite } from './Sprite';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';

/** Uso nel meta dei membri: solo informativo, non entra nella valutazione. */
/** `open`: aperto all'inizio (nella scheda Meta). */
export function MetaUsePanel({ team, data, open = false }: { team: TeamSet[]; data: EngineData; open?: boolean }) {
  const t = useT();
  const lang = useLang();
  const usages = team.map(set => statsEntry(data.stats, battleName(set))?.usage ?? 0);
  const average = usages.reduce((a, b) => a + b, 0) / (usages.length || 1);
  return (
    <details aria-label={t('meta.title')} className="block meta-use" open={open}>
      <summary><span>{t('meta.title')}</span><span>{data.stats ? t('meta.average', { pct: formatPercent(lang, average) }) : t('meta.noData')}</span></summary>
      {!data.stats ? (
        <p className="note">{t('meta.missingStats')}</p>
      ) : (
        <ul className="mon-rows">
          {team.map((set, i) => {
            const entry = statsEntry(data.stats, battleName(set));
            return (
              <li key={`${i}-${set.species}`} className={entry ? '' : 'absent'}>
                <Sprite species={set.species} item={set.item} size={40} />
                <span className="who"><strong>{battleName(set)}</strong></span>
                {entry ? (
                  <span className="status">
                    <meter min={0} max={0.5} value={entry.usage} aria-hidden="true" />
                    <span className="usage"> {formatPercent(lang, entry.usage)}</span>
                  </span>
                ) : <span className="status"> {t('meta.notInStats')}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{t('meta.note')}</p>
    </details>
  );
}
