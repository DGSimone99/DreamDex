import { describe, expect, it } from 'vitest';
import { bestHit } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs'], extra: Partial<TeamSet> = {}): TeamSet =>
  ({ species, item, ability, moves, nature, evs, ...extra });

const toxapex = set('Toxapex', 'Black Sludge', 'Regenerator', ['Recover'], 'Bold', { hp: 252, def: 252 });
const lopunny = set('Lopunny', 'Lopunnite', 'Limber', ['Close Combat'], 'Jolly', { atk: 252, spe: 252 });

describe('bestHit', () => {
  it('Close Combat di Mega Lopunny su Toxapex difensivo: tra il 15% e il 25%', () => {
    const hit = bestHit(lopunny, toxapex)!;
    expect(hit.move).toBe('Close Combat');
    expect(hit.expected).toBeGreaterThan(0.15);
    expect(hit.expected).toBeLessThan(0.25);
  });

  it('Body Press usa la Difesa: dopo Iron Defense fa più danno', () => {
    const corv = set('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Iron Defense'], 'Impish', { hp: 252, def: 252 });
    expect(bestHit(corv, toxapex, { boosts: { def: 2 } })!.expected).toBeGreaterThan(bestHit(corv, toxapex)!.expected);
  });

  it('solo mosse di stato: nessun colpo', () => {
    expect(bestHit(set('Blissey', 'Heavy-Duty Boots', 'Natural Cure', ['Soft-Boiled', 'Toxic'], 'Bold', { hp: 252, def: 252 }), toxapex)).toBeNull();
  });

  it('il Tera dichiarato conta solo se richiesto', () => {
    const gambit = set('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave'], 'Adamant', { hp: 252, atk: 252 }, { teraType: 'Dark' });
    expect(bestHit(gambit, toxapex, { tera: true })!.expected).toBeGreaterThan(bestHit(gambit, toxapex)!.expected);
  });

  it('la mossa Z solo se richiesta e se il cristallo è del tipo di una mossa', () => {
    const kyurem = set('Kyurem', 'Groundium Z', 'Pressure', ['Earth Power'], 'Timid', { spa: 252, spe: 252 });
    expect(bestHit(kyurem, toxapex, { z: true })!.expected).toBeGreaterThan(bestHit(kyurem, toxapex, { z: false })!.expected);
    const normal = { ...kyurem, item: 'Normalium Z' };
    expect(bestHit(normal, toxapex, { z: true })!.expected).toBe(bestHit(normal, toxapex, { z: false })!.expected);
  });

  it('il meteo passa al calcolo: la pioggia alza l\'Acqua e abbassa il Fuoco', () => {
    const water = set('Barraskewda', 'Choice Band', 'Swift Swim', ['Liquidation'], 'Adamant', { atk: 252, spe: 252 });
    const fire = set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm'], 'Modest', { spa: 252, spe: 252 });
    const target = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Jolly', { hp: 252 });
    expect(bestHit(water, target, { conditions: ['rain'] })!.expected).toBeGreaterThan(bestHit(water, target)!.expected);
    expect(bestHit(fire, target, { conditions: ['rain'] })!.expected).toBeLessThan(bestHit(fire, target)!.expected);
  });

  it('Sheer Cold pesa la sua precisione del 30%', () => {
    const lapras = set('Lapras', 'Leftovers', 'Water Absorb', ['Sheer Cold'], 'Modest', { spa: 252 });
    const hit = bestHit(lapras, toxapex)!;
    expect(hit.expected).toBeLessThanOrEqual(0.31);
    expect(hit.min).toBeGreaterThanOrEqual(1);
  });

  it('Choice Band e Specs valgono ×1,35 invece di ×1,5: il blocco su una mossa è un costo', () => {
    const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Adamant', { atk: 252 });
    const target = set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm'], 'Calm', { hp: 252, spd: 252 });
    const plain = bestHit(chomp, target)!;
    const band = bestHit({ ...chomp, item: 'Choice Band' }, target)!;
    expect(band.expected / plain.expected).toBeGreaterThan(1.3);
    expect(band.expected / plain.expected).toBeLessThan(1.4);
    expect(band.min / plain.min).toBeLessThan(1.4);
  });

  it('una specie sconosciuta non rompe il calcolo', () => {
    expect(bestHit(set('Notamon', '', '', ['Tackle'], 'Hardy', {}), toxapex)).toBeNull();
  });

  describe('abilità, strumento ed EV contano da tutte e due le parti', () => {
    const chomp = set('Garchomp', '', 'Rough Skin', ['Earthquake'], 'Adamant', { atk: 252 });
    const target = set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm'], 'Calm', { hp: 252, spd: 252 });
    it('attaccante: Choice Band, Huge Power, EV e natura', () => {
      expect(bestHit({ ...chomp, item: 'Choice Band' }, target)!.expected).toBeGreaterThan(bestHit(chomp, target)!.expected);
      const azu = set('Azumarill', 'Choice Band', 'Huge Power', ['Play Rough'], 'Adamant', { hp: 252, atk: 252 });
      expect(bestHit(azu, target)!.expected).toBeGreaterThan(bestHit({ ...azu, ability: 'Sap Sipper' }, target)!.expected);
      expect(bestHit(chomp, target)!.expected).toBeGreaterThan(bestHit({ ...chomp, nature: 'Modest', evs: {} }, target)!.expected);
    });
    it('difensore: Assault Vest, Multiscale, EV e natura', () => {
      const specs = set('Kingdra', 'Choice Specs', 'Swift Swim', ['Draco Meteor'], 'Modest', { spa: 252 });
      const tank = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', ['Earthquake'], 'Careful', { hp: 252, spd: 252 });
      expect(bestHit(specs, { ...tank, item: 'Assault Vest' })!.expected).toBeLessThan(bestHit(specs, tank)!.expected);
      const nite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', ['Extreme Speed'], 'Adamant', { hp: 252 });
      expect(bestHit(specs, nite)!.expected).toBeLessThan(bestHit(specs, { ...nite, ability: 'Inner Focus' })!.expected);
      expect(bestHit(chomp, { ...target, nature: 'Bold', evs: { hp: 252, def: 252 } })!.expected)
        .toBeLessThan(bestHit(chomp, { ...target, nature: 'Modest', evs: {} })!.expected);
    });
  });
});

