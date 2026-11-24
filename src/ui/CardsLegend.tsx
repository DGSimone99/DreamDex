/**
 * Telefono e tablet (Offesa, Difesa a carte): la legenda corta delle barre, sotto la riga del team, così i pezzi senza
 * etichetta nelle carte si leggono senza scorrere in cima. `text` (le carte delle minacce) dice prima cosa conta la barra.
 * Solo da vedere: per lo screen reader i pezzi hanno già il loro nome.
 */
export function CardsLegend({ pieces, text, setup, side = 'off' }: {
  pieces: [string, string][]; text?: string; setup?: string; side?: 'off' | 'def';
}) {
  return (
    <p className={`cards-legend ${side}`} aria-hidden="true">
      {text && <span className="cards-legend-text">{text}</span>}
      {/* I pezzi insieme: vanno a capo tutti insieme, mai uno solo (es. "OHKO") su una riga sua */}
      <span className="cards-legend-keys">
        {pieces.map(([key, label]) => <span key={key}><i className={`cl-${key}`} />{label}</span>)}
        {setup && <span><i className="kob-tri" />{setup}</span>}
      </span>
    </p>
  );
}

/** Il colore del numero grande della riga del team: verde se è tutto, giallo da 85%, rosso sotto. */
export const countClass = (n: number, total: number) => (n >= total ? 'full' : total > 0 && n / total >= 0.85 ? 'warn' : 'bad');
