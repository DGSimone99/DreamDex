import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { MAX_PENALTY, rateTeam, redundancies } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';

const withMoves = (species: string, moves: string[]): TeamSet => ({ ...emptySet(species), moves });
const items = (team: TeamSet[]) => redundancies(team, analyzeTeam(team, fixtureData)).items;

describe('ridondanze', () => {
  it('le debolezze condivise non sono una penalità (le misura la Difesa)', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(items(team).some(i => /deboli a/.test(i.text))).toBe(false);
  });

  it('stesso hazard da più membri', () => {
    const team = [withMoves('Great Tusk', ['Stealth Rock']), withMoves('Garchomp', ['Stealth Rock']), withMoves('Kingambit', ['Stone Axe'])];
    expect(items(team)).toContainEqual({ text: '3 setter di Stealth Rock', points: 2 });
  });

  it('più rimozioni hazard', () => {
    const team = [withMoves('Great Tusk', ['Rapid Spin']), withMoves('Corviknight', ['Defog'])];
    expect(items(team)).toContainEqual({ text: '2 rimozioni hazard', points: 1 });
  });

  it('tre o più membri dello stesso tipo', () => {
    const team = ['Gholdengo', 'Kingambit', 'Corviknight'].map(n => withMoves(n, []));
    expect(items(team).some(i => /di tipo Steel/.test(i.text))).toBe(false);
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual(expect.objectContaining({ category: 'redundancy', text: '3 membri di tipo Steel' }));
  });

  it('team senza ridondanze', () => {
    expect(redundancies([tusk, gholdengo], analyzeTeam([tusk, gholdengo], fixtureData))).toEqual({ total: 0, items: [] });
  });

  it('penalità massima', () => {
    // 5 Tusks con Stealth Rock + Spin (4 + 4), un conflitto di meteo (3) e due mosse STAB indebolite (2 + 2)
    const team = [
      ...Array(5).fill(0).map(() => withMoves('Great Tusk', ['Stealth Rock', 'Rapid Spin'])),
      { ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' },
      { ...withMoves('Pelipper', ['Surf']), ability: 'Drizzle' },
    ];
    expect(redundancies(team, analyzeTeam(team, fixtureData)).total).toBe(MAX_PENALTY);
  });
});

