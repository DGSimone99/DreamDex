import { Fragment, type CSSProperties } from 'react';
import type { DashboardData } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { MoveName } from '../TypeText';
import { DashCard, DashLink } from './DashCard';

/** Sprite sotto le barre: più piccoli quando lo spazio è poco (mai sotto i 24 px). */
const SPRITE: Record<Density, number> = { tight: 32, normal: 40, roomy: 48 };

/** Velocità: una barra per membro dal più veloce (le barre riempiono la card), la linea della media col valore a sinistra e il controllo, se c'è. */
export function SpeedSection({ speed, density, onView }: { speed: DashboardData['speed']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { lanes, median, vsMeta } = speed;
  // Scala: il più veloce (o la media) con un po' d'aria sopra per il numero
  const top = Math.max(1, median ?? 0, ...lanes.map(l => l.speed)) * 1.12;
  const pct = (n: number) => `${(n / top) * 100}%`;
  // Il controllo si scrive solo se c'è: senza, niente riga (né tooltip)
  const controlText = speed.control.length
    ? `${t('summary.control')} ${speed.control.map(s => `${gameName('move', s.move, lang)} (${s.by.join(', ')})`).join(' · ')}`
    : undefined;
  const control = speed.control.length > 0 && (
    <p className="dash-ctrl">
      {t('summary.control')}{' '}
      {speed.control.map((s, i) => <Fragment key={s.move}>{i > 0 && ' · '}<b><MoveName move={s.move} /></b> ({s.by.join(', ')})</Fragment>)}
    </p>
  );
  const area = t('area.speed');
  return (
    <DashCard className="dash-speed" title={area}
      tooltip={density === 'tight' ? controlText : undefined}
      meta={<><b>{speed.value}</b> {t(vsMeta ? 'dash.aboveMeta' : 'dash.aboveTier')}</>}
      links={<DashLink area={area} onClick={() => onView('speed')} />}>
      <div className="dash-ladder" style={{ '--sprite': `${SPRITE[density]}px` } as CSSProperties}>
        <div className="dash-bars">
          {median !== null && (
            <span className="dash-avg" style={{ bottom: pct(median) }}>
              {/* A vista solo il numero, fuori dalle barre; per intero ai lettori di schermo */}
              <span aria-hidden="true">{median}</span>
              <span className="visually-hidden">{t(vsMeta ? 'dash.avgMeta' : 'dash.avgTier', { n: median })}</span>
            </span>
          )}
          {lanes.map((lane, i) => (
            <span key={`${lane.species}-${i}`} className="dash-lane"
              title={t(vsMeta ? 'dash.laneMeta' : 'dash.laneTier', { species: lane.species, speed: lane.speed, pct: formatPercent(lang, lane.share, 0) })}>
              <span className="visually-hidden">{lane.species}</span>
              <span className={`dash-bar${lane.above ? ' above' : ''}`} style={{ height: pct(lane.speed) }}><small>{lane.speed}</small></span>
            </span>
          ))}
        </div>
        <div className="dash-sprites" aria-hidden="true">
          {lanes.map((lane, i) => <span key={`${lane.species}-${i}`} className="dash-lane-sprite"><Sprite species={lane.species} size={SPRITE[density]} /></span>)}
        </div>
      </div>
      {density !== 'tight' && control}
    </DashCard>
  );
}
