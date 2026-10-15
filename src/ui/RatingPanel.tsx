import type { TeamRating } from '../engine/rating';

export function RatingPanel({ rating }: { rating: TeamRating }) {
  return (
    <div role="group" aria-label="Valutazione team" className="block rating">
      <h3>Valutazione team</h3>
      <p className={`grade grade-${rating.grade}`}>
        <strong>{rating.grade}</strong> <span>· {rating.overall}/100 · {rating.label}
        {rating.provisional ? ' (provvisoria)' : ''}</span>
      </p>
      <dl className="bars">
        {rating.areas.map(area => (
          <div key={area.key}>
            <dt>{area.label} {area.value ?? 'n/d'}</dt>
            <dd><meter min={0} max={100} value={area.value ?? 0} /></dd>
          </div>
        ))}
      </dl>
      {rating.power.length > 0 && (
        <p className="note">
          Statistiche:{' '}
          {rating.power.map((m, i) => (
            <span key={`${i}-${m.species}`} title={`Offesa ${m.offense} · Robustezza ${m.bulk}`}>
              {i > 0 ? ' · ' : ''}{m.species} {m.power}
            </span>
          ))}
        </p>
      )}
      {rating.bonus.total > 0 && (
        <div className="bonus">
          <strong>Bonus +{rating.bonus.total}</strong>{' '}
          <small>(meteo e campi che smorzano debolezze, non sempre attivi)</small>
          <ul>
            {rating.bonus.items.map(item => <li key={item.text}>{item.text} (+{item.points})</li>)}
          </ul>
        </div>
      )}
      {rating.penalty.total > 0 && (
        <div className="penalty">
          <strong>Penalità −{rating.penalty.total}</strong>{' '}
          <small>(voto senza bonus e penalità: {rating.base})</small>
          <ul>
            {rating.penalty.items.map(item => <li key={item.text}>{item.text} (−{item.points})</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Voto grande accanto alla fila del team (riassunto visivo; i dettagli sono nella valutazione). */
export function GradeBadge({ rating }: { rating: TeamRating | null }) {
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}`} aria-hidden="true">
      <span className="letter">{rating?.grade ?? '–'}</span>
      <span className="overall">{rating ? `${rating.overall} / 100` : 'Nessun voto'}</span>
      <span className="label">{rating ? `${rating.label}${rating.provisional ? ' · provvisoria' : ''}` : 'Aggiungi un Pokémon'}</span>
    </div>
  );
}
