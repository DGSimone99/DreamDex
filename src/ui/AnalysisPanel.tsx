import { metaThreats } from '../engine/attackers';
import { battleName } from '../engine/dex';
import { useMemberTip } from './MemberCard';
import { useLayoutEffect, useState } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { CoachAdvice, Coaching, CoachProblem, ProblemCategory } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import type { EngineData } from '../engine/data';
import type { MoveFix } from '../engine/moveFixes';
import { rateTeam, ratingThreats, type TeamRating } from '../engine/rating';
import { usageOf } from '../engine/stats';
import type { TeamSet } from '../engine/sets';
import { formatPercent } from '../i18n';
import { useLang, useT } from '../i18n/react';
import { AnalysisOverview } from './AnalysisOverview';
import { AnalysisTabs } from './AnalysisTabs';
import { resolveView, type AnalysisView, type TabView } from './analysisView';
import type { AreaKey } from './AreaDetail';
import { AreaView } from './AreaView';
import { CoachingView } from './CoachingView';
import { Icon } from './icons';
import { MetaUsePanel } from './MetaUsePanel';
import { PokemonList } from './PokemonName';
import { Sprite } from './Sprite';

/**
 * I problemi del coaching che riguardano ogni area, nella striscia in fondo (regole, condizioni e minacce del meta restano
 * nella Panoramica e nel Coaching). Ruoli e Bonus prende i ruoli che mancano e i malus del Coaching (le ripetizioni).
 */
const AREA_PROBLEMS: Record<AreaKey, ProblemCategory[]> = { defense: ['defense'], strength: ['coverage'], speed: [], bonusMalus: ['roles', 'redundancy'] };
export const problemsOf = (problems: CoachProblem[] | undefined, area: AreaKey) => (problems ?? []).filter(p => AREA_PROBLEMS[area].includes(p.category));

/**
 * La scheda Analisi: le schede interne (Panoramica e le aree del voto) e il loro contenuto. La Panoramica dice cosa fare;
 * al posto della Panoramica può esserci il profilo di un membro; le aree mostrano sulla pagina sottostatistiche e tabelle complete.
 */
export function AnalysisPanel({ team, analysis, rating, coaching, advice = null, data, view, onView, onAdd, onFix, onMoveFix, onApplyFix, onApplyMove, onCollapseTeam, teamCollapsed = false }: {
  /** Team ridotto: la Panoramica usa la densità ampia. */
  teamCollapsed?: boolean;
  /** Riduce il team (dal Riassunto della Panoramica). */
  onCollapseTeam?: () => void;
  /** Un candidato del Coaching: apre la scheda Pokémon su di lui. */
  onFix?: (fix: CoachFix) => void;
  /** Un cambio di mossa del Coaching. */
  onMoveFix?: (fix: MoveFix) => void;
  /** Clic su una proposta del Coaching: il cambio di Pokémon o di mossa si applica subito (annullabile). */
  onApplyFix?: (fix: CoachFix) => void;
  onApplyMove?: (fix: MoveFix) => void;
  /** Aggiungere un Pokémon (posti liberi, Panoramica vuota): porta alla scheda Pokémon. */
  onAdd?: () => void;
  team: TeamSet[];
  analysis: TeamAnalysis;
  rating: TeamRating | null;
  data: EngineData;
  coaching?: Coaching;
  /** I consigli del Coaching (null: si stanno calcolando). */
  advice?: CoachAdvice | null;
  /** Panoramica, Coaching o un'area del voto. */
  view: AnalysisView;
  onView: (view: AnalysisView) => void;
  /** Membro aperto nella Panoramica (null: nessuno) e come cambiarlo. */
}) {
  const tr = useT();
  // La sottoscheda scelta in ogni area, solo in memoria: tornando su un'area si ritrova (Generale se non c'è più)
  const [subTabs, setSubTabs] = useState<Partial<Record<AreaKey, string>>>({});
  // Aprire un'area anche su una sua sotto-scheda (Copertura → Coverage tipi; i Ruoli → Bonus/Malus, sottoscheda Ruoli)
  const openView = (next: AnalysisView, sub?: string) => {
    const target = resolveView(next);
    const pick = target.sub ?? sub;
    if (pick && target.tab !== 'overview' && target.tab !== 'coaching') setSubTabs(tabs => ({ ...tabs, [target.tab]: pick }));
    onView(target.tab);
  };
  // Una vista che non è una scheda (i Ruoli, da un link del voto o da uno stato vecchio): si apre la sua scheda con la sottoscheda
  const target = resolveView(view);
  useLayoutEffect(() => { if (target.sub) openView(view); }, [view]);
  const area = target.tab !== 'overview' && target.tab !== 'coaching' && rating ? target.tab : null;
  const showCoaching = view === 'coaching' && !!rating;
  // Lo stesso numero della barra laterale (tutti i problemi), rosso se almeno uno è grave
  const problems = coaching?.problems ?? [];
  const serious = problems.filter(p => p.severity === 'serious').length;
  const tabView: TabView = area ?? (showCoaching ? 'coaching' : 'overview');
  let body;
  if (area && rating) {
    body = (
      <AreaView key={area} rating={rating} area={area} team={team} analysis={analysis} problems={problemsOf(coaching?.problems, area)} roomy={teamCollapsed} formatId={data.formatId}
        picked={(area === target.tab ? target.sub : undefined) ?? subTabs[area] ?? null} onPick={key => setSubTabs(tabs => ({ ...tabs, [area]: key }))}
        onCoaching={() => openView('coaching')} steps={advice?.steps ?? null} />
    );
  } else if (showCoaching && coaching) {
    // Il Coaching vince sul profilo di un membro, come le aree
    body = <CoachingView coaching={coaching} advice={advice} members={team.length} rating={rating} metaOn={!data.ignoreMeta && !!data.stats}
      threatUsage={Object.fromEntries([...ratingThreats(rating, data).map(th => th.name), ...(rating?.offense.coverageMeta?.rows ?? []).map(row => row.species)].map(name => [name, usageOf(data.stats, name)]))}
      onOpen={column => { if (column !== 'rules') openView(column === 'offense' ? 'strength' : column); }}
      onFix={fix => onFix?.(fix)} onMoveFix={fix => onMoveFix?.(fix)}
      onApplyFix={fix => onApplyFix?.(fix)} onApplyMove={fix => onApplyMove?.(fix)} />;
  } else {
    body = <AnalysisOverview team={team} analysis={analysis} rating={rating} coaching={coaching} advice={advice} data={data}
      onView={openView} onAdd={onAdd} onCollapseTeam={onCollapseTeam} teamCollapsed={teamCollapsed} />;
  }
  return (
    <section aria-label={tr('analysis.region')} className="analysis">
      <h2>{tr('analysis.region')}</h2>
      <AnalysisTabs view={tabView} onView={openView} panelId="analysis-view" areasDisabled={!rating} badges={problems.length ? { coaching: { n: problems.length, serious, minor: problems.length - serious } } : {}}
        scores={Object.fromEntries((rating?.areas ?? []).map(a => [a.key, a.value]))} />
      <div id="analysis-view" role="tabpanel" aria-labelledby={`analysis-view-${tabView}`} className="analysis-view">{body}</div>
    </section>
  );
}

