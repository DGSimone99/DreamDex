import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { fixtureData } from '../fixtures/data';

const teamRegion = () => screen.getByRole('region', { name: 'Team' });

afterEach(() => window.history.replaceState(null, '', '/'));

async function addPokemon(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
}

describe('TeamPanel', () => {
  it('aggiunge un Pokémon dalla ricerca con il set più comune', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    expect(within(teamRegion()).getByText('Great Tusk')).toBeInTheDocument();
    expect(within(teamRegion()).getByRole('heading', { name: 'Team (1/6)' })).toBeInTheDocument();
    expect(within(teamRegion()).getByLabelText('Strumento')).toHaveValue('Booster Energy');
  });

  it('la carta mostra il ruolo principale e un supporto affiancati, brevi, con i nomi completi nel tooltip', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    const roles = teamRegion().querySelector('.slot .roles')!;
    const [main, support] = roles.textContent!.split(' · ');
    expect(main).toMatch(/^(Sweeper fis\.|Wallbreaker|Wall fis\.)$/);
    expect(support).toBeTruthy();
    expect(roles.getAttribute('title')).toMatch(/^(Sweeper fisico|Wallbreaker|Wall fisico) · /);
  });

  it('chi porta il meteo mostra "Meteo" sulla carta, con il meteo nel tooltip', () => {
    const pelipper = { ...emptySet('Pelipper'), item: 'Damp Rock', ability: 'Drizzle', moves: ['Hurricane', 'Scald', 'U-turn', 'Roost'] };
    window.history.replaceState(null, '', `/#team=${encodeShare([pelipper], DEFAULT_FORMAT)}`);
    render(<App initialLang="it" data={fixtureData} />);
    const roles = teamRegion().querySelector('.slot .roles')!;
    expect(roles.textContent).toBe('Meteo · Pivot');
    expect(roles.getAttribute('title')).toMatch(/^Porta la pioggia \(.+\) · Pivot$/);
  });

  it('ignora nomi inesistenti', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Nonesiste');
    expect(within(teamRegion()).getByRole('heading', { name: 'Team (0/6)' })).toBeInTheDocument();
  });

  it('rimuove un membro', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    await user.click(screen.getByRole('button', { name: 'Rimuovi Great Tusk' }));
    expect(within(teamRegion()).queryByText('Great Tusk')).toBeNull();
  });

  it('modifica una mossa', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    const move = within(teamRegion()).getByLabelText('Mossa 4');
    await user.clear(move);
    await user.type(move, 'Stealth Rock');
    expect(within(teamRegion()).getByLabelText('Mossa 4')).toHaveValue('Stealth Rock');
  });

  it('mostra i tipi della forma Mega se tiene la pietra', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Lopunny');
    const item = within(teamRegion()).getByLabelText('Strumento');
    await user.clear(item);
    await user.type(item, 'Lopunnite');
    expect([...teamRegion().querySelectorAll('.slot summary .types .type-chip')].map(chip => chip.textContent)).toEqual(['Normal', 'Fighting']);
  });

  it('segnala un membro oltre il limite di generazione senza rimuoverlo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    await user.selectOptions(screen.getByLabelText('Generazione massima'), '4');
    expect(within(teamRegion()).getByText('Oltre la Gen 4')).toBeInTheDocument();
    expect(within(teamRegion()).getByText('Great Tusk')).toBeInTheDocument();
  });
});
