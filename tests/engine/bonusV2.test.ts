import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import {
  CORE_TRIO_POINTS, SAME_TYPE_POINTS, TYPE_VARIETY_MIN, WEAK_COVERED_POINTS, CONDITION_USED_POINTS,
  coreTrioBonus, typeVarietyBonus, weakCoveredBonus, conditionUsedBonus, rateTeam, redundancies,
} from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, moves: string[] = [], ability?: string): TeamSet => ({ ...emptySet(species), moves, ...(ability ? { ability } : {}) });
const garchomp = mk('Garchomp', ['Earthquake'], 'Rough Skin');
const scizor = mk('Scizor', ['Bullet Punch'], 'Technician');
const valiant = mk('Iron Valiant', ['Moonblast'], 'Quark Drive');
const toxapex = mk('Toxapex', ['Scald'], 'Regenerator');

describe('bonus core a tre', () => {
  it('un trio dell\'Analisi vale +2, con i tre nomi nel testo', () => {
    const items = coreTrioBonus([garchomp, scizor, valiant, toxapex]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ points: CORE_TRIO_POINTS, catalog: 'coreTrio' });
    for (const name of ['Garchomp', 'Scizor', 'Iron Valiant']) expect(items[0].text).toContain(name);
  });

  it('una coppia non dà punti', () => {
    // Garchomp e Scizor si coprono a vicenda ma sono solo due
    expect(coreTrioBonus([garchomp, scizor])).toEqual([]);
  });

  it('senza core niente bonus', () => {
    expect(coreTrioBonus([mk('Great Tusk'), mk('Landorus-Therian')])).toEqual([]);
  });
});

describe('bonus tipi vari', () => {
  // Ground, Fighting · Steel, Ghost · Electric, Flying · Poison, Water · Dark, (Steel) · Grass, (Poison) = 10 tipi
  const varied = ['Great Tusk', 'Gholdengo', 'Zapdos', 'Toxapex', 'Kingambit', 'Venusaur'].map(n => mk(n));
  it(`almeno ${TYPE_VARIETY_MIN} tipi diversi: +1`, () => {
    const items = typeVarietyBonus(varied);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ points: 1, catalog: 'typeVariety' });
    expect(items[0].text).toContain('10');
  });
  it('con meno tipi niente', () => {
    // Gholdengo, Kingambit, Corviknight, Scizor, Heatran, Great Tusk: Steel ripetuto, 9 tipi
    expect(typeVarietyBonus(['Gholdengo', 'Kingambit', 'Corviknight', 'Scizor', 'Heatran', 'Great Tusk'].map(n => mk(n)))).toEqual([]);
  });
});

describe('bonus debolezze coperte', () => {
  const covered = ['Great Tusk', 'Gholdengo', 'Zapdos', 'Toxapex', 'Kingambit', 'Garchomp'].map(n => mk(n));
  const uncovered = ['Great Tusk', 'Landorus-Therian', 'Hippowdon', 'Gholdengo', 'Zapdos', 'Kingambit'].map(n => mk(n));
  it('team da 6 in cui ogni debolezza condivisa ha chi resiste: +1', () => {
    const analysis = analyzeTeam(covered, fixtureData);
    // Il test regge solo se il team è davvero coperto: lo controlliamo sulle righe
    expect(analysis.weakness.every(r => r.weak < 2 || r.resist >= 1)).toBe(true);
    expect(weakCoveredBonus(covered, analysis)).toEqual([expect.objectContaining({ points: WEAK_COVERED_POINTS, catalog: 'weakCovered' })]);
  });
  it('una debolezza condivisa senza chi resiste toglie il bonus', () => {
    const analysis = analyzeTeam(uncovered, fixtureData);
    // Water: Tusk, Landorus e Hippowdon deboli, nessuno resiste
    expect(analysis.weakness.some(r => r.type === 'Water' && r.weak >= 2 && r.resist === 0)).toBe(true);
    expect(weakCoveredBonus(uncovered, analysis)).toEqual([]);
  });
  it('solo nei team da 6', () => {
    const five = covered.slice(0, 5);
    expect(weakCoveredBonus(five, analyzeTeam(five, fixtureData))).toEqual([]);
  });
  it('non con specie sconosciute: senza tipi non ci sono debolezze da coprire', () => {
    const unknown = Array.from({ length: 6 }, (_, i) => ({ ...emptySet(`Fakemon${i}`), species: `Fakemon${i}` }));
    expect(weakCoveredBonus(unknown, analyzeTeam(unknown, fixtureData))).toEqual([]);
  });
});

