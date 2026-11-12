import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const live = () => [...suggestions().querySelectorAll('[aria-live="polite"]')].map(el => el.textContent);

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('ricerca: annunci per i lettori di schermo', () => {
  it('la zona dei risultati c’è sempre; dice il numero e anche "nessun risultato"', async () => {
    const user = await setup('Great Tusk');
    const regions = suggestions().querySelectorAll('[aria-live="polite"]');
    expect(regions.length).toBeGreaterThanOrEqual(2);
    expect(live()).toContain('');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'kinga');
    await waitFor(() => expect(live()).toContain('Risultati: 1 risultato'));
    // Stesso elemento di prima: l'annuncio parte perché la zona esisteva già
    expect(suggestions().querySelectorAll('[aria-live="polite"]')[0]).toBe(regions[0]);
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'zzz');
    await waitFor(() => expect(live()).toContain('Nessun risultato'));
  });

  it('le frecce dicono chi aggiunge Invio', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'a');
    await waitFor(() => expect(suggestions().querySelector('.search-hint')).not.toBeNull());
    await user.keyboard('{ArrowDown}');
    const target = suggestions().querySelector('.search-hint strong')!.textContent;
    expect(live()).toContain(`Invio aggiunge ${target}`);
  });
});

describe('scheda del candidato sul telefono', () => {
  it('apre come una finestra: fuoco dentro, lista inerte, Esc chiude e il fuoco torna sulla carta', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 759px)', media: query, addEventListener() {}, removeEventListener() {} }));
    const user = await setup('Great Tusk');
    const card = suggestions().querySelector<HTMLElement>('.suggestions > li button[aria-pressed]')!;
    await user.click(card);
    const sheet = await screen.findByRole('dialog', { name: /^Dettaglio di / });
    expect(document.activeElement).toBe(sheet);
    expect(suggestions().querySelector('.picker-list')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Torna alla lista' })).not.toHaveAttribute('inert');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Dettaglio di / })).toBeNull());
    expect(suggestions().querySelector('.picker-list')).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(card);
  });

  it('sul computer il dettaglio resta un riquadro accanto alla lista', async () => {
    const user = await setup('Great Tusk');
    await user.click(suggestions().querySelector<HTMLElement>('.suggestions > li button[aria-pressed]')!);
    expect(screen.queryByRole('dialog', { name: /^Dettaglio di / })).toBeNull();
    expect(suggestions().querySelector('.picker-list')).not.toHaveAttribute('inert');
    expect(within(suggestions()).getByRole('complementary', { name: /^Dettaglio di / })).toBeInTheDocument();
  });
});
