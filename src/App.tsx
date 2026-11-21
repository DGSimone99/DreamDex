import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import { coachTeam } from './engine/coach';
import type { CoachFix } from './engine/coachFixes';
import { rateTeam } from './engine/rating';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import { DEFAULT_MEMORY, remember as rememberChoice, rulesOf, withMultipleMegas, type FormatChoice } from './engine/formatChoice';
import { dataSource, formatLabel, teraAllowed } from './engine/formats';
import { battleName } from './engine/dex';
import { DoneToast, UndoToast, type DoneNote, type ListUndo, type UndoAction } from './ui/UndoToast';
import { takeSharedTeam } from './share';
import { exportShowdown, type TeamSet } from './engine/sets';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { MetaTab } from './ui/meta/MetaTab';
import { GradeBadge } from './ui/RatingPanel';
import { blockedReason } from './engine/legalTeam';
import type { AnalysisView } from './ui/analysisView';
import type { KoFocus } from './ui/AreaDetail';
import { SavedPlateName, SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { copyText } from './ui/clipboard';
import { SuggestionsPanel, type CandidateFocus } from './ui/SuggestionsPanel';
import { ListsPanel } from './ui/ListsPanel';
import { TeamPanel, type MoveProposal } from './ui/TeamPanel';
import type { MoveFix } from './engine/moveFixes';
import { Rail } from './ui/Rail';
import { Icon } from './ui/icons';
import { TabPanel, Tabs, type TabId } from './ui/Tabs';
import { loadLang, loadListSprite, loadLists, loadPalette, loadFormatMemory, loadSession, loadTab, loadTeamCollapsed, saveLang, saveListSprite, saveFormatMemory, saveLists, savePalette, saveSession, saveTab, saveTeamCollapsed } from './storage';
import { SettingsDialog } from './ui/SettingsDialog';
import { CreditsDialog } from './ui/CreditsDialog';
import { FeedbackDialog } from './ui/FeedbackDialog';
import { EMPTY_LISTS, effectiveLists, listContext, type UserLists } from './engine/lists';
import { formatPercent, t, type Lang } from './i18n';
import { metaBoard } from './engine/metaBoard';
import { LangProvider } from './i18n/react';
import { gameName, hasItalianNames } from './i18n/game';
import { useDismissMenus } from './ui/useDismissMenus';
import { TouchTips } from './ui/TouchTips';
import { TipHost } from './ui/MoveTip';
import { useAdvice } from './ui/useRanking';
import { paletteFor, type ListSprite, type PaletteSetting } from './ui/theme';
import { EeveeMoment } from './ui/EeveeMoment';
import { SHORT_SCREEN, useMediaQuery } from './ui/useMediaQuery';
import { SHEET_QUERY } from './ui/useAnchoredPop';
import { AutoBand } from './ui/AutoBand';

const NO_DATA: EngineData = { stats: null, sets: null };

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

export function App({ data: initialData, loadSource, storage, initialLang, loadNames }: AppProps) {
  const [lang, setLang] = useState<Lang>(() => initialLang ?? (storage ? loadLang(storage) : null) ?? 'en');
  // I menu a tendina aperti si chiudono con un clic fuori o con Esc
  useDismissMenus();
  useEffect(() => {
    document.documentElement.lang = lang;
    if (storage) saveLang(lang, storage);
  }, [lang, storage]);
  // L'italiano aspetta i suoi nomi (430 KB): si caricano la prima volta che serve, poi la lingua cambia
  const namesLoading = useRef<Promise<void> | null>(null);
  const changeLang = (next: Lang) => {
    if (next !== 'it' || !loadNames || hasItalianNames()) return setLang(next);
    namesLoading.current ??= loadNames();
    namesLoading.current.then(() => setLang('it'));
  };
  const [session] = useState(() => (storage ? loadSession(storage) : null));
  // Un link con un team (#team=...) vince sulla sessione salvata; quella resta recuperabile con Annulla
  const [shared] = useState(takeSharedTeam);
  // La scelta del formato (una delle tre famiglie): un gioco senza i suoi dati torna già al formato di base (sanitizeChoice)
  const [choice, setChoice] = useState<FormatChoice>(() => shared?.choice ?? session?.choice ?? DEFAULT_MEMORY.competitive);
  // Le regole che leggono motore e schede
  const format = useMemo(() => rulesOf(choice), [choice]);
  // L'ultima scelta di ogni famiglia: qualunque cosa cambi il formato (finestra, team salvato, link, Annulla) la aggiorna
  const [memory, setMemory] = useState(() => (storage ? loadFormatMemory(storage) : DEFAULT_MEMORY));
  useEffect(() => { setMemory(m => rememberChoice(m, choice)); }, [choice]);
  useEffect(() => { if (storage) saveFormatMemory(memory, storage); }, [memory, storage]);
  // Colori di versione: seguono il gioco del formato (o la palette fissata nelle impostazioni)
  const [palette, setPalette] = useState<PaletteSetting>(() => (storage ? loadPalette(storage) : null) ?? 'auto');
  const changePalette = (next: PaletteSetting) => {
    setPalette(next);
    if (storage) savePalette(next, storage);
  };
  // Lista candidati: sprite (normale/icona box), salvato come la palette
  const [listSprite, setListSprite] = useState<ListSprite>(() => (storage ? loadListSprite(storage) : null) ?? 'normal');
  const changeListSprite = (next: ListSprite) => {
    setListSprite(next);
    if (storage) saveListSprite(next, storage);
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const closeCredits = useCallback(() => setCreditsOpen(false), []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);
  // Team compresso in una barra sottile: più spazio alla sezione sotto (la scelta resta salvata)
  const [savedCollapsed, setCollapsed] = useState(() => (storage ? loadTeamCollapsed(storage) : null) ?? false);
  // Schermo basso (portatili): con l'editor aperto il team si comprime da solo, così l'editor sta in una schermata
  const short = useMediaQuery(SHORT_SCREEN);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    document.querySelector<HTMLElement>('.rail-settings')?.focus();
  }, []);
  // Con le icone del box, il foglio di sprite di Showdown si scarica in anticipo (una volta sola)
  useEffect(() => {
    if (listSprite === 'box') new Image().src = 'https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png';
  }, [listSprite]);
  useEffect(() => {
    document.documentElement.dataset.palette = paletteFor(palette, format.formatId, format.game);
  }, [palette, format.formatId, format.game]);
  // Dati per fonte: ogni formato carica la sua la prima volta, poi resta in memoria.
  // Un caricamento finito tardi si salva sotto la sua fonte, quindi non tocca il formato attuale.
  const [cache, setCache] = useState<Record<string, EngineData>>({ [dataSource(DEFAULT_FORMAT)]: initialData });
  const source = dataSource(format);
  const loading = !(source in cache) && !!loadSource;
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (source in cache || !loadSource || requested.current.has(source)) return;
    requested.current.add(source);
    loadSource(source).then(result => setCache(c => ({ ...c, [source]: result })));
  }, [source, cache, loadSource]);
  const loaded = cache[source] ?? NO_DATA;
  // Preferiti e bannati dell'utente: salvati nel browser; la raccolta attiva nel contesto (gioco o formato) più l'Universale
  // entrano nei dati (solo i suggerimenti li usano)
  const [lists, setLists] = useState<UserLists>(() => (storage ? loadLists(storage) : EMPTY_LISTS));
  useEffect(() => {
    if (storage) saveLists(lists, storage);
  }, [lists, storage]);
  const listCtx = listContext(format);
  const userLists = useMemo(() => effectiveLists(lists, listCtx), [lists, listCtx]);
  // Liste: raccolta svuotata o sostituita, Pokémon tolto da un box: si può annullare per qualche secondo (finché le liste
  // restano quelle)
  const [listUndo, setListUndo] = useState<{ id: number; undo: ListUndo; before: UserLists; after: UserLists } | null>(null);
  // Stabile: la scheda Liste (oltre mille Pokémon) non si ridisegna quando cambia solo il team
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const changeLists = useCallback((next: UserLists, undo?: ListUndo) => {
    setListUndo(undo ? { id: Date.now(), undo, before: listsRef.current, after: next } : null);
    setLists(next);
  }, []);
  // La scheda Liste si monta la prima volta che la si apre, poi resta
  const [listsOpened, setListsOpened] = useState(false);
  // Senza meta (single player): voto, analisi, coach e suggerimenti ignorano l'uso nel formato
  // Il formato scelto entra nei dati: alcune regole del voto cambiano col formato (Ubers)
  // Il voto e l'analisi non dipendono dalle liste: cambiandole non si ricalcolano (solo i suggerimenti le usano)
  const rated = useMemo(() => ({ ...loaded, formatId: format.formatId, ...(format.meta ? {} : { ignoreMeta: true }),
    ...(format.allowMultipleMegas ? { allowMultipleMegas: true } : {}), ...(format.game ? { game: format.game } : {}) }),
    [loaded, format.formatId, format.meta, format.allowMultipleMegas, format.game]);
  const data = useMemo(() => ({ ...rated, userLists }), [rated, userLists]);
  const [initialTeam] = useState<TeamSet[]>(() => shared?.team ?? session?.team ?? []);
  const [team, setTeam] = useState<TeamSet[]>(initialTeam);
  useEffect(() => {
    if (storage) saveSession({ team, choice }, storage);
  }, [team, choice, storage]);
  // Scheda aperta sotto il team: col team vuoto si parte dai Pokémon, poi vale l'ultima scelta
  // Cosa mostra Analisi: la Panoramica o un'area del voto (il riquadro Voto apre le aree)
  const [analysisView, setAnalysisView] = useState<AnalysisView>('overview');
  // Dalla scheda Meta all'Analisi: la Coverage meta con una minaccia accesa; `nonce` ripete anche la stessa richiesta
  const [analysisJump, setAnalysisJump] = useState<{ view: AnalysisView; sub: string; focus: KoFocus; nonce: number } | null>(null);
  // Membro aperto nella Panoramica di Analisi, per nome: se il team cambia resta lui o si torna alla Panoramica
  const [tab, setTabState] = useState<TabId>(() => (initialTeam.length && storage ? loadTab(storage) : null) ?? 'pokemon');
  const setTab = (next: TabId) => {
    setTabState(next);
    if (storage) saveTab(next, storage);
  };
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  // Il membro aperto nell'editor: l'editor prende il posto della sezione finché resta aperto
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Con l'editor aperto il team non si riduce e non si riapre a mano: aperto sugli schermi normali (l'editor ha la sua
  // altezza giusta), compresso su quelli bassi (se no l'editor non ci sta); chiuso l'editor torna la scelta salvata
  const editingOpen = editingIndex !== null;
  // Telefono: niente tasto, il team si riduce scorrendo la pagina e torna grande in cima (useAutoCollapse)
  const phone = useMediaQuery(SHEET_QUERY);
  const bandControl = useRef<(() => void) | null>(null);
  // Fuori dal telefono; sul telefono decide AutoBand (le sezioni lo vedono sempre grande: lì la pagina scorre)
  const collapsed = editingOpen ? short : savedCollapsed;
  const sectionsCollapsed = phone ? false : collapsed;
  const toggleCollapsed = () => {
    if (editingOpen) return;
    setCollapsed(c => {
      if (storage) saveTeamCollapsed(!c, storage);
      return !c;
    });
  };
  const [closeSignal, setCloseSignal] = useState(0);
  // Completa team aperto: il magenta della pagina si spegne, resta solo quello del pannello (un'azione principale per volta)
  const [fillOpen, setFillOpen] = useState(false);
  // Migliora i set aperto dal Coaching (ogni numero nuovo apre la finestra del team)
  const [improveSignal, setImproveSignal] = useState(0);
  // La pagina non scorre: aprire una sezione basta a mostrarla (e chiude l'editor)
  const openTab = (next: TabId) => { setTab(next); setCloseSignal(n => n + 1); };
  // Dalla barra delle sezioni (e dal voto): sul telefono la sezione si apre dall'inizio, col team ridotto
  const navTo = (next: TabId) => { bandControl.current?.(); openTab(next); };
  // L'editor copre l'area della sezione: gli serve la sua altezza
  const mainRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = workspaceRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const apply = () => mainRef.current?.style.setProperty('--ws-h', `${area.clientHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  /** Scegliere chi sostituire (dal coach o da una carta) porta alla scheda Pokémon, dove ci sono i candidati. */
  // Slot vuoto cliccato: scheda Pokémon in modalità Aggiungi, con il cursore nella ricerca
  const [searchRequest, setSearchRequest] = useState(0);
  const startAdd = () => {
    setReplaceIndex(null);
    setSearchRequest(n => n + 1);
    openTab('pokemon');
  };
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
  // Il membro si cerca per nome e lo slot deve avere ancora la mossa di partenza: altrimenti la proposta è vecchia
  const proposalIndex = (fix: { member: string; slot: number; from: string }) => {
    const index = team.findIndex(set => battleName(set) === fix.member);
    return index >= 0 && (team[index].moves[fix.slot] ?? '') === fix.from ? index : -1;
  };
  const openMoveFix = (fix: MoveFix) => {
    const index = proposalIndex({ member: fix.member, slot: fix.slot, from: fix.from });
    if (index < 0) return;
    setMoveProposal({ index, slot: fix.slot, from: fix.from, to: fix.to, gain: fix.gain, nonce: ++proposalNonce.current });
  };
  // Una mossa al posto di un'altra nel membro `index`, annullabile; niente se lo slot non ha più la mossa di partenza
  const applyMove = ({ index, slot, from, to }: { index: number; slot: number; from: string; to: string }) => {
    const set = team[index];
    if (!set || (set.moves[slot] ?? '') !== from) return false;
    const moves = [0, 1, 2, 3].map(i => set.moves[i] ?? '');
    moves[slot] = to;
    const after = changeTeam(team.map((s, i) => (i === index ? { ...s, moves } : s)));
    const name = (move: string) => (move ? gameName('move', move, lang) : '—');
    remember({ kind: 'move', from: battleName(set), to: `${name(from)} → ${name(to)}` }, after);
    return true;
  };
  // Un consiglio della Sfida applicato (EV o mossa): annullabile, l'avviso dice cosa è cambiato ("+32 EV in DifSp, −32 in Att")
  const applyTip = (index: number, set: TeamSet, change: string) => {
    const before = team[index];
    if (!before) return;
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    remember({ kind: 'move', from: battleName(before), to: change }, after);
  };
  const finishProposal = (applied: boolean) => {
    if (!applied || !moveProposal || !applyMove(moveProposal)) setMoveProposal(null);
  };
  // Clic su una proposta del Coaching: si applica subito, come Applica nell'editor o una sostituzione dalla scheda Pokémon
  const applyMoveFix = (fix: MoveFix) => {
    const index = proposalIndex({ member: fix.member, slot: fix.slot, from: fix.from });
    if (index >= 0) applyMove({ index, slot: fix.slot, from: fix.from, to: fix.to });
  };
  const applyFix = (fix: CoachFix) => {
    if (fix.kind === 'swap') {
      // Il membro si cerca per nome: se non c'è più (consigli di un team precedente), niente
      const index = team.findIndex(set => battleName(set) === fix.member);
      if (index >= 0) replaceAt(index, fix.set);
    } else if (team.length < 6) {
      const after = changeTeam([...team, fix.set]);
      remember({ kind: 'add', from: battleName(fix.set) }, after);
    }
  };
  const analysis = useMemo(() => analyzeTeam(team, rated), [team, rated]);
  const rating = useMemo(() => rateTeam(team, rated, lang), [team, rated, lang]);
  // Il coach prova gli scambi per ogni membro (un decimo di secondo): si aggiorna subito dopo il team, senza bloccarlo
  const coachInput = useMemo(() => ({ team, format, data, lang }), [team, format, data, lang]);
  const coachSource = useDeferredValue(coachInput);
  // Team vuoto: niente aree da mostrare, Analisi torna alla Panoramica
  useEffect(() => { if (team.length === 0) setAnalysisView('overview'); }, [team.length]);
  const coaching = useMemo(() => coachTeam(coachSource.team, coachSource.format, coachSource.data, coachSource.lang), [coachSource]);

  // Contatori delle schede: i problemi del coach; sotto Meta l'uso medio del team (la scheda è solo informativa)
  const problems = coaching.problems;
  const metaOn = !data.ignoreMeta && !!data.stats;
  const metaAverage = metaOn ? metaBoard(data.stats, team).average : null;
  // Senza meta la scheda Meta è spenta: si resta sull'Analisi
  const shownTab: TabId = tab === 'meta' && !metaOn ? 'analysis' : tab;
  if (shownTab === 'lists' && !listsOpened) setListsOpened(true);
  // I consigli (candidati e prima mossa) sono lenti: solo col Coaching aperto, o con la Panoramica (la riga Da sistemare
  // mostra solo ciò che il Coaching risolve), e dopo che la scheda si è disegnata
  const coachingOpen = shownTab === 'analysis' && (analysisView === 'coaching' || (analysisView === 'overview' && team.length >= 2));
  const adviceInput = useMemo(() => (coachingOpen ? { source: coachSource, problems: coaching.problems } : null), [coachingOpen, coachSource, coaching]);
  // In sottofondo (useAdvice): aprire il Coaching non blocca più l'app
  // Consigli di un team precedente: non si mostrano, si dice che si stanno calcolando
  const advice = useAdvice(adviceInput);

  // Proposta di mossa del coach, aperta nell'editor del membro: ogni modifica del team o chiusura dell'editor la toglie
  const [moveProposal, setMoveProposal] = useState<MoveProposal | null>(null);
  const proposalNonce = useRef(0);
  const changeTeam = (next: TeamSet[]) => {
    const value = next.slice(0, 6);
    setTeam(value);
    setMoveProposal(null);
    setReplaceIndex(null);
    return value;
  };
  const addSet = (set: TeamSet) => {
    if (team.length < 6) changeTeam([...team, set]);
  };
  // Rimozioni e sostituzioni si possono annullare per qualche secondo
  // (vale finché il team resta quello lasciato dall'azione: un'altra modifica chiude l'avviso)
  const [undo, setUndo] = useState<(UndoAction & { before: TeamSet[]; after: TeamSet[]; choice?: FormatChoice }) | null>(() =>
    shared && session?.team.length
      ? { id: 0, kind: 'load', from: '', before: session.team, after: initialTeam, choice: session.choice }
      : null);
  const undoId = useRef(0);
  // Esporta (barra del team e Coaching): il testo per Showdown negli appunti e il momento "team pronto" col voto
  const [done, setDone] = useState<DoneNote | null>(null);
  const exportTeam = async () => {
    const ok = await copyText(exportShowdown(team, { tera: teraAllowed(format) }));
    if (ok) setDone({ id: ++undoId.current, kind: 'exported', grade: rating ? { grade: rating.grade, overall: rating.overall } : null });
    return ok;
  };
  const remember = (action: Omit<UndoAction, 'id'>, after: TeamSet[]) =>
    setUndo({ ...action, id: ++undoId.current, before: team, after });
  const replaceAt = (index: number, set: TeamSet) => {
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (team[index]) remember({ kind: 'replace', from: battleName(team[index]), to: battleName(set) }, after);
  };
  // Set incollato: stesso Pokémon con un altro set, o un Pokémon diverso al suo posto
  const pasteAt = (index: number, set: TeamSet) => {
    const before = team[index];
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (before) remember(before.species === set.species
      ? { kind: 'paste', from: battleName(before) }
      : { kind: 'replace', from: battleName(before), to: battleName(set) }, after);
  };
  // Set intero cambiato dall'editor (preset Smogon, I miei set, spread più usati): si annulla come le altre modifiche.
  // Più cambi di fila: Annulla riporta il set di prima dell'ultimo
  const setChangeAt = (index: number, set: TeamSet) => {
    const before = team[index];
    // Lo stesso set riapplicato (il preset già in uso): niente cambia, niente avviso
    if (before && JSON.stringify(before) === JSON.stringify(set)) return;
    const after = changeTeam(team.map((s, i) => (i === index ? set : s)));
    if (before) remember({ kind: 'setChange', from: battleName(before) }, after);
  };
  // Migliora i set (il preset migliore per ogni membro), Completa team, team da torneo caricato o team svuotato: si annullano come le altre modifiche
  const bulk = (kind: 'presets' | 'fill' | 'clear' | 'tournament', next: TeamSet[]) => {
    const after = changeTeam(next);
    remember(kind === 'clear' ? { kind: 'clear', from: '' }
      : kind === 'tournament' ? { kind: 'tournament', from: '' }
      : { kind: 'presets', from: String(rating?.overall ?? '—'), to: String(rateTeam(after, data, lang)?.overall ?? ''),
        added: after.length - team.length, created: team.length === 0 }, after);
  };
  // Team importato o caricato dai team salvati: si annulla come le altre modifiche (con il formato di prima).
  // A team vuoto non c'è niente da riavere: niente avviso
  const loadTeam = (next: TeamSet[], action: Omit<UndoAction, 'id'>, nextChoice?: FormatChoice, again = false) => {
    // Lo stesso import ritoccato (Custom Skillset sbloccato): l'Annulla resta quello del team di prima dell'import
    const chained = again && undo && undo.kind === 'import' && undo.after === team ? undo : null;
    if (again && !chained) { changeTeam(next); return; }
    const before = chained ? chained.before : team;
    const after = changeTeam(next);
    if (nextChoice) setChoice(nextChoice);
    if (before.length) setUndo({ ...action, id: ++undoId.current, before, after, choice: chained ? chained.choice : nextChoice ? choice : undefined });
    else setUndo(null);
  };
  const removeAt = (index: number) => {
    const after = changeTeam(team.filter((_, i) => i !== index));
    remember({ kind: 'remove', from: battleName(team[index]) }, after);
  };

  // Con l'editor aperto la sezione sotto non si vede: la sua riga di stato dice chi stai modificando (chiudendo l'editor torna la sezione),
  // col nome che ha sulla carta (il soprannome, o la forma Mega)
  const editing = editingIndex !== null ? team[editingIndex] : undefined;
  const withEditing = <T extends { id: string; status?: React.ReactNode; hint?: string }>(tabs: T[]): T[] => editing
    ? tabs.map(tab => (tab.id === shownTab ? { ...tab, status: <span className="info">{t(lang, 'rail.editing', { species: editing.name || battleName(editing) })}</span>, hint: t(lang, 'rail.editing', { species: editing.name || battleName(editing) }) } : tab))
    : tabs;
  return (
    <LangProvider lang={lang}>
    <div className="app">
      {/* Per chi usa la tastiera: il primo Tab mostra questo link, che salta la barra laterale */}
      <a className="skip-link" href="#main-content" onClick={e => {
        e.preventDefault();
        // La colonna prende il fuoco solo per il salto (sempre focalizzabile, un clic nel vuoto chiuderebbe l'editor)
        const main = mainRef.current;
        if (!main) return;
        main.tabIndex = -1;
        main.focus();
        main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
      }}>{t(lang, 'app.skipToContent')}</a>
      <Rail choice={choice} memory={memory} onPick={setChoice} team={team} meta={data.stats?.meta ?? null} lang={lang} onLangChange={changeLang}
        onSettings={() => setSettingsOpen(true)}
        onCredits={() => setCreditsOpen(true)}
        onFeedback={() => setFeedbackOpen(true)}
        tabs={<Tabs orientation="vertical" active={shownTab} onChange={navTo} tabs={withEditing([
        // Tessere del menu: sotto il nome lo stato della sezione, leggibile senza aprirla
        // Sul computer la riga mostra solo il numero a destra (count); lo stato intero resta la descrizione della scheda
        { id: 'pokemon', label: t(lang, 'tabs.pokemon'), icon: 'team',
          count: team.length ? { text: `${team.length}/6`, level: 'info' } : null,
          hint: t(lang, team.length ? 'rail.teamCount' : 'rail.teamEmpty', { n: team.length }),
          status: replaceIndex !== null && team[replaceIndex]
            ? <span className="info">{t(lang, 'suggest.replaceTitle', { species: team[replaceIndex].name || battleName(team[replaceIndex]) })}</span>
            : t(lang, team.length ? 'rail.teamCount' : 'rail.teamEmpty', { n: team.length }) },
        { id: 'analysis', label: t(lang, 'tabs.analysis'), icon: 'roles',
          // Col team incompleto il numero resta neutro: giallo o rosso solo a team completo (un team a metà non è «rotto»)
          count: problems.length ? { text: String(problems.length), level: team.length < 6 ? 'info' : problems.some(p => p.severity === 'serious') ? 'serious' : 'warn' } : null,
          hint: rating ? [`${rating.grade} ${rating.overall}`, ...(problems.length ? [t(lang, problems.length === 1 ? 'tabs.problemsOne' : 'tabs.problemsMany', { n: problems.length })] : [])].join(' · ') : t(lang, 'rail.noGrade'),
          status: rating ? <>
            {/* Team non legale nel formato: il voto in grigio, come nella carta del voto */}
            <b className={`grade grade-${rating.grade}${problems.some(p => p.category === 'rules') ? ' illegal' : ''}`}>{rating.grade} {rating.overall}</b>
            {problems.length > 0 && <>{' · '}<span className={problems.some(p => p.severity === 'serious') ? 'serious' : 'minor'}>
              {t(lang, problems.length === 1 ? 'tabs.problemsOne' : 'tabs.problemsMany', { n: problems.length })}</span></>}
          </> : t(lang, 'rail.noGrade') },
        { id: 'meta', label: t(lang, 'tabs.meta'), icon: 'globe', disabled: !metaOn, note: metaOn ? undefined : t(lang, 'tabs.metaOff'),
          hint: !metaOn ? t(lang, 'rail.metaOff') : team.length > 0 && metaAverage !== null ? t(lang, 'meta.average', { pct: formatPercent(lang, metaAverage) }) : t(lang, 'rail.metaUsage'),
          status: !metaOn ? t(lang, 'rail.metaOff')
            : team.length === 0 ? t(lang, 'rail.metaUsage')
            : metaAverage !== null ? t(lang, 'meta.average', { pct: formatPercent(lang, metaAverage) })
            : t(lang, 'rail.metaUsage') },
        { id: 'lists', label: t(lang, 'tabs.lists'), icon: 'star',
          count: userLists.favorites.size || userLists.bans.size
            ? { text: [userLists.favorites.size, userLists.bans.size].filter(Boolean).length === 2 ? `${userLists.favorites.size}·${userLists.bans.size}` : String(userLists.favorites.size || userLists.bans.size), level: 'info' }
            : null,
          hint: userLists.favorites.size || userLists.bans.size ? [
            userLists.favorites.size ? t(lang, userLists.favorites.size === 1 ? 'rail.favOne' : 'rail.favMany', { n: userLists.favorites.size }) : null,
            userLists.bans.size ? t(lang, userLists.bans.size === 1 ? 'rail.banOne' : 'rail.banMany', { n: userLists.bans.size }) : null,
          ].filter(Boolean).join(' · ') : t(lang, 'rail.listsEmpty'),
          status: userLists.favorites.size || userLists.bans.size ? [
            userLists.favorites.size ? t(lang, userLists.favorites.size === 1 ? 'rail.favOne' : 'rail.favMany', { n: userLists.favorites.size }) : null,
            userLists.bans.size ? t(lang, userLists.bans.size === 1 ? 'rail.banOne' : 'rail.banMany', { n: userLists.bans.size }) : null,
          ].filter(Boolean).join(' · ') : t(lang, 'rail.listsEmpty') },
        // Confronto (in arrivo) non si mostra finché non c'è: quando arriva, si torna ad aggiungere qui
        // { id: 'compare', label: t(lang, 'tabs.compare'), icon: 'search', disabled: true, note: t(lang, 'tabs.soon'), status: t(lang, 'rail.soon') },
      ])} />} />
      <div className="main" ref={mainRef} id="main-content">
      {loading && <p className="banner info">{t(lang, 'app.loading')}</p>}
      {!loading && !data.stats && (
        <div className="banner with-eevee" role="alert">
          <EeveeMoment pose="down" />
          <p>{t(lang, 'app.noData', { format: formatLabel(format, lang) })} <code>npm run fetch-data</code> {t(lang, 'app.noDataAfter')}</p>
        </div>
      )}
      <AutoBand phone={phone} collapsed={collapsed} control={bandControl}>{collapsed => (<>
        <TeamPanel team={team} format={format} data={data}
          grade={rating && !blockedReason(team, format.formatId) ? { letter: rating.grade, overall: rating.overall, illegal: !!coaching?.problems.some(p => p.category === 'rules') } : null}
          io={<ShowdownPanel team={team} format={format} choice={choice} tera={teraAllowed(format)} onExport={exportTeam} onImport={(next, again) => loadTeam(next, { kind: 'import', from: '' }, undefined, again)} />}
          saved={<SavedTeams team={team} choice={choice} onLoad={(saved, savedChoice, name) => loadTeam(saved, { kind: 'loadSaved', from: name }, savedChoice)} />}
          plateName={<SavedPlateName team={team} />}
          onChange={changeTeam} onAdd={addSet} onReplace={startReplace} onRemove={removeAt} onDropSet={(i, set) => (i === null ? addSet(set) : replaceAt(i, set))} onPaste={pasteAt} onSetChange={setChangeAt} onTipApply={applyTip} onBulk={bulk} onAddClick={startAdd}
          onOpenChange={index => { setEditingIndex(index); setMoveProposal(p => (p && p.index === index ? p : null)); }}
          proposal={moveProposal} onProposalDone={finishProposal} closeSignal={closeSignal} improveSignal={improveSignal} collapsed={collapsed} onFillOpenChange={setFillOpen}
          onAllowMultipleMegas={() => setChoice(withMultipleMegas)} />
        <GradeBadge rating={rating} blocked={blockedReason(team, format.formatId)} ruleIssues={coaching?.problems.filter(p => p.category === 'rules').map(p => p.text)}
          illegalCount={new Set(coaching?.problems.filter(p => p.category === 'rules').map(p => p.subjects?.[0] ?? p.key)).size}
          illegalNames={[...new Set(coaching?.problems.filter(p => p.category === 'rules').flatMap(p => p.subjects ?? []))]} formatName={formatLabel(format, lang)}
          incomplete={team.length < 6} members={team.length} teamType={coaching?.teamType?.archetype ?? null} collapsed={collapsed} onOpen={area => { navTo('analysis'); setAnalysisView(area); }} />
        {/* Niente freccia mentre l'editor è aperto: lì il team ha una posizione fissa */}
        {!editingOpen && !phone && <button type="button" className="band-toggle" aria-expanded={!collapsed} onClick={toggleCollapsed}
          aria-label={t(lang, collapsed ? 'team.expand' : 'team.collapse')} title={t(lang, collapsed ? 'team.expand' : 'team.collapse')}>
          <Icon name={collapsed ? 'next' : 'prev'} />
        </button>}
      </>)}</AutoBand>
      <div className={`workspace${editingIndex !== null ? ' editing' : ''}${fillOpen ? ' fill-open' : ''}`} ref={workspaceRef}>
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
            listSprite={listSprite}
            onListSpriteChange={changeListSprite}
            teamCollapsed={sectionsCollapsed}
          />
        </TabPanel>
        <TabPanel id="analysis" active={shownTab}>
          <AnalysisPanel team={team} analysis={analysis} data={data} rating={rating} coaching={coaching} advice={advice} view={analysisView} onView={setAnalysisView}
            jump={analysisJump}
            onFix={openFix} onMoveFix={openMoveFix} onApplyFix={applyFix} onApplyMove={applyMoveFix} onAdd={startAdd}
            onExport={exportTeam} onImproveSets={() => setImproveSignal(n => n + 1)}
            onCollapseTeam={() => { if (!collapsed) toggleCollapsed(); }} teamCollapsed={sectionsCollapsed} />
        </TabPanel>
        <TabPanel id="meta" active={shownTab}>
          <MetaTab team={team} data={rated} rating={rating}
            onCoverage={(side, species) => {
              setAnalysisJump(j => ({ view: side === 'defense' ? 'defense' : 'strength', sub: 'coverageMeta', focus: { kind: 'threat', side, species }, nonce: (j?.nonce ?? 0) + 1 }));
              setTab('analysis');
            }}
            onCollapseTeam={() => { if (!collapsed) toggleCollapsed(); }} teamCollapsed={sectionsCollapsed} />
        </TabPanel>
        <TabPanel id="lists" active={shownTab}>
          {listsOpened && <ListsPanel lists={lists} format={format} data={data} onChange={changeLists} />}
        </TabPanel>
      </main>
      </div>
      </div>
      {settingsOpen && <SettingsDialog palette={palette} onPaletteChange={changePalette} listSprite={listSprite} onListSpriteChange={changeListSprite}
        onCredits={() => { setSettingsOpen(false); setCreditsOpen(true); }}
        onFeedback={() => { setSettingsOpen(false); setFeedbackOpen(true); }} onClose={closeSettings} />}
      {creditsOpen && <CreditsDialog onClose={closeCredits} />}
      {feedbackOpen && <FeedbackDialog team={team} choice={choice} onClose={closeFeedback} />}
      {/* Il team copiato per Showdown: sta dove sta l'avviso di Annulla, che intanto aspetta (torna quando questo si chiude) */}
      <TouchTips />
      {/* Il tooltip delle mosse: uno per tutta l'app, su ogni pillola o campo con data-move-tip */}
      <TipHost />
      {done && <DoneToast note={done} onClose={() => setDone(null)} />}
      {!done && listUndo && listUndo.after === lists && (
        <UndoToast action={{ id: listUndo.id, ...listUndo.undo }} onClose={() => setListUndo(null)}
          onUndo={() => { setLists(listUndo.before); setListUndo(null); }} />
      )}
      {!done && undo && undo.after === team && (
        <UndoToast action={undo} docked={editingIndex !== null} onClose={() => setUndo(null)}
          onUndo={() => { changeTeam(undo.before); if (undo.choice) setChoice(undo.choice); setUndo(null); }} />
      )}
    </div>
    </LangProvider>
  );
}
