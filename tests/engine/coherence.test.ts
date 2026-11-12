import { describe, expect, it } from 'vitest';
import { coherenceGaps, contradictorySet } from '../../src/engine/coherence';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { emptySet, type TeamSet } from '../../src/engine/sets';

const mk = (species: string, moves: string[], item = '', ability = ''): TeamSet =>
  ({ ...emptySet(species), moves, item, ability });

// Tre deboli al Ghiaccio (Garchomp, Landorus-Therian, Dragonite), nessuno lo resiste
const iceWeak = (): TeamSet[] => [
  mk('Garchomp', ['Stealth Rock', 'Earthquake', 'Outrage', 'Swords Dance']),
  mk('Landorus-Therian', ['Earthquake', 'U-turn', 'Stone Edge', 'Knock Off']),
  mk('Dragonite', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost']),
];

describe('coherenceGaps', () => {
  it('con meno di 6 membri non dice nulla', () => {
    expect(coherenceGaps(iceWeak(), DEFAULT_RULES)).toEqual([]);
  });

  it('manca chi toglie le trappole', () => {
    const team = [
      ...iceWeak(),
      mk('Corviknight', ['Brave Bird', 'Roost', 'U-turn', 'Body Press']),
      mk('Toxapex', ['Recover', 'Toxic', 'Haze', 'Scald']),
      mk('Empoleon', ['Surf', 'Flip Turn', 'Roost', 'Stealth Rock']),
    ];
    expect(coherenceGaps(team, DEFAULT_RULES)).toEqual([{ kind: 'removal' }]);
  });

  it('trappole e Defog presenti, nessuna tripla debolezza: nessun buco', () => {
    const team = [
      mk('Garchomp', ['Stealth Rock', 'Earthquake', 'Outrage', 'Swords Dance']),
      mk('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost']),
      mk('Toxapex', ['Recover', 'Toxic', 'Haze', 'Scald']),
      mk('Empoleon', ['Surf', 'Flip Turn', 'Roost', 'Stealth Rock']),
      mk('Clefable', ['Moonblast', 'Soft-Boiled', 'Calm Mind', 'Flamethrower']),
      mk('Gholdengo', ['Make It Rain', 'Shadow Ball', 'Recover', 'Nasty Plot']),
    ];
    expect(coherenceGaps(team, DEFAULT_RULES)).toEqual([]);
  });

  it('tre deboli allo stesso tipo senza chi lo resista; un Acqua/Acciaio lo toglie', () => {
    const support = [mk('Corviknight', ['Brave Bird', 'Defog', 'U-turn', 'Roost']), mk('Gengar', ['Shadow Ball', 'Sludge Bomb'])];
    const bad = coherenceGaps([...iceWeak(), ...support, mk('Clefable', ['Moonblast', 'Soft-Boiled'])], DEFAULT_RULES);
    expect(bad).toContainEqual({ kind: 'weakness', type: 'Ice', count: 3 });
    const fixed = coherenceGaps([...iceWeak(), ...support, mk('Empoleon', ['Surf', 'Stealth Rock'])], DEFAULT_RULES);
    expect(fixed.some(g => g.kind === 'weakness' && g.type === 'Ice')).toBe(false);
  });
});

describe('contradictorySet', () => {
  it('Choice Band con Swords Dance', () => {
    expect(contradictorySet(mk('Garchomp', ['Earthquake', 'Swords Dance'], 'Choice Band'))).toBe(true);
  });
  it('Choice Scarf con Trick va bene', () => {
    expect(contradictorySet(mk('Landorus-Therian', ['Earthquake', 'Trick'], 'Choice Scarf'))).toBe(false);
  });
  it('Assault Vest con Toxic', () => {
    expect(contradictorySet(mk('Toxapex', ['Scald', 'Toxic'], 'Assault Vest'))).toBe(true);
  });
  it('Leftovers con Swords Dance va bene', () => {
    expect(contradictorySet(mk('Garchomp', ['Earthquake', 'Swords Dance'], 'Leftovers'))).toBe(false);
  });
});
