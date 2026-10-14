import { useState } from 'react';
import type { EngineData } from './engine/data';
import { DEFAULT_FORMAT, type Format } from './engine/format';
import { DataLists } from './ui/DataLists';
import { TopBar } from './ui/TopBar';

export function App({ data }: { data: EngineData }) {
  const [format, setFormat] = useState<Format>(DEFAULT_FORMAT);

  return (
    <div className="app">
      <TopBar format={format} onFormatChange={setFormat} meta={data.stats?.meta ?? null} />
      {!data.stats && (
        <p className="banner" role="alert">
          Dati Smogon non trovati: esegui <code>npm run fetch-data</code> e ricarica la pagina.
          L'analisi di tipo resta disponibile.
        </p>
      )}
      <main className="columns">
        <div className="left" />
        <div className="right" />
      </main>
      <DataLists />
    </div>
  );
}
