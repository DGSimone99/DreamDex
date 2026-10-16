import { threatScore, type TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { EngineData } from '../engine/data';
import type { TeamRating } from '../engine/rating';
import { DESIRABLE_ROLES, detectRoles, ESSENTIAL_ROLES, roleLabel } from '../engine/roles';
import { battleName } from '../engine/dex';
import { weatherMitigations, type WeatherMitigation } from '../engine/synergy';
import { formatPercent, t, type Lang } from '../i18n';
import { anyGameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
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
/** "Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo" */
function mitigationNote(m: WeatherMitigation, lang: Lang): string {
  const groups = new Map<string, string[]>();
  for (const x of m.members) {
    const key = `${formatMultiplier(x.from)} → ${formatMultiplier(x.to) || '×1'}`;
    groups.set(key, [...(groups.get(key) ?? []), x.species]);
  }
  const changes = [...groups].map(([change, names]) =>
    t(lang, 'analysis.mitigationFor', { type: typeName(m.type, lang), change, list: names.join(', ') })).join('; ');
  const [setter, via = ''] = m.source.replace(/\)$/, '').split(' (');
  const source = via ? `${setter}, ${anyGameName(via, lang)}` : setter;
  return t(lang, 'analysis.mitigation', { condition: t(lang, `analysis.mitigation.${m.condition as 'sun' | 'rain' | 'grassyterrain' | 'mistyterrain'}`), source, changes });
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
  const tr = useT();
  const lang = useLang();
  const severities = analysis.weakness.map(weaknessSeverity);
  const seriousWeak = severities.filter(s => s === 'serious').length;
  const minorWeak = severities.filter(s => s === 'minor').length;
  const uncovered = analysis.coverage.filter(row => row.hitters.length === 0);
  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  const rolesOf = team.map(set => ({ name: battleName(set), roles: detectRoles(set) }));
  const roleGroups = [
    { title: tr('analysis.essential'), roles: ESSENTIAL_ROLES },
    { title: tr('analysis.useful'), roles: DESIRABLE_ROLES },
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
    ? tr('analysis.threatsNoData')
    : open.length === 0 ? tr('analysis.threatsAll') : tr('analysis.threatsOpen', { n: open.length });

  return (
    <section aria-label={tr('analysis.region')} className="analysis">
      <h2>{tr('analysis.region')}</h2>
      {rating && <RatingPanel rating={rating} ruleIssues={coaching?.problems.filter(p => p.category === 'rules').map(p => p.text)} />}
      {coaching && onReplace && <CoachPanel coaching={coaching} preview={preview} onReplace={onReplace} onSwap={onSwap} />}

      <details className="block" id="analysis-defense">
        <summary>
          <span>{tr('analysis.weakness')}</span>
          <span className="summary-info">
            {seriousWeak + minorWeak === 0 && (team.length ? tr('analysis.noShortfall') : '—')}
            <IssueCounts serious={seriousWeak} minor={minorWeak} labels={WEAKNESS_LABELS} />
          </span>
        </summary>
        <table>
          <thead>
            <tr>
              <th>{tr('analysis.type')}</th>
              {team.map((set, i) => <th key={i}>{battleName(set)}</th>)}
              <th>{tr('analysis.weakCol')}</th>
              <th>{tr('analysis.resistCol')}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.weakness.map((row, r) => (
              <tr key={row.type} className={severities[r] ?? (row.resist > row.weak ? 'good' : '')}>
                <th scope="row">
                  <TypeChip type={row.type} />
                  {/* Il colore della riga dice la gravità; a parole per gli screen reader */}
                  {severities[r] && <span className="visually-hidden">{` ${tr(severities[r] === 'serious' ? 'analysis.shortfallSerious' : 'analysis.shortfall')}`}</span>}
                </th>
                {row.multipliers.map((m, i) => <td key={i}>{formatMultiplier(m)}</td>)}
                <td>{row.weak}</td>
                <td>{row.resist}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {weatherMitigations(team).map(m => <p key={m.condition} className="note"><Typed text={mitigationNote(m, lang)} /></p>)}
      </details>

      <details className="block" id="analysis-coverage">
        <summary><span>{tr('analysis.coverage')}</span><span>{tr('analysis.coverageSummary', { n: 18 - uncovered.length })}</span></summary>
        <ul className="type-rows">
          {coverageRows.map(row => (
            <li key={row.type} className={row.hitters.length ? '' : 'bad'}>
              <TypeChip type={row.type} />
              {row.hitters.length
                ? <span>{row.hitters.map((h, i) => <span key={i} className="hitter">{h.member} <small><MoveName move={h.move} /></small></span>)}</span>
                : <span className="missing">{tr('analysis.noSuperEffective')}</span>}
            </li>
          ))}
        </ul>
      </details>

      <details className="block" id="analysis-roles">
        <summary>
          <span>{tr('analysis.roles')}</span>
          <span>{tr('analysis.rolesSummary', { n: coveredRoles, total: allRoles.length })}</span>
        </summary>
        {roleGroups.map(group => (
          <div key={group.title} className="role-group">
            <h4>{group.title}</h4>
            <ul className="role-rows">
              {group.rows.map(({ role, owners }) => (
                <li key={role} className={owners.length ? '' : 'bad'}>
                  <Icon name={owners.length ? 'check' : 'close'} />
                  <span className="role">{roleLabel(role, lang)}</span>
                  <span className="owners">
                    {owners.length ? owners.map(name => <span key={name} className="owner">{name}</span>) : tr('analysis.missing')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {analysis.needs.needStyle && (
          <p>{tr('analysis.unbalanced', { style: tr(`analysis.style.${analysis.needs.needStyle}`) })}</p>
        )}
      </details>

      {data && team.length > 0 && <MetaUsePanel team={team} data={data} />}

      <details className="block">
        <summary><span>{tr('analysis.threats')}</span><span>{threatSummary}</span></summary>
        {score !== null && (
          <p className="note">
            {tr('analysis.threatScore', { n: analysis.threats.length })} <strong>{Math.round(score)}%</strong>
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
                  <strong>{t.name}</strong> <span className="usage">{formatPercent(lang, t.usage)}</span>
                </span>
                <span className="status">
                  <Icon name={t.handledBy.length ? 'check' : 'close'} />
                  <span>
                    {t.handledBy.length ? <span className="handled">{tr('analysis.handledBy')} <PokemonList names={t.handledBy} /></span> : tr('analysis.noCheck')}
                    {fixes.length > 0 && <small className="fixes">{tr('analysis.consider')} <PokemonList names={fixes} separator={` ${tr('analysis.or')} `} /></small>}
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
