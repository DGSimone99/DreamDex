import { describe, expect, it } from 'vitest';
import { provisionalNotes, rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[]): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature: 'Jolly', evs: { hp: 0, atk: 252, def: 0, spa: 0, spd: 4, spe: 252 } });
const team = [
  set('Regieleki', 'Choice Specs', 'Transistor', ['Thunderbolt']), set('Dragapult', 'Choice Band', 'Infiltrator', ['Dragon Darts']),
  set('Iron Bundle', 'Booster Energy', 'Quark Drive', ['Hydro Pump']), set('Electrode-Hisui', 'Life Orb', 'Static', ['Leaf Storm']),
  set('Meowscarada', 'Choice Scarf', 'Protean', ['Flower Trick']), set('Weavile', 'Life Orb', 'Pressure', ['Ice Shard']),
];

describe('Voto provvisorio (avviso, il voto non cambia)', () => {
  it('un team normale non ha avvisi', () => {
    const r = rateTeam(team, fixtureData)!;
    expect(r.notes).toEqual([]);
  });

  it('membro senza mosse: avviso, ma i ruoli mancanti costano come sempre', () => {
    const given = team.map((s, i) => (i === 0 ? { ...s, moves: ['', '', '', ''] } : s));
    const r = rateTeam(given, fixtureData)!;
    expect(r.notes).toEqual(['Regieleki non ha mosse']);
    expect(r.provisional).toBe(false);
  });

  it('mossa e strumento sconosciuti (errore di battitura)', () => {
    const notes = provisionalNotes([set('Weavile', 'Life Orbb', 'Pressure', ['Ice Shard', 'Knock Of'])]);
    expect(notes).toEqual(['Weavile: mossa sconosciuta (Knock Of)', 'Weavile: strumento sconosciuto (Life Orbb)']);
  });

  it('solo mosse sconosciute: anche "non ha mosse"', () => {
    const notes = provisionalNotes([set('Weavile', '', 'Pressure', ['Knock Of', 'Ice Shardd'])], 'en');
    expect(notes).toEqual(['Weavile has no moves', 'Weavile: unknown moves (Knock Of, Ice Shardd)']);
  });

  it('specie sconosciuta; slot vuoto ignorato', () => {
    expect(provisionalNotes([set('Zzzmon', '', '', ['Thunderbolt']), emptySet('')])).toEqual(['Specie sconosciuta: Zzzmon']);
  });

  it('il numero del voto è lo stesso con e senza l\'avviso', () => {
    const typo = team.map((s, i) => (i === 5 ? { ...s, moves: ['Ice Shard', 'Knock Of'] } : s));
    expect(rateTeam(typo, fixtureData)!.overall).toBe(rateTeam(team, fixtureData)!.overall);
  });
});
