import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

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
    expect(within(suggestions()).getByText('1 risultato')).toBeInTheDocument();
  });

  it('nessun risultato', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'zzzz');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('filtro per tipo, contatore dei filtri attivi e azzeramento', async () => {
    const user = await setup('Great Tusk');
    await user.click(within(screen.getByRole('group', { name: 'Tipo' })).getByRole('button', { name: 'Water' }));
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    await waitFor(() => expect([...cardNames()].sort()).toEqual(['Rotom-Wash', 'Toxapex']));
    expect(within(suggestions()).getByText('Filtri (2 attivi)')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Azzera filtri/ })[0]);
    expect(within(suggestions()).getByText('Filtri')).toBeInTheDocument();
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(2));
  });

  it('"Adatto a": solo Pokémon adatti all\'archetipo scelto, e si azzera con gli altri filtri', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    await user.selectOptions(screen.getByLabelText('Adatto a'), 'stall');
    await waitFor(() => expect(cardNames()).toContain('Toxapex'));
    expect(cardNames()).not.toContain('Iron Valiant');
    expect(within(suggestions()).getByText('Filtri (2 attivi)')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Azzera filtri/ })[0]);
    expect(screen.getByLabelText('Adatto a')).toHaveValue('');
  });

  it('al massimo due tipi: gli altri si disattivano', async () => {
    const user = await setup('Great Tusk');
    const types = within(screen.getByRole('group', { name: 'Tipo' }));
    await user.click(types.getByRole('button', { name: 'Water' }));
    await user.click(types.getByRole('button', { name: 'Poison' }));
    await waitFor(() => expect(cardNames()).toContain('Toxapex'));
    expect(types.getByRole('button', { name: 'Fire' })).toBeDisabled();
    expect(types.getByRole('button', { name: 'Water' })).toBeEnabled();
    await user.click(types.getByRole('button', { name: 'Poison' }));
    expect(types.getByRole('button', { name: 'Fire' })).toBeEnabled();
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

  it('azzera filtri anche a filtri chiusi, dalla riga del titolo', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    const summary = within(suggestions()).getByText('Filtri (1 attivo)', { exact: false }).closest('summary')!;
    await user.click(within(summary).getByRole('button', { name: /Azzera filtri/ }));
    expect(screen.getByLabelText('Uso nel meta')).toHaveValue('all');
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
    expect(suggestions().querySelector('.alert-mark')).toBeNull();
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    const mark = suggestions().querySelector('.alert-mark.danger')!;
    expect(mark).toHaveTextContent('Uber · bannato in National Dex OU');
  });

  it('team completo: la ricerca resta, per cercare tra gli scambi', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash');
    expect(screen.getByLabelText('Aggiungi Pokémon')).toBeInTheDocument();
    expect(within(suggestions()).getByRole('heading', { name: 'Migliora il team' })).toBeInTheDocument();
  });
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

