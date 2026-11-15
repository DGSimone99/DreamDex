import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initGameNames } from '../../src/i18n/game';
import { emptySet } from '../../src/engine/sets';
import { t as translate, type MessageKey } from '../../src/i18n';
import { moveEffects } from '../../src/ui/offense/moveEffects';

const t = (key: MessageKey, vars?: Record<string, string | number>) => translate('it', key, vars);
const set = (species: string, ability: string, moves: string[], item = '') => ({ ...emptySet(species), ability, item, moves });

describe('effetti di danza e meteo/campo legati alla mossa (tooltip delle Coverage)', () => {
  // I nomi italiani dei tipi (nell'app arrivano coi dati del gioco)
  beforeAll(() => initGameNames({ moves: {}, abilities: {}, items: {}, natures: {}, types: { fire: 'Fuoco', water: 'Acqua' } }));
  afterAll(() => initGameNames(null));

  it('la danza dice solo la statistica che la mossa usa', () => {
    const lucario = set('Lucario', 'Inner Focus', ['Swords Dance', 'Close Combat', 'Aura Sphere']);
    expect(moveEffects(lucario, 'Close Combat', { boosts: { atk: 2 } }, t, 'it')).toBe('Att ×2');
    // Danzaspada non serve ad Aura Sfera, speciale
    expect(moveEffects(lucario, 'Aura Sphere', { boosts: { atk: 2 } }, t, 'it')).toBe('');
    const gardevoir = set('Gardevoir', 'Trace', ['Calm Mind', 'Mystical Fire']);
    expect(moveEffects(gardevoir, 'Mystical Fire', { boosts: { spa: 1, spd: 1 }, conditions: ['sun'] }, t, 'it')).toBe('AttSp ×1,5 · Fuoco ×1,5');
  });

  it('il meteo del team dice cosa fa a quella mossa', () => {
    const sceptile = set('Sceptile', 'Overgrow', ['Solar Blade', 'Earthquake']);
    expect(moveEffects(sceptile, 'Solar Blade', { conditions: ['sun'] }, t, 'it')).toBe('Senza carica');
    // Il sole non alza una mossa Terra
    expect(moveEffects(sceptile, 'Earthquake', { conditions: ['sun'] }, t, 'it')).toBe('');
    const pelipper = set('Pelipper', 'Keen Eye', ['Hurricane', 'Surf']);
    expect(moveEffects(pelipper, 'Hurricane', { conditions: ['rain'] }, t, 'it')).toBe('Sempre a segno');
    expect(moveEffects(pelipper, 'Surf', { conditions: ['rain'] }, t, 'it')).toBe('Acqua ×1,5');
  });

  it('le abilità di chi attacca accese dal campo del compagno; col Booster Energy già accese', () => {
    const tusk = set('Great Tusk', 'Protosynthesis', ['Headlong Rush']);
    expect(moveEffects(tusk, 'Headlong Rush', { conditions: ['sun'] }, t, 'it')).toContain('×1,3');
    expect(moveEffects({ ...tusk, item: 'Booster Energy' }, 'Headlong Rush', { conditions: ['sun'] }, t, 'it')).toBe('');
  });
});
