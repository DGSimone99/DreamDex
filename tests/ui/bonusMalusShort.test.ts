import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { redundancies, type CatalogKey, type Redundancy } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { shortCase } from '../../src/ui/bonusMalusShort';
import { fixtureData, fixtureStats } from '../fixtures/data';

const item = (text: string, parts?: Record<string, string>): Redundancy => ({ text, points: 1, ...(parts && { parts }) });
/** Il corto come lo chiede la medaglia: col lungo unito da " · " (qui non serve, basta che sia lungo). */
const short = (key: CatalogKey, items: Redundancy[], lang: 'it' | 'en' = 'it') => shortCase(key, items, lang, 'x'.repeat(200));

describe('caso corto delle medaglie Bonus/Malus', () => {
  it('Buco in Difesa: "Nessuno regge" una volta sola', () => {
    const items = [item('Nessuno regge Acqua', { type: 'Acqua' }), item('Nessuno regge Elettro', { type: 'Elettro' })];
    expect(short('defenseHole', items)).toBe('Nessuno regge: Acqua, Elettro');
    expect(short('defenseHole', [item('', { type: 'Water' }), item('', { type: 'Electric' })], 'en')).toBe('Nobody takes: Water, Electric');
  });

  it('Debolezza accumulata: "deboli" solo sul primo tipo', () => {
    const items = [item('', { n: '3', type: 'Acqua' }), item('', { n: '2', type: 'Elettro' })];
    expect(short('sharedWeak', items)).toBe('Nessuno resiste: Acqua (3 deboli), Elettro (2)');
    expect(short('sharedWeak', items, 'en')).toBe('Nobody resists: Acqua (3 weak), Elettro (2)');
  });

  it('Tipi doppioni e Hazard doppio: il numero e il nome', () => {
    expect(short('sameType', [item('', { n: '3', type: 'Acqua' }), item('', { n: '3', type: 'Volante' })])).toBe('3 Acqua, 3 Volante');
    expect(short('hazardDuplicate', [item('', { n: '2', hazard: 'Stealth Rock' }), item('', { n: '2', hazard: 'Spikes' })], 'en')).toBe('2 Stealth Rock, 2 Spikes');
  });

  it('Senza setter: chi aspetta la stessa condizione insieme', () => {
    const items = [
      item('', { member: 'Kingdra', via: 'Nuotovelox', condition: 'la pioggia' }),
      item('', { member: 'Ludicolo', via: 'Nuotovelox', condition: 'la pioggia' }),
      item('', { member: 'Venusaur', via: 'Clorofilla', condition: 'il sole' }),
    ];
    expect(short('unmetCondition', items)).toBe('Manca la pioggia: Kingdra e Ludicolo · Manca il sole: Venusaur');
    expect(short('unmetCondition', [item('', { member: 'Kingdra', via: 'Swift Swim', condition: 'rain' })], 'en')).toBe('No rain: Kingdra');
  });

  it('Setter a vuoto: lo stesso membro una volta sola', () => {
    const items = [item('', { member: 'Pelipper', via: 'Piovischio' }), item('', { member: 'Pelipper', via: 'Danzapioggia' }), item('', { member: 'Hatterene', via: 'Trick Room' })];
    expect(short('unusedEnabler', items)).toBe('Piovischio e Danzapioggia di Pelipper, Trick Room di Hatterene');
    expect(short('unusedEnabler', items.slice(0, 2), 'en')).toBe("Pelipper's Piovischio and Danzapioggia");
  });

  it('Peso morto, Mosse bloccate, Troppo veloci per la Room', () => {
    expect(short('weakMember', [item('', { member: 'Raticate' })])).toBe('Troppo debole: Raticate');
    expect(short('weakMember', [item('', { member: 'Raticate' }), item('', { member: 'Delibird' })])).toBe('Troppo deboli: Raticate e Delibird');
    expect(short('lockedStatus', [item('', { member: 'Hippowdon', item: 'Lentiscelta', moves: 'Levitoroccia, Mulinello' })])).toBe('Hippowdon: Lentiscelta con mosse di stato');
    expect(short('lockedStatus', [item('', { member: 'Hippowdon', item: 'Choice Specs', moves: 'Stealth Rock' })], 'en')).toBe('Hippowdon: Choice Specs with status moves');
    expect(short('lockedStatus', [item('', { member: 'Hippowdon', item: 'Lentiscelta', moves: 'Levitoroccia' }), item('', { member: 'Barraskewda', item: 'Bendascelta', moves: 'Danzaspada' })])).toBe('Hippowdon e Barraskewda con mosse di stato');
    expect(short('trickRoomFast', [item('', { list: 'Dragapult, Weavile' })])).toBe('Rallenta Dragapult, Weavile');
  });

  it('Scontro di climi, Clima sfruttato, Scudo del clima, Rete di sicurezza', () => {
    expect(short('weatherClash', [item('', { kind: 'Meteo', list: 'Pelipper (Piovischio), Hippowdon (Sabbiafiume)' })])).toBe('Meteo: Pelipper, Hippowdon');
    expect(short('conditionUsed', [item('', { condition: 'La pioggia', setter: 'Pelipper', list: 'Barraskewda, Kingdra' })])).toBe('La pioggia per Barraskewda, Kingdra');
    expect(short('weatherHelp', [item('', { condition: 'Sun', setter: 'Ninetales', list: 'Great Tusk' })], 'en')).toBe('Sun helps Great Tusk');
    expect(short('weakCovered', [item('Ogni debolezza condivisa ha chi la resiste')])).toBe('Ogni debolezza ha chi la resiste');
  });

  it('niente corto senza i pezzi, per i tipi vari, o se non è più corto del lungo', () => {
    expect(short('defenseHole', [item('Nessuno regge Acqua')])).toBeNull();
    expect(short('typeVariety', [item('11 tipi diversi', { n: '11' })])).toBeNull();
    expect(shortCase('defenseHole', [item('Nessuno regge Acqua', { type: 'Acqua' })], 'it', 'Nessuno regge Acqua')).toBeNull();
  });

  it('il motore dà i pezzi alle voci (nella lingua del voto)', () => {
    const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock']), mostCommonSet(fixtureStats, 'Dragapult')!];
    const all = redundancies(team, analyzeTeam(team, fixtureData), 'en').items;
    expect(all).toContainEqual(expect.objectContaining({ catalog: 'hazardDuplicate', parts: { n: '2', hazard: 'Stealth Rock' } }));
    expect(all).toContainEqual(expect.objectContaining({ catalog: 'sharedWeak', parts: { n: '3', type: 'Ice' } }));
  });
});
