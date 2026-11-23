import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { loadPalette, savePalette } from '../../src/storage';
import { chooseDex } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    getItem: (k: string) => values[k] ?? null,
    setItem: (k: string, v: string) => { values[k] = v; },
    removeItem: (k: string) => { delete values[k]; },
  } as unknown as Storage;
};
const palette = () => document.documentElement.dataset.palette;

describe('palette salvata', () => {
  it('round-trip e dati non validi', () => {
    const storage = memory();
    savePalette('sv', storage);
    expect(loadPalette(storage)).toBe('sv');
    expect(loadPalette(memory({ 'dreamdex.palette': '"rosa"' }))).toBeNull();
    expect(loadPalette(memory({ 'dreamdex.palette': '{' }))).toBeNull();
  });
});

describe('Impostazioni', () => {
  it("con la scritta visibile il pulsante della barra non ripete il nome nel fumetto", () => {
    render(<App initialLang="it" data={fixtureData} storage={memory()} />);
    const button = screen.getByRole('button', { name: 'Impostazioni' });
    expect(button).not.toHaveAttribute('data-hint');
    expect(button).not.toHaveAttribute('title');
  });
  it("nella barra stretta (solo l'ingranaggio) il nome è nel fumetto dell'app, non nel title del browser", () => {
    // jsdom non ha matchMedia: lo finge una barra stretta
    const narrow = vi.fn((query: string) => ({
      matches: query.includes('max-width: 1279px'), media: query, onchange: null,
      addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    }) as MediaQueryList);
    vi.stubGlobal('matchMedia', narrow);
    try {
      render(<App initialLang="it" data={fixtureData} storage={memory()} />);
      const button = screen.getByRole('button', { name: 'Impostazioni' });
      expect(button).toHaveAttribute('data-hint', 'Impostazioni');
      expect(button).toHaveAttribute('title', '');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('fissare Scarlatto e Violetto cambia la palette, la salva e resta dopo il riavvio', async () => {
    const user = userEvent.setup();
    const storage = memory();
    const { unmount } = render(<App initialLang="it" data={fixtureData} storage={storage} />);
    expect(palette()).toBe('swsh');
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    const dialog = screen.getByRole('dialog', { name: 'Impostazioni' });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Scarlatto e Violetto' }));
    expect(palette()).toBe('sv');
    expect(loadPalette(storage)).toBe('sv');
    unmount();
    render(<App initialLang="it" data={fixtureData} storage={storage} />);
    expect(palette()).toBe('sv');
  });

  it('Esc chiude e il focus torna al pulsante', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Impostazioni' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Impostazioni' })).toHaveFocus();
  });

  it('"Segue il gioco" usa la palette del formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} storage={memory({ 'dreamdex.palette': '"swsh"' })} />);
    await chooseDex(user, 'gen9');
    expect(palette()).toBe('swsh');
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    await user.click(screen.getByRole('radio', { name: 'Segue il gioco' }));
    expect(palette()).toBe('sv');
    await chooseDex(user, 'natdex');
    expect(palette()).toBe('swsh');
  });
});

describe('sprite della lista', () => {
  it('nelle Impostazioni non c’è più la scelta degli sprite della lista', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} storage={memory()} />);
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    expect(screen.queryByRole('radio', { name: 'Icona box' })).toBeNull();
    expect(screen.queryByText('Sprite nella lista')).toBeNull();
  });

  it('un vecchio dreamdex.listSprite salvato si ignora: la lista usa gli sprite normali, senza vista della lista', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} storage={memory({ 'dreamdex.listSprite': '"box"' })} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const panel = screen.getByRole('region', { name: 'Suggerimenti' });
    expect(panel.querySelector('.suggestions .card .sprite')).not.toBeNull();
    expect(panel.querySelector('.suggestions .card .box-icon')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Vista della lista' })).toBeNull();
  });

  it('uno stile Menu salvato da una versione vecchia si ignora: la lista resta a carte', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} storage={memory({ 'dreamdex.listStyle': '"menu"' })} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const panel = screen.getByRole('region', { name: 'Suggerimenti' });
    expect(panel.querySelector('.suggestions.cards')).not.toBeNull();
    expect(panel.querySelector('.suggestions.menu')).toBeNull();
  });
});
