import { describe, expect, it } from 'vitest';
import { analyzeTeam, threatScore } from '../../src/engine/analysis';
import { findProblems, weaknessSeverity } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { summarizeTeam } from '../../src/engine/overviewSummary';
import { rateTeam } from '../../src/engine/rating';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { mostCommonSet } from '../../src/engine/sets';
import { poolMedian, speedPool } from '../../src/engine/speed';
import { fixtureData, fixtureStats } from '../fixtures/data';

const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const build = (data = fixtureData) => {
  const analysis = analyzeTeam(team, data);
  const rating = rateTeam(team, data)!;
  const problems = findProblems(team, DEFAULT_FORMAT, analysis, [], 'it');
  const tiles = summarizeTeam(analysis, rating, problems, data);
  return { analysis, rating, problems, tiles, tile: (key: string) => tiles.find(t => t.key === key)! };
};

describe('summarizeTeam', () => {
  it('sei tessere nell ordine', () => {
    expect(build().tiles.map(t => t.key)).toEqual(['defense', 'strength', 'roles', 'speed', 'meta', 'bonusMalus']);
  });

  it('Difesa: coperti/18 e tipi scoperti', () => {
    const { analysis, tile, problems } = build();
    const exposed = analysis.weakness.filter(r => weaknessSeverity(r) !== null);
    expect(tile('defense').value).toBe(`${analysis.weakness.length - exposed.length}/${analysis.weakness.length}`);
    expect(tile('defense').missing).toEqual(exposed.map(r => ({ kind: 'type', type: r.type })));
    const serious = problems.some(p => p.category === 'defense' && p.severity === 'serious');
    expect(tile('defense').status).toBe(serious ? 'bad' : exposed.length ? 'mid' : 'good');
  });

  it('Offesa: colpiti/18 e tipi senza hitter', () => {
    const { analysis, tile } = build();
    const unhit = analysis.coverage.filter(r => !r.hitters.length);
    expect(tile('strength').value).toBe(`${analysis.coverage.length - unhit.length}/${analysis.coverage.length}`);
    expect(tile('strength').missing).toEqual(unhit.map(r => ({ kind: 'type', type: r.type })));
    expect(tile('strength').status).toBe(unhit.length ? 'mid' : 'good');
  });

  it('Ruoli: contati essenziali e importanti, mancanti in ordine', () => {
    const { analysis, tile } = build();
    const { levels, essentialMissing, importantMissing } = analysis.needs;
    const counted = LEVEL_KEYS.filter(k => levels[k] === 'essential' || levels[k] === 'important').length;
    const lacking = [...essentialMissing, ...importantMissing];
    expect(tile('roles').value).toBe(`${counted - lacking.length}/${counted}`);
    expect(tile('roles').missing).toEqual(lacking.map(need => ({ kind: 'role', need })));
    expect(tile('roles').status).toBe(essentialMissing.length ? 'bad' : importantMissing.length ? 'mid' : 'good');
  });

  it('Velocità: veloci/membri, controllo e stato dall area', () => {
    const { rating, tile } = build();
    const s = tile('speed');
    expect(s.value).toBe(`${rating.speed.members.filter(m => m.raw > 0.5).length}/${rating.speed.members.length}`);
    expect(s.speed!.points).toEqual(rating.speed.members.map(m => ({ species: m.species, speed: m.speed, share: m.raw })));
    expect(s.speed!.control).toEqual(rating.speed.sources.map(c => c.move));
    expect(s.speed!.median).toBe(poolMedian(fixtureData));
    const v = rating.speed.value;
    expect(s.status).toBe(v >= 70 ? 'good' : v >= 50 ? 'mid' : 'bad');
  });

  it('Meta: gestite/considerate e specie senza check', () => {
    const { analysis, tile } = build();
    const t = analysis.threats;
    expect(t.length).toBeGreaterThan(0);
    expect(tile('meta').value).toBe(`${t.filter(x => x.handledBy.length).length}/${t.length}`);
    expect(tile('meta').missing).toEqual(t.filter(x => !x.handledBy.length).map(x => ({ kind: 'mon', species: x.name })));
    const score = threatScore(analysis)!;
    expect(tile('meta').status).toBe(score >= 70 ? 'good' : score >= 50 ? 'mid' : 'bad');
  });

  it('Meta non disponibile senza meta', () => {
    const meta = build({ ...fixtureData, ignoreMeta: true }).tile('meta');
    expect(meta).toMatchObject({ value: '—', status: 'mid', unavailable: true, missing: [] });
  });

  it('Bonus/Malus: netto con segno e al massimo 2 voci per punti assoluti', () => {
    const { rating, tile } = build();
    const net = rating.bonus.total - rating.penalty.total;
    expect(tile('bonusMalus').value).toBe(net < 0 ? `−${-net}` : net > 0 ? `+${net}` : '±0');
    expect(tile('bonusMalus').status).toBe(net >= 0 ? 'good' : 'bad');
    const abs = tile('bonusMalus').items!.map(i => Math.abs(i.points));
    expect(abs.length).toBeLessThanOrEqual(2);
    expect(abs).toEqual([...abs].sort((a, b) => b - a));
  });
});

describe('poolMedian', () => {
  it('è la Velocità a metà del gruppo', () => {
    const sorted = speedPool(fixtureData).map(r => r.value).sort((a, b) => a - b);
    expect(poolMedian(fixtureData)).toBe(sorted[Math.floor(sorted.length / 2)]);
  });
});
