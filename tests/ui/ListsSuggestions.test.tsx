import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { EMPTY_LISTS, type UserLists } from '../../src/engine/lists';
import { fixtureData } from '../fixtures/data';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

const memory = (initial: Record<string, string> = {}) => {
  const values = { ...initial };
  return {
    values,
    storage: {
      getItem: (k: string) => values[k] ?? null,
      setItem: (k: string, v: string) => { values[k] = v; },
      removeItem: (k: string) => { delete values[k]; },
    } as unknown as Storage,
  };
};
const withLists = (lists: UserLists | object) => memory({ 'dreamdex.lists': JSON.stringify(lists) });
// Salvate nella forma di prima delle raccolte (byFormat): si leggono con la migrazione
const bans = (...names: string[]) => ({ universal: { favorites: [], bans: [] }, byFormat: { ou: { favorites: [], bans: names } } });
const favorites = (...names: string[]): UserLists => ({ ...EMPTY_LISTS, universal: { favorites: names, bans: [] } });

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const rowNames = () => [...suggestions().querySelectorAll('.suggestions .name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));
const rowOverall = () => [...suggestions().querySelectorAll('.suggestions .result[aria-label]')].map(el => Number(/ (\d+) \(/.exec(el.getAttribute('aria-label')!)![1]));

async function setup(storage: Storage, ...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} storage={storage} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

describe('liste nella scheda Pokémon', () => {
  it('il bannato non compare; "mostra" lo fa vedere col segno, e si riazzera cambiando team', async () => {
    const first = await (async () => {
      const { storage } = memory();
      await setup(storage, 'Great Tusk');
      await waitFor(() => expect(rowNames().length).toBeGreaterThan(1));
      const name = rowNames()[0];
      document.body.innerHTML = '';
      return name;
    })();
    const { storage } = withLists(bans(first));
    const user = await setup(storage, 'Great Tusk');
    await waitFor(() => expect(rowNames().length).toBeGreaterThan(1));
    expect(rowNames()).not.toContain(first);
    // Il pulsante ⊘ nella fascia "Candidati": li mostra e resta acceso, ripremuto li nasconde di nuovo
    const pill = within(suggestions()).getByRole('button', { name: '1 Pokémon nascosto dalla tua lista Ban. Clicca per mostrarlo' });
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(pill).toHaveTextContent('1');
    await user.click(pill);
    await waitFor(() => expect(rowNames()).toContain(first));
    expect(within(suggestions()).getAllByLabelText('Nella tua lista Ban').length).toBeGreaterThan(0);
    const shown = within(suggestions()).getByRole('button', { name: '1 Pokémon della tua lista Ban in vista. Clicca per nasconderlo' });
    expect(shown).toHaveAttribute('aria-pressed', 'true');
    await user.click(shown);
    await waitFor(() => expect(rowNames()).not.toContain(first));
    await user.click(within(suggestions()).getByRole('button', { name: /nascosto dalla tua lista Ban/ }));
    await waitFor(() => expect(rowNames()).toContain(first));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Gholdengo{Enter}');
    await waitFor(() => expect(rowNames()).not.toContain(first));
  });

  it('ricerca: una parte del nome non riporta il bannato, il nome esatto sì (e non conta tra i nascosti)', async () => {
    const { storage } = withLists(bans('Kingambit'));
    const user = await setup(storage, 'Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'kinga');
    expect(await within(suggestions()).findByText('Nessun Pokémon con questo nome')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Aggiungi Pokémon'));
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'Kingambit');
    await waitFor(() => expect(rowNames()).toEqual(['Kingambit']));
    expect(within(suggestions()).getAllByLabelText('Nella tua lista Ban').length).toBeGreaterThan(0);
    expect(within(suggestions()).queryByRole('button', { name: /dalla tua lista Ban/ })).toBeNull();
  });

  it('un preferito quasi alla pari passa davanti e ha il cuore', async () => {
    const plain = memory();
    // Con Gholdengo i primi due candidati distano 2 punti, il margine dei preferiti (con Toxapex distano 3-5 punti)
    await setup(plain.storage, 'Great Tusk', 'Gholdengo');
    await waitFor(() => expect(rowOverall().length).toBeGreaterThan(2));
    const names = rowNames();
    const overall = rowOverall();
    // Un candidato a non più di 2 punti da quello sopra (anche a pari punti): da preferito gli passa davanti
    const at = overall.findIndex((v, i) => i > 0 && overall[i - 1] - v <= 2);
    expect(at).toBeGreaterThan(0);
    const favorite = names[at];
    document.body.innerHTML = '';

    const { storage } = withLists(favorites(favorite));
    await setup(storage, 'Great Tusk', 'Gholdengo');
    await waitFor(() => expect(rowNames().indexOf(favorite)).toBeLessThan(at));
    // Il ♥ sta sul voto e ne spiega la salita; nella riga del nome niente cuore
    const row = suggestions().querySelectorAll('.suggestions li')[rowNames().indexOf(favorite)];
    const tag = within(row as HTMLElement).getByLabelText(/ · Più in alto perché è tra i tuoi preferiti$/);
    // Il motivo nel fumetto dell'app, non nel titolo del browser
    expect(tag).toHaveAttribute('data-hint', 'Più in alto perché è tra i tuoi preferiti');
    expect(tag).toHaveAttribute('title', '');
    expect(tag.querySelector('.fav-heart')).not.toBeNull();
    expect(row.querySelector('.name-line .list-mark')).toBeNull();
    expect(within(suggestions()).queryAllByLabelText('Nei tuoi Preferiti')).toHaveLength(0);
  });

  it('il lucchetto (Fisso) delle card del team non tocca le liste', async () => {
    const { storage, values } = memory();
    const user = await setup(storage, 'Great Tusk');
    await user.click(screen.getByRole('button', { name: /^Fisso /, pressed: false }));
    expect(values['dreamdex.lists'] ?? JSON.stringify(EMPTY_LISTS)).toBe(JSON.stringify(EMPTY_LISTS));
  });
});

describe('liste: nascosti anche negli scambi', () => {
  it('"Sostituisci" e "Sostituto" dicono quanti bannati mancano', async () => {
    const { storage } = withLists(bans('Kingambit'));
    const user = await setup(storage, 'Great Tusk', 'Gholdengo');
    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituisci' }));
    expect(await within(suggestions()).findByRole('button', { name: /^1 Pokémon nascosto dalla tua lista Ban/ })).toBeInTheDocument();
    await user.click(within(suggestions()).getByRole('button', { name: /^Chi sostituire/ }));
    await user.click(within(suggestions()).getByRole('button', { name: 'Sostituisci Gholdengo' }));
    expect(await within(suggestions()).findByRole('button', { name: /^1 Pokémon nascosto dalla tua lista Ban/ })).toBeInTheDocument();
  });
});
