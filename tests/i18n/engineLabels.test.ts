import { describe, expect, it } from 'vitest';
import { conditionLabel, conditionName } from '../../src/engine/synergy';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { formatLabel, formatOptions } from '../../src/engine/formats';
import { gradeFor } from '../../src/engine/rating';
import { roleLabel } from '../../src/engine/roles';

describe('etichette del motore', () => {
  it('ruoli', () => {
    expect(roleLabel('removal', 'en')).toBe('Hazard removal');
    expect(roleLabel('removal', 'it')).toBe('Rimozione hazard');
    expect(roleLabel('removal')).toBe('Rimozione hazard');
  });

  it('meteo e campi in frase e nei menu', () => {
    expect(conditionLabel('sun', 'it')).toBe('il sole');
    expect(conditionLabel('sun', 'en')).toBe('sun');
    expect(conditionName('grassyterrain', 'en')).toBe('Grassy Terrain');
    expect(conditionName('grassyterrain', 'it')).toBe('Campo Erboso');
  });

  it('formati e voti', () => {
    expect(formatLabel({ ...DEFAULT_FORMAT, formatId: 'all' }, 'en')).toBe('All Pokémon');
    expect(formatOptions('en').find(o => o.id === 'all')!.label).toBe('All Pokémon (no limits)');
    expect(gradeFor(85, 'en')).toEqual({ grade: 'A', label: 'Great' });
    expect(gradeFor(85, 'it')).toEqual({ grade: 'A', label: 'Ottimo' });
  });
});
