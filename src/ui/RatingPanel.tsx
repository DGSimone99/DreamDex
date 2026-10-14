import type { TeamRating } from '../engine/rating';

export function RatingPanel({ rating }: { rating: TeamRating }) {
  return (
    <div role="group" aria-label="Valutazione team" className="block rating">
      <h3>Valutazione team</h3>
      <p className={`grade grade-${rating.grade}`}>
        <strong>{rating.grade}</strong> · {rating.overall}/100 · {rating.label}
        {rating.provisional ? ' (provvisoria)' : ''}
      </p>
      <dl className="bars">
        {rating.areas.map(area => (
          <div key={area.key}>
            <dt>{area.label} {area.value ?? 'n/d'}</dt>
            <dd><meter min={0} max={100} value={area.value ?? 0} /></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
