import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { softScore } from '../../src/engine/scale';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { outspeedShare, speedPool, speedStat } from '../../src/engine/speed';
import { getSpecies } from '../../src/engine/dex';
import { fixtureData } from '../fixtures/data';
import { CONDITION_QUOTA, CONTROL_CONDITIONS, isWebImmune, memberSpeed, rivalSet, slowFactor, SPEED_FULL, SPEED_RANK_WEIGHTS, speedPart } from '../../src/engine/speedArea';
import { bestHit } from '../../src/engine/damage';

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

  it('Tailwind e paralisi a un ottavo; Web, Trick Room e priorità a un quarto', () => {
    expect(CONDITION_QUOTA).toEqual({ setup: 0.5, weather: 0.5, booster: 0.5, unburden: 0.5, priority: 0.25, web: 0.25, trickroom: 0.25, tailwind: 0.125, slow: 0.125 });
    // Stun Spore del compagno: paralisi, avversari a metà velocità
    const p = memberSpeed(pex, [pex, webber], noMeta)!;
    const slow = p.gains.find(g => g.condition === 'slow')!;
    expect(slow.source).toBe('Stun Spore');
    // Gli immuni (Elettro, Erba per le polveri) non rallentano
    const slowed = outspeedShare(p.speed, pool.map(r => ({ ...r, value: Math.floor(r.value * slowFactor('stunspore', r.species)) })), 'Toxapex');
    expect(slow.gain).toBeCloseTo(CONDITION_QUOTA.slow * (slowed - p.raw));
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

  it('la parte Velocità: ogni membro pesato dal più veloce 30/30/20/10/5/5, poi la scala morbida', () => {
    expect(SPEED_RANK_WEIGHTS).toEqual([30, 30, 20, 10, 5, 5]);
    const team = [pex, dnite, barra, pelipper, webber, smasher];
    const members = team.map(s => memberSpeed(s, team, noMeta)!);
    const sorted = [...members].sort((a, b) => b.speed - a.speed);
    const mean = sorted.reduce((a, m, i) => a + SPEED_RANK_WEIGHTS[i] * m.total, 0) / 100;
    // Piena (circa 93) quando il team supera in media il 90% del gruppo: i più lenti del meta li supera chiunque
    expect(SPEED_FULL).toBe(1);
    expect(speedPart(members)).toBe(softScore(mean / SPEED_FULL));
    expect(speedPart(members)).toBeLessThan(100);
    // Con meno membri si normalizza sui pesi usati (i primi due: 30 + 30)
    expect(speedPart(members.slice(0, 2))).toBe(softScore([...members.slice(0, 2)].sort((a, b) => b.speed - a.speed).reduce((a, m, i) => a + SPEED_RANK_WEIGHTS[i] * m.total, 0) / 60 / SPEED_FULL));
    expect(speedPart([])).toBe(0);
  });
});

describe('Priorità come il setup: chi colpisce per primo anche i più veloci', () => {
  const gambit = set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Sucker Punch', 'Kowtow Cleave', 'Iron Head', 'Swords Dance'], 'Adamant', 0);
  const slowpoke = set('Slowking', 'Leftovers', 'Regenerator', ['Scald', 'Slack Off'], 'Calm', 0);
  const target = set('Dragapult', 'Choice Specs', 'Infiltrator', ['Draco Meteor'], 'Timid');

  it('priorityOnly: solo le mosse prioritarie; Fake Out conta metà', () => {
    expect(bestHit(gambit, target, { priorityOnly: true })!.move).toBe('Sucker Punch');
    expect(bestHit(slowpoke, target, { priorityOnly: true })).toBeNull();
    const faker = set('Incineroar', '', 'Blaze', ['Fake Out'], 'Adamant', 0);
    const plain = bestHit(faker, target)!;
    expect(bestHit(faker, target, { priorityOnly: true })!.expected).toBeCloseTo(plain.expected / 2);
  });

  it("Sucker Punch vale tre quarti: fallisce se l'avversario non attacca", () => {
    const plain = bestHit(gambit, target, { superEffectiveOnly: false })!;
    const sucker = bestHit({ ...gambit, moves: ['Sucker Punch'] }, target)!;
    expect(bestHit({ ...gambit, moves: ['Sucker Punch'] }, target, { priorityOnly: true })!.expected).toBeCloseTo(sucker.expected * 0.75);
    expect(plain).toBeTruthy();
  });

  it('il guadagno: un quarto dei più veloci colpiti per primi, ognuno pesato dal danno (metà PS vale pieno)', () => {
    const m = memberSpeed(gambit, [gambit], noMeta)!;
    const prio = m.gains.find(g => g.condition === 'priority')!;
    expect(prio.source).toBe('Sucker Punch');
    expect(CONDITION_QUOTA.priority).toBe(0.25);
    const rivals = pool.filter(r => r.species !== 'Kingambit');
    const neutral = (species: string) => ({ species, item: '', ability: getSpecies(species)!.abilities[0], moves: [], nature: 'Hardy', evs: {} });
    const credit = (species: string) => Math.min(1, (bestHit(gambit, neutral(species), { priorityOnly: true })?.expected ?? 0) / 0.5);
    const hand = rivals.reduce((acc, r) => acc + (r.value > m.speed ? credit(r.species) : r.value === m.speed ? credit(r.species) / 2 : 0), 0) / rivals.length;
    expect(prio.gain).toBeCloseTo(CONDITION_QUOTA.priority * hand);
  });

  it('senza mosse prioritarie nessun guadagno', () => {
    expect(memberSpeed(slowpoke, [slowpoke], noMeta)!.gains.some(g => g.condition === 'priority')).toBe(false);
  });

  it('Grassy Glide è prioritario anche col Grassy Terrain di un compagno', () => {
    const rilla = set('Rillaboom', 'Choice Band', 'Overgrow', ['Grassy Glide', 'Wood Hammer'], 'Adamant', 0);
    const bulu = set('Tapu Bulu', 'Leftovers', 'Grassy Surge', ['Horn Leech'], 'Adamant', 0);
    expect(memberSpeed(rilla, [rilla], noMeta)!.gains.some(g => g.condition === 'priority')).toBe(false);
    expect(memberSpeed(rilla, [rilla, bulu], noMeta)!.gains.find(g => g.condition === 'priority')?.source).toBe('Grassy Glide');
  });
});

