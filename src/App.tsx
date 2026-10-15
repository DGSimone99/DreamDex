import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import { coachTeam, type SwapPreview } from './engine/coach';
import { rateTeam } from './engine/rating';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import { dataLabel, dataSource } from './engine/formats';
import type { TeamSet } from './engine/sets';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { GradeBadge } from './ui/RatingPanel';
import { SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { SuggestionsPanel } from './ui/SuggestionsPanel';
import { TeamPanel } from './ui/TeamPanel';
import { TopBar } from './ui/TopBar';
import { loadLang, loadSession, saveLang, saveSession } from './storage';
import type { Lang } from './i18n';
import { LangProvider } from './i18n/react';

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
}

export function App({ data: initialData, loadSource, storage, initialLang }: AppProps) {
  const [lang, setLang] = useState<Lang>(() => initialLang ?? (storage ? loadLang(storage) : null) ?? 'en');
  useEffect(() => {
    document.documentElement.lang = lang;
    if (storage) saveLang(lang, storage);
  }, [lang, storage]);
  const [session] = useState(() => (storage ? loadSession(storage) : null));
  const [format, setFormat] = useState<Format>(session?.format ?? DEFAULT_FORMAT);
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
  const data = cache[source] ?? NO_DATA;
  const [team, setTeam] = useState<TeamSet[]>(session?.team ?? []);
  useEffect(() => {
    if (storage) saveSession({ team, format }, storage);
  }, [team, format, storage]);
  const [replaceIndex, setReplaceIndexState] = useState<number | null>(null);
  // Sostituto aperto in "Altri sostituti": vale solo per il membro che si sta sostituendo
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const setReplaceIndex = (index: number | null) => {
    setReplaceIndexState(index);
    setPreview(null);
  };
  const changePreview = (next: SwapPreview, open: boolean) =>
    setPreview(current => (open ? next
      : current?.index === next.index && current.replacement === next.replacement ? null : current));
  const analysis = useMemo(() => analyzeTeam(team, data), [team, data]);
  const rating = useMemo(() => rateTeam(team, data), [team, data]);
  const coaching = useMemo(() => coachTeam(team, format, data), [team, format, data]);

  const changeTeam = (next: TeamSet[]) => {
    setTeam(next.slice(0, 6));
    setReplaceIndex(null);
  };
  const addSet = (set: TeamSet) => {
    if (team.length < 6) changeTeam([...team, set]);
  };
  const replaceAt = (index: number, set: TeamSet) => changeTeam(team.map((s, i) => (i === index ? set : s)));

  return (
    <LangProvider lang={lang}>
    <div className="app">
      <TopBar format={format} onFormatChange={setFormat} meta={data.stats?.meta ?? null} lang={lang} onLangChange={setLang}>
        <ShowdownPanel team={team} onImport={changeTeam} />
        <SavedTeams team={team} format={format} onLoad={(loaded, savedFormat) => { changeTeam(loaded); if (savedFormat) setFormat(savedFormat); }} />
      </TopBar>
      {loading && <p className="banner info">Caricamento statistiche…</p>}
      {!loading && !data.stats && (
        <p className="banner" role="alert">
          Statistiche {dataLabel(format)} non scaricate: esegui <code>npm run fetch-data</code> e ricarica la pagina.
          L'analisi di tipo e la ricerca per nome restano disponibili.
        </p>
      )}
      <div className="band">
        <TeamPanel team={team} format={format} data={data} onChange={changeTeam} onAdd={addSet} onReplace={setReplaceIndex}
          onAllowMultipleMegas={() => setFormat(f => ({ ...f, allowMultipleMegas: true }))} />
        <GradeBadge rating={rating} />
      </div>
      <main className="columns">
        <div className="left">
          <AnalysisPanel team={team} analysis={analysis} data={data} rating={rating} coaching={coaching}
            preview={preview?.index === replaceIndex ? preview : null} onReplace={setReplaceIndex} onSwap={replaceAt} />
        </div>
        <div className="right">
          <SuggestionsPanel
            team={team}
            format={format}
            data={data}
            replaceIndex={replaceIndex}
            onAdd={addSet}
            onReplaceWith={replaceAt}
            onCancelReplace={() => setReplaceIndex(null)}
            onPreview={changePreview}
          />
        </div>
      </main>
    </div>
    </LangProvider>
  );
}
