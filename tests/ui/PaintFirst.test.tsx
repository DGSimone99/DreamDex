import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixtureData, fixtureStats } from '../fixtures/data';
import { mostCommonSet } from '../../src/engine/sets';
import { saveSession } from '../../src/storage';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';

/**
 * Nel browser (coi calcoli in sottofondo) la pagina si disegna prima del voto: qui un Worker finto che non risponde mai
 * fa prendere all'App quella strada (gli altri test girano senza Worker, col voto al primo disegno).
 */
class SilentWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  window.localStorage.clear();
});

describe('pagina prima del voto', () => {
  it('il team si vede subito, la carta dice che il voto si calcola, poi arriva il voto', async () => {
    vi.stubGlobal('Worker', SilentWorker);
    vi.resetModules();
    const { App } = await import('../../src/App');
    saveSession({ team: ['Great Tusk', 'Gholdengo'].map(n => mostCommonSet(fixtureStats, n)!), choice: DEFAULT_CHOICE }, window.localStorage);
    render(<App initialLang="it" data={fixtureData} storage={window.localStorage} />);
    // Primo disegno: il team c'è, il voto no
    expect(document.querySelector('.slots')).toHaveTextContent('Great Tusk');
    expect(screen.getAllByText('Calcolo del voto…').length).toBeGreaterThan(0);
    expect(document.querySelector('.grade-badge.grading')).not.toBeNull();
    // Le schede nascoste non si disegnano finché non si aprono
    expect(document.getElementById('panel-analysis')).toBeEmptyDOMElement();
    expect(document.getElementById('panel-meta')).toBeEmptyDOMElement();
    // Subito dopo il voto vero, senza "Calcolo del voto…"
    await waitFor(() => expect(document.querySelector('.grade-badge.grading')).toBeNull());
    expect(document.querySelector('.grade-badge .letter')).not.toBeNull();
    expect(screen.queryAllByText('Calcolo del voto…')).toHaveLength(0);
  });
});
