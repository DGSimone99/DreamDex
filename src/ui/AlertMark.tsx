import { useId } from 'react';
import { Typed } from './TypeText';
import { Icon } from './icons';

export interface Alert {
  /** danger: non legale (rosso); warn: da controllare, es. seconda Mega o mosse non legali (giallo). */
  level: 'danger' | 'warn';
  text: string;
}

/**
 * Triangolo di pericolo con tooltip che spiega il problema. Rosso se c'è almeno un problema
 * di legalità, giallo per gli avvisi. Un solo triangolo, il tooltip li elenca tutti.
 */
export function AlertMark({ alerts, className = '' }: { alerts: Alert[]; className?: string }) {
  const id = useId();
  if (alerts.length === 0) return null;
  const level = alerts.some(a => a.level === 'danger') ? 'danger' : 'warn';
  return (
    <span
      className={`alert-mark ${level} ${className}`}
      tabIndex={0}
      aria-describedby={id}
      // Dentro un <summary>: il triangolo non deve aprire o chiudere la card
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      <Icon name="warning" />
      <span className="visually-hidden">{level === 'danger' ? 'Problema' : 'Avviso'}</span>
      <span id={id} role="tooltip" className="alert-pop">
        {alerts.map(alert => (
          // Nomi di mosse come "Dragon Darts" non vanno colorati come tipi: solo i problemi di legalità
          <span key={alert.text} className={`alert-line ${alert.level}`}>{alert.level === 'danger' ? <Typed text={alert.text} /> : alert.text}</span>
        ))}
      </span>
    </span>
  );
}
