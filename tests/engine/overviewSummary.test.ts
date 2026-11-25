import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { COVERED_LEVEL, findProblems, HELD_LEVEL, holdSeverity } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { teamOffense } from '../../src/engine/offense';
import { summarizeTeam } from '../../src/engine/overviewSummary';
import { rateTeam, ratingThreats } from '../../src/engine/rating';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { mostCommonSet } from '../../src/engine/sets';
import { poolMedian, speedPool } from '../../src/engine/speed';
import { fixtureData, fixtureStats } from '../fixtures/data';

const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const build = (data = fixtureData) => {
  const analysis = analyzeTeam(team, data);
  const rating = rateTeam(team, data)!;
  const problems = findProblems(team, DEFAULT_FORMAT, data, analysis, [], 'it');
  const tiles = summarizeTeam(analysis, rating, problems, data);
  return { analysis, rating, problems, tiles, tile: (key: string) => tiles.find(t => t.key === key)! };
};

describe('summarizeTeam', () => {
  it('sei tessere nell ordine', () => {
    expect(build().tiles.map(t => t.key)).toEqual(['defense', 'strength', 'roles', 'speed', 'meta', 'bonusMalus']);
  });

  it('Difesa: retti/18 e tipi da sistemare, dalla Coverage tipi della Difesa come il coach', () => {
    const { rating, tile, problems } = build();
    const rows = rating.defense.coverageTypes.rows;
    expect(rows).toHaveLength(18);
    const exposed = rows.filter(r => holdSeverity(rating, r.type) !== null);
    // Questo team regge tutti i tipi dal livello HELD_LEVEL: 18/18
    expect(tile('defense').value).toBe(`${18 - exposed.length}/18`);
    expect(exposed).toEqual([]);
    expect(tile('defense').value).toBe('18/18');
    // Gli stessi tipi dei problemi di difesa del coach
    expect(exposed.map(r => `defense:${r.type}`)).toEqual(problems.filter(p => p.category === 'defense').map(p => p.key));
    expect(tile('defense').missing).toEqual(exposed.map(r => ({ kind: 'type', type: r.type })));
    const serious = problems.some(p => p.category === 'defense' && p.severity === 'serious');
    expect(tile('defense').status).toBe(serious ? 'bad' : exposed.length ? 'mid' : 'good');
  });

  it('Difesa con dei tipi scoperti: mancano i gravi (nessuno regge) e i minori (sotto HELD_LEVEL), tessera rossa', () => {
    const two = team.slice(0, 2);
    const analysis = analyzeTeam(two, fixtureData);
    const rating = rateTeam(two, fixtureData)!;
    const problems = findProblems(two, DEFAULT_FORMAT, fixtureData, analysis, [], 'it');
    const defense = summarizeTeam(analysis, rating, problems, fixtureData).find(t => t.key === 'defense')!;
    const { rows, weak } = rating.defense.coverageTypes;
    const exposed = rows.filter(r => weak.includes(r.type) || r.level < HELD_LEVEL).map(r => r.type);
    expect(weak.length).toBeGreaterThan(0);
    expect(defense.value).toBe(`${18 - exposed.length}/18`);
    expect(defense.missing).toEqual(exposed.map(type => ({ kind: 'type', type })));
    expect(defense.status).toBe('bad');
  });

  it("Offesa: coperti/18 e tipi sotto il livello 40 nel pacchetto dell'Offesa, come il coach", () => {
    // Due membri: qualche tipo resta sotto 40
    const two = team.slice(0, 2);
    const analysis = analyzeTeam(two, fixtureData);
    const rating = rateTeam(two, fixtureData)!;
    const problems = findProblems(two, DEFAULT_FORMAT, fixtureData, analysis, [], 'it', rating);
    const tile = (key: string) => summarizeTeam(analysis, rating, problems, fixtureData).find(t => t.key === key)!;
    const rows = rating.offense.types.rows;
    const unhit = rows.filter(r => r.level < COVERED_LEVEL);
    expect(unhit.length).toBeGreaterThan(0);
    expect(tile('strength').value).toBe(`${18 - unhit.length}/18`);
    expect(tile('strength').missing).toEqual(unhit.map(r => ({ kind: 'type', type: r.label })));
    // Il coach dice solo i buchi veri (nessuno lo manda KO in due colpi, 2026-11-24); la tessera tutti i tipi sotto 60
    const holes = teamOffense(two, fixtureData).types.holes;
    expect(holes.map(type => `coverage:${type}`)).toEqual(problems.filter(p => p.category === 'coverage').map(p => p.key));
    expect(holes.every(type => unhit.some(r => r.label === type))).toBe(true);
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

  it('Meta: rette/considerate e specie che nessuno regge, dalla Coverage meta della Difesa', () => {
    const { rating, tile } = build();
    const t = ratingThreats(rating, fixtureData);
    expect(t.map(x => x.name)).toEqual(rating.defense.coverageMeta!.rows.map(r => r.species));
    expect(t.length).toBeGreaterThan(0);
    expect(tile('meta').value).toBe(`${t.filter(x => x.handledBy.length).length}/${t.length}`);
    expect(tile('meta').missing).toEqual(t.filter(x => !x.handledBy.length).map(x => ({ kind: 'mon', species: x.name })));
    const score = rating.defense.coverageMeta!.value;
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
  it('è la Velocità a metà del gruppo, pesando le versioni con la Sciarpa', () => {
    const sorted = [...speedPool(fixtureData)].sort((a, b) => a.value - b.value);
    const half = sorted.reduce((acc, r) => acc + r.weight, 0) / 2;
    let cumulative = 0;
    const expected = sorted.find(r => (cumulative += r.weight) >= half)!.value;
    expect(poolMedian(fixtureData)).toBe(expected);
  });
});