describe('penalità e bonus del meteo', () => {
  const garchomp = withMoves('Garchomp', ['Earthquake']);
  const texts = (team: TeamSet[]) => rateTeam(team, fixtureData)!.penalty.items;

  it('membro senza la condizione che gli serve: nessuna penalità, solo il coach', () => {
    const team = [{ ...withMoves('Leafeon', ['Leaf Blade']), ability: 'Chlorophyll' }, garchomp];
    expect(texts(team).map(i => i.text).join(' | ')).not.toMatch(/Chlorophyll/);
    // Il coach lo segnala ancora tra le condizioni
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual(expect.objectContaining({ category: 'conditions', text: expect.stringMatching(/Leafeon.*Chlorophyll/) }));
  });

  it('abilitatore che potenzia almeno sé stesso: nessuna penalità', () => {
    expect(texts([{ ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' }, garchomp]).map(i => i.text).join(' | ')).not.toMatch(/Drought/);
  });

  it('Hurricane senza pioggia: nessuna penalità', () => {
    expect(texts([withMoves('Tornadus-Therian', ['Hurricane', 'U-turn']), garchomp]).map(i => i.text).join(' | ')).not.toMatch(/Hurricane/);
  });

  it('abilitatore che non serve a nessuno: −2', () => {
    expect(texts([{ ...withMoves('Pelipper', ['U-turn', 'Roost']), ability: 'Drizzle' }, garchomp]))
      .toContainEqual({ text: 'Drizzle di Pelipper non sfruttato', points: 2 });
  });

  it('meteo in conflitto: −3', () => {
    const team = [{ ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' }, { ...withMoves('Pelipper', ['Hurricane']), ability: 'Drizzle' }];
    expect(texts(team)).toContainEqual({ text: 'Meteo in conflitto: Ninetales (Drought), Pelipper (Drizzle)', points: 3 });
  });

  it('mosse indebolite dal meteo del team: −1 coverage, −2 STAB', () => {
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

  const ninetales = { ...withMoves('Ninetales', ['Flamethrower']), ability: 'Drought' };
  const bonusOf = (team: TeamSet[]) => rateTeam(team, fixtureData)!.bonus;

  it('bonus: il setter da solo non conta', () => {
    expect(bonusOf([ninetales, withMoves('Kingambit', ['Sucker Punch'])])).toEqual({ total: 0, items: [] });
  });

  it('bonus: +1 una volta sola se il meteo smorza una debolezza di un compagno', () => {
    const team = [ninetales, withMoves('Great Tusk', ['Headlong Rush'])];
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.bonus.total).toBe(1);
    expect(rating.bonus.items).toEqual([expect.objectContaining({ text: 'Il sole di Ninetales aiuta il team: Great Tusk', points: 1 })]);
    expect(rating.overall).toBe(Math.min(100, Math.max(0, rating.base - rating.penalty.total + rating.bonus.total)));
  });

  it('bonus: abilitare Clorofilla non conta più', () => {
    const team = [ninetales, withMoves('Great Tusk', ['Headlong Rush']), { ...withMoves('Leafeon', ['Leaf Blade']), ability: 'Chlorophyll' }];
    const bonus = bonusOf(team);
    expect(bonus.total).toBe(1);
    expect(bonus.items.map(i => i.text).join(' | ')).not.toContain('Leafeon');
  });

  it('bonus: il meteo primordiale da solo con un compagno debole non dà bonus', () => {
    const groudon = { ...withMoves('Groudon-Primal', ['Precipice Blades']), ability: 'Desolate Land' };
    expect(bonusOf([groudon, withMoves('Great Tusk', ['Headlong Rush'])]).total).toBe(0);
  });

  it('bonus: da 4× a 2× non conta', () => {
    const items = bonusOf([ninetales, withMoves('Rhyperior', ['Earthquake'])]).items;
    expect(items.map(i => i.text).join(' | ')).not.toContain('Rhyperior');
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
      .toContainEqual({ severity: 'minor', category: 'redundancy', text: '2 setter di Stealth Rock', fixes: [] });
  });
});

describe('mancanze essenziali dei Ruoli tra le penalità', () => {
  const s = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, hp: 4 }): TeamSet =>
    ({ ...emptySet(species), item, ability, moves, nature, evs });
  const bulky = { hp: 252, def: 252, spd: 4 };
  // Balance tutto fisico senza muro speciale
  const physical: TeamSet[] = [
    s('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off']),
    s('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant'),
    s('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang']),
    s('Dragapult', 'Choice Band', 'Clear Body', ['Dragon Darts', 'U-turn', 'Phantom Force', 'Sucker Punch']),
    s('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', bulky),
    s('Skarmory', 'Rocky Helmet', 'Sturdy', ['Brave Bird', 'Roost', 'Whirlwind', 'Spikes'], 'Impish', bulky),
  ];

  it('team di 6 senza muro speciale in balance: −2 con testo', () => {
    const rating = rateTeam(physical, fixtureData)!;
    expect(rating.teamType).toBe('balance');
    expect(rating.penalty.items).toContainEqual({ text: 'Balance senza muro speciale', points: 2 });
    expect(rating.roles.failures).toContainEqual({ text: 'Balance senza muro speciale', points: 2 });
    expect(rateTeam(physical, fixtureData, 'en')!.penalty.items).toContainEqual({ text: 'Balance with no special wall', points: 2 });
  });

  it('tutti fisici: −3, una volta sola', () => {
    const texts = rateTeam(physical, fixtureData)!.penalty.items.filter(i => i.text === 'Nessun attaccante speciale');
    expect(texts).toEqual([{ text: 'Nessun attaccante speciale', points: 3 }]);
    // Il coach lo segnala ancora tra i ruoli
    expect(coachTeam(physical, DEFAULT_FORMAT, fixtureData).problems)
      .toContainEqual(expect.objectContaining({ category: 'roles', text: 'Nessun attaccante speciale' }));
  });

  it('Ubers senza hazard: nessun malus del formato', () => {
    const noHazards = physical.map(set => ({ ...set, moves: set.moves.map(m => (['Stealth Rock', 'Spikes'].includes(m) ? 'Protect' : m)) }));
    const texts = rateTeam(noHazards, { ...fixtureData, formatId: 'ubers' })!.penalty.items.map(i => i.text);
    expect(texts.join(' | ')).not.toMatch(/Nessun hazard/);
  });
});
