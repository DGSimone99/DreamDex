import { describe, expect, it } from 'vitest';
import { teamCoverage } from '../../src/engine/coverage';
import { hitRange, pctRange, type PctRange } from '../../src/engine/damage';
import { teamDefense } from '../../src/engine/defense';
import { memberOffense, teamOffense } from '../../src/engine/offense';
import type { TeamSet } from '../../src/engine/sets';
import { TYPES } from '../../src/engine/types';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], nature: string, evs: TeamSet['evs']): TeamSet =>
  ({ species, item, ability, moves, nature, evs });
const noMeta = { ...fixtureData, ignoreMeta: true, formatId: 'ou' as const };
// Mosse precise al 100%: il danno medio sta dentro la forbice dei tiri
const chomp = set('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Outrage', 'Swords Dance'], 'Adamant', { atk: 252, spe: 252 });
const lando = set('Landorus-Therian', 'Leftovers', 'Intimidate', ['Earthquake', 'U-turn', 'Stealth Rock'], 'Impish', { hp: 252, def: 252 });

const ordered = (r: PctRange | null | undefined) => { if (r) expect(r[0]).toBeLessThanOrEqual(r[1]); };
/** Il % mostrato (in basso, al massimo 100) sta nella forbice, a meno di un punto di arrotondamento; a 100 basta il massimo. */
const brackets = (r: PctRange, pct: number) => {
  if (pct < 100) expect(r[0]).toBeLessThanOrEqual(pct + 1);
  expect(pct).toBeLessThanOrEqual(r[1] + 1);
};

describe('pctRange: la forbice dei tiri in % dei PS', () => {
  it('arrotonda minimo e massimo in basso, come i numeri dei tooltip', () => {
    expect(pctRange({ min: 0.794, max: 0.926 })).toEqual([79, 92]);
    expect(pctRange({ min: 0.335, max: 0.395 })).toEqual([33, 39]);
  });
  it('applica il fattore degli schermi', () => {
    expect(pctRange({ min: 0.8, max: 1 }, 0.5)).toEqual([40, 50]);
  });
  it('null senza colpo o senza danno', () => {
    expect(pctRange(null)).toBeNull();
    expect(pctRange(undefined)).toBeNull();
    expect(pctRange({ min: 0, max: 0 })).toBeNull();
  });
  it('senza tetto a 100: oltre è un KO', () => {
    expect(pctRange({ min: 1.2, max: 1.45 })).toEqual([120, 145]);
  });
});

describe('hitRange: la forbice solo per un colpo vero', () => {
  it('un colpo solo del calcolo: la forbice', () => {
    expect(hitRange({ move: 'Earthquake', expected: 0.86, min: 0.794, max: 0.926, exact: true })).toEqual([79, 92]);
  });
  it('una stima o una media pesata (exact falso o assente): niente forbice', () => {
    expect(hitRange({ move: 'Earthquake', expected: 0.86, min: 0.794, max: 0.926, exact: false })).toBeNull();
    expect(hitRange({ move: 'Earthquake', expected: 0.86, min: 0.794, max: 0.926 })).toBeNull();
  });
  it('il danno medio fuori dalla forbice (precisione): niente forbice', () => {
    expect(hitRange({ move: 'Stone Edge', expected: 0.6, min: 0.7, max: 0.8, exact: true })).toBeNull();
  });
});

describe('le forbici accanto ai numeri dei tooltip', () => {
  it('Offesa del membro: ogni forbice va dal minimo al massimo, il colpo semplice c\'è quando colpisce', () => {
    const m = memberOffense(chomp, [chomp], noMeta)!;
    for (const h of m.hits) {
      [h.plainRange, h.setupRange, h.onceRange, h.teamRange, h.comboRange].forEach(ordered);
      if (h.plainPct > 0) expect(h.plainRange).not.toBeNull();
      // Senza meteo del team nessun colpo col meteo, e nessuna forbice
      expect(h.teamPct === null).toBe(h.teamRange === null);
      expect(h.setupPct === null).toBe(h.setupRange === null);
    }
    // Garchomp non tocca il Volante con Earthquake ma sì con Outrage: c'è sempre un colpo
    const flying = m.hits.find(h => h.label === 'Flying')!;
    expect(flying.plainRange).not.toBeNull();
    // Senza meteo del team il colpo semplice è quello del calcolo: il % arrotondato in basso sta nella forbice
    for (const h of m.hits.filter(x => x.plainRange)) {
      brackets(h.plainRange!, h.plainPct);
    }
  });

  it('pacchetto dei tipi: i migliori portano la forbice dietro il loro numero (null se è una media col setup o Tera/Z)', () => {
    const off = teamOffense([chomp, lando], noMeta);
    for (const row of off.types.rows) for (const b of row.best) {
      const member = off.members.find(m => m.species === b.species)!;
      const hit = member.hits.find(h => h.label === row.label)!;
      expect(b.range).toEqual(hit.range);
      if (hit.pct !== hit.plainPct) expect(hit.range).toBeNull();
    }
  });

  it('Coverage meta: la forbice del colpo semplice racchiude il % mostrato (mosse precise al 100%)', () => {
    const cov = teamCoverage([chomp, tusk], fixtureData, 'meta');
    let checked = 0;
    for (const row of cov.rows) for (const c of row.cells ?? []) {
      [c.range, c.setupRange, c.teamRange, c.comboRange].forEach(ordered);
      if (c.pct <= 0 || !c.range) continue;
      // Solo i colpi del set di Garchomp (EQ e Outrage, precisi al 100%) senza mosse a più colpi
      if (c.move !== 'Earthquake' && c.move !== 'Outrage') continue;
      brackets(c.range, c.pct);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('Difesa: forbici dei colpi di tipo e delle minacce, null senza colpo (immune)', () => {
    const d = teamDefense([lando, gholdengo], fixtureData);
    for (const member of d.typed) member.cells.forEach((c, k) => {
      const r = member.ranges[k];
      [r.range, r.physicalRange, r.specialRange].forEach(ordered);
      if (c.physical !== c.special) expect(r.range).toEqual(c.physical > c.special ? r.physicalRange : r.specialRange);
    });
    // Landorus è immune all'Elettro: nessun colpo, nessuna forbice
    const k = TYPES.indexOf('Electric');
    expect(d.typed[0].cells[k].pct).toBe(0);
    expect(d.typed[0].ranges[k].physicalRange).toBeNull();
    expect(d.typed[0].ranges[k].specialRange).toBeNull();
    for (const row of d.coverageMeta!.rows) {
      for (const h of row.heldBy) ordered(h.range);
      for (const h of row.hits ?? []) {
        ordered(h.range);
        if (h.range) brackets(h.range, h.pct);
      }
    }
  });
});
