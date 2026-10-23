import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { softScore } from '../../src/engine/scale';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { outspeedShare, speedPool, speedStat } from '../../src/engine/speed';
import { CONDITION_QUOTA, memberSpeed, SPEED_RANK_WEIGHTS, speedPart } from '../../src/engine/speedArea';

const set = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', spe = 252): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs: { spe } });
const noMeta: EngineData = { stats: null, sets: null };
const pool = speedPool(noMeta);
const share = (speed: number, species: string, opp = 1) => outspeedShare(speed, pool.map(r => ({ ...r, value: Math.floor(r.value * opp) })), species);

const dnite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Dragon Dance', 'Extreme Speed', 'Earthquake', 'Roost'], 'Adamant');
const smasher = set('Cloyster', 'White Herb', 'Skill Link', ['Shell Smash', 'Icicle Spear', 'Rock Blast'], 'Adamant');
const barra = set('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation', 'Close Combat'], 'Adamant');
const pelipper = set('Pelipper', 'Damp Rock', 'Drizzle', ['Hurricane', 'U-turn'], 'Bold', 0);
const webber = set('Ribombee', 'Focus Sash', 'Shield Dust', ['Sticky Web', 'Moonblast', 'Stun Spore'], 'Timid');
const pex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Scald', 'Recover'], 'Bold', 0);

describe('Velocità: ogni membro, coi guadagni delle condizioni', () => {
  it('la velocità pura: quota del gruppo superata (il pareggio vale metà)', () => {
    const m = memberSpeed(pex, [pex], noMeta)!;
    expect(m.speed).toBe(speedStat(pex).value);
    expect(m.raw).toBeCloseTo(share(m.speed, 'Toxapex'));
    expect(m.gains).toEqual([]);
    expect(m.total).toBeCloseTo(m.raw);
  });

  it('il setup aggiunge metà dei Pokémon superati in più (+1 ×1,5, Shell Smash +2 ×2)', () => {
    const d = memberSpeed(dnite, [dnite], noMeta)!;
    const setup = d.gains.find(g => g.condition === 'setup')!;
    expect(setup.source).toBe('Dragon Dance');
    expect(setup.gain).toBeCloseTo(CONDITION_QUOTA.setup * (share(Math.floor(d.speed * 1.5), 'Dragonite') - d.raw));
    const c = memberSpeed(smasher, [smasher], noMeta)!;
    expect(c.gains.find(g => g.condition === 'setup')!.gain).toBeCloseTo(0.5 * (share(c.speed * 2, 'Cloyster') - c.raw));
  });

  it('Swift Swim conta solo con la pioggia del team', () => {
    expect(memberSpeed(barra, [barra], noMeta)!.gains.some(g => g.condition === 'weather')).toBe(false);
    const b = memberSpeed(barra, [barra, pelipper], noMeta)!;
    const rain = b.gains.find(g => g.condition === 'weather')!;
    expect(rain.source).toBe('Swift Swim');
    expect(rain.gain).toBeCloseTo(CONDITION_QUOTA.weather * (share(b.speed * 2, 'Barraskewda') - b.raw));
  });

  it('Sticky Web rallenta gli avversari a terra (non Volanti né Levitate) per tutti i membri', () => {
    const p = memberSpeed(pex, [pex, webber], noMeta)!;
    const web = p.gains.find(g => g.condition === 'web')!;
    expect(web.source).toBe('Sticky Web');
    const slowed = outspeedShare(p.speed, pool.map(r => ({ ...r, value: r.webImmune ? r.value : Math.floor(r.value * 2 / 3) })), 'Toxapex');
    expect(web.gain).toBeCloseTo(CONDITION_QUOTA.web * (slowed - p.raw));
    expect(pool.some(r => r.webImmune)).toBe(true);
  });

  it('Tailwind e paralisi a un quarto', () => {
    expect(CONDITION_QUOTA).toEqual({ setup: 0.5, weather: 0.5, unburden: 0.5, web: 0.5, tailwind: 0.25, slow: 0.25 });
    // Stun Spore del compagno: paralisi, avversari a metà velocità
    const p = memberSpeed(pex, [pex, webber], noMeta)!;
    const slow = p.gains.find(g => g.condition === 'slow')!;
    expect(slow.source).toBe('Stun Spore');
    expect(slow.gain).toBeCloseTo(0.25 * (share(p.speed, 'Toxapex', 0.5) - p.raw));
  });

  it('i guadagni si sommano ma un membro non supera 1', () => {
    const fast = set('Regieleki', 'Choice Scarf', 'Transistor', ['Thunderbolt', 'Tailwind'], 'Timid');
    const m = memberSpeed(fast, [fast, webber], noMeta)!;
    expect(m.total).toBeLessThanOrEqual(1);
    expect(m.total).toBeCloseTo(Math.min(1, m.raw + m.gains.reduce((a, g) => a + g.gain, 0)));
  });

  it('un Pokémon sconosciuto non conta', () => {
    expect(memberSpeed(set('Fakemon', '', '', []), [], noMeta)).toBeNull();
  });

  it('la parte Velocità: ogni membro pesato dal più veloce 25/20/16/14/13/12, poi la scala morbida', () => {
    expect(SPEED_RANK_WEIGHTS).toEqual([25, 20, 16, 14, 13, 12]);
    const team = [pex, dnite, barra, pelipper, webber, smasher];
    const members = team.map(s => memberSpeed(s, team, noMeta)!);
    const sorted = [...members].sort((a, b) => b.speed - a.speed);
    const mean = sorted.reduce((a, m, i) => a + SPEED_RANK_WEIGHTS[i] * m.total, 0) / 100;
    expect(speedPart(members)).toBe(softScore(mean));
    expect(speedPart(members)).toBeLessThan(100);
    // Con meno membri si normalizza sui pesi usati
    expect(speedPart(members.slice(0, 2))).toBe(softScore([...members.slice(0, 2)].sort((a, b) => b.speed - a.speed).reduce((a, m, i) => a + SPEED_RANK_WEIGHTS[i] * m.total, 0) / 45));
    expect(speedPart([])).toBe(0);
  });
});
