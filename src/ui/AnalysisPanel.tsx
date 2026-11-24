import { useEffect, useLayoutEffect, useState } from 'react';
import type { TeamAnalysis } from '../engine/analysis';
import type { CoachAdvice, Coaching, CoachProblem, ProblemCategory } from '../engine/coach';
import type { CoachFix } from '../engine/coachFixes';
import type { EngineData } from '../engine/data';
import type { MoveFix } from '../engine/moveFixes';
import type { TeamRating } from '../engine/rating';
import type { TeamSet } from '../engine/sets';
import { useT } from '../i18n/react';
import { AnalysisOverview } from './AnalysisOverview';
import { AnalysisTabs } from './AnalysisTabs';
import { resolveView, type AnalysisView, type TabView } from './analysisView';
import type { AreaKey, KoFocus } from './AreaDetail';
import { AreaView } from './AreaView';
import { CoachingView } from './CoachingView';
import { TabsGrade } from './RatingPanel';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';

/**
 * I problemi del coaching che riguardano ogni area, nella testata dell'area: le stesse aree delle righe del Coaching
 * (columnOf), così i conti tornano. La Difesa prende anche le minacce del meta che nessuno regge, l'Offesa quelle che
 * nessuno manda KO; Ruoli e Bonus i ruoli che mancano, le condizioni del tipo di team e i malus del Coaching (le ripetizioni), senza le
 * debolezze in comune (le dice già la Difesa, come nel Coaching). Le regole restano nella Panoramica e nel Coaching.
 */
const AREA_PROBLEMS: Record<AreaKey, ProblemCategory[]> = { defense: ['defense', 'meta'], strength: ['coverage', 'metaHit', 'meta'], speed: [], bonusMalus: ['roles', 'conditions', 'redundancy'] };
export const problemsOf = (problems: CoachProblem[] | undefined, area: AreaKey) => (problems ?? [])
  .filter(p => AREA_PROBLEMS[area].includes(p.category) && !p.key.startsWith('redundancy:sharedWeak:'));

/**
 * La scheda Analisi: le schede interne (Panoramica e le aree del voto) e il loro contenuto. La Panoramica dice cosa fare;
 * al posto della Panoramica può esserci il profilo di un membro; le aree mostrano sulla pagina sottostatistiche e tabelle complete.
 */
