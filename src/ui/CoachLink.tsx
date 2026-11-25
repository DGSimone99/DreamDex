import { useT } from '../i18n/react';
import type { AreaContext } from './AreaDetail';
import { Icon } from './icons';

/**
 * Il link "Sistemalo nel Coaching ›": un link a testo nel colore d'accento (come "Vai al Coaching" della Panoramica),
 * solo dove c'è almeno un problema vero. Apre la scheda Coaching (sulla proposta che risolve il problema, se c'è).
 */
export function CoachLink({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const t = useT();
  return (
    <button type="button" className={`dash-link to-coach${className ? ` ${className}` : ''}`} onClick={onClick}>
      {t('area.fixInCoaching')}<Icon name="next" />
    </button>
  );
}

/**
 * Il piede di un foglio dal basso di Coverage tipi o meta: il link al Coaching solo se il soggetto del foglio (la
 * minaccia, il tipo) è un problema dell'area; il foglio si chiude e si apre il Coaching su quel problema.
 */
export function SheetCoachLink({ ctx, subject, onClose }: { ctx: AreaContext; subject: string; onClose: () => void }) {
  const key = ctx.coach?.keyOf(subject);
  if (!ctx.coach || !key) return null;
  const go = ctx.coach.go;
  return <CoachLink className="an-sheet-coach" onClick={() => { onClose(); go(key); }} />;
}
