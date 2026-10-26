import type { Coaching } from '../engine/coach';
import { useT } from '../i18n/react';

/** Tipo di team e stili (Hyper Offense, Volt-turn…), col perché nel tooltip. */
export function TeamTypeLine({ teamType }: { teamType: NonNullable<Coaching['teamType']> }) {
  const tr = useT();
  return (
    <p className="team-type">
      <span className="team-type-label">{tr('coach.teamType')}</span>
      <strong title={tr(`archetype.${teamType.archetype}.note`)}>{tr(`archetype.${teamType.archetype}`)}</strong>
      {teamType.styles.map(style => (
        <span key={style} className="team-style" title={tr(`teamStyle.${style}.note`)}>{tr(`teamStyle.${style}`)}</span>
      ))}
    </p>
  );
}
