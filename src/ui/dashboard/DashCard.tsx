import { useId, type ReactNode } from 'react';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';

/** Una sezione del cruscotto: targhetta magenta obliqua, un riassunto breve, i link alle schede. */
export function DashCard({ title, meta, links, onOpen, openLabel, className = '', icon, titleExtra, tabs, level = 'h3', children }: {
  /** Le schede della card, dopo il titolo (la Copertura: Tipi e Meta). */
  tabs?: ReactNode;
  title: string;
  /** Un segno prima della targhetta (es. la medaglia del core in Bonus/Malus), decorativo. */
  icon?: ReactNode;
  /** Qualcosa in più dentro la targhetta, dopo il titolo (es. i punti dei core). */
  titleExtra?: ReactNode;
  /** Livello del titolo: h4 dentro una scheda di Analisi (sotto l'h3 dell'area). */
  level?: 'h3' | 'h4';
  /** Una sola scheda di arrivo: tutta la barra del titolo la apre (la freccia è il pulsante, allargato a tutta la barra). */
  onOpen?: () => void;
  /** Il nome del link di `onOpen` quando non porta alla scheda col nome del titolo (i Ruoli: Bonus/Malus, sottoscheda Ruoli). */
  openLabel?: string;
  meta?: ReactNode;
  links?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const Title = level;
  return (
    <section className={`dash-card ${className}`} aria-labelledby={id}>
      <header className={`dash-head${onOpen ? ' is-link' : ''}`}>
        {icon}
        <Title id={id} className="dash-plate">{title}{titleExtra}</Title>
        {tabs}
        {meta && <span className="dash-meta">{meta}</span>}
        {(links || onOpen) && <span className="dash-links">{links}{onOpen && <DashLink area={title} name={openLabel} onClick={onOpen} />}</span>}
      </header>
      {children}
    </section>
  );
}

/** Link a una scheda: col testo ("Difesa ›") o solo la freccia, con il nome per lettori di schermo. */
export function DashLink({ label, area, name, onClick }: { label?: string; area: string; name?: string; onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="dash-link" onClick={onClick} aria-label={label ? undefined : name ?? t('dash.open', { area })}>
      {label}<Icon name="next" />
    </button>
  );
}
