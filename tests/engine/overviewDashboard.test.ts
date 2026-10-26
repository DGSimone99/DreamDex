import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { findProblems, weaknessSeverity } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { dashboardData } from '../../src/engine/overviewDashboard';
import { summarizeTeam } from '../../src/engine/overviewSummary';
import { rateTeam } from '../../src/engine/rating';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const build = (data = fixtureData) => {
  const analysis = analyzeTeam(team, data);
  const rating = rateTeam(team, data)!;
  const problems = findProblems(team, DEFAULT_FORMAT, analysis, [], 'it');
  const tiles = summarizeTeam(analysis, rating, problems, data);
  return { analysis, tile: (key: string) => tiles.find(t => t.key === key)!, dash: dashboardData(team, analysis, rating, problems, data, 'it') };
};

describe('dashboardData', () => {
  it('18 tipi in ordine, stati coerenti con summarizeTeam', () => {
    const { analysis, tile, dash } = build();
    const { cells } = dash.coverage;
    expect(cells.length).toBe(18);
    expect(cells.map(c => c.type)).toEqual(analysis.weakness.map(r => r.type));
    const sev = (s: 'serious' | 'minor') => analysis.weakness.filter(r => weaknessSeverity(r) === s).map(r => r.type);
    expect(cells.filter(c => c.defense === 'bad').map(c => c.type)).toEqual(sev('serious'));
    expect(cells.filter(c => c.defense === 'minor').map(c => c.type)).toEqual(sev('minor'));
    const missing = tile('strength').missing.map(m => (m as { type: string }).type);
    expect(cells.filter(c => c.offense === 'bad').map(c => c.type)).toEqual(missing);
    expect(dash.coverage.defense).toBe(tile('defense').value);
    expect(dash.coverage.offense).toBe(tile('strength').value);
  });

  it('ruoli: tutti i livelli, coperti con i loro membri', () => {
    const { analysis, tile, dash } = build();
    const expected = LEVEL_KEYS.filter(k => analysis.needs.levels[k] !== 'ignored');
    expect(dash.roles.chips.map(c => c.need)).toEqual(expected);
    for (const chip of dash.roles.chips) expect(chip.covered).toBe(chip.owners.length > 0);
    expect(dash.roles.chips.some(c => c.level === 'minor')).toBe(true);
    expect(dash.roles.value).toBe(tile('roles').value);
  });

  it('velocità: corsie dal più veloce, above = share > 0.5, vicini del meta', () => {
    const { dash, tile } = build();
    const { lanes } = dash.speed;
    expect(lanes.length).toBeGreaterThan(0);
    for (let i = 1; i < lanes.length; i++) expect(lanes[i - 1].speed).toBeGreaterThanOrEqual(lanes[i].speed);
    for (const l of lanes) {
      expect(l.above).toBe(l.share > 0.5);
      expect(l.outspeeds.length).toBeLessThanOrEqual(3);
      expect(l.outspedBy.length).toBeLessThanOrEqual(3);
    }
    expect(dash.speed.vsMeta).toBe(true);
    expect(dash.speed.value).toBe(tile('speed').value);
  });

  it('minacce: solo le non gestite, dalla più usata', () => {
    const { analysis, dash } = build();
    const unhandled = analysis.threats.filter(t => !t.handledBy.length);
    expect(dash.threats.available).toBe(true);
    expect(dash.threats.metaOff).toBe(false);
    expect(dash.threats.total).toBe(analysis.threats.length);
    expect(dash.threats.pods.length).toBe(unhandled.length);
    for (let i = 1; i < dash.threats.pods.length; i++) expect(dash.threats.pods[i - 1].usage).toBeGreaterThanOrEqual(dash.threats.pods[i].usage);
  });

  it('meta spento: minacce non disponibili, velocità vsMeta false', () => {
    const { dash } = build({ ...fixtureData, ignoreMeta: true });
    expect(dash.threats.available).toBe(false);
    expect(dash.threats.metaOff).toBe(true);
    expect(dash.threats.pods).toEqual([]);
    expect(dash.speed.vsMeta).toBe(false);
  });
});
