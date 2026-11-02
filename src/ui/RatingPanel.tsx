import { useEffect, useState } from 'react';
import { useEditing } from './editing';
import { GRADES, type TeamRating } from '../engine/rating';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
import { type AreaKey, type DetailArea, signed } from './AreaDetail';
import { Icon } from './icons';
import { useT } from '../i18n/react';
import { ANALYSIS_VIEWS } from './AnalysisTabs';
import type { AnalysisView } from './analysisView';

const isDetailArea = (key: string): key is DetailArea => key === 'strength' || key === 'defense' || key === 'speed' || key === 'roles' || key === 'bonusMalus';


/** Voto grande accanto alla fila del team: lettera, punteggio, le tre aree, i Ruoli e Bonus/Malus, che portano alle schede di Analisi. */
/**
 * `onOpen`: le righe delle aree e di Bonus/Malus portano alla scheda di quell'area in Analisi.
 * `ruleIssues`: problemi di regole, triangolo rosso nella testa.
 */
export function GradeBadge({ rating, ruleIssues = [], onOpen }: { rating: TeamRating | null; ruleIssues?: string[]; onOpen?: (area: AreaKey) => void }) {
  const t = useT();
  // Voto quando si è aperto il membro nell'editor: il badge mostra di quanto è cambiato
  const editing = useEditing();
  const [since, setSince] = useState<number | null>(null);
  const overall = rating?.overall ?? null;
  useEffect(() => { setSince(editing === null ? null : overall); }, [editing]);
  const delta = rating && since !== null ? rating.overall - since : 0;
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}`}>
      {/* Per i lettori di schermo una frase sola; il disegno qui sotto è solo visivo */}
      <span className="visually-hidden">
        {rating ? t('rating.badgeSr', { grade: rating.grade, overall: rating.overall, label: rating.label }) : `${t('rating.badgeHead')}: ${t('rating.noGrade')}`}
      </span>
      <span className="grade-visual" aria-hidden="true">
      <span className="grade-head">{t('rating.badgeHead')}</span>
      {rating && <span className="letter">{rating.grade}</span>}
      <span className="overall">{rating ? `${rating.overall} / 100` : t('rating.noGrade')}</span>
      <span className="label">{rating ? rating.label : t('rating.addPokemon')}</span>
      {rating && since !== null && delta !== 0 && (
        <span className={`grade-delta ${delta > 0 ? 'up' : 'down'}`}>
          {t('rating.since', { from: since, delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` })}
        </span>
      )}
      </span>
      {/* Testa: l'aiuto sul voto e il triangolo delle regole, fuori dal disegno perché si usano */}
      {rating && (
        <span className="grade-tools">
          {ruleIssues.length > 0 && <AlertMark alerts={[
            { level: 'danger', text: t('rating.rulesBroken') },
            ...ruleIssues.map(text => ({ level: 'danger' as const, text })),
          ]} />}
          <RatingHelp teamType={rating.teamType} trickRoom={rating.trickRoom} meta={rating.offense.coverageMeta !== null} />
        </span>
      )}
      {/* Le tre aree, i Ruoli e Bonus/Malus: ogni riga porta alla sua scheda in Analisi */}
      {rating && (
        <span className="grade-areas">
          {[...rating.areas].sort((a, b) => ANALYSIS_VIEWS.indexOf(a.key as AnalysisView) - ANALYSIS_VIEWS.indexOf(b.key as AnalysisView)).map(area => {
            const note = area.inactive ? ` · ${t('rating.notCounted')}` : '';
            return (
              // Ogni barra nel colore della lettera che varrebbe da sola: si vede subito l'area debole
              <button key={area.key} type="button"
                className={`grade-area band-${GRADES.find(g => (area.value ?? 0) >= g.min)!.grade}${area.inactive ? ' inactive' : ''}`}
                aria-label={`${t('rating.openArea', { area: area.label, value: area.value ?? '—' })}${note}`}
                title={area.inactive ? t('rating.notCounted') : undefined}
                onClick={() => isDetailArea(area.key) && onOpen?.(area.key)}>
                <span>{area.label}</span>
                <span className="meter"><span style={{ width: `${area.value ?? 0}%` }} /></span>
                <b>{area.value ?? '—'}</b>
                <Icon name="next" />
              </button>
            );
          })}
          {/* Ruoli: una lista, non un'area col peso; senza barra, coperti/totale e quanti mancano */}
          {rating.roles.total > 0 && (() => {
            const { covered, total } = rating.roles;
            const missing = total - covered;
            const state = missing === 0 ? t('rating.rolesAll') : missing === 1 ? t('rating.rolesMissingOne') : t('rating.rolesMissing', { n: missing });
            return (
              <button type="button" className="grade-area grade-roles"
                aria-label={t('rating.openArea', { area: t('area.roles'), value: `${covered}/${total}, ${state}` })}
                onClick={() => onOpen?.('roles')}>
                <span>{t('area.roles')}</span>
                <span className="grade-roles-val"><b>{covered}/{total}</b> · <em className={missing ? 'bad' : 'good'}>{state}</em></span>
                <Icon name="next" />
              </button>
            );
          })()}
          {/* Ultima riga: netto di bonus e malus, senza barra */}
          {(() => {
            const net = rating.bonus.total - rating.penalty.total;
            const value = net === 0 ? '±0' : signed(net);
            return (
              <button type="button" className={`grade-area grade-bm${net > 0 ? ' pos' : net < 0 ? ' neg' : ''}`}
                aria-label={t('rating.openBonusMalus', { value })}
                onClick={() => onOpen?.('bonusMalus')}>
                <span>{t('area.bonusMalus')}</span>
                <b>{value}</b>
                <Icon name="next" />
              </button>
            );
          })()}
        </span>
      )}
    </div>
  );
}
