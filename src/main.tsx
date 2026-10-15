import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadDataOrEmpty, loadSource } from './data/load';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadDataOrEmpty().then(data => {
  root.render(
    <StrictMode>
      <App data={data} loadSource={loadSource} />
    </StrictMode>,
  );
});