describe('Velocità: casi particolari', () => {
  it('il meteo che porta il membro stesso vale anche se un compagno ne porta un altro', () => {
    const torkoal = set('Torkoal', 'Heat Rock', 'Drought', ['Lava Plume'], 'Bold', 0);
    const ownRain = { ...barra, item: 'Life Orb', moves: ['Rain Dance', 'Liquidation'] };
    expect(memberSpeed(ownRain, [torkoal, ownRain], noMeta)!.gains.find(g => g.condition === 'weather')?.source).toBe('Swift Swim');
  });

  it('Unburden: anche Power Herb, Focus Sash, Weakness Policy e simili si consumano', () => {
    for (const item of ['Power Herb', 'Focus Sash', 'Weakness Policy', 'Throat Spray', 'Eject Button', 'Red Card']) {
      const hawlucha = set('Hawlucha', item, 'Unburden', ['Close Combat', 'Sky Attack'], 'Adamant');
      expect(memberSpeed(hawlucha, [hawlucha], noMeta)!.gains.some(g => g.condition === 'unburden')).toBe(true);
    }
  });

  it('si esclude solo la propria forma (le Mega contano come la base)', () => {
    const pool = [{ species: 'Rotom-Heat', value: 100, scarf: false, weight: 1 }, { species: 'Garchomp', value: 100, scarf: false, weight: 1 }];
    expect(outspeedShare(200, pool, 'Rotom-Wash')).toBe(1);
    expect(outspeedShare(200, pool.slice(0, 1).concat({ species: 'Rotom-Wash', value: 300, scarf: false, weight: 1 }), 'Rotom-Wash')).toBe(1);
    expect(outspeedShare(50, pool, 'Garchomp-Mega')).toBe(0);
  });

  it('il gruppo non contiene Pokémon sconosciuti', () => {
    expect(speedPool(fixtureData).every(r => !!getSpecies(r.species))).toBe(true);
  });

  it('Sticky Web: Air Balloon protegge come Levitate e i Volanti', () => {
    expect(isWebImmune('Heatran', 'Flash Fire', 'Air Balloon')).toBe(true);
    expect(isWebImmune('Corviknight', 'Pressure', 'Leftovers')).toBe(true);
    expect(isWebImmune('Rotom-Wash', 'Levitate', 'Leftovers')).toBe(true);
    expect(isWebImmune('Heatran', 'Flash Fire', 'Leftovers')).toBe(false);
  });

  it('paralisi e cali di velocità rispettano le immunità di tipo', () => {
    expect(slowFactor('thunderwave', 'Garchomp')).toBe(1);
    expect(slowFactor('thunderwave', 'Pikachu')).toBe(1);
    expect(slowFactor('thunderwave', 'Toxapex')).toBe(0.5);
    expect(slowFactor('stunspore', 'Venusaur')).toBe(1);
    expect(slowFactor('bulldoze', 'Corviknight')).toBe(1);
    expect(slowFactor('icywind', 'Toxapex')).toBeCloseTo(2 / 3);
  });

});

