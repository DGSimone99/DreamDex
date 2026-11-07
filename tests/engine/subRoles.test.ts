import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, formatRules, UBERS_RULES } from '../../src/engine/formatRules';
import type { TeamSet } from '../../src/engine/sets';
import { attackSide, rolesList, subRoleReasons, uninvestedWall, setSubRoles, statusSources, wallIndex } from '../../src/engine/subRoles';

const set = (species: string, moves: string[], item = '', ability = '', evs: TeamSet['evs'] = {}, nature = 'Serious'): TeamSet =>
  ({ species, ability, item, moves, nature, evs });
const roles = (s: TeamSet) => setSubRoles(s, DEFAULT_RULES);

describe('subRoles', () => {
  it('Alomomola Assault Vest Bold 252 HP / 252 Def: muro fisico e speciale', () => {
    const s = set('Alomomola', ['Wish', 'Flip Turn', 'Scald', 'Protect'], 'Assault Vest', 'Regenerator', { hp: 252, def: 252 }, 'Bold');
    const index = wallIndex(s);
    expect(index.physical).toBeGreaterThanOrEqual(100000);
    expect(index.special).toBeGreaterThanOrEqual(95000);
    expect(roles(s)).toMatchObject({ physicalWall: 1, specialWall: 1, recovery: 1, pivot: 1 });
  });

  it('Dragonite Multiscale: non è un muro', () => {
    const s = set('Dragonite', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Heavy-Duty Boots', 'Multiscale', { hp: 252, atk: 4, spe: 252 }, 'Adamant');
    const v = roles(s);
    expect(v.physicalWall).toBeUndefined();
    expect(v.specialWall).toBeUndefined();
  });

  it('Eviolite solo se non completamente evoluto', () => {
    const base = wallIndex(set('Dusclops', ['Recover'])).physical;
    expect(wallIndex(set('Dusclops', ['Recover'], 'Eviolite')).physical).toBeCloseTo(base * 1.5, 0);
    const knoir = wallIndex(set('Dusknoir', ['Recover'])).physical;
    expect(wallIndex(set('Dusknoir', ['Recover'], 'Eviolite')).physical).toBe(knoir);
  });

  it('Fur Coat raddoppia la Difesa', () => {
    const base = wallIndex(set('Furfrou', ['Cotton Guard'])).physical;
    expect(wallIndex(set('Furfrou', ['Cotton Guard'], '', 'Fur Coat')).physical).toBeCloseTo(base * 2, 0);
  });

  it('soglie Ubers più alte', () => {
    expect(UBERS_RULES.wallIndex).toEqual({ physical: 120000, special: 115000 });
    expect(DEFAULT_RULES.wallIndex).toEqual({ physical: 100000, special: 95000 });
    // Gen 9 AG: soglie di Ubers, il resto delle regole di Gen 9
    expect(formatRules('gen9ag').wallIndex).toEqual(UBERS_RULES.wallIndex);
  });

  it('Toxic Spikes 0.75, Sticky Web è hazard (2026-11-03)', () => {
    expect(roles(set('Toxapex', ['Toxic Spikes'])).hazards).toBe(0.75);
    expect(roles(set('Toxapex', ['Sticky Web'])).hazards).toBe(1);
    expect(roles(set('Toxapex', ['Toxic Spikes', 'Stealth Rock'])).hazards).toBe(1);
  });

  it('schermi: due 1, uno 0.6, senza Light Clay ×0.75', () => {
    expect(roles(set('Klefki', ['Reflect', 'Light Screen'], 'Light Clay')).screens).toBe(1);
    expect(roles(set('Klefki', ['Reflect'], 'Light Clay')).screens).toBe(0.6);
    expect(roles(set('Klefki', ['Reflect'])).screens).toBeCloseTo(0.45);
  });

  it('tabella degli status', () => {
    const v = (moves: string[], ability = '') => roles(set('Toxapex', moves, '', ability));
    expect(v(['Toxic'])).toMatchObject({ dot: 1 });
    expect(v(['Toxic']).debuff).toBeUndefined();
    expect(v(['Will-O-Wisp'])).toMatchObject({ dot: 0.5, debuff: 0.25 });
    expect(v(['Scald'])).toMatchObject({ dot: 0.15 });
    expect(v(['Scald']).debuff).toBeCloseTo(0.075);
    expect(v(['Scald'], 'Serene Grace').dot).toBeCloseTo(0.3);
    expect(v(['Scald'], 'Serene Grace').debuff).toBeCloseTo(0.15);
    expect(v(['Leech Seed'])).toMatchObject({ dot: 0.5, recovery: 0.25 });
    expect(v(['Hypnosis']).debuff).toBeCloseTo(0.6);
    expect(v(['Yawn'])).toMatchObject({ debuff: 0.5 });
    expect(v(['Toxic', 'Will-O-Wisp'])).toMatchObject({ dot: 1 });
    expect(statusSources(set('Toxapex', ['Toxic', 'Will-O-Wisp'])).map(s => s.status)).toEqual(['tox', 'brn']);
  });

  it('Dire Claw e Tri Attack: stato casuale, un terzo della probabilità per ogni stato', () => {
    const claw = statusSources(set('Sneasler', ['Dire Claw']));
    expect(claw.map(s => s.status)).toEqual(['psn', 'par', 'slp']);
    expect(roles(set('Sneasler', ['Dire Claw'])).dot).toBeCloseTo(0.5 * 0.5 / 3);
    expect(roles(set('Sneasler', ['Dire Claw'])).debuff).toBeCloseTo(0.5 / 3);
    expect(statusSources(set('Porygon2', ['Tri Attack'])).map(s => s.status)).toEqual(['brn', 'par']);
    expect(roles(set('Togekiss', ['Tri Attack'], '', 'Serene Grace')).dot).toBeCloseTo(0.5 * 0.4 / 3);
  });

  it("Photon Geyser e simili: il lato dell'attacco segue la statistica più alta", () => {
    const dm = set('Necrozma-Dusk-Mane', ['Photon Geyser'], '', '', { atk: 252 }, 'Adamant');
    expect(attackSide(dm, 'Photon Geyser')).toBe('physical');
    const dw = set('Necrozma-Dawn-Wings', ['Photon Geyser'], '', '', { spa: 252 }, 'Modest');
    expect(attackSide(dw, 'Photon Geyser')).toBe('special');
    expect(attackSide(dm, 'Earthquake')).toBe('physical');
    expect(attackSide(dm, 'Flamethrower')).toBe('special');
    expect(attackSide(dm, 'Swords Dance')).toBeNull();
  });

  it('muro senza investimento in attacco: niente etichetta d’Attacco (Body Press, setup e set senza EV a parte)', () => {
    const wall = { physicalWall: 1 };
    const hippo = set('Hippowdon', ['Earthquake', 'Slack Off'], 'Rocky Helmet', '', { hp: 252, def: 252 }, 'Impish');
    expect(uninvestedWall(hippo, 'physical', 'Earthquake', null, wall)).toBe(true);
    // Non è un muro, ha EV in Attacco o natura che lo alza, setup che lo alza, Body Press, nessun EV dichiarato
    expect(uninvestedWall(hippo, 'physical', 'Earthquake', null, {})).toBe(false);
    expect(uninvestedWall({ ...hippo, evs: { hp: 252, atk: 252 } }, 'physical', 'Earthquake', null, wall)).toBe(false);
    expect(uninvestedWall({ ...hippo, nature: 'Adamant' }, 'physical', 'Earthquake', null, wall)).toBe(false);
    expect(uninvestedWall(hippo, 'physical', 'Earthquake', 'Curse', wall)).toBe(false);
    expect(uninvestedWall(hippo, 'physical', 'Body Press', 'Iron Defense', wall)).toBe(false);
    expect(uninvestedWall({ ...hippo, evs: {} }, 'physical', 'Earthquake', null, wall)).toBe(false);
  });

  it('Knock Off 1, Trick con Choice 1, senza 0.5', () => {
    expect(roles(set('Landorus-Therian', ['Knock Off'])).itemRemoval).toBe(1);
    expect(roles(set('Gholdengo', ['Trick'], 'Choice Scarf')).itemRemoval).toBe(1);
    expect(roles(set('Gholdengo', ['Trick'], 'Leftovers')).itemRemoval).toBe(0.5);
  });

  it('Supporto: Wish, Healing Wish e Lunar Dance 1, Heal Bell e Aromatherapy 0.75', () => {
    expect(roles(set('Alomomola', ['Wish', 'Protect', 'Flip Turn', 'Scald'])).support).toBe(1);
    expect(roles(set('Hatterene', ['Healing Wish', 'Psychic', 'Draining Kiss', 'Mystical Fire'])).support).toBe(1);
    expect(roles(set('Blissey', ['Heal Bell', 'Soft-Boiled', 'Seismic Toss', 'Toxic'])).support).toBe(0.75);
    expect(roles(set('Garchomp', ['Earthquake', 'Stealth Rock'])).support ?? 0).toBe(0);
  });

  it('Controllo hazard: Magic Bounce vale metà senza una mossa di rimozione; Good as Gold niente', () => {
    expect(roles(set('Hatterene', ['Psychic', 'Draining Kiss', 'Calm Mind', 'Mystical Fire'], 'Leftovers', 'Magic Bounce')).removal).toBe(0.5);
    expect(roles(set('Hatterene', ['Defog', 'Draining Kiss', 'Calm Mind', 'Mystical Fire'], 'Leftovers', 'Magic Bounce')).removal).toBe(1);
    expect(roles(set('Gholdengo', ['Make It Rain', 'Shadow Ball', 'Nasty Plot', 'Recover'], 'Air Balloon', 'Good as Gold')).removal ?? 0).toBe(0);
    const reasons = subRoleReasons(set('Hatterene', ['Psychic', 'Draining Kiss', 'Calm Mind', 'Mystical Fire'], 'Leftovers', 'Magic Bounce'), [], { stats: null, sets: null });
    expect(reasons.find(r => r.role === 'removal')?.source).toBe('Magic Bounce');
  });

  it('Unaware è un hazer', () => {
    expect(roles(set('Clodsire', ['Recover'], '', 'Unaware')).phazer).toBe(1);
    expect(roles(set('Toxapex', ['Haze'])).phazer).toBe(1);
  });

  it('Taunt ed Encore presenti valgono 1; rolesList in ordine di famiglia', () => {
    const v = roles(set('Grimmsnarl', ['Taunt', 'Encore', 'Reflect']));
    expect(v).toMatchObject({ taunt: 1, encore: 1 });
    expect(rolesList({ taunt: 1, screens: 0.4, hazards: 0.5 })).toEqual(['hazards', 'taunt']);
  });

  it('attaccanti: sweeper fisico veloce, breaker lento', () => {
    const s = set('Garchomp', ['Earthquake', 'Outrage', 'Swords Dance'], '', '', { atk: 252, spe: 252 }, 'Jolly');
    expect(roles(s)).toMatchObject({ physicalSweeper: 1, physicalBreaker: 1 });
    const slow = set('Great Tusk', ['Headlong Rush', 'Close Combat'], 'Choice Band', '', { atk: 252 }, 'Adamant');
    expect(roles(slow).physicalBreaker).toBe(1);
    expect(roles(slow).physicalSweeper).toBeUndefined();
  });

  it('attaccanti misti: decide lo strumento Choice, altrimenti ogni lato con la statistica alta', () => {
    // Specs Dragapult: due attacchi fisici e due speciali, ma lo Specs dice speciale
    const pult = set('Dragapult', ['Dragon Darts', 'U-turn', 'Draco Meteor', 'Shadow Ball'], 'Choice Specs', 'Infiltrator', { spa: 252, spe: 252 }, 'Timid');
    const v = roles(pult);
    expect(v).toMatchObject({ specialBreaker: 1, specialSweeper: 1, pivot: 1 });
    expect(v.physicalBreaker).toBeUndefined();
    expect(v.physicalSweeper).toBeUndefined();
    // Band: fisico anche con la statistica speciale alta
    const band = set('Dragapult', ['Dragon Darts', 'U-turn', 'Draco Meteor', 'Shadow Ball'], 'Choice Band', 'Infiltrator', { atk: 252, spa: 252, spe: 4 }, 'Hasty');
    expect(roles(band).physicalBreaker).toBe(1);
    expect(roles(band).specialBreaker).toBeUndefined();
    // Loaded Dice Kyurem: senza Choice conta il lato con l'Attacco investito (AttSp senza EV sotto 300)
    const kyurem = set('Kyurem', ['Freeze-Dry', 'Earth Power', 'Icicle Spear', 'Scale Shot'], 'Loaded Dice', 'Pressure', { atk: 252, spa: 4, spe: 252 }, 'Naive');
    const k = roles(kyurem);
    expect(k).toMatchObject({ physicalBreaker: 1, physicalSweeper: 1 });
    expect(k.specialBreaker).toBeUndefined();
    // Misto con entrambe le statistiche alte: entrambi i lati
    const both = set('Kyurem', ['Freeze-Dry', 'Earth Power', 'Icicle Spear', 'Scale Shot'], 'Life Orb', 'Pressure', { atk: 128, spa: 128, spe: 252 }, 'Hasty');
    expect(roles(both)).toMatchObject({ physicalBreaker: 1, specialBreaker: 1 });
  });

  it('il rilevatore del set è in cache per set e congelato', () => {
    const s = set('Garchomp', ['Earthquake', 'Outrage', 'Swords Dance'], '', '', { atk: 252, spe: 252 }, 'Jolly');
    const a = setSubRoles(s, DEFAULT_RULES);
    expect(setSubRoles(s, DEFAULT_RULES)).toBe(a);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('RF1: specie o mosse sconosciute: niente errori, valori vuoti', () => {
    expect(setSubRoles(set('Notamon', ['Toxic', 'Stealth Rock']), DEFAULT_RULES)).toEqual({});
    expect(() => setSubRoles(set('Great Tusk', ['', 'Notamove']), DEFAULT_RULES)).not.toThrow();
    expect(wallIndex(set('Notamon', []))).toEqual({ physical: 0, special: 0 });
  });
});
