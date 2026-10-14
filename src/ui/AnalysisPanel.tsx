import type { TeamAnalysis } from '../engine/analysis';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from '../engine/roles';
import type { TeamSet } from '../engine/sets';

const MULTIPLIER_LABELS: Record<string, string> = { '4': '×4', '2': '×2', '1': '', '0.5': '×½', '0.25': '×¼', '0': '×0' };
const formatMultiplier = (m: number) => MULTIPLIER_LABELS[String(m)] ?? `×${m}`;
const STYLE_LABELS = { physical: 'fisico', special: 'speciale' } as const;

export function AnalysisPanel({ team, analysis }: { team: TeamSet[]; analysis: TeamAnalysis }) {
  const problems = analysis.weakness.filter(row => row.pressure > 0);
  const uncovered = analysis.coverage.filter(row => row.hitters.length === 0);
  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  const rolesOf = team.map(set => ({ name: set.species, roles: detectRoles(set) }));
  const present = new Set(rolesOf.flatMap(r => r.roles));
  const threatSummary = open.length === 0
    ? 'nessuna'
    : `${open.slice(0, 2).map(t => t.name).join(', ')}${open.length > 2 ? ` +${open.length - 2}` : ''}`;

  return (
    <section aria-label="Analisi" className="analysis">
      <h2>Analisi</h2>

      <details className="block">
        <summary><span>Debolezze difensive</span><span>{problems.length} problemi</span></summary>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              {team.map((set, i) => <th key={i}>{set.species}</th>)}
              <th>Deboli</th>
              <th>Resistono</th>
            </tr>
          </thead>
          <tbody>
            {analysis.weakness.map(row => (
              <tr key={row.type} className={row.pressure > 0 ? 'bad' : row.resist > row.weak ? 'good' : ''}>
                <th scope="row">{row.type}</th>
                {row.multipliers.map((m, i) => <td key={i}>{formatMultiplier(m)}</td>)}
                <td>{row.weak}</td>
                <td>{row.resist}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="block">
        <summary><span>Coverage offensiva</span><span>{18 - uncovered.length}/18 tipi</span></summary>
        <ul>
          {analysis.coverage.map(row => (
            <li key={row.type} className={row.hitters.length ? 'good' : 'bad'}>
              {row.type}: {row.hitters.length
                ? row.hitters.map(h => `${h.member} (${h.move})`).join(', ')
                : 'nessuna mossa super efficace'}
            </li>
          ))}
        </ul>
      </details>

      <details className="block">
        <summary>
          <span>Ruoli</span>
          <span>{ESSENTIAL_ROLES.map(role => `${present.has(role) ? '✔' : '✘'} ${ROLE_LABELS[role]}`).join('  ')}</span>
        </summary>
        <ul>
          {[...ESSENTIAL_ROLES, ...DESIRABLE_ROLES].map(role => {
            const owners = rolesOf.filter(r => r.roles.includes(role)).map(r => r.name);
            return <li key={role}>{`${ROLE_LABELS[role]}: ${owners.length ? owners.join(', ') : 'mancante'}`}</li>;
          })}
        </ul>
        {analysis.needs.needStyle && (
          <p>Il team è sbilanciato: serve un attaccante {STYLE_LABELS[analysis.needs.needStyle]}.</p>
        )}
      </details>

      <details className="block">
        <summary><span>Minacce non gestite</span><span>{threatSummary}</span></summary>
        <ul>
          {analysis.threats.map(t => (
            <li key={t.name} className={t.handledBy.length ? '' : 'bad'}>
              {`${t.name} (${(t.usage * 100).toFixed(1)}%): ${t.handledBy.length ? `gestito da ${t.handledBy.join(', ')}` : 'nessun check'}`}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
