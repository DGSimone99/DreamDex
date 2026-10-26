import { useId, type ReactNode } from 'react';
import type { CoachProblem } from '../engine/coach';
import { needLabel } from '../engine/needs';
import type { Missing, SummaryTile, TileKey } from '../engine/overviewSummary';
import type { MessageKey } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { signed } from './AreaDetail';
import type { AnalysisView } from './analysisView';
import { Icon } from './icons';
import { speedPhrases, TeamSpeedLine } from './TeamSpeedLine';
import { MoveName, Typed, TypeLabel } from './TypeText';

const AREA: Record<TileKey, MessageKey> = {
  defense: 'area.defense', strength: 'area.strength', roles: 'area.roles', speed: 'area.speed', meta: 'summary.area.meta', bonusMalus: 'area.bonusMalus',
};

/** Una voce che manca: ✕ rossa e una parola (tipo nel suo colore, ruolo o Pokémon in testo). */
function MissingWord({ item }: { item: Missing }) {
  const lang = useLang();
  return (
    <span className="miss">
      <Icon name="close" />
      {item.kind === 'type' ? <TypeLabel type={item.type} /> : item.kind === 'role' ? needLabel(item.need, lang) : item.species}
    </span>
  );
}

/** Striscia sopra le tessere: quanti problemi, il primo, e la via per il Coaching; senza problemi una riga verde. */
function SummaryStrip({ problems, onView }: { problems: CoachProblem[]; onView: (v: AnalysisView) => void }) {
  const t = useT();
  if (problems.length === 0) {
    return <p className="summary-strip ok"><Icon name="check" />{t('summary.noProblems')}</p>;
  }
  const serious = problems.filter(p => p.severity === 'serious').length;
  const minor = problems.length - serious;
  const first = problems.find(p => p.severity === 'serious') ?? problems[0];
  return (
    <div className={`summary-strip ${serious ? 'bad' : 'warn'}`}>
      <span className="summary-counts">
        {serious > 0 && <span className="sev serious">{t(serious === 1 ? 'summary.seriousOne' : 'summary.seriousMany', { n: serious })}</span>}
        {serious > 0 && minor > 0 && <span aria-hidden="true">·</span>}
        {minor > 0 && <span className="sev minor">{t(minor === 1 ? 'summary.minorOne' : 'summary.minorMany', { n: minor })}</span>}
      </span>
      <span className="summary-first"><Typed text={first.text} /></span>
      <button type="button" className="summary-go" onClick={() => onView('coaching')}>
        {t('summary.toCoaching')} <Icon name="arrow" />
      </button>
    </div>
  );
}

/** La Panoramica in sei tessere: ognuna apre la scheda della sua area (Meta apre la scheda principale Meta). */
export function OverviewSummary({ tiles, problems, onView, onMeta }: {
  tiles: SummaryTile[];
  problems: CoachProblem[];
  onView: (v: AnalysisView) => void;
  onMeta?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const speedId = useId();
  const speedTile = tiles.find(tile => tile.key === 'speed');
  const phrases = speedTile?.speed ? speedPhrases(speedTile.speed.points, speedTile.speed.median, t, lang) : [];

  const detail = (tile: SummaryTile): ReactNode => {
    if (tile.unavailable) return null;
    if (tile.key === 'speed' && tile.speed) {
      return (
        <>
          <TeamSpeedLine points={tile.speed.points} median={tile.speed.median} />
          {tile.speed.control.length > 0 && (
            <span className="summary-note">
              {t('summary.control')}{' '}
              {tile.speed.control.map((move, i) => <span key={move}>{i > 0 && ' · '}<MoveName move={move} /></span>)}
            </span>
          )}
        </>
      );
    }
    if (tile.key === 'bonusMalus') {
      const items = tile.items ?? [];
      return items.length
        ? <span className="summary-items">{items.map(item => (
          <span key={item.text} className={item.points < 0 ? 'loss' : 'gain'}><b>{signed(item.points)}</b> <span><Typed text={item.text} /></span></span>
        ))}</span>
        : <span className="summary-note">{t('summary.noItems')}</span>;
    }
    return tile.missing.length
      ? <span className="summary-miss">{tile.missing.map(item => <MissingWord key={item.kind === 'type' ? item.type : item.kind === 'role' ? item.need : item.species} item={item} />)}</span>
      : <span className="summary-ok"><Icon name="check" />{t(tile.key === 'meta' ? 'summary.allHandled' : 'summary.allCovered')}</span>;
  };

  return (
    <section className="summary" aria-label={t('summary.region')}>
      <SummaryStrip problems={problems} onView={onView} />
      <div className="summary-tiles">
        {tiles.map(tile => {
          const area = t(AREA[tile.key]);
          const caption = tile.unavailable ? t('summary.metaUnavailable') : t(`summary.caption.${tile.key}` as MessageKey);
          const label = tile.unavailable ? `${area}: ${caption}` : `${area}: ${tile.value} ${caption}`;
          return (
            <button key={tile.key} type="button" className={`summary-tile ${tile.unavailable ? 'off' : tile.status}`} aria-label={label}
              aria-describedby={tile.key === 'speed' && phrases.length ? speedId : undefined}
              disabled={tile.unavailable || (tile.key === 'meta' && !onMeta)}
              onClick={() => (tile.key === 'meta' ? onMeta?.() : onView(tile.key))}>
              <span className="summary-head"><span>{area}</span><Icon name="next" /></span>
              {tile.unavailable
                ? <span className="summary-value"><small>{caption}</small></span>
                : <span className="summary-value"><b>{tile.value}</b><small>{caption}</small></span>}
              {detail(tile)}
            </button>
          );
        })}
      </div>
      {/* Le frasi dei tooltip della Velocità, per tastiera e lettori di schermo */}
      {phrases.length > 0 && <ul hidden id={speedId}>{phrases.map(text => <li key={text}>{text}. </li>)}</ul>}
    </section>
  );
}
