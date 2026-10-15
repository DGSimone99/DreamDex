import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { MAX_BONUS, MAX_PENALTY, rateTeam, redundancies } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const items = (team: TeamSet[]) => redundancies(team, analyzeTeam(team, fixtureData)).items;

describe('ridondanze', () => {
  it('debolezze accumulate: ogni debole scoperto oltre il primo', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    // Ice è raro nella fixture (peso 0): 1 punto per debole in più invece di 2
    expect(items(team)).toContainEqual({ text: '3 membri deboli a Ice, nessuno resiste', points: 2 });
  });

  it('debolezze su tipi frequenti pesano doppio', () => {
    const team = [withMoves('Great Tusk', []), withMoves('Garchomp', []), withMoves('Toxapex', [])];
    // Ground: Toxapex debole, Tusk e Garchomp neutri → 1 solo debole, nessuna penalità
    expect(items(team).some(i => i.text.includes('Ground'))).toBe(false);
    const water = [withMoves('Great Tusk', []), withMoves('Landorus-Therian', []), withMoves('Hippowdon', [])];
    // Water: 3 deboli, Water è frequente nella fixture → 2 punti per debole in più
    expect(items(water)).toContainEqual({ text: '3 membri deboli a Water, nessuno resiste', points: 4 });
  });

  it('stesso hazard da più membri', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock']), withMoves('Kingambit', ['Stone Axe'])];
    expect(items(team)).toContainEqual({ text: '3 setter di Stealth Rock', points: 4 });
  });

  it('più rimozioni hazard', () => {
    const team = [withMoves('Great Tusk', ['Rapid Spin']), withMoves('Corviknight', ['Defog'])];
    expect(items(team)).toContainEqual({ text: '2 rimozioni hazard', points: 1 });
  });

  it('tre o più membri dello stesso tipo', () => {
    const team = ['Gholdengo', 'Kingambit', 'Corviknight'].map(n => withMoves(n, []));
    expect(items(team)).toContainEqual({ text: '3 membri di tipo Steel', points: 1 });
  });

  it('team senza ridondanze', () => {
    expect(redundancies([tusk, gholdengo], analyzeTeam([tusk, gholdengo], fixtureData))).toEqual({ total: 0, items: [] });
  });

  it('penalità massima', () => {
    const team = Array(6).fill(0).map(() => withMoves('Great Tusk', ['Stealth Rock', 'Rapid Spin']));
    expect(redundancies(team, analyzeTeam(team, fixtureData)).total).toBe(MAX_PENALTY);
  });
});

describe('penalità e bonus del meteo', () => {
  const garchomp = withMoves('Garchomp', ['Earthquake']);
  const texts = (team: TeamSet[]) => rateTeam(team, fixtureData)!.penalty.items;

  it('membro senza la condizione che gli serve: −3', () => {
    expect(texts([{ ...withMoves('Leafeon', ['Leaf Blade']), ability: 'Chlorophyll' }, garchomp]))
      .toContainEqual({ text: 'Leafeon ha Chlorophyll ma il team non porta il sole', points: 3 });
  });

  it('abilitatore che potenzia solo sé stesso: −1', () => {
    expect(texts([{ ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' }, garchomp]))
      .toContainEqual({ text: 'Drought di Ninetales potenzia solo le sue mosse', points: 1 });
  });

  it('abilitatore che non serve a nessuno: −2', () => {
    expect(texts([{ ...withMoves('Pelipper', ['U-turn', 'Roost']), ability: 'Drizzle' }, garchomp]))
      .toContainEqual({ text: 'Drizzle di Pelipper non sfruttato', points: 2 });
  });

  it('meteo in conflitto: −3', () => {
    const team = [{ ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' }, { ...withMoves('Pelipper', ['Hurricane']), ability: 'Drizzle' }];
    expect(texts(team)).toContainEqual({ text: 'Meteo in conflitto: Ninetales (Drought), Pelipper (Drizzle)', points: 3 });
  });

  it('mosse indebolite dal meteo del team: −2 se STAB, −1 se coverage', () => {
    const team = [
      { ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' },
      withMoves('Kingdra', ['Hydro Pump']),
      withMoves('Kyurem', ['Surf']),
    ];
    expect(texts(team)).toContainEqual({ text: 'Il sole di Ninetales indebolisce le mosse Water di Kingdra', points: 2 });
    expect(texts(team)).toContainEqual({ text: 'Il sole di Ninetales indebolisce le mosse Water di Kyurem', points: 1 });
  });

  it('il coaching segnala conflitti e mosse indebolite', () => {
    const team = [
      { ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' },
      { ...withMoves('Pelipper', ['Hurricane']), ability: 'Drizzle' },
    ];
    const problems = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.map(p => p.text);
    expect(problems).toContain('Meteo in conflitto: Ninetales (Drought), Pelipper (Drizzle)');
    expect(problems).toContain('La pioggia di Pelipper indebolisce le mosse Fire di Ninetales');
  });

  it('bonus: +2 per ogni membro riportato a neutro, massimo +6', () => {
    const team = [{ ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' }, withMoves('Great Tusk', ['Headlong Rush'])];
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.bonus).toEqual({ total: 4, items: [{ text: 'Il sole di Ninetales smorza Water: Ninetales, Great Tusk', points: 4 }] });
    expect(rating.overall).toBe(Math.min(100, Math.max(0, rating.base - rating.penalty.total + rating.bonus.total)));
    expect(MAX_BONUS).toBe(6);
  });

  it('senza meteo nessun bonus', () => {
    expect(rateTeam([tusk, gholdengo], fixtureData)!.bonus).toEqual({ total: 0, items: [] });
  });
});

describe('voto con ridondanze', () => {
  it('la penalità si sottrae al voto complessivo', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock'])];
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.penalty.total).toBeGreaterThan(0);
    expect(rating.overall).toBe(Math.max(0, rating.base - rating.penalty.total + rating.bonus.total));
  });

  it('il coaching segnala i ruoli doppi e i tipi ripetuti', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock'])];
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual({ severity: 'minor', text: 'Ridondanza: 2 setter di Stealth Rock', fixes: [] });
  });
});
