import type { EngineData } from '../engine/data';
import { battleName } from '../engine/dex';
import type { TeamSet } from '../engine/sets';
import { statsEntry } from '../engine/stats';
import { Sprite } from './Sprite';

/** Uso nel meta dei membri: solo informativo, non entra nella valutazione. */
export function MetaUsePanel({ team, data }: { team: TeamSet[]; data: EngineData }) {
  return (
    <details open aria-label="Meta Use" className="block meta-use">
      <summary><span>Meta Use</span><span>Solo informativo</span></summary>
      {!data.stats ? (
        <p className="note">Statistiche Smogon assenti.</p>
      ) : (
        <ul className="mon-rows">
          {team.map((set, i) => {
            const entry = statsEntry(data.stats, battleName(set));
            return (
              <li key={`${i}-${set.species}`} className={entry ? '' : 'absent'}>
                <Sprite species={set.species} item={set.item} size={40} />
                <span className="who"><strong>{set.species}</strong></span>
                {entry ? (
                  <span className="status">
                    <meter min={0} max={0.5} value={entry.usage} aria-hidden="true" />
                    <span className="usage"> {(entry.usage * 100).toFixed(1)}%</span>
                  </span>
                ) : <span className="status"> non presente nelle statistiche</span>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">Solo informativo: non influisce sulla valutazione del team.</p>
    </details>
  );
}
