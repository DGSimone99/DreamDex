import { useState } from 'react';
import type { SpeedPoint } from '../engine/overviewSummary';
import { formatPercent, type Lang, type MessageKey } from '../i18n';
import { useLang, useT } from '../i18n/react';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Le frasi dei tooltip (un punto per membro, poi la tacca): servono anche alla descrizione per la tastiera. */
export function speedPhrases(points: SpeedPoint[], median: number | null, t: Translate, lang: Lang): string[] {
  return [
    ...points.map(p => t('summary.speedPoint', { species: p.species, speed: p.speed, pct: formatPercent(lang, p.share, 0) })),
    ...(median !== null ? [t('summary.speedMedian', { n: median })] : []),
  ];
}

/** La linea della tessera Velocità: un punto per membro secondo la quota di meta che supera; a metà la media del meta. */
export function TeamSpeedLine({ points, median }: { points: SpeedPoint[]; median: number | null }) {
  const t = useT();
  const lang = useLang();
  // Il punto (indice) o la tacca sotto il mouse
  const [hover, setHover] = useState<number | 'mid' | null>(null);
  const tip = hover === 'mid'
    ? median !== null && { left: 50, text: t('summary.speedMedian', { n: median }) }
    : hover !== null && points[hover] && { left: points[hover].share * 100, text: speedPhrases([points[hover]], null, t, lang)[0] };
  return (
    <span className="tsl">
      <span className="tsl-track">
        <span className="tsl-fast" />
        <span className="tsl-mid" onMouseEnter={() => setHover('mid')} onMouseLeave={() => setHover(null)} />
        {points.map((p, i) => (
          <span key={`${p.species}-${i}`} className={`tsl-dot${p.share > 0.5 ? ' fast' : ''}`} style={{ left: `${p.share * 100}%` }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </span>
      {tip && <span role="tooltip" className={`tsl-tip${tip.left > 70 ? ' end' : tip.left < 30 ? ' start' : ''}`} style={{ left: `${tip.left}%` }}>{tip.text}</span>}
    </span>
  );
}