describe("Velocità: l'ordine dei membri non conta", () => {
  it('a pari velocità le posizioni si dividono il peso', () => {
    const a = { species: 'A', speed: 300, raw: 0.5, gains: [], own: 0.9, total: 0.9, controlOptions: [], cells: [] };
    const b = { species: 'B', speed: 300, raw: 0.5, gains: [], own: 0.5, total: 0.5, controlOptions: [], cells: [] };
    const c = { species: 'C', speed: 100, raw: 0.1, gains: [], own: 0.1, total: 0.1, controlOptions: [], cells: [] };
    expect(speedPart([a, b, c])).toBe(speedPart([b, a, c]));
    // Le due posizioni in parità valgono (30 + 30) / 2 ciascuna, la terza 20
    expect(speedPart([a, b, c])).toBe(softScore((30 * 0.9 + 30 * 0.5 + 20 * 0.1) / 80 / SPEED_FULL));
  });

  it('con più mosse che rallentano conta la migliore, in qualunque ordine', () => {
    const wave = set('Clefable', 'Leftovers', 'Magic Guard', ['Thunder Wave', 'Moonblast'], 'Bold', 0);
    const spore = set('Amoonguss', 'Black Sludge', 'Regenerator', ['Stun Spore', 'Giga Drain'], 'Bold', 0);
    const one = memberSpeed(pex, [pex, spore, wave], noMeta)!.gains.find(g => g.condition === 'slow')!;
    const two = memberSpeed(pex, [pex, wave, spore], noMeta)!.gains.find(g => g.condition === 'slow')!;
    expect(one).toEqual(two);
  });
});

describe('Velocità e Controllo Velocità', () => {
  it('le condizioni del team sono il controllo, quelle del membro la sua velocità', () => {
    expect(CONTROL_CONDITIONS).toEqual(['web', 'trickroom', 'tailwind', 'slow']);
    const m = memberSpeed(pex, [pex, webber], noMeta)!;
    const own = m.gains.filter(g => !CONTROL_CONDITIONS.includes(g.condition)).reduce((a, g) => a + g.gain, 0);
    expect(m.own).toBeCloseTo(Math.min(1, m.raw + own));
    expect(m.total).toBeGreaterThanOrEqual(m.own);
  });
});

describe('priorità e condizioni: casi rifiniti', () => {
  it('senza meta gli avversari hanno lo stesso set della velocità che si assume: 252 in Velocità con natura che la alza', () => {
    const r = rivalSet('Dragapult', noMeta);
    expect(r.evs.spe).toBe(252);
    expect(['Jolly', 'Timid']).toContain(r.nature);
  });

  it('il meteo del team potenzia le mosse prioritarie (la pioggia di Pelipper e Aqua Jet)', () => {
    const azu = set('Azumarill', 'Choice Band', 'Huge Power', ['Aqua Jet', 'Play Rough'], 'Adamant', 0);
    const dry = memberSpeed(azu, [azu], noMeta)!.gains.find(g => g.condition === 'priority')!.gain;
    const wet = memberSpeed(azu, [azu, pelipper], noMeta)!.gains.find(g => g.condition === 'priority')!.gain;
    expect(wet).toBeGreaterThan(dry);
  });

  it('il nome della priorità è la mossa che porta più guadagno, non la prima trovata', () => {
    const luc = set('Lucario', 'Life Orb', 'Inner Focus', ['Vacuum Wave', 'Extreme Speed', 'Bullet Punch'], 'Adamant');
    const m = memberSpeed(luc, [luc], noMeta)!;
    const g = m.gains.find(x => x.condition === 'priority')!;
    const only = (move: string) => memberSpeed({ ...luc, moves: [move] }, [], noMeta)!.gains.find(x => x.condition === 'priority')?.gain ?? 0;
    const best = ['Vacuum Wave', 'Extreme Speed', 'Bullet Punch'].sort((a, b) => only(b) - only(a))[0];
    expect(g.source).toBe(best);
  });

  it('con Trick Room gli altri controlli non si sommano: conta il migliore fra Trick Room e il resto', () => {
    const slowpoke = set('Slowbro', 'Leftovers', 'Regenerator', ['Scald', 'Slack Off'], 'Relaxed', 0);
    const hatt = set('Hatterene', 'Focus Sash', 'Magic Bounce', ['Trick Room', 'Psychic'], 'Quiet', 0);
    const wind = set('Whimsicott', 'Focus Sash', 'Prankster', ['Tailwind', 'Moonblast'], 'Timid');
    const m = memberSpeed(slowpoke, [slowpoke, hatt, wind], noMeta)!;
    const room = m.gains.find(g => g.condition === 'trickroom')!.gain;
    const others = m.gains.filter(g => CONTROL_CONDITIONS.includes(g.condition) && g.condition !== 'trickroom').reduce((a, g) => a + g.gain, 0);
    expect(m.total).toBeCloseTo(Math.min(1, m.own + Math.max(room, others)));
  });
});

