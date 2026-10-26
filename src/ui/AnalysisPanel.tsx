import type { ReactNode } from 'react';
import { threatScore, type TeamAnalysis } from '../engine/analysis';
import type { Coaching } from '../engine/coach';
import type { EngineData } from '../engine/data';
import type { TeamRating } from '../engine/rating';
import { keyValue, MISSING_BELOW, needLabel, type Need } from '../engine/needs';
import { LEVEL_KEYS, type Level } from '../engine/roleLevels';
import { battleName } from '../engine/dex';
import { weatherMitigations, type WeatherMitigation } from '../engine/synergy';
import { formatPercent, t, type Lang } from '../i18n';
import { anyGameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import type { TeamSet } from '../engine/sets';
import { CoachPanel } from './CoachPanel';
import { AreaView } from './AreaView';
import { AnalysisTabs } from './AnalysisTabs';
import type { AnalysisView } from './analysisView';
import type { AreaKey } from './AreaDetail';
import type { CoachProblem, ProblemCategory } from '../engine/coach';
import { PokemonList } from './PokemonName';
import { IssueCounts, WEAKNESS_LABELS } from './IssueCounts';
import { Icon } from './icons';
import { weaknessSeverity, type SwapPreview } from '../engine/coach';
import { MetaUsePanel } from './MetaUsePanel';
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

/** I problemi del coaching che riguardano ogni area (regole e condizioni restano solo nella Panoramica). */
const AREA_PROBLEMS: Record<AreaKey, ProblemCategory[]> = { defense: ['defense'], strength: ['coverage'], roles: ['roles'], speed: [], bonusMalus: ['redundancy'] };
export const problemsOf = (problems: CoachProblem[] | undefined, area: AreaKey) => (problems ?? []).filter(p => AREA_PROBLEMS[area].includes(p.category));

export function AnalysisPanel({ team, analysis, rating, coaching, preview, onReplace, onSwap, data, withMeta = true, expanded = false, footer, view = 'overview', onView }: {
  /** Panoramica o un'area del voto (Bonus/Malus non ha una scheda: sta nel Coaching). */
  view?: AnalysisView;
  /** Cambia scheda interna; senza, niente schede (pannello usato da solo). */
  onView?: (view: AnalysisView) => void;
  /** In fondo alla colonna destra (la scheda dei membri). */
  footer?: ReactNode;
  onSwap?: (index: number, set: TeamSet) => void;
  /** Uso nel meta e minacce in fondo; senza, li mostra la scheda Meta (MetaPanel). */
  withMeta?: boolean;
  /** Debolezze, coverage e ruoli aperti all'inizio (nella scheda Analisi c'è spazio). */
  expanded?: boolean;
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
  // Voci dei ruoli per livello, secondo il tipo di team (come nel voto): essenziali, importanti, minori e ignorate
  const { needs } = analysis;
  // Chi copre una voce: i membri col valore misurato (col credito del secondario) almeno MISSING_BELOW, come i bisogni
  const ownersOf = (need: Need) => team.filter((_, i) => keyValue(needs.credited[i] ?? needs.members[i] ?? {}, need) >= MISSING_BELOW).map(set => battleName(set));
  const needGroups = ([
    { title: tr('analysis.essential'), level: 'essential' },
    { title: tr('analysis.important'), level: 'important' },
    { title: tr('analysis.minor'), level: 'minor' },
    { title: tr('analysis.notRequired'), level: 'ignored' },
  ] as { title: string; level: Level }[])
    .map(group => ({ ...group, rows: LEVEL_KEYS.filter(need => needs.levels[need] === group.level).map(need => ({ need, owners: ownersOf(need) })) }))
    .filter(group => group.rows.length > 0);
  const essentialRows = needGroups.find(group => group.level === 'essential')?.rows ?? [];
  const archetypeName = tr(`archetype.${needs.archetype}`);
  // Prima i tipi scoperti: sono quelli su cui intervenire
  const coverageRows = [...uncovered, ...analysis.coverage.filter(row => row.hitters.length > 0)];

  const area = view !== 'overview' && view !== 'bonusMalus' && rating ? view : null;
  const tabs = onView && <AnalysisTabs view={area ?? 'overview'} onView={onView} panelId="analysis-view" />;

  if (area && rating) {
    return (
      <section aria-label={tr('analysis.region')} className="analysis">
        <h2>{tr('analysis.region')}</h2>
        {tabs}
        <div id="analysis-view" role="tabpanel" aria-labelledby={`analysis-view-${area}`} className="analysis-view">
          <AreaView key={area} rating={rating} area={area} problems={problemsOf(coaching?.problems, area)} />
        </div>
      </section>
    );
  }

  return (
    <section aria-label={tr('analysis.region')} className="analysis">
      <h2>{tr('analysis.region')}</h2>
      {tabs}
      <div className="analysis-cols" {...(tabs ? { id: 'analysis-view', role: 'tabpanel', 'aria-labelledby': 'analysis-view-overview' } : {})}>
        <div className="analysis-main">
          {coaching && onReplace && <CoachPanel coaching={coaching} preview={preview} onReplace={onReplace} onSwap={onSwap} />}
        </div>
        <div className="analysis-detail">
          <details className="block" id="analysis-defense" open={expanded}>
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

          <details className="block" id="analysis-coverage" open={expanded}>
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

          <details className="block" id="analysis-roles" open={expanded}>
            <summary>
              <span>{tr('analysis.roles')}</span>
              <span>{tr('analysis.rolesSummary', { archetype: archetypeName, n: essentialRows.filter(r => r.owners.length > 0).length, total: essentialRows.length })}</span>
            </summary>
            <p className="note" title={tr(`archetype.${needs.archetype}.note`)}>
              {team.length < 6 ? tr('analysis.judgedIncomplete', { archetype: archetypeName }) : tr('analysis.judgedAs', { archetype: archetypeName })}
            </p>
            {needGroups.map(group => (
              <div key={group.title} className="role-group">
                <h4>{group.title}</h4>
                <ul className="role-rows">
                  {group.rows.map(({ need, owners }) => {
                    // Manca un essenziale: rosso. Un importante mancante: avviso tenue (pesa nel voto). Minore mancante o voce ignorata: grigio
                    const essential = group.level === 'essential';
                    const important = group.level === 'important';
                    const state = owners.length ? (group.level !== 'ignored' ? '' : 'soft') : essential ? 'bad' : important ? 'warn' : 'soft';
                    return (
                      <li key={need} className={state}>
                        {owners.length ? <Icon name="check" /> : essential ? <Icon name="close" /> : <span aria-hidden="true" />}
                        <span className="role">{needLabel(need, lang)}</span>
                        <span className="owners">
                          {owners.length
                            ? owners.map(name => <span key={name} className="owner">{name}</span>)
                            : essential ? tr('analysis.missing') : important ? tr('analysis.notCovered') : group.level !== 'ignored' ? '—' : tr('analysis.notRequiredValue')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {analysis.needs.needStyle && (
              <p>{tr('analysis.unbalanced', { style: tr(`analysis.style.${analysis.needs.needStyle}`) })}</p>
            )}
          </details>
          {footer}
        </div>
      </div>
      {withMeta && <MetaPanelBody team={team} analysis={analysis} data={data} coaching={coaching} />}
    </section>
  );
}

/** Uso nel meta dei membri e minacce del meta; senza meta, niente. */
function MetaPanelBody({ team, analysis, data, coaching, expanded = false }: { team: TeamSet[]; analysis: TeamAnalysis; data?: EngineData; coaching?: Coaching; expanded?: boolean }) {
  const tr = useT();
  const lang = useLang();
  const open = analysis.threats.filter(t => t.handledBy.length === 0);
  const score = threatScore(analysis);
  const threatSummary = score === null
    ? tr('analysis.threatsNoData')
    : open.length === 0 ? tr('analysis.threatsAll') : tr('analysis.threatsOpen', { n: open.length });
  return (
    <>
      {/* Senza meta niente uso nel formato né minacce */}
      {data && !data.ignoreMeta && team.length > 0 && <MetaUsePanel team={team} data={data} open={expanded} />}

      {!data?.ignoreMeta && <details className="block" open={expanded}>
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
      </details>}
    </>
  );
}

/** Scheda Meta: uso nel meta a sinistra, minacce a destra. */
export function MetaPanel(props: { team: TeamSet[]; analysis: TeamAnalysis; data?: EngineData; coaching?: Coaching }) {
  const tr = useT();
  return (
    <section aria-label={tr('tabs.meta')} className="meta-panel">
      <MetaPanelBody {...props} expanded />
    </section>
  );
}
