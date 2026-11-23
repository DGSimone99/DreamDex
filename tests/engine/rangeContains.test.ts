import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { findProblems } from '../../src/engine/coach';
import type { PctRange } from '../../src/engine/damage';
import { teamDefense } from '../../src/engine/defense';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { teamOffense } from '../../src/engine/offense';
import { dashboardData } from '../../src/engine/overviewDashboard';
import { rateTeam } from '../../src/engine/rating';
import { mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats } from '../fixtures/data';

/**
 * Regola dei tooltip (2026-11-23): una riga mostra la forbice dei tiri solo se è il minimo e il massimo veri del colpo che
 * la riga descrive. Quindi il numero della riga sta sempre dentro la sua forbice; a 100 (il tetto dei numeri) basta che il
 * colpo possa arrivare a 100.
 */
type Pair = { where: string; range: PctRange | null | undefined; pct: number | null | undefined };
const inside = ({ range, pct }: Pair) => !range || pct == null || (range[0] <= pct && pct <= range[1]) || (pct === 100 && range[1] >= 100);

const reference = JSON.parse(readFileSync('tests/fixtures/referenceTeams.json', 'utf8')) as { name: string; team: TeamSet[] }[];
// Squadre col meteo del compagno (sole, pioggia, sabbia), danze d'attacco e di difesa, schermi, Tera/Z
const picked = ['Team di Simone', 'A2 Stall Garganacl', 'A5 Hyper Offense', 'A6 Rain', 'A7 Sand', 'A8 Sun', 'A10 Webs HO', 'S11 torn z chomp'];
const teams: { name: string; team: TeamSet[] }[] = [
  ...picked.map(name => reference.find(t => t.name === name)!).filter(Boolean),
  { name: 'fixture', team: ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight', 'Toxapex', 'Rotom-Wash'].map(n => mostCommonSet(fixtureStats, n)!) },
];

/** Tutte le coppie forbice / numero che i tooltip mostrano, per area; e quante forbici e quanti numeri soli. */
function pairsOf(team: TeamSet[]) {
  const out: Record<string, Pair[]> = { offTypes: [], offSetup: [], offOnce: [], offTeam: [], offCombo: [], offRow: [], offMeta: [], defTyped: [], threats: [], cover: [] };
  const off = teamOffense(team, fixtureData);
  for (const m of off.members) for (const h of m.hits) {
    const where = `${m.species} → ${h.label}`;
    out.offTypes.push({ where, range: h.plainRange, pct: h.plainPct }, { where: `${where} (pct)`, range: h.range, pct: h.pct });
    out.offSetup.push({ where, range: h.setupRange, pct: h.setupPct });
    out.offOnce.push({ where, range: h.onceRange, pct: h.oncePct });
    out.offTeam.push({ where, range: h.teamRange, pct: h.teamPct });
    out.offCombo.push({ where, range: h.comboRange, pct: h.comboPct });
  }
  for (const row of off.types.rows) for (const b of row.best) out.offRow.push({ where: `${row.label}: ${b.species}`, range: b.range, pct: b.pct });
  for (const row of off.coverageMeta?.rows ?? []) (row.cells ?? []).forEach((c, k) => {
    const where = `${team[k]?.species} → ${row.species}`;
    out.offMeta.push({ where, range: c.range, pct: c.pct }, { where: `${where} setup`, range: c.setupRange, pct: c.setupPct },
      { where: `${where} team`, range: c.teamRange, pct: c.teamPct }, { where: `${where} combo`, range: c.comboRange, pct: c.comboPct });
  });
  const def = teamDefense(team, fixtureData);
  for (const member of def.typed) member.cells.forEach((c, k) => {
    const r = member.ranges[k];
    const where = `${member.species} ← ${k}`;
    out.defTyped.push({ where, range: r.range, pct: c.pct }, { where: `${where} phys`, range: r.physicalRange, pct: c.physical }, { where: `${where} spec`, range: r.specialRange, pct: c.special });
  });
  for (const row of def.coverageMeta?.rows ?? []) {
    for (const h of row.heldBy) out.threats.push({ where: `${row.species} held by ${h.species}`, range: h.range, pct: h.pct });
    for (const h of row.hits ?? []) out.threats.push({ where: `${row.species} hits`, range: h.range, pct: h.pct });
  }
  const analysis = analyzeTeam(team, fixtureData);
  const rating = rateTeam(team, fixtureData);
  if (rating) {
    const dash = dashboardData(team, analysis, rating, findProblems(team, DEFAULT_FORMAT, fixtureData, analysis, [], 'it'), fixtureData, 'it');
    for (const cell of dash.coverage.cells) {
      for (const h of cell.hits) out.cover.push({ where: `${cell.type} off ${h.species}`, range: h.range, pct: h.pct });
      for (const m of cell.members) out.cover.push({ where: `${cell.type} def ${m.species}`, range: m.range, pct: m.pct });
    }
  }
  return out;
}

const all = teams.map(t => ({ name: t.name, pairs: pairsOf(t.team) }));
const count = (area: string, shown: boolean) => all.reduce((acc, t) => acc + t.pairs[area].filter(p => p.pct != null && !!p.range === shown).length, 0);

describe('ogni forbice mostrata racchiude il numero della sua riga', () => {
  for (const area of ['offTypes', 'offSetup', 'offOnce', 'offTeam', 'offCombo', 'offRow', 'offMeta', 'defTyped', 'threats', 'cover']) {
    it(area, () => {
      const bad = all.flatMap(t => t.pairs[area].filter(p => !inside(p)).map(p => `${t.name}: ${p.where} ${p.pct} ∉ ${p.range}`));
      expect(bad).toEqual([]);
      // Le forbici ci sono davvero (la regola non le spegne tutte)
      expect(count(area, true)).toBeGreaterThan(0);
    });
  }
  it('le medie pesate restano un numero solo (meteo del compagno, danze di difesa, schermi, precisione)', () => {
    // In queste squadre ci sono righe senza forbice in Offesa tipi, nella Difesa e nelle minacce
    expect(count('offTypes', false)).toBeGreaterThan(0);
    expect(count('defTyped', false)).toBeGreaterThan(0);
    expect(count('threats', false)).toBeGreaterThan(0);
  });
});
