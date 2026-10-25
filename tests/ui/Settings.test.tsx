import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { loadPalette, savePalette } from '../../src/storage';
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
    await user.selectOptions(screen.getByLabelText('Pokédex'), 'gen9');
    expect(palette()).toBe('swsh');
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    await user.click(screen.getByRole('radio', { name: 'Segue il gioco' }));
    expect(palette()).toBe('sv');
    await user.selectOptions(screen.getByLabelText('Pokédex'), 'natdex');
    expect(palette()).toBe('swsh');
  });
});
