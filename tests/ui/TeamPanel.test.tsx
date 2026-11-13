import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet } from '../../src/engine/sets';
import { encodeShare } from '../../src/share';
import { App } from '../../src/App';
import { chooseGen } from '../helpers/format';
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

  it('solo il primo slot libero ha la scritta: gli altri sono cornici tenui, con lo stesso nome per i lettori di schermo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    const check = (free: number) => {
      const slots = within(teamRegion()).getAllByRole('button', { name: 'Aggiungi un Pokémon' });
      expect(slots).toHaveLength(free);
      expect(slots[0]).not.toHaveClass('quiet');
      expect(slots[0]).toHaveTextContent('Aggiungi un Pokémon');
      for (const slot of slots.slice(1)) {
        expect(slot).toHaveClass('quiet');
        expect(slot).toHaveTextContent('');
      }
    };
    check(6);
    await addPokemon(user, 'Great Tusk');
    check(5);
  });

  it('la carta mostra solo il ruolo principale per esteso, con tutti i ruoli nel tooltip', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    const roles = teamRegion().querySelector('.slot .roles')!;
    expect(roles.textContent).toMatch(/^(Sweeper Fisico|Wallbreaker Fisico|Muro Fisico)$/);
    // Il ruolo mostrato spiegato in una frase, poi gli altri per nome
    expect(roles.getAttribute('title')).toMatch(/^(Sweeper Fisico|Wallbreaker Fisico|Muro Fisico): [^·]+ · /);
  });

  it('la carta non ha il badge Stats e mostra lo strumento come icona prima del nome (nome nel tooltip)', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    const card = teamRegion().querySelector('.slot > .slot-card')!;
    expect(card.querySelector('.stats-badge')).toBeNull();
    const held = card.querySelector('.name-line .held')!;
    expect(held.querySelector('.item-icon')).not.toBeNull();
    expect(held.getAttribute('title')).toMatch(/^Booster Energy/);
    expect(held).toHaveTextContent('Booster Energy');
    expect(held.compareDocumentPosition(card.querySelector('.name')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('chi porta il meteo: sulla carta il ruolo principale, il meteo nel tooltip dei ruoli', () => {
    const pelipper = { ...emptySet('Pelipper'), item: 'Damp Rock', ability: 'Drizzle', moves: ['Hurricane', 'Scald', 'U-turn', 'Roost'] };
    window.history.replaceState(null, '', `/#team=${encodeShare([pelipper], DEFAULT_FORMAT)}`);
    render(<App initialLang="it" data={fixtureData} />);
    const roles = teamRegion().querySelector('.slot .roles')!;
    // Ruoli misurati come nel voto: il principale non è mai il Recupero; il meteo e il resto nel tooltip
    expect(roles.textContent).not.toContain(' · ');
    expect(roles.textContent).not.toBe('Recupero');
    const all = roles.getAttribute('title')!.split(' · ');
    expect(all[1]).toMatch(/^Porta la pioggia \(.+\)$/);
    expect(all).toEqual(expect.arrayContaining(['Pivot', 'Recupero']));
  });

  it('il tooltip dei ruoli elenca tutti i ruoli, non solo i due mostrati', () => {
    // Calibrazione (Task 9): Latias-Mega veloce con Calm Mind è uno sweeper (una sola etichetta); Defog dà la seconda
    const latias = { ...emptySet('Latias'), item: 'Latiasite', ability: 'Levitate', moves: ['Calm Mind', 'Mystical Fire', 'Mist Ball', 'Defog'] };
    window.history.replaceState(null, '', `/#team=${encodeShare([latias], DEFAULT_FORMAT)}`);
    render(<App initialLang="it" data={fixtureData} />);
    const roles = teamRegion().querySelector('.slot .roles')!;
    expect(roles.textContent!.split(' · ')).toHaveLength(1);
    const all = roles.getAttribute('title')!.split(' · ').map(part => part.split(': ')[0]);
    expect(all.length).toBeGreaterThan(2);
    expect(all.slice(0, 2)).toEqual(['Sweeper Speciale', 'Controllo Hazard']);
    expect(all).toEqual(expect.arrayContaining(['Muro Speciale']));
    expect(new Set(all).size).toBe(all.length);
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
    await user.tab();
    expect(within(teamRegion()).getByLabelText('Mossa 4')).toHaveValue('Stealth Rock');
  });

  it('mostra i tipi della forma Mega se tiene la pietra', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Lopunny');
    const item = within(teamRegion()).getByLabelText('Strumento');
    await user.clear(item);
    await user.type(item, 'Lopunnite');
    await user.tab();
    expect([...teamRegion().querySelectorAll('.slot .slot-card .types .type-chip')].map(chip => chip.textContent)).toEqual(['Normal', 'Fighting']);
  });

  it('segnala un membro oltre il limite di generazione senza rimuoverlo', async () => {
    const user = userEvent.setup();
    render(<App initialLang="it" data={fixtureData} />);
    await addPokemon(user, 'Great Tusk');
    await chooseGen(user, '4');
    expect(within(teamRegion()).getByText('Oltre la Gen 4')).toBeInTheDocument();
    expect(within(teamRegion()).getByText('Great Tusk')).toBeInTheDocument();
  });
});
