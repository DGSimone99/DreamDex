import { Fragment, type CSSProperties } from 'react';
import type { DashboardData } from '../../engine/overviewDashboard';
import type { SpeedCondition } from '../../engine/speedArea';
import { formatPercent, type MessageKey } from '../../i18n';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import type { Density } from '../OverviewDashboard';
import { Sprite } from '../Sprite';
import { MoveName } from '../TypeText';
import { DashCard, DashLink } from './DashCard';
import { useFit } from './useFit';

/** Sprite sotto le barre: più piccoli quando lo spazio è poco (mai sotto i 24 px). */
const SPRITE: Record<Density, number> = { tight: 32, normal: 40, roomy: 48 };
/** Il controllo che si segnala quando manca (spiegazione estesa). */
const WANTED: SpeedCondition[] = ['trickroom', 'tailwind'];

/** Velocità: una barra per membro dal più veloce, la linea della media, il controllo e (se c'è posto) chi supera e da chi è superato. */
export function SpeedSection({ speed, density, onView }: { speed: DashboardData['speed']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { lanes, median, vsMeta } = speed;
  // Scala: il più veloce (o la media) con un po' d'aria sopra per il numero
  const top = Math.max(1, median ?? 0, ...lanes.map(l => l.speed)) * 1.12;
  const pct = (n: number) => `${(n / top) * 100}%`;
  const or = ` ${t('dash.or')} `;
  const missing = WANTED.filter(c => !speed.control.some(s => s.condition === c)).map(c => t(`sdetail.cond.${c}` as MessageKey));
  const controlText = `${t('summary.control')} ${speed.control.length
    ? speed.control.map(s => `${gameName('move', s.move, lang)} (${s.by.join(', ')})`).join(' · ')
    : t('dash.controlNone')}`;
  const control = (
    <p className="dash-ctrl">
      {t('summary.control')}{' '}
      {speed.control.length
        ? speed.control.map((s, i) => <Fragment key={s.move}>{i > 0 && ' · '}<b><MoveName move={s.move} /></b> ({s.by.join(', ')})</Fragment>)
        : t('dash.controlNone')}
      {density === 'roomy' && missing.length > 0 && <> · {t('dash.controlMissing', { list: missing.join(or) })}</>}
    </p>
  );
  // Chi supera e da chi è superato: dal normale in su, tante righe quante ne stanno sotto le barre
  const near = density === 'tight' ? [] : lanes.filter(l => l.outspeeds.length || l.outspedBy.length);
  const { ref: nearRef, shown: nearShown } = useFit<HTMLUListElement>(`${density}|${lang}|${near.map(l => l.species).join()}`, near.length);
  const area = t('area.speed');
  return (
    <DashCard className="dash-speed" title={area}
      tooltip={density === 'tight' ? controlText : undefined}
      meta={<><b>{speed.value}</b> {t(vsMeta ? 'dash.aboveMeta' : 'dash.aboveTier')}</>}
      links={<DashLink area={area} onClick={() => onView('speed')} />}>
      <div className={`dash-ladder${near.length ? ' capped' : ''}`} style={{ '--sprite': `${SPRITE[density]}px` } as CSSProperties}>
        <div className="dash-bars">
          {median !== null && (
            <span className="dash-avg" style={{ bottom: pct(median) }}>
              <span>{t(vsMeta ? 'dash.avgMeta' : 'dash.avgTier', { n: median })}</span>
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
      {/* Il controllo subito sotto le barre: se avanza spazio resta in fondo, non in mezzo */}
      {density !== 'tight' && control}
      {near.length > 0 && (
        <ul ref={nearRef} className="dash-near">
          {near.slice(0, nearShown).map((lane, i) => (
            <li key={`${lane.species}-${i}`} data-fit>
              <b>{lane.species}</b>{' '}
              {[
                lane.outspeeds.length ? t('dash.outspeeds', { list: lane.outspeeds.join(', ') }) : '',
                lane.outspedBy.length ? t('dash.outspedBy', { list: lane.outspedBy.join(', ') }) : '',
              ].filter(Boolean).join(' · ')}
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
