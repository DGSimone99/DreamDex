import type { AreaKey, TeamRating } from '../engine/rating';
import { Typed } from './TypeText';
import { AlertMark } from './AlertMark';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';

/** Le aree con una scheda propria nell'analisi: cliccandole ci si arriva. */
export const AREA_SECTIONS: Partial<Record<AreaKey, { id: string; title: MessageKey }>> = {
  defense: { id: 'analysis-defense', title: 'analysis.weakness' },
  coverage: { id: 'analysis-coverage', title: 'analysis.coverage' },
  roles: { id: 'analysis-roles', title: 'analysis.roles' },
};

/** Apre la scheda (se chiusa) e ci scorre sopra. */
function goToSection(id: string) {
  const section = document.getElementById(id) as HTMLDetailsElement | null;
  if (!section) return;
  section.open = true;
  section.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  section.querySelector('summary')?.focus({ preventScroll: true });
}

/** `ruleIssues`: problemi di regole del team (vietati, Mega, mosse non legali…): triangolo rosso accanto al voto. */
/** `metaMonth`: mese delle statistiche, per dire con quale meta è stato calcolato il voto. */
export function RatingPanel({ rating, ruleIssues = [], metaMonth }: { rating: TeamRating; ruleIssues?: string[]; metaMonth?: string }) {
  const t = useT();
  return (
    <details open aria-label={t('rating.title')} className="block rating">
      <summary><span>{t('rating.title')}</span><span>{rating.grade} · {rating.overall}/100</span></summary>
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
          const section = AREA_SECTIONS[area.key];
          // Statistiche e Meta: il dettaglio sta nel tooltip
          const tip = area.key === 'strength' && rating.power.length
            ? rating.power.map(m => `${m.species} ${m.power}`).join('\n')
            : area.key === 'meta' && rating.meta ? t('rating.metaTip', { threats: rating.meta.threats, usage: rating.meta.usage })
            : area.key === 'speed' ? t(rating.meta ? 'rating.speedTipMeta' : 'rating.speedTipFree')
            : undefined;
          return (
            <div key={area.key}>
              <dt>
                {section ? (
                  <button type="button" className="area-link" title={t('rating.goTo', { section: t(section.title) })} onClick={() => goToSection(section.id)}>
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
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}`} aria-hidden="true">
      {rating && <span className="letter">{rating.grade}</span>}
      <span className="overall">{rating ? `${rating.overall} / 100` : t('rating.noGrade')}</span>
      <span className="label">{rating ? rating.label : t('rating.addPokemon')}</span>
    </div>
  );
}
