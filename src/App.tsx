import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import { coachTeam, type Coaching } from './engine/coach';
import type { CoachFix } from './engine/coachFixes';
import { rateTeam } from './engine/rating';
import type { EngineData } from './engine/data';
import { DEFAULT_MEMORY, withMultipleMegas } from './engine/formatChoice';
import { formatLabel, teraAllowed } from './engine/formats';
import { battleName } from './engine/dex';
import { DoneToast, UndoToast } from './ui/UndoToast';
import { takeSharedTeam } from './share';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { MetaTab } from './ui/meta/MetaTab';
import { GradeBadge } from './ui/RatingPanel';
import { blockedReason } from './engine/legalTeam';
import type { AnalysisView } from './ui/analysisView';
import type { KoFocus } from './ui/AreaDetail';
import { SavedPlateName, SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { SuggestionsPanel, type CandidateFocus } from './ui/SuggestionsPanel';
import { ListsPanel } from './ui/ListsPanel';
import { TeamPanel } from './ui/TeamPanel';
import { Rail } from './ui/Rail';
import { Icon } from './ui/icons';
import { TabPanel, Tabs, type TabId } from './ui/Tabs';
import { loadSession, loadTab, saveTab } from './storage';
import { SettingsDialog } from './ui/SettingsDialog';
import { CreditsDialog } from './ui/CreditsDialog';
import { FeedbackDialog } from './ui/FeedbackDialog';
import { t, type Lang } from './i18n';
import { metaBoard } from './engine/metaBoard';
import { LangProvider } from './i18n/react';
import { RulesContext } from './ui/rulesContext';
import { formatRules } from './engine/formatRules';
import { useDismissMenus } from './ui/useDismissMenus';
import { TouchTips } from './ui/TouchTips';
import { TipHost } from './ui/MoveTip';
import { useAdvice } from './ui/useRanking';
import { EeveeMoment } from './ui/EeveeMoment';
import { AutoBand } from './ui/AutoBand';
import { useFormatChoice, useLang, usePalette } from './app/useSettings';
import { useBooted, useLists, useSourceData } from './app/useEngineData';
import { useTeamLayout, useWorkspaceHeight } from './app/useTeamLayout';
import { teamEdits, useTeamState } from './app/teamEdits';
import { railTabs } from './app/railTabs';

/** Il Coaching mentre il voto si calcola: niente problemi, niente consigli (la riga Da sistemare resta vuota un attimo). */
const COACHING_WAIT: Coaching = { verdict: '', teamType: null, strengths: [], problems: [], threatFixes: {} };

interface AppProps {
  /** Dati della fonte iniziale (National Dex OU). */
  data: EngineData;
  /** Carica i dati di un'altra fonte quando si cambia formato. */
  loadSource?: (source: string) => Promise<EngineData>;
  /** Dove salvare la sessione (team e formato). Senza, si parte sempre da zero. */
  storage?: Storage;
  /** Lingua iniziale; senza, quella salvata o l'inglese. */
  initialLang?: Lang;
  /** Carica i nomi italiani del gioco: chiamato solo passando all'italiano, una volta. */
  loadNames?: () => Promise<void>;
}

/** Il salto alla colonna principale per chi usa la tastiera: prende il fuoco solo per il salto. */
function skipToMain(main: HTMLElement | null) {
  // Non resta focalizzabile: un clic nel vuoto chiuderebbe l'editor
  if (!main) return;
  main.tabIndex = -1;
  main.focus();
  main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
}

export function App({ data: initialData, loadSource, storage, initialLang, loadNames }: AppProps) {
  const [lang, changeLang] = useLang(storage, initialLang, loadNames);
  // I menu a tendina aperti si chiudono con un clic fuori o con Esc
  useDismissMenus();
  const [session] = useState(() => (storage ? loadSession(storage) : null));
  // Un link con un team (#t=...) vince sulla sessione salvata; quella resta recuperabile con Annulla
  const [shared] = useState(takeSharedTeam);
  const { choice, setChoice, format, memory } = useFormatChoice(storage, shared?.choice ?? session?.choice ?? DEFAULT_MEMORY.competitive);
  const [palette, changePalette] = usePalette(storage, format);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const closeCredits = useCallback(() => setCreditsOpen(false), []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    document.querySelector<HTMLElement>('.rail-settings')?.focus();
  }, []);
  const { loaded, loading } = useSourceData(initialData, format, loadSource);
  const { lists, userLists, changeLists, listUndo, setListUndo, undoLists } = useLists(storage, format);
  // Le schede Analisi, Meta e Liste si montano la prima volta che le si apre, poi restano (nascoste non si disegnano
  // all'avvio, e prima di aprirle non si ridisegnano a ogni modifica del team)
  const [listsOpened, setListsOpened] = useState(false);
  const [analysisOpened, setAnalysisOpened] = useState(false);
  const [metaOpened, setMetaOpened] = useState(false);
  const booted = useBooted();
  // Senza meta (single player): voto, analisi, coach e suggerimenti ignorano l'uso nel formato
  // Il formato scelto entra nei dati: alcune regole del voto cambiano col formato (Ubers)
  // Il voto e l'analisi non dipendono dalle liste: cambiandole non si ricalcolano (solo i suggerimenti le usano)
  const rated = useMemo(() => ({ ...loaded, formatId: format.formatId, ...(format.meta ? {} : { ignoreMeta: true }),
    ...(format.allowMultipleMegas ? { allowMultipleMegas: true } : {}), ...(format.game ? { game: format.game } : {}) }),
    [loaded, format.formatId, format.meta, format.allowMultipleMegas, format.game]);
  const data = useMemo(() => ({ ...rated, userLists }), [rated, userLists]);
  const teamState = useTeamState(storage, choice, shared, session);
  const { initialTeam, team, replaceIndex, setReplaceIndex, moveProposal, setMoveProposal, undo, setUndo, done, setDone } = teamState;
  // Cosa mostra Analisi: la Panoramica o un'area del voto (il riquadro Voto apre le aree)
  const [analysisView, setAnalysisView] = useState<AnalysisView>('overview');
  // Dalla scheda Meta all'Analisi: la Coverage meta con una minaccia accesa; `nonce` ripete anche la stessa richiesta
  const [analysisJump, setAnalysisJump] = useState<{ view: AnalysisView; sub: string; focus: KoFocus; nonce: number } | null>(null);
  // Scheda aperta sotto il team: col team vuoto si parte dai Pokémon, poi vale l'ultima scelta
  const [tab, setTabState] = useState<TabId>(() => (initialTeam.length && storage ? loadTab(storage) : null) ?? 'pokemon');
  const setTab = (next: TabId) => {
    setTabState(next);
    if (storage) saveTab(next, storage);
  };
  // Il membro aperto nell'editor: l'editor prende il posto della sezione finché resta aperto
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editingOpen = editingIndex !== null;
  // Telefono e tablet piccolo: niente tasto, il team si riduce scorrendo la pagina e torna grande in cima (useAutoCollapse)
  const bandControl = useRef<(() => void) | null>(null);
  // Senza meta la scheda Meta è spenta: si resta sull'Analisi
  const metaOn = !data.ignoreMeta && !!data.stats;
  const shownTab: TabId = tab === 'meta' && !metaOn ? 'analysis' : tab;
  const { collapsed, sectionsCollapsed, toggleCollapsed, autoBand, phone, tabletSide, tabletUpright } = useTeamLayout(storage, shownTab, editingOpen);
  const collapseTeam = () => { if (!collapsed) toggleCollapsed(); };
  const [closeSignal, setCloseSignal] = useState(0);
  // Completa team aperto: il magenta della pagina si spegne, resta solo quello del pannello (un'azione principale per volta)
  const [fillOpen, setFillOpen] = useState(false);
  // Migliora i set aperto dal Coaching (ogni numero nuovo apre la finestra del team)
  const [improveSignal, setImproveSignal] = useState(0);
  // La pagina non scorre: aprire una sezione basta a mostrarla (e chiude l'editor)
  const openTab = (next: TabId) => { setTab(next); setCloseSignal(n => n + 1); };
  // Dalla barra delle sezioni (e dal voto): sul telefono la sezione si apre dall'inizio, col team ridotto
  const navTo = (next: TabId) => { bandControl.current?.(); openTab(next); };
  const mainRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useWorkspaceHeight(mainRef, workspaceRef);
  // Slot vuoto cliccato: scheda Pokémon in modalità Aggiungi, con il cursore nella ricerca
  const [searchRequest, setSearchRequest] = useState(0);
  const startAdd = () => {
    setReplaceIndex(null);
    setSearchRequest(n => n + 1);
    openTab('pokemon');
  };
  /** Scegliere chi sostituire (dal coach o da una carta) porta alla scheda Pokémon, dove ci sono i candidati. */
  const startReplace = (index: number | null) => {
    setReplaceIndex(index);
    if (index !== null) openTab('pokemon');
  };
  // Candidato scelto nel Coaching: la scheda Pokémon va su di lui (sostituendo quel membro, o in Aggiungi)
  const [candidateFocus, setCandidateFocus] = useState<CandidateFocus | undefined>(undefined);
  const openFix = (fix: CoachFix) => {
    if (fix.kind === 'swap') {
      // I consigli possono essere di un team appena cambiato: il membro si cerca per nome; se non c'è più, niente
      const index = team.findIndex(set => battleName(set) === fix.member);
      if (index < 0) return;
      startReplace(index);
    } else {
      setReplaceIndex(null);
      openTab('pokemon');
    }
    setCandidateFocus(current => ({ species: fix.species, mode: fix.kind === 'add' ? 'add' : 'member', nonce: (current?.nonce ?? 0) + 1 }));
  };
  const analysis = useMemo(() => (booted ? analyzeTeam(team, rated) : null), [booted, team, rated]);
  const rating = useMemo(() => (booted ? rateTeam(team, rated, lang) : null), [booted, team, rated, lang]);
  /** Il voto del team non c'è ancora: si sta calcolando (solo al primo disegno, vedi useBooted). */
  const grading = !booted && team.length > 0;
  // Il coach prova gli scambi per ogni membro (un decimo di secondo): si aggiorna subito dopo il team, senza bloccarlo
  const coachInput = useMemo(() => ({ team, format, data, lang }), [team, format, data, lang]);
  const coachSource = useDeferredValue(coachInput);
  // Team vuoto: niente aree da mostrare, Analisi torna alla Panoramica
  useEffect(() => { if (team.length === 0) setAnalysisView('overview'); }, [team.length]);
  const coaching = useMemo(() => (booted ? coachTeam(coachSource.team, coachSource.format, coachSource.data, coachSource.lang) : COACHING_WAIT), [booted, coachSource]);

  // Contatori delle schede: i problemi del coach; sotto Meta l'uso medio del team (la scheda è solo informativa)
  // Le debolezze in comune non sono nella lista del Coaching (le dice già la Difesa): non si contano
  const problems = coaching.problems.filter(p => !p.key.startsWith('redundancy:sharedWeak:'));
  const ruleProblems = coaching.problems.filter(p => p.category === 'rules');
  const metaAverage = metaOn ? metaBoard(data.stats, team).average : null;
  if (shownTab === 'lists' && !listsOpened) setListsOpened(true);
  if (shownTab === 'analysis' && !analysisOpened) setAnalysisOpened(true);
  if (shownTab === 'meta' && !metaOpened) setMetaOpened(true);
  // I consigli (candidati e prima mossa) sono lenti: solo col Coaching aperto, o con la Panoramica (la riga Da sistemare
  // mostra solo ciò che il Coaching risolve), e dopo che la scheda si è disegnata
  const coachingOpen = shownTab === 'analysis' && (analysisView === 'coaching' || (analysisView === 'overview' && team.length >= 2));
  const adviceInput = useMemo(() => (coachingOpen && booted ? { source: coachSource, problems: coaching.problems } : null), [coachingOpen, booted, coachSource, coaching]);
  // In sottofondo (useAdvice): aprire il Coaching non blocca più l'app
  // Consigli di un team precedente: non si mostrano, si dice che si stanno calcolando
  const advice = useAdvice(adviceInput);

  const edits = teamEdits(teamState, { format, data, lang, rating, choice, setChoice });
  const { changeTeam } = teamState;
  const { addSet, replaceAt } = edits;
  const blocked = blockedReason(team, format.formatId);
  // Le regole del formato per la carta del tooltip (la lista dei ruoli del set)
  const shownRules = useMemo(() => formatRules(data.formatId), [data.formatId]);
  const tabs = railTabs({ lang, team, replaceIndex, problems, rating, grading, metaOn, metaAverage, userLists,
    editing: editingIndex !== null ? team[editingIndex] : undefined, shownTab });
  return (
    <LangProvider lang={lang}>
    <RulesContext.Provider value={shownRules}>
    <div className="app">
      {/* Per chi usa la tastiera: il primo Tab mostra questo link, che salta la barra laterale */}
      <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); skipToMain(mainRef.current); }}>{t(lang, 'app.skipToContent')}</a>
      <Rail choice={choice} memory={memory} onPick={setChoice} team={team} meta={data.stats?.meta ?? null} lang={lang} onLangChange={changeLang}
        onSettings={() => setSettingsOpen(true)}
        onCredits={() => setCreditsOpen(true)}
        onFeedback={() => setFeedbackOpen(true)}
        tabs={<Tabs orientation="vertical" active={shownTab} onChange={navTo} tabs={tabs} />} />
      <div className="main" ref={mainRef} id="main-content">
      {loading && <p className="banner info">{t(lang, 'app.loading')}</p>}
      {!loading && !data.stats && (
        <div className="banner with-eevee" role="alert">
          <EeveeMoment pose="down" />
          <p>{t(lang, 'app.noData', { format: formatLabel(format, lang) })} <code>npm run fetch-data</code> {t(lang, 'app.noDataAfter')}</p>
        </div>
      )}
      {/* Tablet in verticale: in Meta e Liste il team non c'è (Meta ha già "Il tuo team", Liste non lo usa).
          Telefono: il team si vede solo nella scheda Pokémon (in Analisi, Meta e Liste i membri sono già nelle loro tabelle e il
          voto nella barra in basso); resta montato e torna quando si apre l'editor o Completa team */}
      <AutoBand phone={autoBand} collapsed={collapsed} control={bandControl} off={!editingOpen && !fillOpen && ((phone && shownTab !== 'pokemon') || (tabletUpright && (shownTab === 'meta' || shownTab === 'lists')))}>{collapsed => (<>
        <TeamPanel team={team} format={format} data={data}
          grade={rating && !blocked ? { letter: rating.grade, overall: rating.overall, illegal: ruleProblems.length > 0 } : null}
          io={<ShowdownPanel team={team} format={format} choice={choice} tera={teraAllowed(format)} onExport={edits.exportTeam} onImport={(next, again) => edits.loadTeam(next, { kind: 'import', from: '' }, undefined, again)} />}
          saved={<SavedTeams team={team} choice={choice} onLoad={(saved, savedChoice, name) => edits.loadTeam(saved, { kind: 'loadSaved', from: name }, savedChoice)} />}
          plateName={<SavedPlateName team={team} />}
          onChange={changeTeam} onAdd={addSet} onReplace={startReplace} onRemove={edits.removeAt} onDropSet={(i, set) => (i === null ? addSet(set) : replaceAt(i, set))} onPaste={edits.pasteAt} onSetChange={edits.setChangeAt} onTipApply={edits.applyTip} onBulk={edits.bulk} onAddClick={startAdd}
          onOpenChange={index => { setEditingIndex(index); setMoveProposal(p => (p && p.index === index ? p : null)); }}
          proposal={moveProposal} onProposalDone={edits.finishProposal} closeSignal={closeSignal} improveSignal={improveSignal} collapsed={collapsed} onFillOpenChange={setFillOpen}
          onAllowMultipleMegas={() => setChoice(withMultipleMegas)} />
        <GradeBadge rating={rating} grading={grading} blocked={blocked} ruleIssues={ruleProblems.map(p => p.text)}
          illegalCount={new Set(ruleProblems.map(p => p.subjects?.[0] ?? p.key)).size}
          illegalNames={[...new Set(ruleProblems.flatMap(p => p.subjects ?? []))]} formatName={formatLabel(format, lang)}
          incomplete={team.length < 6} members={team.length} teamType={coaching.teamType?.archetype ?? null} collapsed={collapsed} foldReset={`${tab}|${analysisView}`} onOpen={area => { navTo('analysis'); setAnalysisView(area); }} />
        {/* Niente freccia mentre l'editor è aperto: lì il team ha una posizione fissa */}
        {!editingOpen && !autoBand && !tabletSide && <button type="button" className="band-toggle" aria-expanded={!collapsed} onClick={toggleCollapsed}
          aria-label={t(lang, collapsed ? 'team.expand' : 'team.collapse')} title={t(lang, collapsed ? 'team.expand' : 'team.collapse')}>
          <Icon name={collapsed ? 'next' : 'prev'} />
        </button>}
      </>)}</AutoBand>
      <div className={`workspace${editingOpen ? ' editing' : ''}${fillOpen ? ' fill-open' : ''}`} ref={workspaceRef}>
      <main className="tab-body">
        <TabPanel id="pokemon" active={shownTab}>
          <SuggestionsPanel
            team={team}
            format={format}
            data={data}
            rating={rating}
            replaceIndex={replaceIndex}
            onAdd={addSet}
            onReplaceWith={replaceAt}
            onCancelReplace={() => setReplaceIndex(null)}
            focus={candidateFocus}
            onTarget={setReplaceIndex}
            focusSearch={searchRequest}
            teamCollapsed={sectionsCollapsed}
          />
        </TabPanel>
        <TabPanel id="analysis" active={shownTab}>
          {analysisOpened && analysis && <AnalysisPanel team={team} analysis={analysis} data={data} rating={rating} coaching={coaching} advice={advice} view={analysisView} onView={setAnalysisView}
            jump={analysisJump}
            onFix={openFix} onMoveFix={edits.openMoveFix} onApplyFix={edits.applyFix} onApplyMove={edits.applyMoveFix} onApplyPlan={edits.applyPlan} onAdd={startAdd}
            onExport={edits.exportTeam} onImproveSets={() => setImproveSignal(n => n + 1)}
            onCollapseTeam={collapseTeam} teamCollapsed={sectionsCollapsed} />}
        </TabPanel>
        <TabPanel id="meta" active={shownTab}>
          {metaOpened && booted && <MetaTab team={team} data={rated} rating={rating}
            onCoverage={(side, species) => {
              setAnalysisJump(j => ({ view: side === 'defense' ? 'defense' : 'strength', sub: 'coverageMeta', focus: { kind: 'threat', side, species }, nonce: (j?.nonce ?? 0) + 1 }));
              setTab('analysis');
            }}
            onCollapseTeam={collapseTeam} teamCollapsed={sectionsCollapsed} />}
        </TabPanel>
        <TabPanel id="lists" active={shownTab}>
          {listsOpened && <ListsPanel lists={lists} format={format} data={data} onChange={changeLists} />}
        </TabPanel>
      </main>
      </div>
      </div>
      {settingsOpen && <SettingsDialog palette={palette} onPaletteChange={changePalette}
        onCredits={() => { setSettingsOpen(false); setCreditsOpen(true); }}
        onFeedback={() => { setSettingsOpen(false); setFeedbackOpen(true); }} onClose={closeSettings} />}
      {creditsOpen && <CreditsDialog onClose={closeCredits} />}
      {feedbackOpen && <FeedbackDialog team={team} choice={choice} onClose={closeFeedback} />}
      <TouchTips />
      {/* Il tooltip delle mosse: uno per tutta l'app, su ogni pillola o campo con data-move-tip */}
      <TipHost />
      {/* Il team copiato per Showdown: sta dove sta l'avviso di Annulla, che intanto aspetta (torna quando questo si chiude) */}
      {done && <DoneToast note={done} onClose={() => setDone(null)} />}
      {!done && listUndo && listUndo.after === lists && (
        <UndoToast action={{ id: listUndo.id, ...listUndo.undo }} onClose={() => setListUndo(null)} onUndo={undoLists} />
      )}
      {!done && undo && undo.after === team && (
        <UndoToast action={undo} docked={editingOpen} onClose={() => setUndo(null)} onUndo={edits.undoTeam} />
      )}
    </div>
    </RulesContext.Provider>
    </LangProvider>
  );
}
