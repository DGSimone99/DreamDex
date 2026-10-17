import { describe, expect, it } from 'vitest';
import { battleName, battleSpecies } from '../../src/engine/dex';

describe('forme da battaglia attivate da uno strumento', () => {
  it('Zacian con la Rusted Sword e Zamazenta con la Rusted Shield sono le forme Crowned', () => {
    expect(battleName({ species: 'Zacian', item: 'Rusted Sword' })).toBe('Zacian-Crowned');
    expect(battleName({ species: 'Zamazenta', item: 'Rusted Shield' })).toBe('Zamazenta-Crowned');
    expect(battleSpecies({ species: 'Zacian', item: 'Rusted Sword' })!.types).toEqual(['Fairy', 'Steel']);
  });

  it('senza lo strumento giusto restano la forma base', () => {
    expect(battleName({ species: 'Zacian', item: 'Leftovers' })).toBe('Zacian');
    expect(battleName({ species: 'Zamazenta', item: 'Rusted Sword' })).toBe('Zamazenta');
  });

  it('Ogerpon con la maschera resta la sua forma: la forma Tera arriva solo con la Teracristallizzazione', () => {
    expect(battleName({ species: 'Ogerpon-Wellspring', item: 'Wellspring Mask' })).toBe('Ogerpon-Wellspring');
  });

  it('Mega e Primal come prima', () => {
    expect(battleName({ species: 'Groudon', item: 'Red Orb' })).toBe('Groudon-Primal');
    expect(battleName({ species: 'Charizard', item: 'Charizardite Y' })).toBe('Charizard-Mega-Y');
  });
});
