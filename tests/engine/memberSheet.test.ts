import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { initLearnsets } from '../../src/engine/learnsets';
import { memberSheet } from '../../src/engine/memberSheet';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const noMeta: EngineData = { stats: null, sets: null };
const row = (team: TeamSet[], species: string, data = noMeta) => memberSheet(team, data).find(r => r.species === species)!;

const ninetales = set('Ninetales', 'Heat Rock', 'Drought', ['Weather Ball', 'Will-O-Wisp', 'Encore', 'Healing Wish'], 'Timid', { hp: 4, spa: 252, spe: 252 });
const corviknight = set('Corviknight', 'Rocky Helmet', 'Pressure', ['Brave Bird', 'U-turn', 'Body Press', 'Roost'], 'Impish', { hp: 252, def: 252, spd: 4 });
const greninja = set('Greninja', 'Life Orb', 'Battle Bond', ['Hydro Pump', 'Dark Pulse', 'Water Shuriken', 'Ice Beam'], 'Timid', { hp: 4, spa: 252, spe: 252 });
const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic', 'Haze'], 'Bold', { hp: 252, def: 252, spd: 4 });

beforeAll(() => initLearnsets());

describe('scheda dei membri', () => {
  it('statistiche reali del set: EV, natura, strumento', () => {
    const g = row([greninja], 'Greninja');
    // Timid 252 Vel: 2·122 + 31 + 63 + 5 = 343, ×1,1 = 377
    expect(g.speed.value).toBe(377);
    // Att. Sp. 103 a 252 EV (natura neutra): 2·103 + 99 = 305, ×1,3 per la Life Orb
    expect(g.attack.value).toBe(Math.round(305 * 1.3));
    expect(g.attack.boostItem).toBe('Life Orb');
    expect(g.bulk.hp).toBe(2 * 72 + 31 + 1 + 110);
  });

  it('il ruolo dal set: muro, supporto, sweeper; ognuno giudicato nel suo ruolo', () => {
    const team = [ninetales, corviknight, greninja, toxapex];
    expect(row(team, 'Toxapex').role).toBe('wall');
    expect(row(team, 'Ninetales').role).toBe('support');
    expect(row(team, 'Greninja').role).toBe('sweeper');
    // Un muro non perde punti per l'attacco basso: Toxapex vale come muro
    expect(row(team, 'Toxapex').grade).toBeGreaterThan(70);
    expect(row(team, 'Toxapex').attack.share).toBeLessThan(0.05);
  });

  it('un set sbagliato vale meno: muro con EV in attacco', () => {
    const wrong = { ...toxapex, nature: 'Adamant', evs: { atk: 252, spe: 252, hp: 4 } };
    expect(row([wrong], 'Toxapex').grade).toBeLessThan(row([toxapex], 'Toxapex').grade);
  });

  it('Weather Ball col sole del team, supporti come etichette', () => {
    const n = row([ninetales], 'Ninetales');
    expect(n.coverage).toContain('Grass');
    expect(n.support).toEqual(expect.arrayContaining(['status', 'disruption', 'sacrifice', 'weather']));
    expect(row([greninja], 'Greninja').support).toContain('priority');
  });

  it('col meta la velocità si confronta con le minacce più usate', () => {
    expect(row([greninja], 'Greninja', fixtureData).speed.vsMeta).toBe(true);
    expect(row([greninja], 'Greninja').speed.vsMeta).toBe(false);
  });
});
