import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isLang, t, type Lang } from '../i18n';

/**
 * Un errore imprevisto mentre si disegna l'app: invece della pagina vuota una schermata che lo dice e "Ricarica". Il
 * team è già salvato nella sessione (lo salva l'app a ogni modifica, e il link #team= viene tolto appena letto), quindi
 * ricaricando si riparte dal team di prima dell'errore.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('DreamDex: errore imprevisto', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // La lingua la mette l'app sulla pagina (document.documentElement.lang)
    const lang: Lang = typeof document !== 'undefined' && isLang(document.documentElement.lang) ? document.documentElement.lang : 'it';
    return (
      <main className="crash" role="alert">
        <div className="crash-card">
          <h1>{t(lang, 'crash.title')}</h1>
          <p>{t(lang, 'crash.text')}</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>{t(lang, 'crash.reload')}</button>
        </div>
      </main>
    );
  }
}
