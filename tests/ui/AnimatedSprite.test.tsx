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

  it('lo statico si chiede subito, non in modo pigro (col "lazy" arrivava dopo il resto della pagina)', () => {
    const { container } = render(<Sprite species="Garchomp" />);
    expect(container.querySelector('img.sprite')).not.toHaveAttribute('loading', 'lazy');
  });

  it('animazione che Showdown non ha (es. Kingambit): non la chiede e lo statico "respira"', () => {
    const { container } = render(<Sprite species="Kingambit" animated />);
    expect(aniOf(container)).toBeNull();
    const still = container.querySelector('img.sprite')!;
    expect(still).not.toHaveClass('covered');
    expect(still).toHaveClass('idle');
  });

  it('animazione che non arriva: resta lo statico, che "respira"', () => {
    const { container } = render(<Sprite species="Garchomp" animated />);
    fireEvent.error(aniOf(container)!);
    expect(aniOf(container)).toBeNull();
    expect(container.querySelector('img.sprite')).not.toHaveClass('covered');
    expect(container.querySelector('img.sprite')).toHaveClass('idle');
  });

  it('la GIF arriva in dissolvenza e sa già quanto è alta (dalla tabella)', () => {
    const { container } = render(<Sprite species="Garchomp" animated />);
    const gif = aniOf(container)!;
    expect(gif).not.toHaveClass('ready');
    expect(gif.style.getPropertyValue('--ani-h')).not.toBe('');
    fireEvent.load(gif);
    expect(gif).toHaveClass('ready');
  });

  it('con "riduci animazioni" del sistema niente idle animato', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
    const { container } = render(<Sprite species="Garchomp" animated />);
    expect(aniOf(container)).toBeNull();
    expect(container.querySelector('img.sprite')).not.toHaveClass('idle');
  });
});

describe('nel team', () => {
  it('si anima solo il Pokémon col moveset aperto; chiuso torna statico', async () => {
    const user = userEvent.setup();
    const { container } = render(<App data={fixtureData} initialLang="it" />);
    for (const name of ['Great Tusk', 'Gholdengo']) await user.type(screen.getByLabelText('Aggiungi Pokémon'), `${name}{Enter}`);
    const team = screen.getByRole('region', { name: 'Team' });
    expect(container.querySelectorAll('.slot img.sprite-ani')).toHaveLength(0);
    await user.click(within(team).getByText('Gholdengo', { selector: '.name' }));
    const animated = container.querySelectorAll<HTMLImageElement>('.slot img.sprite-ani');
    expect(animated).toHaveLength(1);
    expect(animated[0].src).toBe(`${ANI}gholdengo.gif`);
    await user.click(within(team).getByText('Gholdengo', { selector: '.name' }));
    expect(container.querySelectorAll('.slot img.sprite-ani')).toHaveLength(0);
  });
});
