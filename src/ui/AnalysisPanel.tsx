import { threatScore, type TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { EngineData } from '../engine/data';
import type { TeamRating } from '../engine/rating';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES, ROLE_LABELS } from '../engine/roles';
import { weatherMitigations, type WeatherMitigation } from '../engine/synergy';
import type { TeamSet } from '../engine/sets';
import { CoachPanel } from './CoachPanel';
import { PokemonList } from './PokemonName';
import { IssueCounts, WEAKNESS_LABELS } from './IssueCounts';
import { Icon } from './icons';
import { weaknessSeverity, type SwapPreview } from '../engine/coach';
import { MetaUsePanel } from './MetaUsePanel';
import { RatingPanel } from './RatingPanel';
import { Sprite, TypeChip } from './Sprite';
import { MoveName, Typed } from './TypeText';

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

export function AnalysisPanel({ team, analysis, rating, coaching, preview, onReplace, onSwap, data }: {
  onSwap?: (index: number, set: TeamSet) => void;
  preview?: SwapPreview | null;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating?: TeamRating | null;
  data?: EngineData;
  coaching?: Coaching;
  onReplace?: (index: number) => void;
}) {
  const severities = analysis.weakness.map(weaknessSeverity);
  const seriousWeak = severities.filter(s => s === 'serious').length;
  const minorWeak = severities.filter(s => s === 'minor').length;
  const uncovered = analysis.coverage.filter(row => row.hitters.length === 0);
  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  const rolesOf = team.map(set => ({ name: set.species, roles: detectRoles(set) }));
  const roleGroups = [
    { title: 'Essenziali', roles: ESSENTIAL_ROLES },
    { title: 'Utili', roles: DESIRABLE_ROLES },
  ].map(group => ({
    ...group,
    rows: group.roles.map(role => ({ role, owners: rolesOf.filter(r => r.roles.includes(role)).map(r => r.name) })),
  }));
  const allRoles = roleGroups.flatMap(g => g.rows);
  const coveredRoles = allRoles.filter(r => r.owners.length > 0).length;
  // Prima i tipi scoperti: sono quelli su cui intervenire
  const coverageRows = [...uncovered, ...analysis.coverage.filter(row => row.hitters.length > 0)];
  const score = threatScore(analysis);
  const threatSummary = score === null
    ? 'nessun dato Smogon'
    : open.length === 0 ? 'Tutte coperte' : `${open.length} scoperte`;

  return (
    <section aria-label="Analisi" className="analysis">
      <h2>Analisi</h2>
      {rating && <RatingPanel rating={rating} />}
      {coaching && onReplace && <CoachPanel coaching={coaching} preview={preview} onReplace={onReplace} onSwap={onSwap} />}

      <details className="block" id="analysis-defense">
        <summary>
          <span>Debolezze difensive</span>
          <span className="summary-info">
            {seriousWeak + minorWeak === 0 && (team.length ? 'Nessuna mancanza' : '—')}
            <IssueCounts serious={seriousWeak} minor={minorWeak} labels={WEAKNESS_LABELS} />
          </span>
        </summary>
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
            {analysis.weakness.map((row, r) => (
              <tr key={row.type} className={severities[r] ?? (row.resist > row.weak ? 'good' : '')}>
                <th scope="row">
                  <TypeChip type={row.type} />
                  {/* Il colore della riga dice la gravità; a parole per gli screen reader */}
                  {severities[r] && <span className="visually-hidden">{severities[r] === 'serious' ? ' mancanza grave' : ' mancanza'}</span>}
                </th>
                {row.multipliers.map((m, i) => <td key={i}>{formatMultiplier(m)}</td>)}
                <td>{row.weak}</td>
                <td>{row.resist}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m)} /></p>)}
      </details>

      <details className="block" id="analysis-coverage">
        <summary><span>Coverage offensiva</span><span>{18 - uncovered.length}/18 tipi</span></summary>
        <ul className="type-rows">
          {coverageRows.map(row => (
            <li key={row.type} className={row.hitters.length ? '' : 'bad'}>
              <TypeChip type={row.type} />
              {row.hitters.length
                ? <span>{row.hitters.map((h, i) => <span key={i} className="hitter">{h.member} <small><MoveName move={h.move} /></small></span>)}</span>
                : <span className="missing">Nessuna mossa super efficace</span>}
            </li>
          ))}
        </ul>
      </details>

      <details className="block" id="analysis-roles">
        <summary>
          <span>Ruoli</span>
          <span>{coveredRoles}/{allRoles.length} coperti</span>
        </summary>
        {roleGroups.map(group => (
          <div key={group.title} className="role-group">
            <h4>{group.title}</h4>
            <ul className="role-rows">
              {group.rows.map(({ role, owners }) => (
                <li key={role} className={owners.length ? '' : 'bad'}>
                  <Icon name={owners.length ? 'check' : 'close'} />
                  <span className="role">{ROLE_LABELS[role]}</span>
                  <span className="owners">
                    {owners.length ? owners.map(name => <span key={name} className="owner">{name}</span>) : 'Mancante'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {analysis.needs.needStyle && (
          <p>Il team è sbilanciato: serve un attaccante {STYLE_LABELS[analysis.needs.needStyle]}.</p>
        )}
      </details>

      {data && team.length > 0 && <MetaUsePanel team={team} data={data} />}

      <details className="block">
        <summary><span>Minacce del meta</span><span>{threatSummary}</span></summary>
        {score !== null && (
          <p className="note">
            Copertura delle {analysis.threats.length} minacce più usate (pesata per uso): <strong>{Math.round(score)}%</strong>
            <meter min={0} max={100} value={score} />
          </p>
        )}
        <ul className="mon-rows">
          {analysis.threats.map(t => {
            const fixes = coaching?.threatFixes[t.name] ?? [];
            return (
              <li key={t.name} className={t.handledBy.length ? '' : 'bad'}>
                <Sprite species={t.name} size={40} />
                <span className="who">
                  <strong>{t.name}</strong> <span className="usage">{(t.usage * 100).toFixed(1)}%</span>
                </span>
                <span className="status">
                  <Icon name={t.handledBy.length ? 'check' : 'close'} />
                  <span>
                    {t.handledBy.length ? <span className="handled">Gestito da <PokemonList names={t.handledBy} /></span> : 'Nessun check'}
                    {fixes.length > 0 && <small className="fixes">Considera <PokemonList names={fixes} separator=" o " /></small>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
