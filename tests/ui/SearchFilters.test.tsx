import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { getSpecies } from '../../src/engine/dex';

// File lento (calcola le proposte o monta l'App intera): sotto il carico della suite completa supera i 15 s del default
vi.setConfig({ testTimeout: 60000 });

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const cardNames = () => [...suggestions().querySelectorAll('.suggestions .name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
}

/** Apre la finestra dei filtri dal pulsante nella barra (le scelte valgono subito). */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(suggestions()).getByRole('button', { name: /^Filtri/ }));
  return screen.getByRole('dialog', { name: 'Filtri' });
}
/** Accende una tessera di un gruppo della finestra (tipi, ruoli, tier, uso…). */
async function pick(user: ReturnType<typeof userEvent.setup>, group: string, name: string) {
  await user.click(within(screen.getByRole('group', { name: group })).getByRole('button', { name }));
}

/** Sceglie il tipo in una casella del tipo del Pokémon (Tipo 1 o Tipo 2): apre la tendina e clicca il tipo. */
async function pickSlot(user: ReturnType<typeof userEvent.setup>, slot: 'Tipo 1' | 'Tipo 2', type: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${slot}:`) }));
  await pick(user, slot, type);
}

describe('ricerca e filtri nei suggerimenti', () => {
  it('la ricerca sta nei suggerimenti, non più nel team', async () => {
    await setup();
    expect(within(suggestions()).getByLabelText('Aggiungi Pokémon')).toBeInTheDocument();
    expect(within(team()).queryByLabelText('Aggiungi Pokémon')).toBeNull();
  });

  it('scrivere restringe la lista, ordinata per adattamento', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'kinga');
    await waitFor(() => expect(cardNames()).toEqual(['Kingambit']));
    // Il numero una volta sola, nella fascia della lista (e per i lettori di schermo)
    expect(within(suggestions()).getByRole('heading', { name: 'Candidati (1)' })).toBeInTheDocument();
    expect(within(suggestions()).getByText('Risultati: 1 risultato')).toBeInTheDocument();
  });

  it('nessun risultato', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'zzzz');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('filtro per tipo, contatore dei filtri attivi e azzeramento', async () => {
    const user = await setup('Great Tusk');
    const dialog = await openFilters(user);
    await pickSlot(user, 'Tipo 1', 'Water');
    await pick(user, 'Resiste a', 'Fire');
    await pick(user, 'Resiste a', 'Ground');
    await waitFor(() => expect(cardNames()).toContain('Rotom-Wash'));
    await waitFor(() => expect(cardNames().every(name => getSpecies(name)?.types.includes('Water'))).toBe(true));
    expect(within(suggestions()).getByText('Filtri (2 attivi)')).toBeInTheDocument();
    expect(within(dialog).getByText('2 attivi')).toBeInTheDocument();
    // Il piede dice quanti Pokémon restano e chiude la finestra
    await user.click(within(dialog).getByRole('button', { name: /^Mostra \d+ Pokémon$/ }));
    expect(screen.queryByRole('dialog', { name: 'Filtri' })).toBeNull();
    await openFilters(user);
    await user.click(within(screen.getByRole('dialog', { name: 'Filtri' })).getByRole('button', { name: /Azzera filtri/ }));
    expect(within(suggestions()).getByText('Filtri')).toBeInTheDocument();
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(2));
  });

  it('Solo preferiti: conta come filtro; senza preferiti non trova niente', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    await user.click(screen.getByRole('checkbox', { name: 'Solo preferiti' }));
    expect(within(suggestions()).getByText('Filtri (1 attivo)')).toBeInTheDocument();
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('tipo del Pokémon: due caselle; Tipo 2 dopo il Tipo 1, Solo monotipo solo con un tipo', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    expect(screen.getByRole('button', { name: 'Tipo 2: Qualsiasi' })).toBeDisabled();
    await pickSlot(user, 'Tipo 1', 'Water');
    expect(screen.getByRole('button', { name: 'Tipo 1: Water' })).toBeInTheDocument();
    // Nella tendina del Tipo 2 il tipo già scelto è spento
    await user.click(screen.getByRole('button', { name: 'Tipo 2: Qualsiasi' }));
    expect(within(screen.getByRole('group', { name: 'Tipo 2' })).getByRole('button', { name: 'Water' })).toBeDisabled();
    await pick(user, 'Tipo 2', 'Poison');
    expect(screen.getByRole('checkbox', { name: 'Solo monotipo' })).toBeDisabled();
    await waitFor(() => expect(cardNames()).toContain('Toxapex'));
    // Svuotando il Tipo 1 il Tipo 2 sale al suo posto
    await user.click(screen.getByRole('button', { name: 'Tipo 1: Water' }));
    await user.click(within(screen.getByRole('group', { name: 'Tipo 1' }).parentElement!).getByRole('button', { name: 'Qualsiasi' }));
    expect(screen.getByRole('button', { name: 'Tipo 1: Poison' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Solo monotipo' })).toBeEnabled();
  });

  it('un tipo + Solo monotipo: solo monotipo di quel tipo', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    await pickSlot(user, 'Tipo 1', 'Water');
    await user.click(screen.getByRole('checkbox', { name: 'Solo monotipo' }));
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(0));
    await waitFor(() => expect(cardNames().every(name => getSpecies(name)?.types.join() === 'Water')).toBe(true));
    expect(cardNames()).not.toContain('Toxapex');
  });

  it('resiste a: più tipi, devono essere tutti resistiti', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    const resists = within(screen.getByRole('group', { name: 'Resiste a' }));
    await user.click(resists.getByRole('button', { name: 'Ground' }));
    await waitFor(() => expect(cardNames()).toContain('Corviknight'));
    await user.click(resists.getByRole('button', { name: 'Fire' }));
    await waitFor(() => expect(cardNames()).not.toContain('Corviknight'));
    expect(within(suggestions()).getByText('Filtri (1 attivo)')).toBeInTheDocument();
  });

  it('niente Mega, Leggendari né "Fino alla gen" fra i filtri; Solo preferiti in alto', async () => {
    const user = await setup('Great Tusk');
    const dialog = await openFilters(user);
    expect(screen.queryByRole('group', { name: 'Leggendari e Misteriosi' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Mega' })).toBeNull();
    expect(screen.queryByLabelText('Fino alla gen')).toBeNull();
    expect(within(dialog.querySelector<HTMLElement>('.filters-head')!).getByRole('checkbox', { name: 'Solo preferiti' })).toBeInTheDocument();
  });

  it('filtri attivi come chip: la × ne toglie uno, anche a pannello chiuso', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    await pick(user, 'Ruolo', 'Hazard');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filtri' })).toBeNull();
    await user.click(within(suggestions()).getByRole('button', { name: /^Rimuovi filtro Ruolo/ }));
    await openFilters(user);
    expect(within(screen.getByRole('group', { name: 'Ruolo' })).getByRole('button', { name: 'Hazard' })).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard('{Escape}');
    expect(within(suggestions()).queryByRole('button', { name: /^Rimuovi filtro/ })).toBeNull();
  });

  it('con filtri attivi il numero di risultati si vede una volta sola, nella fascia "Candidati (N)"', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    await pick(user, 'Ruolo', 'Hazard');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(within(suggestions()).getByRole('heading', { name: /^Candidati \(\d+\)$/ })).toBeInTheDocument());
    expect(suggestions().querySelector('.active-filters')).not.toHaveTextContent(/risultat[oi]/);
  });

  it('chip e Azzera con lista vuota', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    await pickSlot(user, 'Tipo 1', 'Fire');
    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
    await user.click(within(suggestions().querySelector<HTMLElement>('.active-filters')!).getByRole('button', { name: 'Azzera filtri' }));
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
  });

  it('gli Uber compaiono nella ricerca con il tag di ban', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    // Il triangolo sta sulla riga e nel dettaglio
    expect(within(suggestions().querySelector<HTMLElement>('.suggestions')!).getByText('Uber · bannato in National Dex OU')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Dettaglio di Dragapult' })).getByText('Uber · bannato in National Dex OU')).toBeInTheDocument();
  });

  it('niente Tier né Uso nel meta fra i filtri', async () => {
    const user = await setup('Great Tusk');
    await openFilters(user);
    expect(screen.queryByRole('group', { name: 'Tier' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Uso nel meta' })).toBeNull();
  });

  it('niente badge del tier: solo il triangolo rosso per chi è bannato', async () => {
    const user = await setup('Great Tusk');
    expect(suggestions().querySelector('.tag.tier')).toBeNull();
    expect(suggestions().querySelector('.alert-mark.danger')).toBeNull();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    const mark = suggestions().querySelector('.alert-mark.danger')!;
    expect(mark).toHaveTextContent('Uber · bannato in National Dex OU');
  });

  it('team completo: la ricerca resta, per cercare tra gli scambi', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash');
    expect(screen.getByLabelText('Aggiungi Pokémon')).toBeInTheDocument();
    expect(within(suggestions()).queryByRole('heading', { name: 'Migliora il team' })).toBeNull();
    // Sei aggiunte, ognuna coi suggerimenti ricalcolati: con la Difesa ogni candidato nuovo costa qualche ms in più
  }, 60000);
});

describe('ricerca: Invio aggiunge il primo risultato', () => {
  it('nome parziale + Invio aggiunge la riga dorata; Esc svuota', async () => {
    const user = await setup('Great Tusk');
    const search = screen.getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'kinga');
    await waitFor(() => expect(cardNames()).toEqual(['Kingambit']));
    expect(within(suggestions()).getByText('Kingambit', { selector: '.search-hint strong' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(within(team()).getByText('Kingambit')).toBeInTheDocument();
    expect(search).toHaveValue('');

    await user.type(search, 'zzz');
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
  });

  it('nessun menu a tendina sul campo di ricerca', async () => {
    await setup();
    expect(screen.getByLabelText('Aggiungi Pokémon')).not.toHaveAttribute('list');
  });

  it('frecce su/giù cambiano il risultato scelto; Invio aggiunge quello', async () => {
    const user = await setup('Great Tusk');
    const search = screen.getByLabelText('Aggiungi Pokémon');
    await user.type(search, 'a');
    // La lista filtrata è pronta quando compare il suggerimento nel campo
    await waitFor(() => expect(suggestions().querySelector('.search-hint')).not.toBeNull());
    const names = cardNames();
    expect(names.length).toBeGreaterThan(2);
    const hint = () => suggestions().querySelector('.search-hint strong')!.textContent;
    const picked = () => suggestions().querySelector('li.picked .name-line strong')!.textContent!.replace(/^\d+\. /, '');
    expect(hint()).toBe(names[0]);
    expect(picked()).toBe(names[0]);

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(hint()).toBe(names[2]);
    expect(picked()).toBe(names[2]);
    await user.keyboard('{ArrowUp}');
    expect(hint()).toBe(names[1]);

    await user.keyboard('{Enter}');
    expect(within(team()).getByText(names[1])).toBeInTheDocument();
  });
});

