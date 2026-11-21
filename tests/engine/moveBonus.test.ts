import { describe, expect, it } from 'vitest';
import { rankedChanges } from '../../src/engine/coach';
import { KNOCK_OFF_POINTS, TAUNT_ENCORE_POINTS, knockOffUser, tauntEncoreUser } from '../../src/engine/moveBonus';
import { bonusMalusCatalog, rateTeam } from '../../src/engine/rating';
import { DOUBLES_RULES } from '../../src/engine/formatRules';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import type { TeamGain } from '../../src/engine/teamGain';
import { fixtureData } from '../fixtures/data';

const s = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, hp: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };

const tusk = s('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off']);
const dragapult = s('Dragapult', 'Heavy-Duty Boots', 'Infiltrator', ['Dragon Darts', 'U-turn', 'Hex', 'Taunt']);
const toxapex = s('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Haze', 'Taunt'], 'Bold', bulky);
const sableye = s('Sableye', 'Leftovers', 'Prankster', ['Encore', 'Recover', 'Will-O-Wisp', 'Foul Play'], 'Bold', bulky);

describe('Knock Off e Taunt/Encore: chi li porta', () => {
  it('Knock Off: il primo membro che la ha; Trick e Switcheroo non contano', () => {
    expect(knockOffUser([dragapult, tusk])).toEqual({ member: 'Great Tusk' });
    expect(knockOffUser([dragapult, { ...tusk, moves: ['Headlong Rush', 'Trick'] }])).toBeNull();
  });

  it('Taunt o Encore: solo chi agisce prima di almeno metà del gruppo', () => {
    expect(tauntEncoreUser([toxapex, dragapult], fixtureData)).toEqual({ member: 'Dragapult', move: 'Taunt' });
    expect(tauntEncoreUser([toxapex], fixtureData)).toBeNull();
    expect(tauntEncoreUser([tusk], fixtureData)).toBeNull();
  });

  it('Prankster basta, anche su un membro lento', () => {
    expect(tauntEncoreUser([sableye], fixtureData)).toEqual({ member: 'Sableye', move: 'Encore' });
    expect(tauntEncoreUser([{ ...sableye, ability: 'Keen Eye' }], fixtureData)).toBeNull();
  });
});

describe('Knock Off e Taunt/Encore: nel voto', () => {
  const rest = [
    s('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant'),
    s('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang']),
    s('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
    s('Skarmory', 'Rocky Helmet', 'Sturdy', ['Brave Bird', 'Roost', 'Whirlwind', 'Spikes'], 'Impish', bulky),
  ];
  const team = [tusk, dragapult, ...rest];
  const bonusOf = (list: TeamSet[], catalog: string, data = fixtureData) => rateTeam(list, data)!.bonus.items.filter(i => i.catalog === catalog);

  it('+1 ciascuno, col nome di chi la porta', () => {
    const [knock] = bonusOf(team, 'knockOff');
    expect(knock.points).toBe(KNOCK_OFF_POINTS);
    expect(knock.text).toBe('Knock Off: Great Tusk toglie lo strumento all\'avversario');
    const [taunt] = bonusOf(team, 'tauntEncore');
    expect(taunt.points).toBe(TAUNT_ENCORE_POINTS);
    expect(taunt.text).toContain('Dragapult');
  });

  it('una volta sola, anche con più membri che le portano', () => {
    const twice = [tusk, dragapult, { ...rest[0], moves: ['Kowtow Cleave', 'Sucker Punch', 'Knock Off', 'Taunt'] }, ...rest.slice(1)];
    expect(bonusOf(twice, 'knockOff')).toHaveLength(1);
    expect(bonusOf(twice, 'tauntEncore')).toHaveLength(1);
  });

  it('senza le mosse niente; il voto scende dei punti dei due bonus', () => {
    const without = [{ ...tusk, moves: tusk.moves.slice(0, 3) }, { ...dragapult, moves: dragapult.moves.slice(0, 3) }, ...rest];
    expect(bonusOf(without, 'knockOff')).toEqual([]);
    expect(bonusOf(without, 'tauntEncore')).toEqual([]);
    expect(rateTeam(team, fixtureData)!.bonus.total - rateTeam(without, fixtureData)!.bonus.total).toBe(KNOCK_OFF_POINTS + TAUNT_ENCORE_POINTS);
  });

  it('in doppio non si danno, e non stanno nell\'elenco del doppio', () => {
    const doublesData = { ...fixtureData, formatId: 'natdexdoubles' as const };
    expect(bonusOf(team, 'knockOff', doublesData)).toEqual([]);
    expect(bonusOf(team, 'tauntEncore', doublesData)).toEqual([]);
    const doubles = bonusMalusCatalog('it', DOUBLES_RULES).map(e => e.key as string);
    expect(doubles).not.toContain('knockOff');
    expect(doubles).not.toContain('tauntEncore');
    expect(bonusMalusCatalog('it').map(e => e.key as string)).toEqual(expect.arrayContaining(['knockOff', 'tauntEncore']));
  });
});

describe('Knock Off e Taunt/Encore: nel Coaching', () => {
  it('pro e contro li nominano, coi loro punti', () => {
    const none = { roles: [], covers: [], resists: [] };
    const diff = { gains: none, losses: none, lostResists: [] };
    const gain = { moves: [{ catalog: 'knockOff', change: 'gained' }, { catalog: 'tauntEncore', change: 'lost' }], areaPoints: {} } as unknown as TeamGain;
    const changes = rankedChanges(diff, gain, 'it');
    expect(changes.pros).toEqual([{ text: 'Knock Off nel team', points: KNOCK_OFF_POINTS, area: 'roles', bonus: true }]);
    expect(changes.cons).toEqual([{ text: 'Niente più Taunt o Encore', points: -TAUNT_ENCORE_POINTS, area: 'roles', bonus: true }]);
  });
});
