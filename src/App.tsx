import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import { coachTeam, type SwapPreview } from './engine/coach';
import { rateTeam } from './engine/rating';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import { dataSource, formatLabel, teraAllowed } from './engine/formats';
import { battleName } from './engine/dex';
import { UndoToast, type UndoAction } from './ui/UndoToast';
import { takeSharedTeam } from './share';
import type { TeamSet } from './engine/sets';
import { AnalysisPanel, MetaPanel } from './ui/AnalysisPanel';
import { GradeBadge } from './ui/RatingPanel';
import { MemberSheet } from './ui/MemberSheet';
import { SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { SuggestionsPanel } from './ui/SuggestionsPanel';
import { ListsPanel } from './ui/ListsPanel';
import { TeamPanel } from './ui/TeamPanel';
import { Rail } from './ui/Rail';
import { TabPanel, Tabs, type TabId } from './ui/Tabs';
import { loadLang, loadLists, loadSession, loadTab, saveLang, saveLists, saveSession, saveTab } from './storage';
import { EMPTY_LISTS, effectiveLists, type UserLists } from './engine/lists';
import { t, type Lang } from './i18n';
import { LangProvider } from './i18n/react';
import { hasItalianNames } from './i18n/game';
import { paletteFor, type PaletteSetting } from './ui/theme';

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
  const [format, setFormat] = useState<Format>(shared?.format ?? session?.format ?? DEFAULT_FORMAT);
  // Colori di versione: seguono il gioco del formato (o la palette fissata nelle impostazioni)
  const palette: PaletteSetting = 'auto';
  useEffect(() => {
    document.documentElement.dataset.palette = paletteFor(palette, format.formatId);
  }, [palette, format.formatId]);
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
  // Preferiti e bannati dell'utente: salvati nel browser, quelli del formato entrano nei dati (solo i suggerimenti li usano)
  const [lists, setLists] = useState<UserLists>(() => (storage ? loadLists(storage) : EMPTY_LISTS));
  useEffect(() => {
    if (storage) saveLists(lists, storage);
  }, [lists, storage]);
  const userLists = useMemo(() => effectiveLists(lists, format.formatId), [lists, format.formatId]);
  // Lista svuotata: si può annullare per qualche secondo (finché le liste restano quelle)
  const [listUndo, setListUndo] = useState<{ id: number; from: string; before: UserLists; after: UserLists } | null>(null);
  // Stabile: la scheda Liste (oltre mille Pokémon) non si ridisegna quando cambia solo il team
  const listsRef = useRef(lists);
  listsRef.current = lists;
  const changeLists = useCallback((next: UserLists, undo?: { kind: 'clearList'; from: string }) => {
    setListUndo(undo ? { id: Date.now(), from: undo.from, before: listsRef.current, after: next } : null);
    setLists(next);
  }, []);
  // La scheda Liste si monta la prima volta che la si apre, poi resta
  const [listsOpened, setListsOpened] = useState(false);
  // Senza meta (single player): voto, analisi, coach e suggerimenti ignorano l'uso nel formato
  // Il formato scelto entra nei dati: alcune regole del voto cambiano col formato (Ubers)
  // Il voto e l'analisi non dipendono dalle liste: cambiandole non si ricalcolano (solo i suggerimenti le usano)
  const rated = useMemo(() => ({ ...loaded, formatId: format.formatId, ...(format.meta ? {} : { ignoreMeta: true }) }),
    [loaded, format.formatId, format.meta]);
  const data = useMemo(() => ({ ...rated, userLists }), [rated, userLists]);
  const [initialTeam] = useState<TeamSet[]>(() => shared?.team ?? session?.team ?? []);
  const [team, setTeam] = useState<TeamSet[]>(initialTeam);
  useEffect(() => {
    if (storage) saveSession({ team, format }, storage);
  }, [team, format, storage]);
  // Scheda aperta sotto il team: col team vuoto si parte dai Pokémon, poi vale l'ultima scelta
  const [tab, setTabState] = useState<TabId>(() => (initialTeam.length && storage ? loadTab(storage) : null) ?? 'pokemon');
  const setTab = (next: TabId) => {
    setTabState(next);
    if (storage) saveTab(next, storage);
  };
  const [replaceIndex, setReplaceIndexState] = useState<number | null>(null);
  // Sostituto aperto in "Altri sostituti": vale solo per il membro che si sta sostituendo
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const setReplaceIndex = (index: number | null) => {
    setReplaceIndexState(index);
    setPreview(null);
  };
  // Il membro aperto nell'editor: l'editor prende il posto della sezione finché resta aperto
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [closeSignal, setCloseSignal] = useState(0);
  // La pagina non scorre: aprire una sezione basta a mostrarla (e chiude l'editor)
  const openTab = (next: TabId) => { setTab(next); setCloseSignal(n => n + 1); };
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
  const changePreview = (next: SwapPreview, open: boolean) =>
    setPreview(current => (open ? next
      : current?.index === next.index && current.replacement === next.replacement ? null : current));
  const analysis = useMemo(() => analyzeTeam(team, rated), [team, rated]);
  const rating = useMemo(() => rateTeam(team, rated, lang), [team, rated, lang]);
  // Il coach prova gli scambi per ogni membro (un decimo di secondo): si aggiorna subito dopo il team, senza bloccarlo
  const coachInput = useMemo(() => ({ team, format, data, lang }), [team, format, data, lang]);
  const coachSource = useDeferredValue(coachInput);
  const coaching = useMemo(() => coachTeam(coachSource.team, coachSource.format, coachSource.data, coachSource.lang), [coachSource]);

  // Contatori delle schede: problemi del coach e minacce del meta senza check
  const problems = coaching.problems;
  const metaOn = !data.ignoreMeta && !!data.stats;
  const openThreats = analysis.threats.filter(threat => threat.handledBy.length === 0).length;
  // Senza meta la scheda Meta è spenta: si resta sull'Analisi
  const shownTab: TabId = tab === 'meta' && !metaOn ? 'analysis' : tab;
  if (shownTab === 'lists' && !listsOpened) setListsOpened(true);

  const changeTeam = (next: TeamSet[]) => {
    const value = next.slice(0, 6);
    setTeam(value);
    setReplaceIndex(null);
    return value;
  };
  const addSet = (set: TeamSet) => {
    if (team.length < 6) changeTeam([...team, set]);
  };
  // Rimozioni e sostituzioni si possono annullare per qualche secondo
  // (vale finché il team resta quello lasciato dall'azione: un'altra modifica chiude l'avviso)
  const [undo, setUndo] = useState<(UndoAction & { before: TeamSet[]; after: TeamSet[]; format?: Format }) | null>(() =>
    shared && session?.team.length
      ? { id: 0, kind: 'load', from: '', before: session.team, after: initialTeam, format: session.format }
      : null);
  const undoId = useRef(0);
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
  // Preset migliori per tutto il team, o team svuotato: si annullano come le altre modifiche
  const bulk = (kind: 'presets' | 'fill' | 'clear', next: TeamSet[]) => {
    const after = changeTeam(next);
    remember(kind === 'clear' ? { kind: 'clear', from: '' }
      : { kind: 'presets', from: String(rating?.overall ?? '—'), to: String(rateTeam(after, data, lang)?.overall ?? ''),
        added: after.length - team.length, created: team.length === 0 }, after);
  };
  const removeAt = (index: number) => {
    const after = changeTeam(team.filter((_, i) => i !== index));
    remember({ kind: 'remove', from: battleName(team[index]) }, after);
  };

  return (
    <LangProvider lang={lang}>
    <div className="app">
      <Rail format={format} onFormatChange={setFormat} meta={data.stats?.meta ?? null} lang={lang} onLangChange={changeLang}
        actions={<>
          <ShowdownPanel team={team} format={format} tera={teraAllowed(format)} onImport={changeTeam} />
          <SavedTeams team={team} format={format} onLoad={(saved, savedFormat) => { changeTeam(saved); if (savedFormat) setFormat({ ...savedFormat, meta: format.meta }); }} />
        </>}
        tabs={<Tabs orientation="vertical" active={shownTab} onChange={openTab} tabs={[
        { id: 'pokemon', label: t(lang, 'tabs.pokemon'),
          count: replaceIndex !== null && team[replaceIndex] ? { text: t(lang, 'suggest.replaceTitle', { species: team[replaceIndex].species }), level: 'info' } : null },
        { id: 'analysis', label: t(lang, 'tabs.analysis'),
          count: problems.length ? { text: t(lang, problems.length === 1 ? 'tabs.problemsOne' : 'tabs.problemsMany', { n: problems.length }),
            level: problems.some(p => p.severity === 'serious') ? 'serious' : 'minor' } : null },
        { id: 'meta', label: t(lang, 'tabs.meta'), disabled: !metaOn, note: metaOn ? undefined : t(lang, 'tabs.metaOff'),
          count: metaOn && team.length > 0 && openThreats ? { text: t(lang, openThreats === 1 ? 'tabs.threatsOne' : 'tabs.threatsMany', { n: openThreats }), level: 'warn' } : null },
        { id: 'lists', label: t(lang, 'tabs.lists') },
        { id: 'compare', label: t(lang, 'tabs.compare'), disabled: true, note: t(lang, 'tabs.soon') },
      ]} />} />
      <div className="main" ref={mainRef}>
      {loading && <p className="banner info">{t(lang, 'app.loading')}</p>}
      {!loading && !data.stats && (
        <p className="banner" role="alert">
          {t(lang, 'app.noData', { format: formatLabel(format, lang) })} <code>npm run fetch-data</code> {t(lang, 'app.noDataAfter')}
        </p>
      )}
      <div className="band">
        <TeamPanel team={team} format={format} data={data} onChange={changeTeam} onAdd={addSet} onReplace={startReplace} onRemove={removeAt} onPaste={pasteAt} onBulk={bulk} onAddClick={startAdd}
          onOpenChange={setEditingIndex} closeSignal={closeSignal}
          onAllowMultipleMegas={() => setFormat(f => ({ ...f, allowMultipleMegas: true }))} />
        <GradeBadge rating={rating} />
      </div>
      <div className={`workspace${editingIndex !== null ? ' editing' : ''}`} ref={workspaceRef}>
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
            onPreview={changePreview}
            onTarget={setReplaceIndex}
            focusSearch={searchRequest}
          />
        </TabPanel>
        <TabPanel id="analysis" active={shownTab}>
          <AnalysisPanel team={team} analysis={analysis} data={data} rating={rating} coaching={coaching} withMeta={false} expanded
            preview={preview?.index === replaceIndex ? preview : null} onReplace={startReplace} onSwap={replaceAt}
            footer={team.length > 0 && <MemberSheet team={team} data={rated} />} />
        </TabPanel>
        <TabPanel id="meta" active={shownTab}>
          <MetaPanel team={team} analysis={analysis} data={data} coaching={coaching} />
        </TabPanel>
        <TabPanel id="lists" active={shownTab}>
          {listsOpened && <ListsPanel lists={lists} format={format} data={data} onChange={changeLists} />}
        </TabPanel>
      </main>
      </div>
      </div>
      {listUndo && listUndo.after === lists && (
        <UndoToast action={{ id: listUndo.id, kind: 'clearList', from: listUndo.from }} onClose={() => setListUndo(null)}
          onUndo={() => { setLists(listUndo.before); setListUndo(null); }} />
      )}
      {undo && undo.after === team && (
        <UndoToast action={undo} onClose={() => setUndo(null)}
          onUndo={() => { changeTeam(undo.before); if (undo.format) setFormat({ ...undo.format, meta: format.meta }); setUndo(null); }} />
      )}
    </div>
    </LangProvider>
  );
}
