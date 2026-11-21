import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_CHOICE, type FormatChoice } from '../../src/engine/formatChoice';
import { loadSession, saveSession } from '../../src/storage';
import { chooseTier, chosen } from '../helpers/format';
import { fixtureData } from '../fixtures/data';

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    getItem: (k: string) => values[k] ?? null,
    setItem: (k: string, v: string) => { values[k] = v; },
    removeItem: (k: string) => { delete values[k]; },
  } as unknown as Storage;
};
const team = () => screen.getByRole('region', { name: 'Team' });

describe('sessione salvata', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trip e dati non validi', () => {
    const storage = memory();
    const tusk = { species: 'Great Tusk', item: '', ability: '', moves: [], nature: 'Jolly', evs: {}, favorite: true };
    const free: FormatChoice = { family: 'free', genLimit: 6, multipleMegas: false };
    expect(saveSession({ team: [tusk], choice: free }, storage)).toBe(true);
    expect(loadSession(storage)).toEqual({ team: [tusk], choice: free });
    expect(loadSession(memory({ 'dreamdex.session': '{rotto' }))).toBeNull();
    expect(loadSession(memory({ 'dreamdex.session': JSON.stringify({ team: 'x', choice: {} }) }))).toBeNull();
    const weird = loadSession(memory({ 'dreamdex.session': JSON.stringify({ team: [tusk], format: { formatId: 'gen9ou' } }) }));
    expect(weird?.team).toEqual([tusk]);
    expect(weird?.choice).toEqual(DEFAULT_CHOICE);
    expect(loadSession(undefined)).toBeNull();
  });

  it('team, preferiti e formato restano dopo un ricaricamento', async () => {
    const storage = memory();
    const user = userEvent.setup();
    const { unmount } = render(<App initialLang="it" data={fixtureData} storage={storage} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await user.click(screen.getByRole('button', { name: 'Fisso Great Tusk' }));
    await chooseTier(user, 'uu');
    unmount();
    render(<App initialLang="it" data={fixtureData} storage={storage} />);
    expect(within(team()).getByText('Great Tusk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fisso Great Tusk' })).toHaveAttribute('aria-pressed', 'true');
    expect(chosen('format-tier')).toBe('uu');
  });

  it('senza storage (test, browser bloccato) si parte da zero', () => {
    render(<App initialLang="it" data={fixtureData} />);
    expect(within(team()).getByRole('heading', { name: 'Team (0/6)' })).toBeInTheDocument();
  });

  it('i team salvati ricordano il formato', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Great Tusk{Enter}');
    await chooseTier(user, 'ubers');
    await user.type(screen.getByLabelText('Nome team'), 'Ubers team');
    await user.click(screen.getByRole('button', { name: 'Salva team' }));
    await chooseTier(user, 'ou');
    await user.click(screen.getByRole('button', { name: 'Ubers team' }));
    expect(chosen('format-tier')).toBe('ubers');
  });
});
