import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadDataOrEmpty } from './data/load';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadDataOrEmpty().then(data => {
  root.render(
    <StrictMode>
      <App data={data} />
    </StrictMode>,
  );
});
