import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadDataOrEmpty, loadSource } from './data/load';
import { initLearnsets } from './engine/learnsets';
import { browserStorage } from './storage';
import './styles.css';

const root = createRoot(document.getElementById('root')!);


Promise.all([loadDataOrEmpty(), initLearnsets()]).then(([data]) => {
  root.render(
    <StrictMode>
      <App data={data} loadSource={loadSource} storage={browserStorage()} />
    </StrictMode>,
  );
});
