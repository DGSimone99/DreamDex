import { useId, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Typed } from './TypeText';
import { Icon, type IconName } from './icons';
import { useT } from '../i18n/react';
import { hint } from './MoveTip';

export interface Alert {
  /** danger: non legale (rosso); warn: da controllare, es. seconda Mega (giallo); info: solo informativo (blu). */
  level: 'danger' | 'warn' | 'info';
  text: string;
  /** Suggerimento al passaggio del mouse su questa riga (es. come risolvere). */
  title?: string;
  /** Testo con nomi di mosse o abilità ("Dragon Darts"): niente colori dei tipi anche se è un problema rosso. */
  plain?: boolean;
}

/** Larghezza massima del tooltip (come in marks.css), per tenerlo dentro la finestra. */
const POP_MAX = 260;

/**
 * Triangolo di pericolo con tooltip che spiega il problema. Rosso se c'è almeno un problema
 * di legalità, giallo per gli avvisi. Un solo triangolo, il tooltip li elenca tutti.
 * `floating`: il tooltip visibile va nel body (posizione fissa), così non resta tagliato o sotto i pannelli
 * vicini quando il segno sta in un contenitore che nasconde ciò che sporge (le caselle della lista).
 */
export function AlertMark({ alerts, className = '', icon = 'warning', floating = false }: { alerts: Alert[]; className?: string; icon?: IconName; floating?: boolean }) {
  const id = useId();
  const t = useT();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  if (alerts.length === 0) return null;
  const level = alerts.some(a => a.level === 'danger') ? 'danger' : alerts.some(a => a.level === 'warn') ? 'warn' : 'info';
  const lines = alerts.map(alert => (
    // Nomi di mosse come "Dragon Darts" non vanno colorati come tipi: solo i problemi di legalità
    <span key={alert.text} className={`alert-line ${alert.level}`} {...hint(alert.title)}>{alert.level === 'danger' && !alert.plain ? <Typed text={alert.text} /> : alert.text}</span>
  ));
  const show = (e: SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left - 8, window.innerWidth - POP_MAX - 16)), top: r.bottom + 8 });
  };
  const hide = () => setPos(null);
  return (
    <span
      className={`alert-mark ${level}${floating ? ' floating' : ''} ${className}`}
      tabIndex={0}
      aria-describedby={id}
      // Dentro la carta del team: il triangolo non deve aprire o chiudere la card
      onClick={e => { e.preventDefault(); e.stopPropagation(); }}
      {...(floating && { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide })}
    >
      <Icon name={icon} />
      <span className="visually-hidden">{t(`alert.${level}`)}</span>
      {/* Il testo resta qui per gli screen reader; col tooltip flottante si vede la copia nel body */}
      <span id={id} role="tooltip" className="alert-pop">{lines}</span>
      {floating && pos && createPortal(
        <span className={`alert-pop alert-float ${level}`} style={{ left: pos.left, top: pos.top }} aria-hidden="true">{lines}</span>,
        document.body,
      )}
    </span>
  );
}
