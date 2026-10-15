import type { EngineData } from '../engine/data';
import { battleName } from '../engine/dex';
import type { TeamSet } from '../engine/sets';
import { statsEntry } from '../engine/stats';

/** Uso nel meta dei membri: solo informativo, non entra nella valutazione. */
export function MetaUsePanel({ team, data }: { team: TeamSet[]; data: EngineData }) {
  return (
    <div role="group" aria-label="Meta Use" className="block meta-use">
      <h3>Meta Use</h3>
      {!data.stats ? (
        <p className="note">Statistiche Smogon assenti.</p>
      ) : (
        <ul>
          {team.map((set, i) => {
            const entry = statsEntry(data.stats, battleName(set));
            return (
              <li key={`${i}-${set.species}`}>
                {entry ? `${set.species} ${(entry.usage * 100).toFixed(1)}%` : `${set.species}: non presente nelle statistiche`}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">Solo informativo: non influisce sulla valutazione del team.</p>
    </div>
  );
}
