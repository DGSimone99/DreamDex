import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { speedPart, teamSpeedArea } from '../../src/engine/speedArea';
import { softScore } from '../../src/engine/scale';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly'): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe: 252 } });
const noMeta: EngineData = { stats: null, sets: null };
const dragapult = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor', 'Shadow Ball', 'Flamethrower', 'U-turn'], 'Timid');
const valiant = set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Timid');
const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Toxic', 'Haze'], 'Bold');

describe('area Velocità', () => {
  it("l'area è la Velocità più il plus del controllo; il controllo è in punti e non toglie mai", () => {
    const web = set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast'], 'Timid');
    const team = [dragapult, valiant, toxapex, web];
    const area = teamSpeedArea(team, noMeta);
    expect(area.value).toBe(speedPart(area.members));
    expect(area.speed).toBe(speedPart(area.members.map(m => ({ ...m, total: m.own }))));
    expect(area.control).toBe(area.value - area.speed);
    expect(area.control).toBeGreaterThan(0);
    expect(area.value).toBeLessThan(100);
    const none = teamSpeedArea([dragapult, valiant, toxapex], noMeta);
    expect(none.control).toBe(0);
    expect(none.sources).toEqual([]);
  });

  it('chi porta il controllo: la mossa, quanti compagni aiuta e quanti punti aggiunge', () => {
    const clef = set('Clefable', 'Leftovers', 'Magic Guard', ['Thunder Wave', 'Moonblast'], 'Bold');
    const chomp = set('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake'], 'Jolly');
    const team = [clef, chomp, toxapex];
    const area = teamSpeedArea(team, noMeta);
    const wave = area.sources.find(src => src.move === 'Thunder Wave')!;
    expect(wave.by).toEqual(['Clefable']);
    expect(wave.condition).toBe('slow');
    expect(wave.helped).toBe(area.members.filter(m => m.gains.some(g => g.source === 'Thunder Wave' && g.by?.includes('Clefable'))).length);
    expect(wave.plus).toBe(speedPart(area.members.map(m => ({ ...m, total: Math.min(1, m.own + (m.gains.find(g => g.condition === 'slow')?.gain ?? 0)) }))) - area.speed);
    // Con due mosse che rallentano conta la migliore, ma la tabella le mostra tutte, ognuna con il suo effetto da sola
    // Glare rallenta sempre almeno quanto Thunder Wave (i Terra non ne sono immuni): Thunder Wave non vince mai
    const glare = set('Dudunsparce', 'Leftovers', 'Serene Grace', ['Glare', 'Boomburst'], 'Calm');
    const both = teamSpeedArea([clef, chomp, glare], noMeta);
    expect(both.sources.map(src => src.move).sort()).toEqual(['Glare', 'Thunder Wave']);
    expect(both.sources.find(src => src.move === 'Thunder Wave')!.by).toEqual(['Clefable']);
    expect(both.sources.find(src => src.move === 'Thunder Wave')!.plus).toBeGreaterThan(0);
    // Il guadagno di Garchomp dice da chi viene: non è lui ad avere Thunder Wave
    expect(area.members.find(m => m.species === 'Garchomp')!.gains.find(g => g.condition === 'slow')!.by).toEqual(['Clefable']);
  });

  it("nel voto: il valore dell'area è quello di teamSpeedArea", () => {
    const rating = rateTeam([dragapult, valiant, toxapex], fixtureData)!;
    expect(rating.areas.find(a => a.key === 'speed')!.value).toBe(teamSpeedArea([dragapult, valiant, toxapex], fixtureData).value);
    expect(rating.speed.members).toHaveLength(3);
  });

  it('anche chi non attacca conta (Toxapex lento abbassa la Velocità del team)', () => {
    expect(teamSpeedArea([dragapult, valiant, toxapex], noMeta).speed).toBeLessThan(teamSpeedArea([dragapult, valiant], noMeta).speed);
  });

  it('col meta e senza: due gruppi di confronto diversi', () => {
    const team = [dragapult, valiant, toxapex];
    const on = teamSpeedArea(team, fixtureData);
    const off = teamSpeedArea(team, { ...fixtureData, ignoreMeta: true });
    expect(on.members[2].raw).not.toBeCloseTo(off.members[2].raw, 5);
  });

  it('Trick Room è una condizione: la Velocità resta, e guadagna chi è adatto (i lenti), non chi è veloce', () => {
    const hatt = set('Hatterene', 'Life Orb', 'Magic Bounce', ['Trick Room', 'Psychic', 'Dazzling Gleam', 'Mystical Fire'], 'Quiet');
    const slowpex = { ...toxapex, evs: {}, nature: 'Relaxed' };
    const tr = [hatt, slowpex, dragapult];
    expect(rateTeam(tr, noMeta)!.areas.map(a => a.key)).toContain('speed');
    const area = teamSpeedArea(tr, noMeta);
    const room = (name: string) => area.members.find(m => m.species === name)!.gains.find(g => g.condition === 'trickroom');
    expect(room('Toxapex')!.source).toBe('Trick Room');
    // La quota di Trick Room è un quarto: il guadagno massimo è 0,25
    expect(room('Toxapex')!.gain).toBeGreaterThan(0.15);
    expect(room('Dragapult')).toBeUndefined();
    // Senza Trick Room la condizione non c'è
    expect(teamSpeedArea([slowpex, dragapult], noMeta).members.some(m => m.gains.some(g => g.condition === 'trickroom'))).toBe(false);
  });

  it('team vuoto o di sconosciuti: 0, niente NaN', () => {
    expect(teamSpeedArea([], noMeta).value).toBe(0);
    expect(teamSpeedArea([set('Fakemon', '', '', [])], noMeta).value).toBe(0);
  });
});