describe('bonus condizione sfruttata', () => {
  const pelipper = mk('Pelipper', ['Hurricane', 'U-turn'], 'Drizzle');
  const barraskewda = mk('Barraskewda', ['Liquidation'], 'Swift Swim');
  const kingdra = mk('Kingdra', ['Hydro Pump'], 'Swift Swim');
  it('pioggia sfruttata da due compagni: +1, col nome del portatore', () => {
    const items = conditionUsedBonus([pelipper, barraskewda, kingdra, garchomp]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ points: CONDITION_USED_POINTS, catalog: 'conditionUsed' });
    expect(items[0].text).toContain('Pelipper');
    expect(items[0].text).toContain('Barraskewda');
  });
  it('un solo compagno non basta; il portatore non si conta', () => {
    expect(conditionUsedBonus([pelipper, barraskewda, garchomp])).toEqual([]);
  });
  it('Trick Room con due lenti che attaccano conta come condizione', () => {
    const room = mk('Dragapult', ['Trick Room', 'Shadow Ball']);
    const torkoal = mk('Torkoal', ['Lava Plume'], 'Drought');
    const hippowdon = mk('Hippowdon', ['Earthquake'], 'Sand Stream');
    // Torkoal e Hippowdon sono lenti (≤ 50 di base) e attaccano
    const items = conditionUsedBonus([room, torkoal, hippowdon, garchomp]);
    expect(items.some(i => i.text.includes('Dragapult'))).toBe(true);
  });
});

describe('malus stesso tipo nel voto', () => {
  it('tre membri Steel: −1 con la chiave di catalogo', () => {
    const team = ['Gholdengo', 'Kingambit', 'Corviknight'].map(n => mk(n));
    expect(redundancies(team, analyzeTeam(team, fixtureData)).items)
      .toContainEqual(expect.objectContaining({ text: '3 membri di tipo Steel', points: SAME_TYPE_POINTS, catalog: 'sameType' }));
  });
  it('quattro membri Steel: −2', () => {
    const team = ['Gholdengo', 'Kingambit', 'Corviknight', 'Heatran'].map(n => mk(n));
    expect(redundancies(team, analyzeTeam(team, fixtureData)).items)
      .toContainEqual(expect.objectContaining({ text: '4 membri di tipo Steel', points: 2 * SAME_TYPE_POINTS }));
  });
});

describe('niente tetti', () => {
  it('la penalità è la somma delle voci anche oltre 15', () => {
    const team = [
      ...Array(5).fill(0).map(() => mk('Great Tusk', ['Stealth Rock', 'Rapid Spin'])),
      mk('Ninetales', ['Flamethrower'], 'Drought'),
      mk('Pelipper', ['Surf'], 'Drizzle'),
    ];
    const r = redundancies(team, analyzeTeam(team, fixtureData));
    const sum = r.items.reduce((n, i) => n + i.points, 0);
    expect(sum).toBeGreaterThan(15);
    expect(r.total).toBe(sum);
  });
  it('il bonus è la somma delle voci e il voto le somma tutte', () => {
    const team = [garchomp, scizor, valiant, mk('Zapdos'), mk('Toxapex'), mk('Great Tusk')];
    const r = rateTeam(team, fixtureData)!;
    expect(r.bonus.total).toBe(r.bonus.items.reduce((n, i) => n + i.points, 0));
    expect(r.penalty.total).toBe(r.penalty.items.reduce((n, i) => n + i.points, 0));
    expect(r.bonus.items.map(i => i.catalog)).toContain('coreTrio');
    expect(r.overall).toBe(Math.min(100, Math.max(0, r.base - r.penalty.total + r.bonus.total + r.memberPoints)));
  });
});
