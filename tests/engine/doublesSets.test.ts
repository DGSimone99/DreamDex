import { describe, expect, it } from 'vitest';
import { bestPresetIndex, improveSets } from '../../src/engine/bestPreset';
import { commonChoices } from '../../src/engine/common';
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

describe('doppio: Migliora i set lavora anche senza preset', () => {
  it('un set scadente di chi ha solo statistiche di doppio migliora verso il set del doppio', () => {
    const team: TeamSet[] = [
      { ...mk('Garchomp', '', 'Rough Skin', ['Sand Attack', 'Cut', 'Rock Smash', 'Strength']), evs: {} },
      mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']),
    ];
    const [garchomp] = improveSets(team, doubles, 9);
    expect(garchomp.changed).toBe(true);
    expect(garchomp.gain).toBeGreaterThan(0);
    expect(garchomp.after.moves).toEqual(expect.arrayContaining(['Earthquake', 'Protect']));
    expect(garchomp.after.moves).not.toContain('Stealth Rock');
    // Nel menu dei set non c'è nessun preset da segnare
    expect(bestPresetIndex(team, 0, doubles, 9)).toBeNull();
  });

  it('un set già buono non peggiora: resta quello di adesso se vale di più', () => {
    const good = defaultSet(doubles, 'Garchomp');
    const team = [good, mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'])];
    expect(improveSets(team, doubles, 9)[0].gain).toBeGreaterThanOrEqual(0);
  });

  it('nel singolo, senza preset, il membro resta com\'è (come sempre)', () => {
    const noPresets: EngineData = { stats, sets: {}, presets: {}, formatId: 'ou' };
    const team: TeamSet[] = [
      { ...mk('Garchomp', '', 'Rough Skin', ['Sand Attack', 'Cut', 'Rock Smash', 'Strength']), evs: {} },
      mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot']),
    ];
    expect(improveSets(team, noPresets, 9)[0].changed).toBe(false);
  });
});

describe('doppio: quali forme contano come "con dati di doppio"', () => {
  const formes: EngineData = { ...doubles, stats: { ...stats, pokemon: {
    ...stats.pokemon,
    'Slowbro-Mega': entry(0.05, 'slowbronite', 'shellarmor', ['scald', 'psychic', 'protect', 'trickroom'], SPEC),
    Metagross: entry(0.05, 'assaultvest', 'clearbody', ['meteormash', 'zenheadbutt', 'bulletpunch', 'stompingtantrum'], PHYS),
    Maushold: entry(0.05, 'widelens', 'friendguard', ['followme', 'populationbomb', 'protect', 'beatup'], PHYS),
  } } };

  it('un\'altra forma (Slowbro-Galar) non eredita i dati della Mega della base: tiene le riserve del singolo', () => {
    expect(ownDataOnly(formes, 'Slowbro')).toBe(true);
    expect(ownDataOnly(formes, 'Slowbro-Mega')).toBe(true);
    expect(ownDataOnly(formes, 'Slowbro-Galar')).toBe(false);
    expect(ownDataOnly(formes, 'Deoxys-Attack')).toBe(false);
  });

  it('una Mega senza statistiche sue, con la base che le ha: parte dal set di doppio della base, con la pietra', () => {
    expect(ownDataOnly(formes, 'Metagross-Mega')).toBe(true);
    const mega = defaultSet(formes, 'Metagross-Mega');
    expect(mega.item).toBe('Metagrossite');
    expect(mega.moves).toEqual(expect.arrayContaining(['Meteor Mash', 'Bullet Punch']));
  });

  it('una forma solo estetica usa i dati di doppio della base', () => {
    expect(ownDataOnly(formes, 'Maushold-Four')).toBe(true);
    expect(defaultSet(formes, 'Maushold-Four').moves).toEqual(expect.arrayContaining(['Follow Me', 'Protect']));
  });
});

describe('doppio: le "più usate" non vengono dal singolo per chi ha dati di doppio', () => {
  const singlesStats = { Garchomp: { ...entry(0.3, 'rockyhelmet', 'roughskin', ['stealthrock', 'spikes', 'dragontail', 'earthquake'], PHYS), format: 'gen9nationaldex' },
    Dragonite: { ...entry(0.3, 'heavydutyboots', 'multiscale', ['dragondance', 'extremespeed', 'earthquake', 'roost'], PHYS), format: 'gen9nationaldex' } };
  const preset: Preset = { name: 'Doppio', format: 'gen9nationaldexdoubles', set: mk('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Rock Slide', 'Protect', 'Swords Dance']) };
  // Garchomp ha un preset di doppio ma nessuna statistica di doppio
  const noStats = { ...stats, pokemon: { Incineroar: stats.pokemon.Incineroar } };
  const data = (formatId: 'natdexdoubles' | 'ou'): EngineData => ({ stats: noStats, sets: {}, presets: { Garchomp: [preset] }, fallbackStats: singlesStats, formatId });
  const moves = (d: EngineData, set: TeamSet) => commonChoices(d, set).moves.map(m => m.name);

  it('Garchomp con dati di doppio: niente Stealth Rock dalle statistiche del singolo', () => {
    expect(moves(data('natdexdoubles'), preset.set)).not.toContain('Stealth Rock');
    expect(moves(data('ou'), preset.set)).toContain('Stealth Rock');
  });

  it('una specie senza dati di doppio le prende ancora dal formato in cui è più giocata', () => {
    const dragonite = mk('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed']);
    expect(moves(data('natdexdoubles'), dragonite)).toContain('Roost');
  });
});
