import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import { coachTeam } from './engine/coach';
import { rateTeam } from './engine/rating';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import { dataSource, formatLabel } from './engine/formats';
import type { TeamSet } from './engine/sets';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { DataLists } from './ui/DataLists';
import { SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { SuggestionsPanel } from './ui/SuggestionsPanel';
import { TeamPanel } from './ui/TeamPanel';
import { TopBar } from './ui/TopBar';

const NO_DATA: EngineData = { stats: null, sets: null };

interface AppProps {
  /** Dati della fonte iniziale (National Dex OU). */
  data: EngineData;
  /** Carica i dati di un'altra fonte quando si cambia formato. */
  loadSource?: (source: string) => Promise<EngineData>;
}

export function App({ data: initialData, loadSource }: AppProps) {
  const [format, setFormat] = useState<Format>(DEFAULT_FORMAT);
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
  const [team, setTeam] = useState<TeamSet[]>([]);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
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
    <div className="app">
      <TopBar format={format} onFormatChange={setFormat} meta={data.stats?.meta ?? null}>
        <ShowdownPanel team={team} onImport={changeTeam} />
        <SavedTeams team={team} onLoad={changeTeam} />
      </TopBar>
      {loading && <p className="banner info">Caricamento statistiche…</p>}
      {!loading && !data.stats && (
        <p className="banner" role="alert">
          Statistiche {formatLabel(format)} non scaricate: esegui <code>npm run fetch-data</code> e ricarica la pagina.
          L'analisi di tipo e la ricerca per nome restano disponibili.
        </p>
      )}
      <main className="columns">
        <div className="left">
          <TeamPanel team={team} format={format} data={data} onChange={changeTeam} onAdd={addSet} onReplace={setReplaceIndex}
            onAllowMultipleMegas={() => setFormat(f => ({ ...f, allowMultipleMegas: true }))} />
          <AnalysisPanel team={team} analysis={analysis} data={data} rating={rating} coaching={coaching} onReplace={setReplaceIndex} />
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
          />
        </div>
      </main>
      <DataLists />
    </div>
  );
}
