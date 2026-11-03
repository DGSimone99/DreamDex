import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { speedPool } from '../../src/engine/speed';
import { CONDITION_QUOTA, CONTROL_CONDITIONS, memberSpeed, teamSpeedArea, type MemberSpeed, type SpeedCell } from '../../src/engine/speedArea';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', spe = 252): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe } });
const noMeta: EngineData = { stats: null, sets: null };

const dnite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant');
const webber = set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore'], 'Timid');
const room = set('Hatterene', 'Leftovers', 'Magic Bounce', ['Trick Room', 'Psychic', 'Draining Kiss', 'Mystical Fire'], 'Quiet', 0);
const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover', 'Haze', 'Toxic'], 'Bold', 0);
const team = [dnite, webber, room, pex];

const wmean = (cells: SpeedCell[], pick: (c: SpeedCell) => number) => {
  const total = cells.reduce((acc, c) => acc + c.weight, 0);
  return cells.reduce((acc, c) => acc + c.weight * pick(c), 0) / total;
};
const ownSum = (m: MemberSpeed) => m.gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition)).reduce((acc, g) => acc + g.gain, 0);
const underCaps = (m: MemberSpeed) => m.raw + ownSum(m) <= 1 && m.total < 1;

describe('celle della Velocità: ogni rivale del gruppo, per ogni membro', () => {
  const members = team.map(s => memberSpeed(s, team, noMeta)!);
  const pool = speedPool(noMeta);

  it('una cella per ogni rivale del gruppo, nello stesso ordine; la propria specie pesa 0', () => {
    for (const m of members) {
      expect(m.cells).toHaveLength(pool.length);
      expect(m.cells.map(c => c.species)).toEqual(pool.map(r => r.species));
    }
    const self = members[0].cells.find(c => c.species === 'Dragonite')!;
    expect(self.weight).toBe(0);
    expect(self.credit).toBe(0);
    expect(self.via).toBeNull();
  });

  it('la media pesata delle celle è il totale del membro (sotto i tetti), mai meno', () => {
    expect(members.filter(underCaps).length).toBeGreaterThanOrEqual(2);
    for (const m of members) {
      const mean = wmean(m.cells, c => c.credit);
      if (underCaps(m)) expect(mean).toBeCloseTo(m.total, 6);
      expect(mean).toBeGreaterThanOrEqual(m.total - 1e-9);
    }
  });

  it('Dragonite: supera i lenti da solo, i medi dopo Dragon Dance; Hatterene supera i veloci con Trick Room', () => {
    const d = members[0];
    const slow = d.cells.find(c => c.weight > 0 && c.speed < d.speed)!;
    expect(slow.base).toBe(1);
    expect(slow.via).toBeNull();
    expect(slow.credit).toBeGreaterThanOrEqual(1);
    const mid = d.cells.find(c => c.weight > 0 && c.speed > d.speed && c.speed < Math.floor(d.speed * 1.5))!;
    expect(mid.base).toBe(0);
    expect(mid.via).toBe('setup');
    expect(mid.source).toBe('Dragon Dance');
    const h = members[2];
    const fast = h.cells.find(c => c.weight > 0 && c.speed > h.speed)!;
    expect(fast.base).toBe(0);
    expect(fast.via).toBe('trickroom');
    expect(fast.source).toBe('Trick Room');
    // Il credito di Trick Room per rivale è la sua quota (un quarto)
    expect(fast.credit).toBeCloseTo(CONDITION_QUOTA.trickroom);
    // Sotto Trick Room un rivale più lento si perde: da 1 a tre quarti
    const slower = h.cells.find(c => c.weight > 0 && c.speed < h.speed);
    if (slower) expect(slower.credit).toBeCloseTo(1 - CONDITION_QUOTA.trickroom);
  });

  it('il controllo nelle celle è quello che vince per il membro (Trick Room oppure Web e paralisi), non il migliore per rivale', () => {
    for (const m of members) {
      const roomGain = m.gains.find(g => g.condition === 'trickroom')?.gain ?? 0;
      const ups = m.gains.filter(g => CONTROL_CONDITIONS.includes(g.condition) && g.condition !== 'trickroom').reduce((acc, g) => acc + g.gain, 0);
      const winner = roomGain > ups ? 'trickroom' : 'speedUps';
      const vias = new Set(m.cells.map(c => c.via));
      if (winner === 'trickroom') { expect(vias.has('web')).toBe(false); expect(vias.has('slow')).toBe(false); }
      else expect(vias.has('trickroom')).toBe(false);
    }
  });

  it('le minacce del team: quante le superano senza condizioni e quante le raggiungono, dalla meno superata', () => {
    const area = teamSpeedArea(team, noMeta);
    expect(area.threats).toHaveLength(pool.length);
    for (const th of area.threats) {
      const cells = area.members.map(m => m.cells[th.index]);
      expect(th.species).toBe(pool[th.index].species);
      expect(th.outsped).toBe(cells.filter(c => c.weight > 0 && c.base === 1).length);
      expect(th.reached).toBe(cells.filter(c => c.weight > 0 && c.credit > 0).length);
    }
    const outsped = area.threats.map(th => th.outsped);
    expect(outsped).toEqual([...outsped].sort((a, b) => a - b));
    expect(area.threats[0].outsped).toBe(0);
    // Con Trick Room ogni rivale veloce è raggiunto da Hatterene; Toxapex da solo, senza condizioni, non raggiunge i più veloci
    const alone = teamSpeedArea([pex], noMeta);
    expect(alone.threats.every(th => Number.isFinite(th.outsped) && Number.isFinite(th.reached))).toBe(true);
    expect(alone.threats[0]).toMatchObject({ outsped: 0, reached: 0 });
    // Dragonite da solo supera i rivali più lenti di lui
    expect(teamSpeedArea([dnite], noMeta).threats.some(th => th.outsped === 1)).toBe(true);
  });
});
