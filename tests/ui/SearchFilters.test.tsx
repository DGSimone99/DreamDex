import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';
import { getSpecies } from '../../src/engine/dex';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const cardNames = () => [...suggestions().querySelectorAll('.suggestions .name-line strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={fixtureData} />);
  for (const name of names) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
  return user;
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
    await user.selectOptions(screen.getByLabelText('Tipo 1'), 'Water');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    await waitFor(() => expect([...cardNames()].sort()).toEqual(['Rotom-Wash', 'Toxapex']));
    expect(within(suggestions()).getByText('Filtri (2 attivi)')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Azzera filtri/ })[0]);
    expect(within(suggestions()).getByText('Filtri')).toBeInTheDocument();
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(2));
  });

  it('Solo preferiti: conta come filtro; senza preferiti non trova niente', async () => {
    const user = await setup('Great Tusk');
    await user.click(screen.getByRole('checkbox', { name: 'Solo preferiti' }));
    expect(within(suggestions()).getByText('Filtri (1 attivo)')).toBeInTheDocument();
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('Mono si sceglie solo dopo il Tipo 1', async () => {
    const user = await setup('Great Tusk');
    expect(screen.getByRole('option', { name: 'Solo monotipo' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Tipo 1'), 'Water');
    expect(screen.getByRole('option', { name: 'Solo monotipo' })).toBeEnabled();
  });

  it('Tipo 1 + Mono: solo monotipo', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Tipo 1'), 'Water');
    await user.selectOptions(screen.getByLabelText('Tipo 2'), 'mono');
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(0));
    await waitFor(() => expect(cardNames().every(name => getSpecies(name)?.types.length === 1)).toBe(true));
    expect(cardNames()).not.toContain('Toxapex');
  });

  it('stesso tipo nelle due tendine: solo monotipo di quel tipo', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Tipo 1'), 'Fire');
    await user.selectOptions(screen.getByLabelText('Tipo 2'), 'Fire');
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(0));
    await waitFor(() => expect(cardNames().every(name => getSpecies(name)?.types.join() === 'Fire')).toBe(true));
  });

  it('resiste a: più tipi, devono essere tutti resistiti', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    const resists = within(screen.getByRole('group', { name: 'Resiste a' }));
    await user.click(resists.getByRole('button', { name: 'Ground' }));
    await waitFor(() => expect([...cardNames()].sort()).toEqual(['Corviknight', 'Rotom-Wash']));
    await user.click(resists.getByRole('button', { name: 'Fire' }));
    await waitFor(() => expect(cardNames()).toEqual(['Rotom-Wash']));
    expect(within(suggestions()).getByText('Filtri (2 attivi)')).toBeInTheDocument();
  });

  it('leggendari e misteriosi in un solo filtro, niente "Fino alla gen"', async () => {
    await setup('Great Tusk');
    expect(within(screen.getByRole('group', { name: 'Leggendari e Misteriosi' })).getByRole('button', { name: 'Tutti' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Fino alla gen')).toBeNull();
  });

  it('filtri attivi come chip: la × ne toglie uno, anche a pannello chiuso', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    expect(suggestions().querySelector('details.filters')).not.toHaveAttribute('open');
    await user.click(within(suggestions()).getByRole('button', { name: /^Rimuovi filtro Uso nel meta/ }));
    expect(screen.getByLabelText('Uso nel meta')).toHaveValue('all');
    expect(within(suggestions()).queryByRole('button', { name: /^Rimuovi filtro/ })).toBeNull();
  });

  it('con filtri attivi il numero di risultati si vede una volta sola, nella fascia "Candidati (N)"', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    await waitFor(() => expect(within(suggestions()).getByRole('heading', { name: /^Candidati \(\d+\)$/ })).toBeInTheDocument());
    expect(suggestions().querySelector('.active-filters')).not.toHaveTextContent(/risultat[oi]/);
  });

  it('chip e Azzera con lista vuota', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tier' }), 'legal');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
    await user.click(within(suggestions().querySelector<HTMLElement>('.active-filters')!).getByRole('button', { name: 'Azzera filtri' }));
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
  });

  it('tier: gli Uber compaiono nella ricerca con il tag di ban', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    // Il triangolo sta sulla riga e nel dettaglio
    expect(within(suggestions().querySelector<HTMLElement>('.suggestions')!).getByText('Uber · bannato in National Dex OU')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Dettaglio di Dragapult' })).getByText('Uber · bannato in National Dex OU')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tier' }), 'legal');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
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
  }, 30000);
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

