import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const suggestions = () => screen.getByRole('region', { name: 'Suggerimenti' });
const team = () => screen.getByRole('region', { name: 'Team' });
const cardNames = () => [...suggestions().querySelectorAll('details.suggestion summary strong')].map(el => el.textContent!.replace(/^\d+\. /, ''));

async function setup(...names: string[]) {
  const user = userEvent.setup();
  render(<App data={fixtureData} />);
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
    await user.click(screen.getByRole('button', { name: 'Azzera filtri' }));
    expect(within(suggestions()).getByText('Filtri')).toBeInTheDocument();
    await waitFor(() => expect(cardNames().length).toBeGreaterThan(2));
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

  it('filtro a tendina: resiste a', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Uso nel meta'), 'common');
    await user.selectOptions(screen.getByLabelText('Resiste a'), 'Ground');
    await waitFor(() => expect([...cardNames()].sort()).toEqual(['Corviknight', 'Rotom-Wash']));
  });

  it('tier: gli Uber compaiono nella ricerca con il tag di ban', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'dragapu');
    await waitFor(() => expect(cardNames()).toEqual(['Dragapult']));
    expect(within(suggestions()).getByText('Uber · bannato in National Dex OU')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Tier'), 'legal');
    expect(await within(suggestions()).findByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('tag del tier anche sui suggerimenti normali', async () => {
    await setup('Great Tusk');
    expect(within(suggestions()).getAllByText('OU').length).toBeGreaterThan(0);
  });

  it('team completo: ricerca nascosta', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash');
    expect(screen.queryByLabelText('Aggiungi Pokémon')).toBeNull();
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
});
