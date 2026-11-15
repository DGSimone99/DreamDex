import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadBans, loadDataOrEmpty, loadItalianNames, loadSource, loadTiers } from './data/load';
import { initBans } from './engine/formats';
import { initGameNames } from './i18n/game';
import { initTiers } from './engine/dex';
import { initLearnsets } from './engine/learnsets';
import { browserStorage, loadLang } from './storage';
import '@fontsource/kanit/400.css';
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/700.css';
import '@fontsource/kanit/400-italic.css';
import '@fontsource/kanit/600-italic.css';
import '@fontsource/kanit/700-italic.css';
import '@fontsource/kanit/800-italic.css';
import './styles.css';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

const storage = browserStorage();
// I nomi italiani solo se si parte in italiano; altrimenti al primo passaggio a IT
const loadNames = () => loadItalianNames().then(initGameNames);
const names = storage && loadLang(storage) === 'it' ? loadNames() : Promise.resolve();

/** La schermata di caricamento di index.html: sfuma via quando l'app è sulla pagina. */
function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  const remove = () => boot.remove();
  // Solo quando l'app è davvero sulla pagina (React la disegna un attimo dopo), così non si vede mai una pagina vuota
  const fade = () => {
    if (!rootElement.firstChild) return requestAnimationFrame(fade);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return remove();
    boot.classList.add('gone');
    boot.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 600);
  };
  requestAnimationFrame(fade);
}

/** Se i dati non arrivano: lo si dice nella schermata di caricamento invece di restare fermi per sempre. */
function bootFailed(error: unknown) {
  console.error('Avvio non riuscito:', error);
  const boot = document.getElementById('boot');
  const text = boot?.querySelector('.boot-text');
  if (!boot || !text) return;
  boot.classList.add('failed');
  boot.setAttribute('role', 'alert');
  text.removeAttribute('aria-label'); // index.html ci mette la parola "Caricamento…" (divisa in lettere)
  text.textContent = document.documentElement.lang === 'en'
    ? 'DreamDex could not start. Reload the page.'
    : 'DreamDex non è partito. Ricarica la pagina.';
}

// I tier di Showdown prima dei dati: decidono chi è legale in ogni formato
Promise.all([loadTiers().then(initTiers).then(loadDataOrEmpty), loadBans().then(initBans), initLearnsets(), names]).then(([data]) => {
  root.render(
    <StrictMode>
      <App data={data} loadSource={loadSource} storage={storage} loadNames={loadNames} />
    </StrictMode>,
  );
  hideBoot();
}, bootFailed);
