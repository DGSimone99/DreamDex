import { useEffect, useId, useRef, useState } from 'react';
import { useEditing } from './editing';
import { MAX_PENALTY, type TeamRating } from '../engine/rating';
import { roleShortLabel } from '../engine/roles';
import { rolesList } from '../engine/subRoles';
import { Typed } from './TypeText';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
import { AreaDetail, signed, type DetailArea } from './AreaDetail';
import { useLang, useT } from '../i18n/react';

const isDetailArea = (key: string): key is DetailArea => key === 'strength' || key === 'defense' || key === 'speed' || key === 'roles' || key === 'bonusMalus';

/** `ruleIssues`: problemi di regole del team (vietati, Mega, mosse non legali…): triangolo rosso accanto al voto. */
/** `metaMonth`: mese delle statistiche, per dire con quale meta è stato calcolato il voto. */
export function RatingPanel({ rating, ruleIssues = [], metaMonth }: { rating: TeamRating; ruleIssues?: string[]; metaMonth?: string }) {
  const t = useT();
  const lang = useLang();
  // Dettaglio dell'area (sottostatistiche per membro); alla chiusura il focus torna alla barra
  const [detail, setDetail] = useState<DetailArea | null>(null);
  const netLabelId = useId();
  const detailButtons = useRef<Partial<Record<DetailArea, HTMLButtonElement | null>>>({});
  const closeDetail = () => { const area = detail; setDetail(null); if (area) detailButtons.current[area]?.focus(); };
  // Bonus meno malus (il malus è già limitato a MAX_PENALTY): il segno usa il meno tipografico
  const net = rating.bonus.total - rating.penalty.total;
  // Un totale a 0 si scrive "0" senza segno; con entrambi a 0 resta solo il netto
  const netText = rating.penalty.total === 0 && rating.bonus.total === 0
    ? `${t('area.bonusMalus')} 0`
    : t('rating.net', { net: signed(net), penalty: signed(-rating.penalty.total), bonus: signed(rating.bonus.total) });
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
            : area.key === 'roles' && rating.roles.members.length
              // Ruoli: i sotto-ruoli di ogni membro (valore almeno 0,5), coi nomi brevi
              ? rating.roles.members.map(m => `${m.species} ${rolesList(m.values).map(r => roleShortLabel(r, lang)).join(' · ') || '—'}`).join('\n')
            : undefined;
          // Area senza peso (la Velocità nello stall): visibile ma grigia, con la nota nel tooltip
          const note = area.inactive ? t('rating.notCounted') : undefined;
          const fullTip = tip && note ? `${tip}
${note}` : tip ?? note;
          return (
            <div key={area.key} className={area.inactive ? 'inactive' : undefined}>
              <dt>
                {isDetailArea(area.key) ? (
                  // Offesa, Difesa, Velocità e Ruoli aprono il loro dettaglio: sottostatistiche e punteggio di ogni membro
                  <button ref={el => { detailButtons.current[area.key as DetailArea] = el; }} type="button" className={fullTip ? 'area-link tip' : 'area-link'}
                    aria-haspopup="dialog" onClick={() => setDetail(area.key as DetailArea)} data-tip={fullTip} aria-description={area.inactive ? note : undefined} title={fullTip ? undefined : t('detail.open', { area: area.label })}>
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
        {/* Bonus/Malus: barra a tutta larghezza sotto le aree, centrata sullo zero (rosso a sinistra, blu a destra) */}
        <div className="net-row">
          <dt>
            {/* Il catalogo di tutti i bonus e malus; il focus torna qui alla chiusura */}
            <button ref={el => { detailButtons.current.bonusMalus = el; }} id={netLabelId} type="button" className="area-link"
              aria-haspopup="dialog" onClick={() => setDetail('bonusMalus')} title={t('catalogue.open')}>
              {netText}
            </button>
          </dt>
          <dd>
            <div className="net-bar" role="meter" aria-labelledby={netLabelId} aria-valuemin={-MAX_PENALTY} aria-valuemax={MAX_PENALTY} aria-valuenow={net}>
              <span className="net-tick" />
              {net !== 0 && <span className={`net-fill ${net < 0 ? 'neg' : 'pos'}`} style={{ width: `${Math.min(Math.abs(net), MAX_PENALTY) / MAX_PENALTY * 50}%` }} />}
            </div>
          </dd>
        </div>
      </dl>
      {(rating.penalty.items.length > 0 || rating.bonus.items.length > 0) && (
        <ul className="net-list">
          {rating.penalty.items.map(item => <li key={`m${item.text}`} className="neg"><Typed text={item.text} />{item.points > 0 && ` (−${item.points})`}</li>)}
          {rating.bonus.items.map(item => <li key={`b${item.text}`} className="pos"><Typed text={item.text} />{item.points > 0 && ` (+${item.points})`}</li>)}
        </ul>
      )}
      {detail && <AreaDetail rating={rating} area={detail} onClose={closeDetail} />}
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