/** Uso nel meta dei membri e minacce del meta; senza meta, niente. */
function MetaPanelBody({ team, rating, data, coaching, expanded = false }: { team: TeamSet[]; analysis: TeamAnalysis; rating?: TeamRating | null; data?: EngineData; coaching?: Coaching; expanded?: boolean }) {
  const tr = useT();
  const lang = useLang();
  // Le minacce come le giudica il voto (Coverage meta della Difesa), come il coach e la Panoramica
  const judged = rating !== undefined ? rating : data ? rateTeam(team, data, lang) : null;
  const threats = data ? ratingThreats(judged, data) : [];
  const open = threats.filter(t => t.handledBy.length === 0);
  const score = threats.length ? judged?.defense.coverageMeta?.value ?? null : null;
  // Sulla sprite di una minaccia: la carta del suo set più usato nel meta (quello che il voto usa per i calcoli)
  const memberTip = useMemberTip();
  const threatSets = data ? metaThreats(data) : [];
  const setOfThreat = (name: string) => threatSets.find(x => battleName(x.set) === name)?.set;
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
            {tr('analysis.threatScore', { n: threats.length })} <strong>{Math.round(score)}%</strong>
            <meter min={0} max={100} value={score} />
          </p>
        )}
        <ul className="mon-rows">
          {threats.map(t => {
            const fixes = coaching?.threatFixes[t.name] ?? [];
            return (
              <li key={t.name} className={t.handledBy.length ? '' : 'bad'}>
                <span className="mon-tip" {...(setOfThreat(t.name) ? memberTip.bind(setOfThreat(t.name)!, tr('mcard.threat', { pct: formatPercent(lang, t.usage) })) : {})}>
                  <Sprite species={t.name} size={40} />
                </span>
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
      {memberTip.tip}
    </>
  );
}

/** Scheda Meta: uso nel meta a sinistra, minacce a destra. */
export function MetaPanel(props: { team: TeamSet[]; analysis: TeamAnalysis; rating?: TeamRating | null; data?: EngineData; coaching?: Coaching }) {
  const tr = useT();
  return (
    <section aria-label={tr('tabs.meta')} className="meta-panel">
      <MetaPanelBody {...props} expanded />
    </section>
  );
}
