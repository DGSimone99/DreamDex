import { describe, expect, it } from 'vitest';
import { battleAbility, toID } from '../../src/engine/dex';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { asSetter, asUser } from '../../src/engine/styleSets';

const set = (species: string, moves: string[], ability = '', item = ''): TeamSet => ({ ...emptySet(species), moves, ability, item });
const ids = (s: TeamSet | null) => s?.moves.map(toID) ?? [];

describe('set adattati allo stile', () => {
  it('chi porta lo stile: prima l’abilità, poi la mossa (che prende il posto dell’ultima)', () => {
    expect(asSetter(set('Abomasnow', ['Blizzard', 'Wood Hammer', 'Ice Shard', 'Earthquake'], 'Soundproof'), 'snow', 9)?.ability).toBe('Snow Warning');
    const cresselia = asSetter(set('Cresselia', ['Psychic', 'Moonblast', 'Thunder Wave', 'Moonlight'], 'Levitate'), 'trickroom', 9);
    expect(ids(cresselia)).toEqual(['psychic', 'moonblast', 'thunderwave', 'trickroom']);
  });

  it('chi sfrutta lo stile: Kyurem prende Blizzard; chi non impara nulla di utile resta fuori', () => {
    expect(ids(asUser(set('Kyurem', ['Ice Beam', 'Earth Power', 'Freeze-Dry', 'Roost'], 'Pressure'), 'snow', 9))).toContain('blizzard');
    expect(asUser(set('Ditto', ['Transform'], 'Imposter'), 'snow', 9)).toBeNull();
  });

  it('Trick Room: un lento resta com’è, un veloce non la sfrutta', () => {
    const hands = set('Iron Hands', ['Drain Punch', 'Wild Charge', 'Ice Punch', 'Fake Out'], 'Quark Drive');
    expect(asUser(hands, 'trickroom', 9)).toBe(hands);
    expect(asUser(set('Dragapult', ['Shadow Ball', 'Draco Meteor', 'Flamethrower', 'U-turn'], 'Infiltrator'), 'trickroom', 9)).toBeNull();
  });

  it('mai Weather Ball come mossa aggiunta', () => {
    for (const style of ['rain', 'sun', 'sand', 'snow'] as const) {
      const adapted = asUser(set('Castform', ['Hydro Pump', 'Fire Blast', 'Ice Beam', 'Thunderbolt'], 'Forecast'), style, 9);
      expect(ids(adapted)).not.toContain('weatherball');
    }
  });

  it('una Mega tiene l’abilità della Mega', () => {
    const zard = set('Charizard', ['Flamethrower', 'Solar Beam', 'Focus Blast', 'Roost'], 'Blaze', 'Charizardite Y');
    for (const adapted of [asSetter(zard, 'snow', 9), asUser(zard, 'snow', 9)]) {
      if (adapted) expect(battleAbility(adapted)).toBe('Drought');
    }
  });

  it('niente abilità introdotte dopo il limite di generazione', () => {
    // Slush Rush è della gen 7: con il limite alla gen 6 Beartic non la riceve
    const beartic = asUser(set('Beartic', ['Icicle Crash', 'Superpower', 'Aqua Jet', 'Swords Dance'], 'Snow Cloak'), 'snow', 6);
    expect(beartic?.ability).not.toBe('Slush Rush');
  });
});
