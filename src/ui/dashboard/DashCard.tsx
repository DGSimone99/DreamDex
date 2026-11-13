import { useId, type ReactNode } from 'react';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';

/** Una sezione del cruscotto: targhetta magenta obliqua, un riassunto breve, i link alle schede. */
export function DashCard({ title, meta, links, onOpen, className = '', tooltip, children }: {
  title: string;
  /** Una sola scheda di arrivo: tutta la barra del titolo la apre (la freccia è il pulsante, allargato a tutta la barra). */
  onOpen?: () => void;
  meta?: ReactNode;
  links?: ReactNode;
  className?: string;
  /** Testo nascosto per la densità stretta (es. il controllo della Velocità). */
  tooltip?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className={`dash-card ${className}`} aria-labelledby={id} title={tooltip}>
      <header className={`dash-head${onOpen ? ' is-link' : ''}`}>
        <h3 id={id} className="dash-plate">{title}</h3>
        {meta && <span className="dash-meta">{meta}</span>}
        {(links || onOpen) && <span className="dash-links">{links}{onOpen && <DashLink area={title} onClick={onOpen} />}</span>}
      </header>
      {children}
    </section>
  );
}

/** Link a una scheda: col testo ("Difesa ›") o solo la freccia, con il nome per lettori di schermo. */
export function DashLink({ label, area, onClick }: { label?: string; area: string; onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="dash-link" onClick={onClick} aria-label={label ? undefined : t('dash.open', { area })}>
      {label}<Icon name="next" />
    </button>
  );
}