describe('mosse multicolpo e Parental Bond', () => {
  const toxapex = { species: 'Toxapex', item: 'Black Sludge', ability: 'Regenerator', moves: ['Recover'], nature: 'Bold', evs: { hp: 252, def: 252 } };
  it('Icicle Spear con Skill Link somma i colpi', () => {
    const cloyster = { species: 'Cloyster', item: 'Focus Sash', ability: 'Skill Link', moves: ['Icicle Spear'], nature: 'Jolly', evs: { atk: 252, spe: 252 } };
    // 5 colpi da circa il 3% l'uno contro Toxapex difensivo; con 3 colpi sarebbe sotto il 10%
    expect(bestHit(cloyster, toxapex)!.expected).toBeGreaterThan(0.14);
  });
  it('Mega Kangaskhan con Parental Bond fa più danno di Kangaskhan', () => {
    const kanga = { species: 'Kangaskhan', item: 'Life Orb', ability: 'Scrappy', moves: ['Double-Edge'], nature: 'Adamant', evs: { atk: 252, spe: 252 } };
    expect(bestHit({ ...kanga, item: 'Kangaskhanite' }, toxapex)!.expected).toBeGreaterThan(bestHit({ ...kanga, item: 'Leftovers' }, toxapex)!.expected);
  });
});

describe('mosse a due turni', () => {
  const leafeon = { species: 'Leafeon', item: 'Life Orb', ability: 'Chlorophyll', moves: ['Solar Blade'], nature: 'Adamant', evs: { atk: 252, spe: 252 } };
  const target = { species: 'Terapagos', item: 'Leftovers', ability: 'Tera Shift', moves: [], nature: 'Calm', evs: { hp: 252, spd: 252 } };
  it('senza sole Solar Blade carica un turno: vale metà danno', () => {
    const plain = bestHit(leafeon, target)!;
    const sun = bestHit(leafeon, target, { conditions: ['sun'] })!;
    // Al sole è immediata (e non dimezzata); senza sole conta metà
    expect(plain.expected).toBeLessThan(sun.expected * 0.6);
  });
});
