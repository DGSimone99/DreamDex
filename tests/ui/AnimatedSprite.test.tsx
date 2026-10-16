import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { Sprite } from '../../src/ui/Sprite';
import { fixtureData } from '../fixtures/data';

const ANI = 'https://play.pokemonshowdown.com/sprites/gen5ani/';
const aniOf = (container: HTMLElement) => container.querySelector<HTMLImageElement>('img.sprite-ani');

afterEach(() => vi.unstubAllGlobals());

describe('sprite animato', () => {
  it('solo se richiesto: idle animato sopra lo statico, che resta finché l\'animato non è caricato', () => {
    const { container, rerender } = render(<Sprite species="Garchomp" />);
    expect(aniOf(container)).toBeNull();
    rerender(<Sprite species="Garchomp" item="Garchompite" animated />);
    expect(aniOf(container)!.src).toBe(`${ANI}garchomp-mega.gif`);
    const still = container.querySelector('img.sprite')!;
    expect(still).not.toHaveClass('covered');
    fireEvent.load(aniOf(container)!);
    expect(still).toHaveClass('covered');
  });

  it('animazione mancante (es. Kingambit): resta lo statico', () => {
    const { container } = render(<Sprite species="Kingambit" animated />);
    fireEvent.error(aniOf(container)!);
    expect(aniOf(container)).toBeNull();
    expect(container.querySelector('img.sprite')).not.toHaveClass('covered');
  });

  it('con "riduci animazioni" del sistema niente idle animato', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<Sprite species="Garchomp" animated />);
    expect(aniOf(container)).toBeNull();
  });
});

describe('nel team', () => {
  it('si anima solo il Pokémon col moveset aperto; chiuso torna statico', async () => {
    const user = userEvent.setup();
    const { container } = render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const team = screen.getByRole('region', { name: 'Team' });
    expect(container.querySelectorAll('img.sprite-ani')).toHaveLength(0);
    await user.click(within(team).getByText('Gholdengo', { selector: '.name' }));
    const animated = container.querySelectorAll<HTMLImageElement>('.slot img.sprite-ani');
    expect(animated).toHaveLength(1);
    expect(animated[0].src).toBe(`${ANI}gholdengo.gif`);
    await user.click(within(team).getByText('Gholdengo', { selector: '.name' }));
    expect(container.querySelectorAll('img.sprite-ani')).toHaveLength(0);
  });
});
