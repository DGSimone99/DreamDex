import { describe, expect, it } from 'vitest';
import { improveSets } from '../../src/engine/bestPreset';
import type { EngineData } from '../../src/engine/data';
import { generatedSet } from '../../src/engine/generatedSet';
import { defaultSet, ownDataOnly, presetsFor, presetsForSet, type Preset, type TeamSet } from '../../src/engine/sets';
import type { SpeciesStats } from '../../src/engine/stats';

const entry = (usage: number, item: string, ability: string, moves: string[], spread: string): SpeciesStats => ({
  usage, count: 100, abilities: { [ability]: 1 }, items: { [item]: 1 }, teraTypes: {},
  moves: Object.fromEntries(moves.map(m => [m, 1])), spreads: { [spread]: 1 }, teammates: {}, checks: {},
});
const PHYS = 'Jolly:0/252/0/0/4/252';
const SPEC = 'Timid:0/0/0/252/4/252';
const mk = (species: string, item: string, ability: string, moves: string[]): TeamSet => ({ species, item, ability, moves, nature: 'Jolly', evs: { atk: 252, spe: 252 } });

// Preset del singolo (riserva): Garchomp con Stealth Rock, Charizard senza pietra, Dragonite che in doppio non ha dati
const singles: Record<string, Preset[]> = {
  Garchomp: [{ name: 'Tank', format: 'gen9nationaldex', set: mk('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Stealth Rock', 'Earthquake', 'Dragon Tail', 'Spikes']) }],
  Charizard: [
    { name: 'Dragon Dance', format: 'gen9nationaldex', set: mk('Charizard', 'Heavy-Duty Boots', 'Blaze', ['Dragon Dance', 'Flare Blitz', 'Earthquake', 'Roost']) },
    { name: 'Mega Y singolo', format: 'gen9nationaldex', set: mk('Charizard', 'Charizardite Y', 'Blaze', ['Fire Blast', 'Solar Beam', 'Focus Blast', 'Roost']) },
  ],
  Dragonite: [{ name: 'Dragon Dance', format: 'gen9nationaldex', set: mk('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost']) }],
};
const fallback = { Garchomp: singles.Garchomp[0].set, Dragonite: singles.Dragonite[0].set };

// Statistiche di doppio: Garchomp e la Mega Y di Charizard (solo sotto la Mega); nessun preset di doppio
const stats = {
  meta: { month: '2026-10', cutoff: 1500, battles: 1000 },
  pokemon: {
    Garchomp: entry(0.2, 'lifeorb', 'roughskin', ['earthquake', 'rockslide', 'dragonclaw', 'protect'], PHYS),
    'Charizard-Mega-Y': entry(0.1, 'charizarditey', 'drought', ['heatwave', 'solarbeam', 'protect', 'airslash'], SPEC),
    Incineroar: entry(0.4, 'sitrusberry', 'intimidate', ['fakeout', 'flareblitz', 'knockoff', 'partingshot'], PHYS),
  },
};
const base: EngineData = { stats, sets: {}, presets: {}, fallbackPresets: singles, fallback };
const doubles: EngineData = { ...base, formatId: 'natdexdoubles' };
const ou: EngineData = { ...base, formatId: 'ou' };

describe('doppio: niente set del singolo per chi ha dati di doppio', () => {
  it('Garchomp con statistiche di doppio: il set viene dalle statistiche e i preset del singolo non ci sono', () => {
    const set = defaultSet(doubles, 'Garchomp');
    expect(set.moves).toEqual(['Earthquake', 'Rock Slide', 'Dragon Claw', 'Protect']);
    expect(set.moves).not.toContain('Stealth Rock');
    expect(presetsFor(doubles, 'Garchomp')).toEqual([]);
    expect(presetsForSet(doubles, set, 9)).toEqual([]);
    expect(ownDataOnly(doubles, 'Garchomp')).toBe(true);
  });

  it('nel singolo, con gli stessi dati, il preset di riserva resta', () => {
    expect(presetsFor(ou, 'Garchomp').map(p => p.name)).toEqual(['Tank']);
    expect(ownDataOnly(ou, 'Garchomp')).toBe(false);
  });

  it('una specie senza alcun dato di doppio tiene il set e i preset del singolo, come oggi', () => {
    expect(ownDataOnly(doubles, 'Dragonite')).toBe(false);
    expect(presetsFor(doubles, 'Dragonite').map(p => p.name)).toEqual(['Dragon Dance']);
    expect(defaultSet(doubles, 'Dragonite')).toEqual(defaultSet(ou, 'Dragonite'));
    expect(defaultSet(doubles, 'Dragonite').moves).toContain('Dragon Dance');
  });

  it('Mega: le statistiche stanno sotto la Mega, vale anche per la specie base; il set tiene la pietra', () => {
    expect(ownDataOnly(doubles, 'Charizard')).toBe(true);
    expect(ownDataOnly(doubles, 'Charizard-Mega-Y')).toBe(true);
    const mega = defaultSet(doubles, 'Charizard-Mega-Y');
    expect(mega.item).toBe('Charizardite Y');
    expect(mega.moves).toEqual(expect.arrayContaining(['Heat Wave', 'Protect']));
    // Niente preset del singolo né per la Mega né per la forma base
    expect(presetsFor(doubles, 'Charizard-Mega-Y')).toEqual([]);
    expect(presetsFor(doubles, 'Charizard')).toEqual([]);
    // La forma base senza dati suoi: un set generato per il doppio, mai con la pietra né dal singolo
    const plain = defaultSet(doubles, 'Charizard');
    expect(plain.item).not.toBe('Charizardite Y');
    expect(plain.moves).not.toContain('Dragon Dance');
    expect(plain.moves).toContain('Protect');
    // Nel singolo la Mega prende il preset di riserva con la pietra
    expect(presetsFor(ou, 'Charizard-Mega-Y').map(p => p.name)).toEqual(['Mega Y singolo']);
  });

  it('preset di doppio presenti: restano, e sono gli unici', () => {
    const preset: Preset = { name: 'Doppio', format: 'gen9nationaldexdoubles', set: mk('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Rock Slide', 'Protect', 'Swords Dance']) };
    const data: EngineData = { ...doubles, presets: { Garchomp: [preset] } };
    expect(presetsFor(data, 'Garchomp').map(p => p.name)).toEqual(['Doppio']);
    expect(defaultSet(data, 'Garchomp').moves).toEqual(preset.set.moves);
  });
});

describe('doppio: il set generato', () => {
  it('parte da Protect e non propone Stealth Rock', () => {
    const set = generatedSet('Garchomp', 9, null, true);
    expect(set.moves).toContain('Protect');
    expect(set.moves).not.toContain('Stealth Rock');
  });

  it('senza il quarto argomento è quello di sempre', () => {
    const set = generatedSet('Garchomp', 9, null);
    expect(set.moves).toContain('Stealth Rock');
    expect(set.moves).not.toContain('Protect');
    expect(generatedSet('Garchomp')).toEqual(set);
  });
});

describe('doppio: Migliora i set senza preset', () => {
  it('con la lista dei preset vuota non lancia e non prende mosse dal preset del singolo', () => {
    const team: TeamSet[] = [
      mk('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Protect']),
      mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']),
    ];
    const changes = improveSets(team, doubles, 9);
    expect(changes).toHaveLength(2);
    const garchomp = changes[0].after ?? changes[0].before;
    for (const move of ['Stealth Rock', 'Dragon Tail', 'Spikes']) expect(garchomp.moves).not.toContain(move);
    expect(garchomp.item).not.toBe('Rocky Helmet');
  });
});
