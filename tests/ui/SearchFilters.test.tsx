import { render, screen, within } from '@testing-library/react';
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
    expect(cardNames()).toEqual(['Kingambit']);
    expect(within(suggestions()).getByText('1 risultato')).toBeInTheDocument();
  });

  it('nessun risultato', async () => {
    const user = await setup('Great Tusk');
    await user.type(screen.getByLabelText('Aggiungi Pokémon'), 'zzzz');
    expect(within(suggestions()).getByText('Nessun Pokémon corrisponde ai filtri')).toBeInTheDocument();
  });

  it('filtro per tipo, contatore dei filtri attivi e azzeramento', async () => {
    const user = await setup('Great Tusk');
    await user.click(within(screen.getByRole('group', { name: 'Tipo' })).getByRole('button', { name: 'Water' }));
    expect([...cardNames()].sort()).toEqual(['Rotom-Wash', 'Toxapex']);
    expect(within(suggestions()).getByText('Filtri (1 attivo)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Azzera filtri' }));
    expect(within(suggestions()).getByText('Filtri')).toBeInTheDocument();
    expect(cardNames().length).toBeGreaterThan(2);
  });

  it('al massimo due tipi: gli altri si disattivano', async () => {
    const user = await setup('Great Tusk');
    const types = within(screen.getByRole('group', { name: 'Tipo' }));
    await user.click(types.getByRole('button', { name: 'Water' }));
    await user.click(types.getByRole('button', { name: 'Poison' }));
    expect(cardNames()).toEqual(['Toxapex']);
    expect(types.getByRole('button', { name: 'Fire' })).toBeDisabled();
    expect(types.getByRole('button', { name: 'Water' })).toBeEnabled();
    await user.click(types.getByRole('button', { name: 'Poison' }));
    expect(types.getByRole('button', { name: 'Fire' })).toBeEnabled();
  });

  it('filtro a tendina: resiste a', async () => {
    const user = await setup('Great Tusk');
    await user.selectOptions(screen.getByLabelText('Resiste a'), 'Ground');
    expect([...cardNames()].sort()).toEqual(['Corviknight', 'Rotom-Wash']);
  });

  it('team completo: ricerca nascosta', async () => {
    await setup('Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash');
    expect(screen.queryByLabelText('Aggiungi Pokémon')).toBeNull();
  });
});
