import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadBans, loadDataOrEmpty, loadItalianNames, loadSource, loadTiers } from './data/load';
import { initBans } from './engine/formats';
import { initGameNames } from './i18n/game';
import { initTiers } from './engine/dex';
import { initLearnsets } from './engine/learnsets';
import { browserStorage, loadLang } from './storage';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);


const storage = browserStorage();
// I nomi italiani solo se si parte in italiano; altrimenti al primo passaggio a IT
const loadNames = () => loadItalianNames().then(initGameNames);
const names = storage && loadLang(storage) === 'it' ? loadNames() : Promise.resolve();

// I tier di Showdown prima dei dati: decidono chi è legale in ogni formato
Promise.all([loadTiers().then(initTiers).then(loadDataOrEmpty), loadBans().then(initBans), initLearnsets(), names]).then(([data]) => {
  root.render(
    <StrictMode>
      <App data={data} loadSource={loadSource} storage={storage} loadNames={loadNames} />
    </StrictMode>,
  );
});
