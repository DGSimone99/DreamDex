import { describe, expect, it } from 'vitest';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { SpeedRival } from '../../src/engine/speed';
import { speedOptions } from '../../src/engine/speedArea';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', spe = 252): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe } });
const rival = (species: string, webImmune = false): SpeedRival => ({ species, value: 300, scarf: false, weight: 1, webImmune });

const dnite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant');
const smasher = set('Cloyster', 'White Herb', 'Skill Link', ['Shell Smash', 'Icicle Spear', 'Rock Blast'], 'Adamant');
const barra = set('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat'], 'Adamant');
const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'U-turn'], 'Bold', 0);
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid');
const pincurchin = set('Pincurchin', 'Terrain Extender', 'Electric Surge', ['Discharge', 'Spikes', 'Recover', 'Toxic Spikes'], 'Bold', 0);
const webber = set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore', 'U-turn'], 'Timid');
const room = set('Hatterene', 'Leftovers', 'Magic Bounce', ['Trick Room', 'Psychic', 'Draining Kiss', 'Mystical Fire'], 'Quiet', 0);
const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Haze', 'Toxic'], 'Bold', 0);

const brief = (o: ReturnType<typeof speedOptions>[number]) => ({ condition: o.condition, source: o.source, memberFactor: o.memberFactor, by: o.by });

describe('le condizioni di velocità di un membro (i check del modale, le stesse del voto)', () => {
  it('setup: +1 vale ×1,5, Shell Smash ×2', () => {
    expect(speedOptions(dnite, [dnite]).map(brief)).toEqual([{ condition: 'setup', source: 'Dragon Dance', memberFactor: 1.5, by: undefined }]);
    expect(speedOptions(smasher, [smasher]).map(brief)).toEqual([{ condition: 'setup', source: 'Shell Smash', memberFactor: 2, by: undefined }]);
  });

  it('Scale Shot vale +1, Shift Gear e Geomancy +2', () => {
    const chomp = set('Garchomp', 'Loaded Dice', 'Rough Skin', ['Scale Shot', 'Earthquake', 'Swords Dance', 'Stone Edge'], 'Jolly');
    expect(speedOptions(chomp, [chomp]).map(brief)).toEqual([{ condition: 'setup', source: 'Scale Shot', memberFactor: 1.5, by: undefined }]);
    const klink = set('Klinklang', 'Leftovers', 'Clear Body', ['Shift Gear', 'Gear Grind', 'Wild Charge', 'Substitute'], 'Jolly');
    expect(speedOptions(klink, [klink]).map(brief)).toEqual([{ condition: 'setup', source: 'Shift Gear', memberFactor: 2, by: undefined }]);
    const xern = set('Xerneas', 'Power Herb', 'Fairy Aura', ['Geomancy', 'Moonblast', 'Thunderbolt', 'Focus Blast'], 'Timid');
    expect(speedOptions(xern, [xern]).map(brief)).toEqual([{ condition: 'setup', source: 'Geomancy', memberFactor: 2, by: undefined }]);
  });

  it('Swift Swim solo con la pioggia del team (×2)', () => {
    expect(speedOptions(barra, [barra])).toEqual([]);
    expect(speedOptions(barra, [barra, pelipper]).map(brief)).toEqual([{ condition: 'weather', source: 'Swift Swim', memberFactor: 2, by: undefined }]);
  });

  it('Booster Energy ×1,5, una volta sola anche col campo elettrico', () => {
    const alone = speedOptions(valiant, [valiant]).filter(o => o.condition === 'booster');
    expect(alone.map(brief)).toEqual([{ condition: 'booster', source: 'Booster Energy', memberFactor: 1.5, by: undefined }]);
    expect(speedOptions(valiant, [valiant, pincurchin]).filter(o => o.condition === 'booster')).toHaveLength(1);
  });

  it('il controllo del team: Sticky Web e Stun Spore di Ribombee, con le immunità per rivale', () => {
    const options = speedOptions(pex, [pex, webber]);
    const web = options.find(o => o.condition === 'web')!;
    expect(web.source).toBe('Sticky Web');
    expect(web.by).toEqual(['Ribombee']);
    expect(web.memberFactor).toBe(1);
    expect(web.rivalFactor!(rival('Garchomp'))).toBeCloseTo(2 / 3);
    expect(web.rivalFactor!(rival('Corviknight', true))).toBe(1);
    const spore = options.find(o => o.condition === 'slow')!;
    expect(spore.source).toBe('Stun Spore');
    expect(spore.by).toEqual(['Ribombee']);
    expect(spore.rivalFactor!(rival('Garchomp'))).toBe(0.5);
    expect(spore.rivalFactor!(rival('Rillaboom'))).toBe(1);
    expect(options.some(o => o.condition === 'trickroom')).toBe(false);
  });

  it('Trick Room è un check che inverte; un membro senza niente non ha check', () => {
    const tr = speedOptions(pex, [pex, room]).find(o => o.condition === 'trickroom')!;
    expect(tr.trickRoom).toBe(true);
    expect(tr.by).toEqual(['Hatterene']);
    expect(speedOptions(pex, [pex])).toEqual([]);
  });
});
