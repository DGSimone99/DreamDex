import { useEffect, useRef, useState } from 'react';
import { useEditing } from './editing';
import type { TeamRating } from '../engine/rating';
import { roleShortLabel } from '../engine/roles';
import { rolesList } from '../engine/subRoles';
import { Typed } from './TypeText';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
import { AreaDetail, type DetailArea } from './AreaDetail';
import { useLang, useT } from '../i18n/react';

const isDetailArea = (key: string): key is DetailArea => key === 'strength' || key === 'defense' || key === 'speed' || key === 'roles';

/** `ruleIssues`: problemi di regole del team (vietati, Mega, mosse non legali…): triangolo rosso accanto al voto. */
/** `metaMonth`: mese delle statistiche, per dire con quale meta è stato calcolato il voto. */
export function RatingPanel({ rating, ruleIssues = [], metaMonth }: { rating: TeamRating; ruleIssues?: string[]; metaMonth?: string }) {
  const t = useT();
  const lang = useLang();
  // Dettaglio dell'area (sottostatistiche per membro); alla chiusura il focus torna alla barra
  const [detail, setDetail] = useState<DetailArea | null>(null);
  const detailButtons = useRef<Partial<Record<DetailArea, HTMLButtonElement | null>>>({});
  const closeDetail = () => { const area = detail; setDetail(null); if (area) detailButtons.current[area]?.focus(); };
  return (
    <details open aria-label={t('rating.title')} className="block rating">
      <summary>
        <span className="rating-title">{t('rating.title')}<RatingHelp teamType={rating.teamType} trickRoom={rating.trickRoom} /></span>
        <span>{rating.grade} · {rating.overall}/100</span>
      </summary>
      <p className={`grade grade-${rating.grade}`}>
        <strong>{rating.grade}</strong>
        {/* Il triangolo delle regole sta subito sopra il punteggio */}
        <span className="grade-side">
          {ruleIssues.length > 0 && (
            <AlertMark className="grade-alert" alerts={[
              { level: 'danger', text: t('rating.rulesBroken') },
              ...ruleIssues.map(text => ({ level: 'danger' as const, text })),
            ]} />
          )}
          <span>{rating.overall}/100 · {rating.label}</span>
        </span>
      </p>
      {metaMonth && <p className="rating-note">{rating.meta ? t('rating.metaOn', { month: metaMonth }) : t('rating.metaOff')}</p>}
      {rating.archetype === 'stall' && <p className="rating-note">{t('rating.stall')}</p>}
      <dl className="bars">
        {rating.areas.map(area => {
          const text = `${area.label} ${area.value ?? 'n/d'}`;
          // Nel tooltip solo i dati per membro; come si calcola ogni area lo spiega il "?" accanto al titolo
          const tip = area.key === 'strength' && rating.offense.members.length
            ? [...rating.offense.members].sort((a, b) => b.value - a.value).map(m => `${m.species} ${m.value}`).join('\n')
            : area.key === 'defense' && rating.defense.members.length
              ? [...rating.defense.members].sort((a, b) => b.value - a.value).map(m => `${m.species} ${m.value}`).join('\n')
            : area.key === 'speed' && rating.speed.members.length
              ? [...rating.speed.members].sort((a, b) => b.total - a.total).map(m => `${m.species} ${Math.round(100 * m.total)}`).join('\n')
            : undefined;
          return (
            <div key={area.key}>
              <dt>
                {isDetailArea(area.key) ? (
                  // Offesa, Difesa, Velocità e Ruoli aprono il loro dettaglio: sottostatistiche e punteggio di ogni membro
                  <button ref={el => { detailButtons.current[area.key as DetailArea] = el; }} type="button" className={tip ? 'area-link tip' : 'area-link'}
                    aria-haspopup="dialog" onClick={() => setDetail(area.key as DetailArea)} data-tip={tip} title={tip ? undefined : t('detail.open', { area: area.label })}>
                    {text}
                  </button>
                ) : tip ? (
                  <span className="tip" tabIndex={0} data-tip={tip} aria-description={tip.replaceAll('\n', ' · ')}>{text}</span>
                ) : text}
              </dt>
              <dd><meter min={0} max={100} value={area.value ?? 0} /></dd>
            </div>
          );
        })}
      </dl>
      {rating.bonus.total > 0 && (
        <div className="bonus">
          <strong>{t('rating.bonus', { n: rating.bonus.total })}</strong>
          <ul>
            {rating.bonus.items.map(item => <li key={item.text}><Typed text={item.text} /> (+{item.points})</li>)}
          </ul>
        </div>
      )}
      {detail && <AreaDetail rating={rating} area={detail} onClose={closeDetail} />}
      {rating.penalty.total > 0 && (
        <div className="penalty">
          <strong>{t('rating.penalty', { n: rating.penalty.total })}</strong>
          <ul>
            {rating.penalty.items.map(item => <li key={item.text}><Typed text={item.text} /> (−{item.points})</li>)}
          </ul>
        </div>
      )}
    </details>
  );
}

/** Voto grande accanto alla fila del team (riassunto visivo; i dettagli sono nella valutazione). */
export function GradeBadge({ rating }: { rating: TeamRating | null }) {
  const t = useT();
  // Voto quando si è aperto il membro nell'editor: il badge mostra di quanto è cambiato
  const editing = useEditing();
  const [since, setSince] = useState<number | null>(null);
  const overall = rating?.overall ?? null;
  useEffect(() => { setSince(editing === null ? null : overall); }, [editing]);
  const delta = rating && since !== null ? rating.overall - since : 0;
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}`} aria-hidden="true">
      {rating && <span className="letter">{rating.grade}</span>}
      <span className="overall">{rating ? `${rating.overall} / 100` : t('rating.noGrade')}</span>
      <span className="label">{rating ? rating.label : t('rating.addPokemon')}</span>
      {rating && since !== null && delta !== 0 && (
        <span className={`grade-delta ${delta > 0 ? 'up' : 'down'}`}>
          {t('rating.since', { from: since, delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` })}
        </span>
      )}
    </div>
  );
}
