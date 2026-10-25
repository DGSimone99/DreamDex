import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Typed, typeTextColor } from '../../src/ui/TypeText';
import { TYPES } from '../../src/engine/types';

const parts = (text: string) => {
  const { container } = render(<p><Typed text={text} /></p>);
  return {
    mons: [...container.querySelectorAll('.mon-ref')].map(el => el.textContent),
    types: [...container.querySelectorAll('.type-name')].map(el => el.textContent),
    text: container.textContent,
  };
};

describe('testo con tipi e Pokémon', () => {
  it('Pokémon in grassetto, tipi colorati, testo invariato', () => {
    const r = parts('Il sole di Ninetales smorza la debolezza a Water di Ninetales');
    expect(r.mons).toEqual(['Ninetales', 'Ninetales']);
    expect(r.types).toEqual(['Water']);
    expect(r.text).toBe('Il sole di Ninetales smorza la debolezza a Water di Ninetales');
  });

  it('la forma più lunga vince; le forme con un tipo nel nome non sono tipi', () => {
    expect(parts('Mega: Charizard-Mega-Y e Calyrex-Ice').mons).toEqual(['Charizard-Mega-Y', 'Calyrex-Ice']);
    expect(parts('Calyrex-Ice').types).toEqual([]);
    expect(parts('Mr. Mime e Porygon-Z').mons).toEqual(['Mr. Mime', 'Porygon-Z']);
  });

  it('ogni Pokémon nominato ha il pallino del tipo, diviso a metà per i doppi tipi', () => {
    const { container } = render(<p><Typed text="Sinergie: Kyogre-Primal (Primordial Sea) → Swampert-Mega (Swift Swim)" /></p>);
    const refs = [...container.querySelectorAll('.mon-ref')];
    expect(refs.map(r => r.textContent)).toEqual(['Kyogre-Primal', 'Swampert-Mega']);
    const dots = refs.map(r => r.querySelector('.type-dot') as HTMLElement);
    expect(dots[0].title).toBe('Water');
    expect(dots[1].title).toBe('Water / Ground');
  });

  it('parole comuni non diventano Pokémon', () => {
    expect(parts('Ruoli coperti: Hazard, Pivot, Priorità, Controllo velocità').mons).toEqual([]);
  });

  it('il testo di ogni tipo ha contrasto almeno 6:1 sul pannello attuale (#1a1d2a)', () => {
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const panel = lum([0x1a, 0x1d, 0x2a]);
    for (const type of TYPES) {
      const color = typeTextColor(type)!;
      const rgb = color === '#ffffff' ? [255, 255, 255] : color.match(/\d+/g)!.map(Number);
      expect((lum(rgb) + 0.05) / (panel + 0.05), type).toBeGreaterThanOrEqual(6);
    }
  });
});
