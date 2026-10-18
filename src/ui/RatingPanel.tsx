import { useEffect, useState } from 'react';
import { useEditing } from './editing';
import type { AreaKey, TeamRating } from '../engine/rating';
import { Typed } from './TypeText';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
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
          const section = AREA_SECTIONS[area.key];
          // Nel tooltip solo i dati per membro; come si calcola ogni area lo spiega il "?" accanto al titolo
          const tip = area.key === 'strength' && rating.power.length
            ? [...rating.power].sort((a, b) => b.offense - a.offense).map(m => `${m.species} ${m.offense}`).join('\n')
            : area.key === 'meta' && rating.meta ? t('rating.metaTip', { threats: rating.meta.threats, usage: rating.meta.usage })
            : area.key === 'coverage' && rating.coverageByMember.length
              ? [t('rating.coverageTip'), ...[...rating.coverageByMember].sort((a, b) => b.types - a.types).map(m => `${m.species} ${m.types}`)].join('\n')
            : area.key === 'bulk' && rating.power.length
              ? [...rating.power].sort((a, b) => b.bulk - a.bulk).map(m => `${m.species} ${m.bulk}`).join('\n')
            : undefined;
          return (
            <div key={area.key}>
              <dt>
                {section ? (
                  // Con un dettaglio, il tooltip lo mostra insieme a dove porta il clic
                  <button type="button" className={tip ? 'area-link tip' : 'area-link'} onClick={() => goToSection(section.id)}
                    title={tip ? undefined : t('rating.goTo', { section: t(section.title) })}
                    data-tip={tip ? `${tip}\n${t('rating.goTo', { section: t(section.title) })}` : undefined}>
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
