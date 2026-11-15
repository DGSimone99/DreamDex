import { useEffect, useState } from 'react';
import { useEditing } from './editing';
import { GRADES, type TeamRating } from '../engine/rating';
import type { Archetype } from '../engine/archetype';
import { rolesTally } from '../engine/rolesArea';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
import { type DetailArea, signed } from './AreaDetail';
import { Icon } from './icons';
import { useT } from '../i18n/react';
import { ANALYSIS_VIEWS } from './AnalysisTabs';
import type { TabView } from './analysisView';
import { EeveeMoment } from './EeveeMoment';
import { bonusMalusTotals } from './BonusMalusView';

const isDetailArea = (key: string): key is DetailArea => key === 'strength' || key === 'defense' || key === 'speed' || key === 'roles' || key === 'bonusMalus';


/** Voto grande accanto alla fila del team: lettera, punteggio, le tre aree, i Ruoli e Bonus/Malus, che portano alle schede di Analisi. */
/**
 * `onOpen`: le righe delle aree e di Bonus/Malus portano alla scheda di quell'area in Analisi; la riga dei Ruoli a
 * Bonus/Malus, sottoscheda Ruoli.
 * `teamType`: il tipo di team del Riassunto (null finché il team non ha 6 membri: "In costruzione").
 * `ruleIssues`: problemi di regole: la lettera diventa grigia e sotto si scrive perché (`formatName`: il formato). `blocked`: il team ha membri ma il voto non si dà (EV oltre 510, specie doppia): il perché.
 */
