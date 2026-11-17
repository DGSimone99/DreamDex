import { describe, expect, it } from 'vitest';
import { rolesValue } from '../../src/engine/rolesArea';
import { analyzeTeam } from '../../src/engine/analysis';
import { COVERED_LEVEL, findProblems, holdSeverity } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { dashboardData, metaThreats } from '../../src/engine/overviewDashboard';
import { summarizeTeam } from '../../src/engine/overviewSummary';
import { rateTeam, ratingThreats } from '../../src/engine/rating';
import { LEVEL_KEYS } from '../../src/engine/roleLevels';
import { mostCommonSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

const team = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!);
const build = (data = fixtureData) => {
  const analysis = analyzeTeam(team, data);
  const rating = rateTeam(team, data)!;
  const problems = findProblems(team, DEFAULT_FORMAT, data, analysis, [], 'it');
  const tiles = summarizeTeam(analysis, rating, problems, data);
  return { analysis, rating, tile: (key: string) => tiles.find(t => t.key === key)!, dash: dashboardData(team, analysis, rating, problems, data, 'it') };
};

describe('dashboardData', () => {
  it('18 tipi in ordine, stati dal voto (come il coach) e coerenti con summarizeTeam', () => {
    const { analysis, rating, tile, dash } = build();
    const { cells } = dash.coverage;
    expect(cells.length).toBe(18);
    expect(cells.map(c => c.type)).toEqual(analysis.weakness.map(r => r.type));
    // Difesa: grave (bad) i tipi che nessuno regge, minore sotto il livello 50 della Coverage tipi
    const rows = rating.defense.coverageTypes.rows;
    const sev = (s: 'serious' | 'minor') => rows.filter(r => holdSeverity(rating, r.type) === s).map(r => r.type);
    expect(cells.filter(c => c.defense === 'bad').map(c => c.type)).toEqual(sev('serious'));
    expect(cells.filter(c => c.defense === 'minor').map(c => c.type)).toEqual(sev('minor'));
    // Offesa: bad i buchi del pacchetto, minore sotto il livello 50; i non ok sono i tipi mancanti della tessera
    const offense = rating.offense.types;
    expect(cells.filter(c => c.offense === 'bad').map(c => c.type)).toEqual(offense.holes);
    expect(cells.filter(c => c.offense === 'minor').map(c => c.type))
      .toEqual(offense.rows.filter(r => r.level < COVERED_LEVEL && !offense.holes.includes(r.label)).map(r => r.label));
    const missing = tile('strength').missing.map(m => (m as { type: string }).type);
    expect(cells.filter(c => c.offense !== 'ok').map(c => c.type)).toEqual(missing);
    // Quanti membri reggono del tutto ogni tipo (la vista ampia del Riassunto segna "nessuno lo regge")
    expect(cells.map(c => c.resist)).toEqual(rows.map(r => r.heldBy.length));
    for (const c of cells) {
      const held = rows.find(r => r.type === c.type)!.heldBy;
      expect(c.defenseNote).toBe(held.length ? `Coperto da ${held.join(', ')}` : 'Scoperto');
    }
    expect(dash.coverage.defense).toBe(tile('defense').value);
    expect(dash.coverage.offense).toBe(tile('strength').value);
  });

  it('ruoli: tutti i livelli, coperti con i loro membri', () => {
    const { analysis, tile, dash } = build();
    const expected = LEVEL_KEYS.filter(k => analysis.needs.levels[k] !== 'ignored');
    expect(dash.roles.chips.map(c => c.need)).toEqual(expected);
    for (const chip of dash.roles.chips) expect(chip.covered).toBe(chip.owners.length > 0);
    expect(dash.roles.chips.some(c => c.level === 'minor')).toBe(true);
    // Il numero della carta: voci coperte sul totale, come il pannello del voto
    const rating = rateTeam(team, fixtureData)!;
    expect(dash.roles.value).toBe(rolesValue(rating.roles));
    // Le colonne della tabella: i membri in ordine, scritti come chi copre i ruoli
    expect(dash.roles.members).toHaveLength(team.length);
    for (const chip of dash.roles.chips) for (const owner of chip.owners) expect(dash.roles.members).toContain(owner);
    // soft: con 6 membri solo le voci minori (una mancanza che non toglie punti)
    for (const chip of dash.roles.chips) expect(chip.soft).toBe(chip.level === 'minor');
  });

  it('ruoli con meno di 6 membri: ogni voce è soft (il voto è provvisorio, le mancanze non tolgono punti)', () => {
    const two = team.slice(0, 2);
    const analysis = analyzeTeam(two, fixtureData);
    const rating = rateTeam(two, fixtureData)!;
    expect(rating.provisional).toBe(true);
    const problems = findProblems(two, DEFAULT_FORMAT, fixtureData, analysis, [], 'it', rating);
    const { chips } = dashboardData(two, analysis, rating, problems, fixtureData, 'it').roles;
    expect(chips.some(c => c.level !== 'minor' && !c.covered)).toBe(true);
    expect(chips.every(c => c.soft)).toBe(true);
  });

  it('velocità: corsie dal più veloce, above = share > 0.5', () => {
    const { dash, tile } = build();
    const { lanes } = dash.speed;
    expect(lanes.length).toBeGreaterThan(0);
    for (let i = 1; i < lanes.length; i++) expect(lanes[i - 1].speed).toBeGreaterThanOrEqual(lanes[i].speed);
    for (const l of lanes) expect(l.above).toBe(l.share > 0.5);
    expect(dash.speed.vsMeta).toBe(true);
    expect(dash.speed.value).toBe(tile('speed').value);
  });

  it('minacce: solo quelle che nessuno regge (Coverage meta della Difesa), dalla più usata', () => {
    const { rating, dash } = build();
    const threats = ratingThreats(rating, fixtureData);
    const unhandled = threats.filter(t => !t.handledBy.length);
    expect(dash.threats.available).toBe(true);
    expect(dash.threats.metaOff).toBe(false);
    expect(dash.threats.total).toBe(threats.length);
    expect(dash.threats.pods.map(p => p.species).sort()).toEqual(unhandled.map(t => t.name).sort());
    for (let i = 1; i < dash.threats.pods.length; i++) expect(dash.threats.pods[i - 1].usage).toBeGreaterThanOrEqual(dash.threats.pods[i].usage);
  });

  it('metaThreats: scoperte (nessuno regge / nessuno KO in due) prima, poi a fatica (uno solo), poi dalla più usata', () => {
    const { rating, dash } = build();
    const list = metaThreats(rating, fixtureData);
    expect(dash.threats.list).toEqual(list);
    const defense = new Map((rating.defense.coverageMeta?.rows ?? []).map(r => [r.species, r.heldBy.filter(h => !h.partial).length]));
    const offense = new Map((rating.offense.coverageMeta?.rows ?? []).map(r => [r.species, new Set(r.coveredBy.map(c => c.species)).size]));
    // Ogni minaccia della lista ha davvero zero o un solo membro che la gestisce, su ogni lato che cita
    for (const x of list) {
      for (const r of x.reasons) expect((r.side === 'defense' ? defense : offense).get(x.species)).toBe(r.by.length);
      expect(x.status).toBe(x.reasons[0].by.length ? 'thin' : 'open');
    }
    // E nessuna ne manca
    for (const [species, n] of defense) if (n <= 1) expect(list.some(x => x.species === species)).toBe(true);
    for (const [species, n] of offense) if (n <= 1) expect(list.some(x => x.species === species)).toBe(true);
    const rank = (x: (typeof list)[number]) => (x.status === 'open' ? 0 : 1);
    for (let i = 1; i < list.length; i++) expect(rank(list[i - 1])).toBeLessThanOrEqual(rank(list[i]));
  });

  it('meta spento: minacce non disponibili, velocità vsMeta false', () => {
    const { dash } = build({ ...fixtureData, ignoreMeta: true });
    expect(dash.threats.available).toBe(false);
    expect(dash.threats.metaOff).toBe(true);
    expect(dash.threats.pods).toEqual([]);
    expect(dash.threats.list).toEqual([]);
    expect(dash.speed.vsMeta).toBe(false);
  });
});
