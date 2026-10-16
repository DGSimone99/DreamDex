import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { conditionConflicts, unusedEnablers, weakenedMoves, weatherMitigations } from '../../src/engine/synergy';

const set = (species: string, ability: string, moves: string[] = [], item = ''): TeamSet =>
  ({ ...emptySet(species), ability, moves, item });

const groudon = set('Groudon', 'Drought', ['Precipice Blades', 'Stealth Rock'], 'Red Orb');
const kyogre = set('Kyogre', 'Drizzle', ['Origin Pulse', 'Thunder'], 'Blue Orb');
const hooh = set('Ho-Oh', 'Regenerator', ['Sacred Fire', 'Brave Bird']);
const ninetales = set('Ninetales', 'Drought', ['Flamethrower']);

describe('meteo primordiale: dura solo finché il Pokémon è in campo', () => {
  it('due primordiali insieme non sono in conflitto', () => {
    expect(conditionConflicts([groudon, kyogre, hooh])).toEqual([]);
  });

  it('primordiale contro meteo normale: conflitto (entrando lo cancella)', () => {
    expect(conditionConflicts([kyogre, ninetales])).toHaveLength(1);
  });

  it('non indebolisce le mosse dei compagni', () => {
    expect(weakenedMoves([groudon, kyogre, hooh])).toEqual([]);
  });

  it('mai "non sfruttato"', () => {
    expect(unusedEnablers([groudon, hooh])).toEqual([]);
  });

  it('smorza le debolezze solo di chi lo porta', () => {
    const steelWeakToFire = set('Scizor', 'Technician', ['Bullet Punch']);
    expect(weatherMitigations([kyogre, steelWeakToFire])).toEqual([]);
  });
});

describe('Chilly Reception: mossa per cambiare, la neve è secondaria', () => {
  const slowking = set('Slowking-Galar', 'Regenerator', ['Chilly Reception', 'Sludge Bomb']);
  const ttar = set('Tyranitar', 'Sand Stream', ['Stone Edge'], 'Tyranitarite');

  it('niente conflitto col meteo dei compagni e mai "non sfruttato"', () => {
    expect(conditionConflicts([slowking, ttar])).toEqual([]);
    expect(unusedEnablers([slowking]).map(u => u.via)).not.toContain('Chilly Reception');
  });
});

describe('sabbia e neve potenziano chi le porta se del tipo giusto', () => {
  it('Tyranitar (Roccia) con la sua sabbia: sfrutta da sé, nessun avviso', () => {
    const ttar = set('Tyranitar', 'Sand Stream', ['Knock Off']);
    expect(unusedEnablers([ttar])).toEqual([]);
  });

  it('Ninetales-Alola (Ghiaccio) con la sua neve: sfrutta da sé, nessun avviso', () => {
    const ninetalesA = set('Ninetales-Alola', 'Snow Warning', ['Moonblast']);
    expect(unusedEnablers([ninetalesA])).toEqual([]);
  });

  it('la sabbia fa danno agli avversari: mai "non sfruttata", anche su Hippowdon', () => {
    const hippo = set('Hippowdon', 'Sand Stream', ['Stealth Rock', 'Slack Off', 'Earthquake', 'Whirlwind']);
    expect(unusedEnablers([hippo])).toEqual([]);
  });

  it('la neve invece non fa danno: Snowscape senza chi la sfrutti resta segnalato', () => {
    const chomp = set('Garchomp', 'Rough Skin', ['Snowscape', 'Earthquake']);
    expect(unusedEnablers([chomp])).toEqual([{ member: 'Garchomp', condition: 'snow', via: 'Snowscape' }]);
  });
});
