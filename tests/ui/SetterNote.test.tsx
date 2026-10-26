import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import type { EngineData } from '../../src/engine/data';
import type { SpeciesStats } from '../../src/engine/stats';

const entry = (usage: number, ability: string, moves: string[]): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: {}, teraTypes: {}, spreads: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), teammates: {}, checks: {},
});
const data = (withTorkoal: boolean): EngineData => ({
  stats: {
    meta: { month: '2026-09', cutoff: 1630, battles: 1 },
    pokemon: {
      ...(withTorkoal ? { Torkoal: entry(0.04, 'drought', ['lavaplume']) } : {}),
      Garchomp: entry(0.13, 'roughskin', ['earthquake']),
    },
  },
  sets: {},
});

async function replaceNinetales(withTorkoal: boolean) {
  const user = userEvent.setup();
  render(<App initialLang="it" data={data(withTorkoal)} />);
  await user.selectOptions(screen.getByLabelText('Uso minimo'), '0');
  await user.click(screen.getByLabelText('Testo Showdown'));
  await user.paste('Ninetales\nAbility: Drought\n- Flamethrower\n\nLeafeon\nAbility: Chlorophyll\n- Leaf Blade');
  await user.click(screen.getByRole('button', { name: 'Importa' }));
  await user.click(screen.getByRole('button', { name: 'Sostituisci Ninetales' }));
  return screen.getByRole('region', { name: 'Suggerimenti' });
}

describe('nota sul weather setter in sostituzione', () => {
  it('mostra solo chi porta la stessa condizione', async () => {
    const panel = await replaceNinetales(true);
    expect(within(panel).getByText('In cima chi porta il sole: Leafeon ne ha bisogno. Gli altri seguono per voto')).toBeInTheDocument();
  });

  it('avvisa se nessuno porta la condizione', async () => {
    const panel = await replaceNinetales(false);
    expect(within(panel).getByText('Nessun altro Pokémon porta il sole: se sostituisci Ninetales, Leafeon perde Chlorophyll')).toBeInTheDocument();
  });
});
