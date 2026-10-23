import { describe, expect, it } from 'vitest';
import { bestHit, standardHit } from '../../src/engine/damage';
import type { TeamSet } from '../../src/engine/sets';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });

const chomp = set('Garchomp', 'Leftovers', 'Rough Skin', ['Earthquake'], 'Adamant', { atk: 252 });
const kyogre = set('Kyogre', 'Leftovers', 'Drizzle', ['Water Spout'], 'Modest', { spa: 252 });

describe('standardHit: colpo standard senza tipo, potenza 100', () => {
  it('conta lo strumento dell\'attaccante (Band col suo sconto da mossa bloccata)', () => {
    const tank = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', [], 'Impish', { hp: 252, def: 252 });
    const ratio = standardHit({ ...chomp, item: 'Choice Band' }, tank, 'Physical')!.expected / standardHit(chomp, tank, 'Physical')!.expected;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.4);
  });

  it('conta strumenti e abilità del difensore: Assault Vest, Eviolite, Multiscale', () => {
    const tingLu = set('Ting-Lu', 'Leftovers', 'Vessel of Ruin', [], 'Careful', { hp: 252, spd: 252 });
    expect(standardHit(kyogre, { ...tingLu, item: 'Assault Vest' }, 'Special')!.expected).toBeLessThan(standardHit(kyogre, tingLu, 'Special')!.expected);
    const chansey = set('Chansey', 'Eviolite', 'Natural Cure', [], 'Bold', { hp: 252, def: 252 });
    expect(standardHit(chomp, chansey, 'Physical')!.expected).toBeLessThan(standardHit(chomp, { ...chansey, item: 'Leftovers' }, 'Physical')!.expected);
    const nite = set('Dragonite', 'Heavy-Duty Boots', 'Multiscale', [], 'Impish', { hp: 252, def: 252 });
    expect(standardHit(chomp, nite, 'Physical')!.expected).toBeLessThan(standardHit(chomp, { ...nite, ability: 'Inner Focus' }, 'Physical')!.expected);
  });

  it('il colpo fisico è di contatto, lo speciale no: Fluffy dimezza solo il fisico', () => {
    const dachs = { species: 'Dachsbun', item: 'Leftovers', ability: 'Fluffy', moves: [], nature: 'Bold', evs: { hp: 252, def: 252 } };
    const baked = { ...dachs, ability: 'Well-Baked Body' };
    const kyogre = { species: 'Kyogre', item: '', ability: 'Drizzle', moves: [], nature: 'Modest', evs: { spa: 252 } };
    expect(standardHit(kyogre, dachs, 'Special')!.max).toBeCloseTo(standardHit(kyogre, baked, 'Special')!.max);
    expect(standardHit(chomp, dachs, 'Physical')!.max).toBeLessThan(standardHit(chomp, baked, 'Physical')!.max * 0.6);
  });

  it('ignora i tipi: Gengar (Spettro) non è immune al colpo standard fisico', () => {
    const gengar = set('Gengar', 'Leftovers', 'Cursed Body', [], 'Bold', { hp: 252, def: 252 });
    expect(standardHit(chomp, gengar, 'Physical')!.expected).toBeGreaterThan(0);
  });

  it('il tiro più alto è sempre almeno il danno medio', () => {
    const hit = standardHit(chomp, kyogre, 'Physical')!;
    expect(hit.max).toBeGreaterThanOrEqual(hit.expected);
    expect(bestHit(chomp, kyogre)!.max).toBeGreaterThanOrEqual(bestHit(chomp, kyogre)!.expected);
  });

  it('una specie sconosciuta non rompe il calcolo', () => {
    expect(standardHit(set('Notamon', '', '', [], 'Hardy', {}), kyogre, 'Physical')).toBeNull();
  });
});
