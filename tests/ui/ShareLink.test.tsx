import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_CHOICE } from '../../src/engine/formatChoice';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { fixtureData } from '../fixtures/data';

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return { getItem: k => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: k => void map.delete(k), clear: () => map.clear(), key: () => null, get length() { return map.size; } };
};
const names = () => [...screen.getByRole('region', { name: 'Team' }).querySelectorAll('.slot .name')].map(n => n.textContent);

afterEach(() => window.history.replaceState(null, '', '/'));

describe('aprire un link con un team', () => {
  it('carica team e formato, toglie il link e permette di annullare', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.setItem('dreamdex.session', JSON.stringify({ team: [emptySet('Great Tusk')], choice: DEFAULT_CHOICE }));
    const shared = [{ ...emptySet('Garchomp'), ability: 'Rough Skin' }, { ...emptySet('Gholdengo'), ability: 'Good as Gold' }];
    window.history.replaceState(null, '', `/#team=${encodeShare(shared, { ...DEFAULT_CHOICE, tier: 'Ubers' })}`);
    render(<App data={fixtureData} storage={storage} initialLang="it" />);
    expect(names()).toEqual(['Garchomp', 'Gholdengo']);
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent('Team caricato dal link');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(names()).toEqual(['Great Tusk']);
  });

  it('senza team precedente nessun avviso', () => {
    window.history.replaceState(null, '', `/#team=${encodeShare([emptySet('Garchomp')], DEFAULT_CHOICE)}`);
    render(<App data={fixtureData} initialLang="it" />);
    expect(names()).toEqual(['Garchomp']);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('copiare il link', () => {
  it('la linguetta Copia link mette negli appunti l\u2019indirizzo con il team', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App data={fixtureData} initialLang="it" />);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Garchomp{Enter}');
    await user.click(screen.getByRole('button', { name: 'Copia link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#t=[A-Za-z0-9_-]+$/));
    expect(await screen.findByText('Link copiato')).toBeInTheDocument();
  });
});
