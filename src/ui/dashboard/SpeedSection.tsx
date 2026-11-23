import { Fragment, type CSSProperties } from 'react';
import type { DashboardData } from '../../engine/overviewDashboard';
import { formatPercent } from '../../i18n';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import type { AnalysisView } from '../analysisView';
import type { Density } from '../OverviewDashboard';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { useRoving } from '../useRoving';
import { Sprite } from '../Sprite';
import { SpeedTip } from './SpeedTip';
import { hint } from '../MoveTip';
import { MoveName } from '../TypeText';
import { DashCard } from './DashCard';

/** Sprite sotto le barre: più piccoli quando lo spazio è poco (mai sotto i 24 px). */
const SPRITE: Record<Density, number> = { tight: 32, normal: 40, roomy: 48 };

/** Velocità: una barra per membro dal più veloce (le barre riempiono la card), la linea della media col valore a sinistra e il controllo, se c'è. */
export function SpeedSection({ speed, density, onView }: { speed: DashboardData['speed']; density: Density; onView: (v: AnalysisView) => void }) {
  const t = useT();
  const lang = useLang();
  const { lanes, median, vsMeta } = speed;
  // Barra o sprite di un membro: la scala dei rivali vicini (più veloci sopra, più lenti sotto) nel tooltip DreamDex
  const tip = useFloatAnchor<number>();
  const hover = (i: number) => ({ onMouseEnter: (e: { currentTarget: Element }) => tip.open(i, e.currentTarget), onMouseLeave: tip.close });
  // Le barre sono un posto solo nel giro del Tab, le frecce vanno da una all'altra; col fuoco il tooltip
  const nav = useRoving<HTMLDivElement>();
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
  const headHint = t(vsMeta ? 'dash.speedHintMeta' : 'dash.speedHintTier');
  return (
    <DashCard className="dash-speed" title={area}
      meta={(
        // Il fumetto dice cosa conta il 3/6 e che il voto guarda anche altro (lo stesso testo ai lettori di schermo)
        // Stretto: il controllo del team non ha la sua riga, sta in fondo allo stesso fumetto
        <span className="dash-meta-hint" {...hint([headHint, density === 'tight' ? controlText : ''].filter(Boolean).join('\n'))}>
          <b>{speed.value}</b> {t(vsMeta ? 'dash.aboveMeta' : 'dash.aboveTier')}
          <span className="visually-hidden">. {headHint}</span>
        </span>
      )}
      onOpen={() => onView('speed')}>
      <div className="dash-ladder" style={{ '--sprite': `${SPRITE[density]}px` } as CSSProperties}>
        <div ref={nav.ref} className="dash-bars" onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
          {median !== null && (
            <span className="dash-avg" style={{ bottom: pct(median) }}>
              {/* A vista solo il numero, fuori dalle barre; per intero ai lettori di schermo */}
              <span aria-hidden="true">{median}</span>
              <span className="visually-hidden">{t(vsMeta ? 'dash.avgMeta' : 'dash.avgTier', { n: median })}</span>
            </span>
          )}
          {lanes.map((lane, i) => (
            <span key={`${lane.species}-${i}`} className="dash-lane" data-nav="" data-tap-tip {...hover(i)} {...tip.focus(i)}>
              {/* Nome e velocità separati per i lettori di schermo: "Barraskewda, 371" */}
              <span className="visually-hidden">{`${lane.species}, `}</span>
              <span className={`dash-bar${lane.above ? ' above' : ''}`} style={{ height: pct(lane.speed) }}><small>{lane.speed}</small></span>
            </span>
          ))}
        </div>
        <div className="dash-sprites" aria-hidden="true">
          {lanes.map((lane, i) => <span key={`${lane.species}-${i}`} className="dash-lane-sprite" data-tap-tip {...hover(i)}><Sprite species={lane.species} size={SPRITE[density]} /></span>)}
        </div>
      </div>
      {/* Stretto: il controllo solo nel fumetto della testata e, per intero, ai lettori di schermo */}
      {density !== 'tight' ? control : controlText && <p className="visually-hidden">{controlText}</p>}
      {tip.anchor && lanes[tip.anchor.key] && (
        <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className="speed" side="left">
          <SpeedTip lane={lanes[tip.anchor.key]} vsMeta={vsMeta} />
        </FloatTip>
      )}
    </DashCard>
  );
}
