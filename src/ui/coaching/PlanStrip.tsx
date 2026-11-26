import { useRef, type CSSProperties } from 'react';
import type { PlanStep } from '../../engine/coachPlan';
import { getMove } from '../../engine/dex';
import type { TeamRating } from '../../engine/rating';
import { gameName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { typeIconUrl } from '../typeIcons';
import { PokemonIcon } from '../PokemonName';
import { hint } from '../MoveTip';
import { typeColor } from '../Sprite';
import { proposalName, firstType, subjectOf } from './effects';
import { GradeTag, useSideFade } from './HeroCard';

/**
 * Il Piano, sopra la carta grande: i cambi migliori da fare insieme (coachPlan: uno per posto, ognuno alza il voto vero
 * del team coi cambi prima di lui). Ogni passo è una piccola carta (il numero, l'icona del Box, chi entra o la mossa nuova
 * e il posto); un clic la apre nella carta grande. In fondo il voto vero dopo ogni passo ("B 70 → A 81 → A 84"), il dopo
 * nel colore del voto, e "dopo N cambi"; poi "Applica il piano", che fa tutti i passi insieme (un solo Annulla). È un
 * pulsante secondario (bordo, niente magenta): l'unico magenta resta Applica della carta.
 */
export function PlanStrip({ steps, start, onOpen, onApply, compact = false }: {
  steps: PlanStep[]; start: TeamRating; onOpen: (groupId: string) => void;
  /** Applica tutti i passi del piano insieme; senza, niente pulsante. */
  onApply?: () => void;
  /** Telefono: i passi piccoli (numero, l'icona e il nome corto; per una mossa l'icona del tipo e la mossa) in una fila che
   *  scorre di lato, il voto di ora → quello finale con "N cambi" e "Applica il piano" sotto. */
  compact?: boolean;
}) {
  const tr = useT();
  const lang = useLang();
  const path = [`${start.grade} ${start.overall}`, ...steps.map(st => `${st.grade} ${st.overall}`)].join(' → ');
  const last = steps[steps.length - 1];
  const stepsRef = useRef<HTMLOListElement>(null);
  const fade = useSideFade(stepsRef, `${steps.length}|${compact}`);
  return (
    <nav className={`coach-plan${compact ? ' is-compact' : ''}`} aria-label={tr('coach.plan.region')}>
      <span className="coach-plan-title coach-head" aria-hidden="true">{tr('coach.plan.title')}</span>
      <ol className={`coach-plan-steps${fade.right ? ' fade-right' : ''}${fade.left ? ' fade-left' : ''}`} ref={stepsRef}>
        {steps.map((st, i) => {
          const p = st.proposal;
          // Il nome intero del membro, come nella carta e nella classifica
          const seat = p.kind === 'move' ? tr('coach.vs.on', { member: p.fix.member })
            : p.fix.kind === 'swap' ? tr('coach.row.instead', { member: p.fix.member ?? '' }) : tr('coach.row.free');
          return (
            <li key={st.groupId}>
              {i > 0 && <span className="coach-plan-arrow" aria-hidden="true">→</span>}
              <button type="button" className={`coach-plan-step${p.kind === 'move' ? ' is-move' : ''}`} style={{ '--t1': typeColor(firstType(p)) } as CSSProperties}
                aria-label={tr('coach.plan.stepAria', { n: i + 1, name: proposalName(p, tr, lang), grade: `${st.grade} ${st.overall}` })} {...hint(proposalName(p, tr, lang))}
                onClick={() => onOpen(st.groupId)}>
                <span className="coach-plan-n" aria-hidden="true">{i + 1}</span>
                {compact && p.kind === 'move'
                  ? <PlanMoveIcon move={p.fix.to} />
                  : <PokemonIcon name={subjectOf(p)} />}
                <span className="coach-plan-who" aria-hidden="true">
                  <b>{p.kind === 'move' ? gameName('move', p.fix.to, lang) : p.fix.species}</b>
                  {!compact && <small>{seat}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <span className="coach-plan-grade">
        <span className="visually-hidden">{tr('coach.plan.gradeAria', { path })}</span>
        <span className="coach-plan-path" aria-hidden="true">
          <span className="coach-grade-from">{start.grade} {start.overall}</span>
          {(compact ? steps.slice(-1) : steps).map(st => <span key={st.groupId}><span className="coach-grade-arrow"> → </span><GradeTag score={st.overall} className={st === steps[steps.length - 1] ? 'is-last' : ''} /></span>)}
        </span>
        <small className="coach-plan-after" aria-hidden={compact || undefined}>{compact ? `· ${tr('coach.rank.count', { n: steps.length })}` : tr('coach.plan.after', { n: steps.length })}</small>
      </span>
      {onApply && last && (
        <button type="button" className="coach-plan-apply" onClick={onApply}
          aria-label={tr('coach.plan.applyAria', { n: steps.length, grade: `${last.grade} ${last.overall}` })}>
          <span aria-hidden="true">{tr('coach.plan.apply')}</span>
        </button>
      )}
    </nav>
  );
}

/** Un passo di mossa del Piano sul telefono: l'icona del tipo della mossa nuova (così non sembra un cambio di Pokémon). */
function PlanMoveIcon({ move }: { move: string }) {
  const type = getMove(move)?.type;
  const url = type ? typeIconUrl(type) : undefined;
  return <span className="coach-plan-mv" aria-hidden="true">{url && <img src={url} alt="" draggable={false} />}</span>;
}
