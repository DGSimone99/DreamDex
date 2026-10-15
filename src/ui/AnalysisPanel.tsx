import type { TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { TeamRating } from '../engine/rating';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from '../engine/roles';
import { weatherMitigations, type WeatherMitigation } from '../engine/synergy';
import type { TeamSet } from '../engine/sets';
import { CoachPanel } from './CoachPanel';
import { RatingPanel } from './RatingPanel';

const MULTIPLIER_LABELS: Record<string, string> = { '4': '×4', '2': '×2', '1': '', '0.5': '×½', '0.25': '×¼', '0': '×0' };
const formatMultiplier = (m: number) => MULTIPLIER_LABELS[String(m)] ?? `×${m}`;
const STYLE_LABELS = { physical: 'fisico', special: 'speciale' } as const;

const MITIGATION_LABELS: Record<string, string> = {
  sun: 'Col sole', rain: 'Con la pioggia', grassyterrain: 'Col Campo Erboso', mistyterrain: 'Col Campo Nebbioso',
};

/** "Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo" */
function mitigationNote(m: WeatherMitigation): string {
  const groups = new Map<string, string[]>();
  for (const x of m.members) {
    const key = `${formatMultiplier(x.from)} → ${formatMultiplier(x.to) || '×1'}`;
    groups.set(key, [...(groups.get(key) ?? []), x.species]);
  }
  const changes = [...groups].map(([change, names]) => `${m.type} ${change} per ${names.join(', ')}`).join('; ');
  const source = m.source.replace(' (', ', ').replace(/\)$/, '');
  return `${MITIGATION_LABELS[m.condition]} (${source}): ${changes} · il meteo non è sempre attivo`;
}

export function AnalysisPanel({ team, analysis, rating, coaching, onReplace }: {
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating?: TeamRating | null;
  coaching?: Coaching;
  onReplace?: (index: number) => void;
}) {
  const problems = analysis.weakness.filter(row => row.pressure > 0);
  const uncovered = analysis.coverage.filter(row => row.hitters.length === 0);
  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  const rolesOf = team.map(set => ({ name: set.species, roles: detectRoles(set) }));
  const present = new Set(rolesOf.flatMap(r => r.roles));
  const handledCount = analysis.threats.length - open.length;
  const threatSummary = open.length === 0
    ? `${handledCount}/${analysis.threats.length} gestiti`
    : `${handledCount}/${analysis.threats.length} gestiti · mancano ${open.slice(0, 2).map(t => t.name).join(', ')}${open.length > 2 ? ` +${open.length - 2}` : ''}`;

  return (
    <section aria-label="Analisi" className="analysis">
      <h2>Analisi</h2>
      {rating && <RatingPanel rating={rating} />}
      {coaching && onReplace && <CoachPanel coaching={coaching} onReplace={onReplace} />}

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
        {weatherMitigations(team).map(m => <p key={m.condition} className="note">{mitigationNote(m)}</p>)}
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
        <summary><span>Check contro i Pokémon più usati</span><span>{threatSummary}</span></summary>
        <ul>
          {analysis.threats.map(t => {
            const fixes = coaching?.threatFixes[t.name] ?? [];
            const detail = t.handledBy.length
              ? `gestito da ${t.handledBy.join(', ')}`
              : `nessun check${fixes.length ? ` → considera ${fixes.join(' o ')}` : ''}`;
            return <li key={t.name} className={t.handledBy.length ? '' : 'bad'}>{`${t.name} (${(t.usage * 100).toFixed(1)}%): ${detail}`}</li>;
          })}
        </ul>
      </details>
    </section>
  );
}
