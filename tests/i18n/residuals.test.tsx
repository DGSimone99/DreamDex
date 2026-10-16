import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { initGameNames } from '../../src/i18n/game';
import { Typed } from '../../src/ui/TypeText';
import { renderIt } from '../helpers/italian';
import { fixtureData } from '../fixtures/data';

afterEach(() => initGameNames(null));

const NAMES = {
  moves: { firepunch: { name: 'Pugno Fuoco' } },
  abilities: { roughskin: { name: 'Cartavetro', desc: 'Ferisce chi attacca con un contatto.' } },
  items: { rockyhelmet: { name: 'Bitorzolelmo', desc: 'Danneggia chi attacca con un contatto.' } },
  types: { fire: 'Fuoco' }, natures: {},
};

describe('tipi nei testi in italiano', () => {
  it('un nome di mossa che contiene un tipo resta intero; il tipo da solo si colora', () => {
    initGameNames(NAMES);
    const { container } = renderIt(<Typed text="Pugno Fuoco è superefficace contro Fuoco" />);
    const colored = [...container.querySelectorAll('.type-name')].map(e => e.textContent);
    expect(colored).toEqual(['Fuoco']);
    expect(container).toHaveTextContent('Pugno Fuoco è superefficace contro Fuoco');
  });
});

describe('tooltip della card', () => {
  it('strumento e abilità con la descrizione nella lingua scelta', async () => {
    initGameNames(NAMES);
    const user = userEvent.setup();
    render(<App data={fixtureData} initialLang="it" />);
    await user.click(screen.getByLabelText('Testo Showdown'));
    await user.paste('Garchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake');
    await user.click(screen.getByRole('button', { name: 'Importa' }));
    const slot = screen.getByRole('region', { name: 'Team' }).querySelector('.slot')!;
    expect(slot.querySelector('.held')).toHaveAttribute('title', 'Danneggia chi attacca con un contatto.');
    expect(slot.querySelector('.ability')).toHaveAttribute('title', 'Ferisce chi attacca con un contatto.');
  });
});

describe('nomi italiani caricati solo quando servono', () => {
  it('in inglese non si caricano; passando a IT si caricano una volta e poi cambia lingua', async () => {
    const user = userEvent.setup();
    const loadNames = vi.fn(async () => initGameNames(NAMES));
    render(<App data={fixtureData} initialLang="en" loadNames={loadNames} />);
    expect(loadNames).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'IT' }));
    expect(loadNames).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('Aggiungi Pokémon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'EN' }));
    await user.click(screen.getByRole('button', { name: 'IT' }));
    expect(loadNames).toHaveBeenCalledTimes(1);
  });
});