describe('riferimento della velocità', () => {
  it('i Pokémon del tier del formato, evoluti, alla velocità massima', async () => {
    const { referenceSpeeds } = await import('../../src/engine/speed');
    const ou = referenceSpeeds('ou');
    const ubers = referenceSpeeds('ubers');
    expect(ou.length).toBeGreaterThan(0);
    // In Ubers giocano anche gli OU: il riferimento è più ampio
    expect(ubers.length).toBeGreaterThan(ou.length);
    expect([...ou].sort((a, b) => a - b)).toEqual(ou);
  });
});

describe('malus: Trick Room in un team veloce', () => {
  const fast = (species: string) => set(species, 'Life Orb', '', ['Thunderbolt'], 'Timid');
  const hatt = set('Hatterene', 'Focus Sash', 'Magic Bounce', ['Trick Room', 'Psychic'], 'Quiet');

  it('−1 per ogni membro veloce (supera almeno metà del meta), al massimo −3', () => {
    const team = [hatt, fast('Regieleki'), fast('Dragapult'), fast('Iron Bundle'), fast('Electrode-Hisui'), fast('Meowscarada')];
    const rating = rateTeam(team, fixtureData)!;
    const item = rating.penalty.items.find(i => i.text.startsWith('Trick Room di Hatterene rallenta'))!;
    expect(item.points).toBe(3);
    const two = rateTeam([hatt, fast('Regieleki'), fast('Dragapult'), toxapex], fixtureData)!;
    expect(two.penalty.items.find(i => i.text.startsWith('Trick Room'))!.points).toBe(2);
  });

  it('un vero team Trick Room (tutti lenti) non perde niente; senza Trick Room nemmeno', () => {
    const slow = (species: string) => set(species, 'Leftovers', '', ['Body Slam'], 'Brave');
    const team = [hatt, { ...toxapex, nature: 'Relaxed', evs: {} }, slow('Ursaluna'), slow('Torkoal')].map(s => ({ ...s, evs: {} }));
    expect(rateTeam(team, fixtureData)!.penalty.items.some(i => i.text.startsWith('Trick Room'))).toBe(false);
    expect(rateTeam([fast('Regieleki'), fast('Dragapult')], fixtureData)!.penalty.items.some(i => i.text.startsWith('Trick Room'))).toBe(false);
  });
});

