import { describe, expect, it } from 'vitest';
import { battleAbility } from '../../src/engine/dex';
import { rateTeam } from '../../src/engine/rating';
import { levelOf } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { unmetBeneficiaries, weakenedMoves } from '../../src/engine/synergy';
import { fixtureData } from '../fixtures/data';

const set = (species: string, moves: string[], ability = '', item = ''): TeamSet => ({ ...emptySet(species), moves, ability, item });
const penalties = (team: TeamSet[]) => rateTeam(team, fixtureData)!.penalty.items;
const texts = (team: TeamSet[]) => penalties(team).map(i => i.text).join(' | ');

/** Malus che colpivano a sproposito i team da torneo (banco del 2026-10-30), corretti uno per uno. */
describe('malus corretti', () => {
  it('debolezza condivisa: nessun malus se almeno un membro resiste a quel tipo', () => {
    // Ice: Garchomp, Landorus-T e Dragapult deboli, Heatran resiste → c'è il cambio, niente punti
    const team = [set('Garchomp', ['Earthquake']), set('Landorus-Therian', ['Earthquake']), set('Dragapult', ['Dragon Darts']), set('Heatran', ['Magma Storm'])];
    expect(texts(team)).not.toMatch(/deboli a Ice/);
  });

  it('debolezza condivisa scoperta: resta 2 punti per ogni debole oltre il primo', () => {
    const team = [set('Garchomp', ['Earthquake']), set('Landorus-Therian', ['Earthquake']), set('Dragapult', ['Dragon Darts'])];
    expect(penalties(team)).toContainEqual(expect.objectContaining({ text: '3 membri deboli a Ice, nessuno resiste', points: 2, catalog: 'sharedWeak' }));
  });

  it('Ditto con Imposter non è un membro debole: copia l\'avversario', () => {
    const team = [set('Ditto', ['Transform'], 'Imposter', 'Choice Scarf'), set('Garchomp', ['Earthquake'])];
    expect(texts(team)).not.toMatch(/Ditto è debole/);
  });

  it('un semi-stall senza attaccanti non perde punti: Sweeper e Wallbreaker minori (2026-11-13); nel balance basta uno dei due', () => {
    for (const key of ['anySweeper', 'anyBreaker'] as const) {
      expect(levelOf('semiStall', key)).toBe('minor');
      expect(levelOf('stall', key)).toBe('minor');
      expect(levelOf('balance', key)).toBe('ignored');
    }
  });

  it('due meteo automatici che si annullano, senza compagni che ne dipendono: nessun conflitto', () => {
    const team = [set('Kyogre', ['Origin Pulse'], 'Drizzle'), set('Koraidon', ['Collision Course'], 'Orichalcum Pulse'), set('Arceus', ['Judgment'], 'Multitype')];
    expect(texts(team)).not.toMatch(/Meteo in conflitto/);
  });

  it('meteo in conflitto con un compagno che dipende da uno dei due: −3', () => {
    const team = [set('Ninetales', ['Flamethrower'], 'Drought'), set('Pelipper', ['U-turn'], 'Drizzle'), set('Kingdra', ['Hydro Pump'], 'Swift Swim')];
    expect(penalties(team)).toContainEqual(expect.objectContaining({ text: 'Meteo in conflitto: Ninetales (Drought), Pelipper (Drizzle)', points: 3 }));
  });

  it('chi porta il meteo opposto non ha mosse indebolite dal meteo del compagno', () => {
    const team = [set('Kyogre', ['Origin Pulse'], 'Drizzle'), set('Groudon', ['Precipice Blades', 'Fire Punch'], 'Drought')];
    expect(weakenedMoves(team)).toEqual([]);
    // Un compagno che non porta meteo resta indebolito
    expect(weakenedMoves([...team, set('Ho-Oh', ['Sacred Fire'], 'Regenerator')])).toEqual([
      expect.objectContaining({ condition: 'rain', setter: 'Kyogre', member: 'Ho-Oh', type: 'Fire', stab: true }),
    ]);
  });

  it('Hydration, Rain Dish, Ice Body e Harvest non sono dipendenze: il Pokémon funziona anche senza meteo', () => {
    expect(unmetBeneficiaries([set('Manaphy', ['Surf'], 'Hydration')])).toEqual([]);
    expect(unmetBeneficiaries([set('Ludicolo', ['Surf'], 'Rain Dish')])).toEqual([]);
    expect(unmetBeneficiaries([set('Walrein', ['Surf'], 'Ice Body')])).toEqual([]);
    expect(unmetBeneficiaries([set('Trevenant', ['Horn Leech'], 'Harvest')])).toEqual([]);
    expect(unmetBeneficiaries([set('Ludicolo', ['Surf'], 'Swift Swim')])).toEqual([{ member: 'Ludicolo', condition: 'rain', via: 'Swift Swim' }]);
  });

  it('Mega e Primal usano sempre la loro unica abilità, anche se il set ne dichiara un\'altra', () => {
    expect(battleAbility({ species: 'Groudon-Primal', item: '', ability: 'Drought' })).toBe('Desolate Land');
    expect(battleAbility({ species: 'Venusaur-Mega', item: '', ability: 'Chlorophyll' })).toBe('Thick Fat');
    expect(battleAbility({ species: 'Groudon', item: 'Red Orb', ability: 'Drought' })).toBe('Desolate Land');
    expect(battleAbility({ species: 'Groudon', item: '', ability: 'Drought' })).toBe('Drought');
  });
});
