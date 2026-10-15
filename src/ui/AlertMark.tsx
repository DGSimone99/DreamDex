import { useId } from 'react';
import { Typed } from './TypeText';
import { Icon, type IconName } from './icons';
import { useT } from '../i18n/react';

export interface Alert {
  /** danger: non legale (rosso); warn: da controllare, es. seconda Mega (giallo); info: solo informativo (blu). */
  level: 'danger' | 'warn' | 'info';
  text: string;
}

/**
 * Triangolo di pericolo con tooltip che spiega il problema. Rosso se c'è almeno un problema
 * di legalità, giallo per gli avvisi. Un solo triangolo, il tooltip li elenca tutti.
 */
export function AlertMark({ alerts, className = '', icon = 'warning' }: { alerts: Alert[]; className?: string; icon?: IconName }) {
  const id = useId();
  const t = useT();
  if (alerts.length === 0) return null;
  const level = alerts.some(a => a.level === 'danger') ? 'danger' : alerts.some(a => a.level === 'warn') ? 'warn' : 'info';
  return (
    <span
      className={`alert-mark ${level} ${className}`}
      tabIndex={0}
      aria-describedby={id}
      // Dentro un <summary>: il triangolo non deve aprire o chiudere la card
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      <Icon name={icon} />
      <span className="visually-hidden">{t(`alert.${level}`)}</span>
      <span id={id} role="tooltip" className="alert-pop">
        {alerts.map(alert => (
          // Nomi di mosse come "Dragon Darts" non vanno colorati come tipi: solo i problemi di legalità
          <span key={alert.text} className={`alert-line ${alert.level}`}>{alert.level === 'danger' ? <Typed text={alert.text} /> : alert.text}</span>
        ))}
      </span>
    </span>
  );
}
