import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadData } from './data/load';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadData().then(data => {
  root.render(
    <StrictMode>
      <App data={data} />
    </StrictMode>,
  );
});
