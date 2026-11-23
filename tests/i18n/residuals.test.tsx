import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { initGameNames } from '../../src/i18n/game';
import { KitTipBody } from '../../src/ui/MoveTip';
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
    // Lo strumento sulla carta è solo l'icona: nome e descrizione nel tooltip DreamDex (TipHost)
    fireEvent.mouseOver(slot.querySelector('.held')!);
    await waitFor(() => expect(document.querySelector('.ftip.kit')).toHaveTextContent('Danneggia chi attacca con un contatto.'));
    fireEvent.mouseOut(slot.querySelector('.held')!, { relatedTarget: document.body });
    fireEvent.mouseOver(slot.querySelector('.ability')!);
    await waitFor(() => expect(document.querySelector('.ftip.kit')).toHaveTextContent('Ferisce chi attacca con un contatto.'));
  });
});

describe('tooltip di strumenti e abilità', () => {
  it('testata col nome e il genere; in italiano la descrizione italiana, e se manca quella inglese di Showdown', () => {
    initGameNames(NAMES);
    const helmet = renderIt(<KitTipBody kind="item" name="Rocky Helmet" />);
    expect(helmet.container.querySelector('.tip-title')).toHaveTextContent('Bitorzolelmo');
    expect(helmet.container.querySelector('.tip-kind')).toHaveTextContent('Strumento');
    expect(helmet.container.querySelector('.ktip-desc')).toHaveTextContent('Danneggia chi attacca con un contatto.');
    helmet.unmount();
    // Focus Sash non ha la descrizione italiana: c'è quella inglese di Showdown, piuttosto che niente
    const sash = renderIt(<KitTipBody kind="item" name="Focus Sash" />);
    expect(sash.container.querySelector('.tip-kind')).toHaveTextContent('Strumento');
    expect(sash.container.querySelector('.ktip-desc')).toHaveTextContent(/survive/i);
    sash.unmount();
    const skin = renderIt(<KitTipBody kind="ability" name="Rough Skin" />);
    expect(skin.container.querySelector('.tip-kind')).toHaveTextContent('Abilità');
    expect(skin.container.querySelector('.tip-glyph')).not.toBeNull();
  });

  it('in inglese la descrizione di Showdown', () => {
    const { container } = render(<KitTipBody kind="item" name="Focus Sash" />);
    expect(container.querySelector('.tip-kind')).toHaveTextContent('Item');
    expect(container.querySelector('.ktip-desc')).toHaveTextContent(/survive/i);
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