export function GradeBadge({ rating, ruleIssues = [], illegalCount = 0, illegalNames = [], formatName = '', blocked = null, incomplete = false, teamType = null, onOpen }: { rating: TeamRating | null; teamType?: Archetype | null; ruleIssues?: string[]; illegalCount?: number; illegalNames?: string[]; formatName?: string; blocked?: 'ev' | 'species' | null; incomplete?: boolean; onOpen?: (area: DetailArea) => void }) {
  const t = useT();
  // Voto quando si è aperto il membro nell'editor: il badge mostra di quanto è cambiato
  const editing = useEditing();
  const [since, setSince] = useState<number | null>(null);
  const overall = rating?.overall ?? null;
  useEffect(() => { setSince(editing === null ? null : overall); }, [editing]);
  const delta = rating && since !== null ? rating.overall - since : 0;
  // Regole infrante: lettera, punteggio e giudizio in grigio finché il team non è legale (il voto si calcola uguale), e sotto
  // il perché (in quale formato e quanti membri; chi e il motivo nel tooltip). Niente triangolo sul voto
  const broken = ruleIssues.length > 0;
  // Nella carta (stretta) la scritta corta; il formato è nel tooltip e nella frase per i lettori di schermo
  const notLegal = broken ? t('rating.notLegalIn', { format: formatName, n: Math.max(1, illegalCount) }) : '';
  const notLegalShort = broken ? t('rating.notLegalShort', { n: Math.max(1, illegalCount) }) : '';
  // Il tipo di team come nel Riassunto: senza tipo (team incompleto) "In costruzione"
  const typeLabel = t(teamType ? `archetype.${teamType}` : 'sum.archBuilding');
  const typeNote = t(teamType ? `archetype.${teamType}.note` : 'sum.archBuildingNote');
  const who = illegalNames.length ? t('rating.notLegalWho', { list: illegalNames.join(', ') }) : '';
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}${broken ? ' rules-broken' : ''}`}>
      {/* Per i lettori di schermo una frase sola; il disegno qui sotto è solo visivo */}
      <span className="visually-hidden">
        {rating ? t('rating.badgeSr', { grade: rating.grade, overall: rating.overall, label: rating.label }) + (broken ? `, ${notLegal}${illegalNames.length ? ` (${illegalNames.join(', ')})` : ''}: ${ruleIssues.join('; ')}` : '') + (rating.notes.length ? `, ${t('rating.provisional')}` : '') + `, ${typeLabel}` : `${t('rating.badgeHead')}: ${t('rating.noGrade')}`}
      </span>
      <span className="grade-visual" aria-hidden="true">
      <span className="grade-head">{t('rating.badgeHead')}</span>
      {rating && <span className="letter">{rating.grade}</span>}
      {!rating && !blocked && <EeveeMoment pose="wave" />}
      <span className="overall">{rating ? `${rating.overall} / 100` : t('rating.noGrade')}</span>
      <span className="label">{rating ? rating.label : t(blocked === 'ev' ? 'rating.evBlocked' : blocked === 'species' ? 'rating.speciesBlocked' : 'rating.addPokemon')}
        {/* Il tipo di team sulla riga del giudizio, in una targa: la carta non diventa più alta */}
        {rating && <span className="grade-type" title={typeNote}><span>{typeLabel}</span></span>}
      </span>
      {rating && broken && <span className="grade-rules" title={[notLegal, who, ...ruleIssues].filter(Boolean).join(' · ')}><Icon name="warning" />{notLegalShort}</span>}
      </span>
      {/* Testa: l'aiuto sul voto e il triangolo delle regole, fuori dal disegno perché si usano */}
      {(rating || blocked) && (
        <span className="grade-tools">
          {/* Di quanto è cambiato il voto da quando si è aperto l'editor: la prima della fila, così non va mai sotto i segni */}
          {rating && since !== null && delta !== 0 && (
            <span className={`grade-delta ${delta > 0 ? 'up' : 'down'}`} aria-hidden="true">
              {t('rating.since', { from: since, delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` })}
            </span>
          )}
          {/* In giallo il voto provvisorio (membro senza mosse, specie, mossa o strumento sconosciuti); le regole sono la
              scritta sotto il giudizio (senza voto, quando il voto è bloccato, restano qui in rosso) */}
          {((!rating && ruleIssues.length > 0) || !!rating?.notes.length) && <AlertMark alerts={[
            ...(!rating && ruleIssues.length ? [{ level: 'danger' as const, text: t('rating.rulesBroken') }, ...ruleIssues.map(text => ({ level: 'danger' as const, text }))] : []),
            ...(rating?.notes.length ? [{ level: 'warn' as const, text: t('rating.provisional') }] : []),
            ...(rating?.notes ?? []).map(text => ({ level: 'warn' as const, text })),
          ]} />}
          {rating && <RatingHelp incomplete={incomplete} teamType={rating.teamType} trickRoom={rating.trickRoom} meta={rating.offense.coverageMeta !== null} weights={rating.weightTable} typeRule={rating.needs.rules.typeRule} />}
        </span>
      )}
      {/* Le tre aree, i Ruoli e Bonus/Malus: ogni riga porta alla sua scheda in Analisi */}
      {rating && (
        <span className="grade-areas">
          {[...rating.areas].sort((a, b) => ANALYSIS_VIEWS.indexOf(a.key as TabView) - ANALYSIS_VIEWS.indexOf(b.key as TabView)).map(area => {
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
          {/* Ruoli: una lista, non un'area col peso; senza barra, lo stesso conteggio di Panoramica, Coaching e sottoscheda
              (rolesTally): essenziali e importanti coperte sul totale, nel colore del livello peggiore che manca, poi i punti
              dei Ruoli sul voto (+N / −N / 0). Un minore scoperto non è un difetto, quindi non entra nel totale */}
          {rating.roles.total > 0 && (() => {
            const { covered, total, missing, missingEssential, points } = rolesTally(rating.roles);
            const state = missing > 1 ? t('rating.rolesMissing', { n: missing }) : missing === 1 ? t('rating.rolesMissingOne') : '';
            const tone = missingEssential > 0 ? 'bad' : missing > 0 ? 'warn' : '';
            return (
              <button type="button" className={`grade-area grade-roles${points > 0 ? ' pos' : points < 0 ? ' neg' : ''}`}
                aria-label={t('rating.openArea', { area: t('area.roles'), value: [`${covered}/${total}`, state, t('rating.rolesPoints', { value: signed(points) })].filter(Boolean).join(', ') })}
                onClick={() => onOpen?.('roles')}>
                <span>{t('area.roles')}</span>
                <span className="grade-roles-val"><em className={`grade-roles-count ${tone}`}>{covered}/{total}</em><b>{signed(points)}</b></span>
                <Icon name="next" />
              </button>
            );
          })()}
          {/* Ultima riga: netto di bonus e malus senza i ruoli (come la scheda Bonus/Malus), senza barra */}
          {(() => {
            const { net } = bonusMalusTotals(rating);
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
