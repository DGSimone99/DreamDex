import { cloneElement, useId, useState, type ReactElement } from 'react';

interface Props {
  /** Cosa fa il controllo, in parole: il fumetto lo mostra sotto il mouse e col fuoco da tastiera. */
  label: string;
  /** Una riga in più accanto al nome (es. il formato dell'analisi): collegata al controllo con aria-describedby. */
  detail?: string;
  /** Fumetto "fatto" (es. Copiato): verde, letto subito dai lettori di schermo. */
  done?: string;
  /** Il fumetto si allinea al bordo destro del controllo (per i controlli vicino al bordo della finestra). */
  end?: boolean;
  className?: string;
  /** Il controllo: un solo pulsante o link, con il suo nome accessibile. */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * Fumetto dei controlli con sola icona (lo stesso di Esporta e Svuota nella barra del team): appare sotto il mouse e
 * col fuoco da tastiera, al posto del tooltip del browser. Il nome resta quello del controllo; il dettaglio, se c'è,
 * è la sua descrizione.
 */
export function Hint({ label, detail, done, end = false, className, children }: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const own = children.props as Record<string, ((e: unknown) => void) | undefined>;
  const on = (key: string, value: boolean) => (e: unknown) => { setShown(value); own[key]?.(e); };
  const trigger = cloneElement(children, {
    'aria-describedby': detail ? id : undefined,
    onFocus: on('onFocus', true),
    onBlur: on('onBlur', false),
  });
  return (
    // Il mouse si ascolta sul contenitore: anche un pulsante disattivato (es. Salva con 5 set già salvati) mostra il fumetto
    <span className={`hint-wrap${end ? ' end' : ''}${className ? ` ${className}` : ''}`}
      onPointerEnter={() => setShown(true)} onPointerLeave={() => setShown(false)}
      // Esc nasconde il fumetto (e continua: nell'editor chiude anche l'editor, come sempre)
      onKeyDown={e => { if (e.key === 'Escape') setShown(false); }}>
      {trigger}
      {done ? (
        <span className="hint-bubble done" role="status">{done}</span>
      ) : (
        // Sempre nella pagina (il dettaglio serve alla descrizione anche a fumetto chiuso), visibile solo quando serve
        <span className="hint-bubble" hidden={!shown}>
          {label}{detail && <span className="hint-detail" id={id}>{detail}</span>}
        </span>
      )}
    </span>
  );
}
