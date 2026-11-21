import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHOICE, DEFAULT_MEMORY, type FormatChoice } from '../../src/engine/formatChoice';
import { initGames } from '../../src/engine/games';
import { t as translate, type MessageKey } from '../../src/i18n';
import { LangProvider } from '../../src/i18n/react';
import { FormatDialog } from '../../src/ui/FormatDialog';
import { choiceName, choiceSummary } from '../../src/ui/formatName';

afterEach(() => initGames(null));

const open = (choice: FormatChoice = DEFAULT_CHOICE, family = choice.family) => {
  const onPick = vi.fn();
  const onClose = vi.fn();
  render(<LangProvider lang="it"><FormatDialog choice={choice} memory={DEFAULT_MEMORY} family={family} onPick={onPick} onClose={onClose} /></LangProvider>);
  return { onPick, onClose, dialog: screen.getByRole('dialog', { name: 'Scegli il formato' }) };
};
const radio = (name: string, value: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;

describe('finestra Scegli il formato', () => {
  it('cambiare linguetta non cambia il formato; Conferma prende la scelta della linguetta aperta e chiude', async () => {
    const user = userEvent.setup();
    const { onPick, onClose } = open();
    await user.click(radio('format-family', 'free'));
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith(DEFAULT_MEMORY.free);
    expect(onClose).toHaveBeenCalled();
  });

  it('Annulla chiude senza cambiare il formato', async () => {
    const user = userEvent.setup();
    const { onPick, onClose } = open();
    await user.click(radio('format-tier', 'ubers'));
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('le scelte di una linguetta restano passando a un\'altra e tornando', async () => {
    const user = userEvent.setup();
    const { onPick } = open();
    await user.click(radio('format-tier', 'uu'));
    await user.click(radio('format-family', 'free'));
    await user.click(radio('format-family', 'competitive'));
    await user.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith({ ...DEFAULT_CHOICE, tier: 'UU' });
  });

  it('il tier cambia il formato', async () => {
    const user = userEvent.setup();
    const { onPick } = open();
    await user.click(radio('format-tier', 'ubers'));
    expect(onPick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith({ ...DEFAULT_CHOICE, tier: 'Ubers' });
  });

  it('passando a Gen 9 dal Doppio si torna al Singolo', async () => {
    const user = userEvent.setup();
    const { onPick } = open({ ...DEFAULT_CHOICE, battle: 'doubles' });
    await user.click(radio('format-gen', '9'));
    await user.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith({ ...DEFAULT_CHOICE, gen: 9, battle: 'singles' });
  });

  it('le generazioni passate, VGC e Champions si vedono ma sono spente', () => {
    const { dialog } = open();
    expect(within(dialog).getByRole('radio', { name: /Gen 7/ })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: /RBY/ })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: /VGC/ })).toBeDisabled();
    expect(within(dialog).getByRole('radio', { name: /Champions/ })).toBeDisabled();
  });

  it('niente pulsante del meta e niente limite di generazione su Smogon', () => {
    const { dialog } = open();
    expect(within(dialog).queryByRole('button', { name: /meta/i })).toBeNull();
    expect(document.querySelector('input[name="format-genlimit"]')).toBeNull();
  });

  it('senza dati dei giochi la linguetta Giochi è spenta; con i dati si sceglie e mostra le opzioni', async () => {
    open();
    expect(radio('format-family', 'game')).toBeDisabled();
  });

  it('Giochi: opzioni del gioco e logo', async () => {
    initGames({ sv: { dex: ['sprigatito'] } });
    const user = userEvent.setup();
    const game: FormatChoice = DEFAULT_MEMORY.game;
    const { onPick, dialog } = open(game);
    expect(within(dialog).getByRole('img', { name: 'Pokémon Scarlatto' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Tutto il Pokédex' }));
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith({ ...game, allPokedex: true });
  });

  it('No Format: limite di generazione e Più Mega, niente testo sulle hackrom', async () => {
    const user = userEvent.setup();
    const free: FormatChoice = DEFAULT_MEMORY.free;
    const { onPick, dialog } = open(free);
    expect(dialog).toHaveTextContent('Tutto ammesso: niente tier, niente ban, niente meta.');
    expect(dialog).not.toHaveTextContent(/hackrom/i);
    await user.click(radio('format-genlimit', '7'));
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));
    expect(onPick).toHaveBeenCalledWith({ ...free, genLimit: 7 });
  });

  it('Esc e × chiudono', async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = open();
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('nome e riassunto del formato', () => {
  const t = (key: MessageKey, values?: Record<string, string | number>) => translate('it', key, values);
  it('competitivo, gioco, No Format', () => {
    expect(choiceName({ ...DEFAULT_CHOICE, gen: 9, tier: 'Anything Goes' }, t)).toBe('Gen 9 Anything Goes');
    expect(choiceSummary({ ...DEFAULT_CHOICE, battle: 'doubles', ignoreBans: true }, t)).toEqual(['Smogon', 'Doppio', 'Ban ignorati']);
    expect(choiceName(DEFAULT_MEMORY.game, t)).toBe('Scarlatto e Violetto');
    expect(choiceSummary({ ...DEFAULT_MEMORY.game, allPokedex: true, legendaries: true }, t)).toEqual(['Gen 9', 'Tutto il Pokédex', 'Leggendari']);
    expect(choiceName(DEFAULT_MEMORY.free, t)).toBe('No Format');
    expect(choiceSummary({ family: 'free', genLimit: 7, multipleMegas: true }, t)).toEqual(['Fino alla Gen 7', 'Più Mega']);
  });
});
