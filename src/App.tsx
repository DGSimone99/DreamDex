import { useMemo, useState } from 'react';
import { analyzeTeam } from './engine/analysis';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import type { TeamSet } from './engine/sets';
import { AnalysisPanel } from './ui/AnalysisPanel';
import { DataLists } from './ui/DataLists';
import { SavedTeams } from './ui/SavedTeams';
import { ShowdownPanel } from './ui/ShowdownPanel';
import { SuggestionsPanel } from './ui/SuggestionsPanel';
import { TeamPanel } from './ui/TeamPanel';
import { TopBar } from './ui/TopBar';

export function App({ data }: { data: EngineData }) {
  const [format, setFormat] = useState<Format>(DEFAULT_FORMAT);
  const [team, setTeam] = useState<TeamSet[]>([]);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const analysis = useMemo(() => analyzeTeam(team, data), [team, data]);

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
      {!data.stats && (
        <p className="banner" role="alert">
          Dati Smogon non trovati: esegui <code>npm run fetch-data</code> e ricarica la pagina.
          L'analisi di tipo resta disponibile.
        </p>
      )}
      <main className="columns">
        <div className="left">
          <TeamPanel team={team} format={format} data={data} onChange={changeTeam} onAdd={addSet} onReplace={setReplaceIndex} />
          <AnalysisPanel team={team} analysis={analysis} />
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
