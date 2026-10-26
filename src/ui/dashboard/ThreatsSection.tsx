import type { CSSProperties } from 'react';
import type { DashboardData } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import { useLang, useT } from '../../i18n/react';
import { Icon } from '../icons';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/** Righe di sprite: una sola finché lo spazio è poco, due quando è ampio. */
const ROWS: Record<Density, number> = { tight: 1, normal: 1, roomy: 2 };

/** Minacce non gestite: sprite sul piedistallo dalla più usata; quelle che non stanno in "+X", che apre la scheda Meta. */
export function ThreatsSection({ threats, density, onMeta }: { threats: DashboardData['threats']; density: Density; onMeta: () => void }) {
  const t = useT();
  const lang = useLang();
  const { pods } = threats;
  const { ref, shown } = useFit<HTMLDivElement>(`${density}|${pods.map(p => p.species).join()}`, pods.length, { more: true });
  const hidden = pods.length - shown;
  const title = t('dash.threats');
  let body;
  if (!threats.available) {
    body = <p className="dash-note">{t(threats.metaOff ? 'dash.metaOff' : 'summary.metaUnavailable')}</p>;
  } else if (!pods.length) {
    body = <p className="dash-note good"><Icon name="check" />{t('summary.allHandled')}</p>;
  } else {
    body = (
      <div ref={ref} className="dash-pods dash-fit" style={{ '--rows': ROWS[density] } as CSSProperties}>
        {pods.slice(0, shown).map(pod => (
          <span key={pod.species} data-fit className="dash-pod" title={`${pod.species} · ${formatPercent(lang, pod.usage, 1)}`}>
            <span className="dash-plinth"><Sprite species={pod.species} size={48} /></span>
            <b>{pod.species}</b>
            <small>{formatPercent(lang, pod.usage, 0)}</small>
          </span>
        ))}
        {hidden > 0 && (
          <button type="button" data-fit-more className="dash-pod more" onClick={onMeta} aria-label={t('dash.moreThreats', { n: hidden })}>
            <span className="dash-plinth">+{hidden}</span>
            <b>{t('dash.others')}</b>
            <small>{t('dash.metaTab')}</small>
          </button>
        )}
      </div>
    );
  }
  return (
    <DashCard className="dash-threats" title={title}
      meta={threats.available ? <><b>{t('dash.threatsOf', { n: pods.length, total: threats.total })}</b> · {t('dash.byUsage')}</> : undefined}
      links={<DashLink area={t('area.meta')} onClick={onMeta} />}>
      {body}
    </DashCard>
  );
}
