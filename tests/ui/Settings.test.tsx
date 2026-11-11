import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { loadListSprite, loadPalette, saveListSprite, savePalette } from '../../src/storage';
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
  it('sprite della lista: round-trip e dati non validi', () => {
    const storage = memory();
    saveListSprite('box', storage);
    expect(loadListSprite(storage)).toBe('box');
    expect(loadListSprite(memory({ 'dreamdex.listSprite': '"rosa"' }))).toBeNull();
    expect(loadListSprite(memory({ 'dreamdex.listSprite': '{' }))).toBeNull();
  });

  it('Icona box si sceglie nelle Impostazioni e resta dopo il riavvio; niente più stile Menu', async () => {
    const user = userEvent.setup();
    const storage = memory();
    const { unmount } = render(<App initialLang="it" data={fixtureData} storage={storage} />);
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    expect(screen.getByRole('radio', { name: 'Normale' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Menu' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Carte' })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Icona box' }));
    expect(loadListSprite(storage)).toBe('box');
    unmount();
    render(<App initialLang="it" data={fixtureData} storage={storage} />);
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    expect(screen.getByRole('radio', { name: 'Icona box' })).toBeChecked();
  });

  it('uno stile Menu salvato da una versione vecchia si ignora: la lista resta a carte', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} storage={memory({ 'dreamdex.listStyle': '"menu"' })} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const panel = screen.getByRole('region', { name: 'Suggerimenti' });
    expect(panel.querySelector('.suggestions.cards')).not.toBeNull();
    expect(panel.querySelector('.suggestions.menu')).toBeNull();
  });

  it('Vista della lista nella fascia Candidati: lo sprite, la stessa impostazione del dialogo', async () => {
    const user = userEvent.setup();
    const storage = memory();
    render(<App initialLang="it" data={fixtureData} storage={storage} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    const panel = screen.getByRole('region', { name: 'Suggerimenti' });
    const toggle = within(panel).getByRole('button', { name: 'Vista della lista' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const pop = within(panel).getByRole('group', { name: 'Vista della lista' });
    expect(within(pop).queryByRole('radio', { name: 'Menu' })).toBeNull();
    expect(within(pop).getByRole('radio', { name: 'Normale' })).toBeChecked();
    await user.click(within(pop).getByRole('radio', { name: 'Icona box' }));
    expect(loadListSprite(storage)).toBe('box');
    expect(panel.querySelector('.suggestions .box-icon')).not.toBeNull();
    // Esc chiude e riporta il focus al pulsante
    await user.keyboard('{Escape}');
    expect(within(panel).queryByRole('group', { name: 'Vista della lista' })).toBeNull();
    expect(toggle).toHaveFocus();
    // Il dialogo Impostazioni mostra le stesse scelte; cambiarle lì aggiorna la vista
    await user.click(screen.getByRole('button', { name: 'Impostazioni' }));
    const dialog = screen.getByRole('dialog', { name: 'Impostazioni' });
    expect(within(dialog).getByRole('radio', { name: 'Icona box' })).toBeChecked();
    await user.click(within(dialog).getByRole('radio', { name: 'Normale' }));
    await user.keyboard('{Escape}');
    await user.click(toggle);
    expect(within(within(panel).getByRole('group', { name: 'Vista della lista' })).getByRole('radio', { name: 'Normale' })).toBeChecked();
    // Un clic fuori lo chiude
    await user.click(document.body);
    expect(within(panel).queryByRole('group', { name: 'Vista della lista' })).toBeNull();
  });
});
