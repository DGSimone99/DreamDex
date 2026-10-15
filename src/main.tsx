import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadDataOrEmpty, loadSource } from './data/load';
import { initLearnsets } from './engine/learnsets';
import { browserStorage } from './storage';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);


Promise.all([loadDataOrEmpty(), initLearnsets()]).then(([data]) => {
  root.render(
    <StrictMode>
      <App data={data} loadSource={loadSource} storage={browserStorage()} />
    </StrictMode>,
  );
});