describe('Trick Room non si punisce due volte', () => {
  const fast = (species: string, moves = ['Thunderbolt']) => set(species, 'Life Orb', '', moves, 'Timid');
  it('con "Trick Room in team veloce" la stessa Trick Room non è anche attivatore inutilizzato; la pioggia inutilizzata resta', () => {
    const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['U-turn', 'Roost'], 'Bold');
    const team = [fast('Dragapult', ['Trick Room', 'Shadow Ball']), fast('Regieleki'), fast('Iron Bundle'), pelipper];
    const items = rateTeam(team, fixtureData)!.penalty.items;
    expect(items.some(i => i.catalog === 'trickRoomFast')).toBe(true);
    const unused = items.filter(i => i.catalog === 'unusedEnabler');
    expect(unused.map(i => i.text)).toEqual([expect.stringContaining('Pelipper')]);
  });
});

describe('controllo e malus: casi limite', () => {
  const fast = (species: string) => set(species, 'Life Orb', '', ['Thunderbolt'], 'Timid');

  it('una mossa di controllo che non aiuta nessuno compare comunque, con +0', () => {
    const roomPult = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Trick Room', 'Shadow Ball'], 'Timid');
    const area = teamSpeedArea([roomPult, fast('Iron Valiant')], fixtureData);
    const room = area.sources.find(src => src.move === 'Trick Room')!;
    expect(room).toMatchObject({ by: ['Dragapult'], helped: 0, plus: 0 });
  });

  it('un solo membro veloce: il testo è al singolare', () => {
    const hatt = set('Hatterene', 'Focus Sash', 'Magic Bounce', ['Trick Room', 'Psychic'], 'Quiet');
    const rating = rateTeam([hatt, fast('Regieleki'), toxapex], fixtureData)!;
    const item = rating.penalty.items.find(i => i.text.startsWith('Trick Room'))!;
    expect(item.text).toBe('Trick Room di Hatterene rallenta 1 membro veloce (Regieleki)');
    expect(item.points).toBe(1);
  });

  it('il malus resta dentro il tetto delle penalità', () => {
    const hatt = set('Hatterene', 'Focus Sash', 'Magic Bounce', ['Trick Room', 'Psychic'], 'Quiet');
    const team = [hatt, fast('Regieleki'), fast('Dragapult'), fast('Iron Bundle'), fast('Electrode-Hisui'), fast('Meowscarada')];
    // Senza i buchi in Difesa e i Senza risposta (un team di soli attaccanti veloci ne ha), che non dipendono dalla Trick Room
    const items = rateTeam(team, fixtureData)!.penalty.items.filter(i => i.catalog !== 'defenseHole' && i.catalog !== 'unanswered');
    expect(items.reduce((acc, i) => acc + i.points, 0)).toBeLessThanOrEqual(15);
  });
});


describe('i tank pesano metà nella Velocità', () => {
  const tankApex: TeamSet = { ...toxapex, evs: { hp: 252, def: 252, spd: 4 } };
  it('un Toxapex con 350+ EV difensivi pesa metà degli altri; senza EV difensivi pesa pieno', () => {
    const tanked = teamSpeedArea([dragapult, valiant, tankApex], noMeta);
    const [d, v, t] = ['Dragapult', 'Iron Valiant', 'Toxapex'].map(name => tanked.members.find(m => m.species === name)!);
    expect(t.tank).toBe(true);
    expect(tanked.value).toBe(softScore((d.total + v.total + 0.5 * t.total) / 2.5));
    const plain = teamSpeedArea([dragapult, valiant, toxapex], noMeta);
    expect(plain.members.some(m => m.tank)).toBe(false);
    expect(plain.value).toBe(softScore(plain.members.reduce((a, m) => a + m.total, 0) / 3));
    expect(tanked.value).toBeGreaterThan(plain.value);
  });

  it('un team di soli tank torna alla media normale', () => {
    const area = teamSpeedArea([tankApex], noMeta);
    expect(area.value).toBe(softScore(area.members[0].total));
  });
});