export function AnalysisPanel({ team, analysis, rating, coaching, advice = null, data, view, onView, jump = null, onAdd, onFix, onMoveFix, onApplyFix, onApplyMove, onExport, onImproveSets, onCollapseTeam, teamCollapsed = false }: {
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
  /** Il Coaching senza problemi: copia il team per Showdown (come Esporta del team); vero se è andata. */
  onExport?: () => Promise<boolean>;
  /** Il Coaching con problemi che nessuna sostituzione risolve: apre Migliora i set. */
  onImproveSets?: () => void;
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
  /**
   * Una richiesta da fuori (il blocco "Contro il tuo team" della scheda Meta): apre la vista, la sottoscheda e il
   * dettaglio acceso come un clic della Panoramica; `nonce` la ripete anche uguale.
   */
  jump?: { view: AnalysisView; sub?: string; focus?: KoFocus; nonce: number } | null;
  /** Membro aperto nella Panoramica (null: nessuno) e come cambiarlo. */
}) {
  const tr = useT();
  // La sottoscheda scelta in ogni area, solo in memoria: tornando su un'area si ritrova (Generale se non c'è più)
  const [subTabs, setSubTabs] = useState<Partial<Record<AreaKey, string>>>({});
  // Il problema scelto nella testata di un'area: il Coaching si apre su di lui (`nonce`: anche lo stesso problema di nuovo)
  const [coachFocus, setCoachFocus] = useState<{ key: string; nonce: number } | null>(null);
  // Aprire un'area anche su una sua sotto-scheda (Copertura → Coverage tipi; i Ruoli → Bonus/Malus, sottoscheda Ruoli)
  // Il dettaglio da accendere nell'area che si apre (una minaccia della Panoramica): vale solo per quell'area, e si
  // dimentica appena si passa a un'altra scheda (tornandoci non si riaccende)
  const [areaFocus, setAreaFocus] = useState<{ area: TabView; focus: KoFocus } | null>(null);
  const openView = (next: AnalysisView, sub?: string, focus?: KoFocus) => {
    const target = resolveView(next);
    const pick = target.sub ?? sub;
    if (pick && target.tab !== 'overview' && target.tab !== 'coaching') setSubTabs(tabs => ({ ...tabs, [target.tab]: pick }));
    setAreaFocus(focus ? { area: target.tab, focus } : null);
    onView(target.tab);
  };
  // Una vista che non è una scheda (i Ruoli, da un link del voto o da uno stato vecchio): si apre la sua scheda con la sottoscheda
  const target = resolveView(view);
  useLayoutEffect(() => { if (target.sub) openView(view); }, [view]);
  useLayoutEffect(() => { if (jump) openView(jump.view, jump.sub, jump.focus); }, [jump?.nonce]);
  const area = target.tab !== 'overview' && target.tab !== 'coaching' && rating ? target.tab : null;
  // Telefono: niente Panoramica, l'Analisi si apre sul Coaching (il voto del team sta nella barra delle schede); senza voto
  // (team vuoto o voto bloccato) resta la Panoramica col suo messaggio, senza schede
  const phone = useMediaQuery(PHONE_QUERY);
  const showCoaching = (view === 'coaching' || (phone && target.tab === 'overview')) && !!rating;
  // Lasciato il Coaching, il problema scelto si dimentica (tornandoci dalle schede non si riaccende)
  useEffect(() => { if (!showCoaching) setCoachFocus(null); }, [showCoaching]);
  useEffect(() => { if (areaFocus && areaFocus.area !== (area ?? 'overview')) setAreaFocus(null); }, [area]);
  // Lo stesso numero della barra laterale (tutti i problemi), rosso se almeno uno è grave
  // Come la lista del Coaching: senza le debolezze in comune (le dice già la Difesa)
  const problems = (coaching?.problems ?? []).filter(p => !p.key.startsWith('redundancy:sharedWeak:'));
  const serious = problems.filter(p => p.severity === 'serious').length;
  const tabView: TabView = area ?? (showCoaching ? 'coaching' : 'overview');
  let body;
  if (area && rating) {
    body = (
      <AreaView key={area} rating={rating} area={area} team={team} analysis={analysis} problems={problemsOf(coaching?.problems, area)} roomy={teamCollapsed} formatId={data.formatId}
        picked={(area === target.tab ? target.sub : undefined) ?? subTabs[area] ?? null} onPick={key => setSubTabs(tabs => ({ ...tabs, [area]: key }))}
        onCoaching={key => {
          if (key) setCoachFocus(f => ({ key, nonce: (f?.nonce ?? 0) + 1 }));
          openView('coaching');
        }} advice={advice} initialFocus={areaFocus?.area === area ? areaFocus.focus : null} />
    );
  } else if (showCoaching && coaching) {
    // Il Coaching vince sul profilo di un membro, come le aree
    body = <CoachingView coaching={coaching} advice={advice} members={team.length} rating={rating}
      onFix={fix => onFix?.(fix)} onMoveFix={fix => onMoveFix?.(fix)}
      onApplyFix={fix => onApplyFix?.(fix)} onApplyMove={fix => onApplyMove?.(fix)} focus={coachFocus}
      onExport={onExport} onImproveSets={onImproveSets} onOverview={phone ? undefined : () => openView('overview')} />;
  } else {
    body = <AnalysisOverview team={team} analysis={analysis} rating={rating} coaching={coaching} advice={advice} data={data}
      onView={openView} onAdd={onAdd} onCollapseTeam={onCollapseTeam} teamCollapsed={teamCollapsed} />;
  }
  return (
    <section aria-label={tr('analysis.region')} className="analysis">
      <h2>{tr('analysis.region')}</h2>
      {!(phone && !rating) && <AnalysisTabs view={tabView} onView={openView} panelId="analysis-view" areasDisabled={!rating}
        noOverview={phone} aside={phone && rating ? <TabsGrade rating={rating} team={team} broken={problems.some(p => p.category === 'rules')} incomplete={team.length < 6} onOpen={area => openView(area)} /> : null} badges={problems.length ? { coaching: { n: problems.length, serious, minor: problems.length - serious, neutral: team.length < 6 } } : {}}
        scores={Object.fromEntries((rating?.areas ?? []).map(a => [a.key, a.value]))} />}
      <div id="analysis-view" role="tabpanel" aria-labelledby={`analysis-view-${tabView}`} className="analysis-view">{body}</div>
    </section>
  );
}
