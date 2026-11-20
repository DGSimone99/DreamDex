import { describe, expect, it } from 'vitest';
import { duelTips, evSources, metaEffects, quickTips } from '../../src/engine/duelTips';
import { editorDuel } from '../../src/engine/editorDuel';
import { rateTeam } from '../../src/engine/rating';
import { fixtureData } from '../fixtures/data';
import { mostCommonSet } from '../../src/engine/sets';
import { gholdengo, tusk } from '../fixtures/data';

const sum = (evs: Record<string, number | undefined>) => Object.values(evs).reduce<number>((a, n) => a + (n ?? 0), 0);

describe('consigli della Sfida: da dove si prendono gli EV', () => {
  it('EV liberi bastano: una variante senza togliere niente', () => {
    const set = { ...tusk, evs: { atk: 252, spe: 200 } };
    const v = evSources(set, { spd: 32 });
    expect(v).toHaveLength(1);
    expect(v[0].taken).toEqual({});
    expect(v[0].set.evs.spd).toBe(32);
  });

  it('EV da togliere: una variante per statistica che ne ha abbastanza, mai da quella che riceve', () => {
    const set = { ...tusk, evs: { hp: 4, atk: 252, spe: 252 } };
    const v = evSources(set, { spd: 32 });
    expect(v.map(x => Object.keys(x.taken)[0]).sort()).toEqual(['atk', 'spe']);
    for (const x of v) {
      expect(sum(x.set.evs)).toBeLessThanOrEqual(510);
      expect(x.set.evs.spd).toBe(32);
    }
    const atk = v.find(x => x.taken.atk)!;
    expect(atk.taken.atk).toBe(32);
    expect(atk.set.evs.atk).toBe(220);
  });

  it('510 EV e nessuna statistica con abbastanza: nessuna variante', () => {
    const set = { ...tusk, evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 } };
    expect(evSources(set, { spd: 120 })).toEqual([]);
  });
});

describe('consigli della Sfida: cosa cambia contro il resto del meta', () => {
  it('più Difesa Speciale = reggi di più contro attaccanti speciali, mai il contrario', () => {
    const fx = metaEffects(tusk, { ...tusk, evs: { ...tusk.evs, hp: 252, spd: 252, atk: 0 } }, [{ set: gholdengo, weight: 1 }]);
    expect(fx.find(f => f.kind === 'takeLess')).toBeUndefined();
    expect(fx.find(f => f.kind === 'takeMore')?.shifts[0].species).toBe('Gholdengo');
    for (const f of fx) for (const s of f.shifts) expect(s.before).not.toBe(s.after);
  });

  it('meno Attacco = fai meno danni', () => {
    const fx = metaEffects(tusk, { ...tusk, evs: { ...tusk.evs, atk: 0 }, nature: 'Timid' }, [{ set: gholdengo, weight: 1 }]);
    expect(fx.find(f => f.kind === 'dealMore')).toBeUndefined();
    expect(fx.find(f => f.kind === 'dealLess')?.shifts[0].species).toBe('Gholdengo');
  });

  it('nessuna minaccia: nessun effetto', () => {
    expect(metaEffects(tusk, { ...tusk, evs: { ...tusk.evs, spd: 252 } }, [])).toEqual([]);
  });
});

describe('consigli della Sfida: i consigli completi', () => {
  const team = [tusk, gholdengo];

  it('il voto di adesso è quello di rateTeam', () => {
    expect(duelTips(team, 0, gholdengo, [], fixtureData).overall).toBe(rateTeam(team, fixtureData)?.overall ?? null);
  });

  it('ogni opzione EV sposta davvero la soglia e resta entro 510', () => {
    const me = { ...tusk, evs: { hp: 4, atk: 252, spe: 252 } };
    const tips = duelTips([me, gholdengo], 0, gholdengo, [], fixtureData).tips.filter(t => t.id !== 'move');
    expect(tips.length).toBeGreaterThan(0);
    const before = editorDuel(me, gholdengo);
    for (const tip of tips) {
      for (const o of tip.options) expect(sum(o.set.evs)).toBeLessThanOrEqual(510);
      const after = editorDuel(tip.options[tip.best].set, gholdengo);
      if (tip.id === 'def') expect(after.theirs!.hitsMaybe).toBeGreaterThan(before.theirs!.hitsMaybe);
      if (tip.id === 'atk') expect(after.mine!.hitsSure).toBeLessThan(before.mine!.hitsSure);
    }
  });

  it('mossa: 4 opzioni, la scelta ha il voto più alto, lo slot vuoto vince a pari voto', () => {
    const me = { ...tusk, moves: ['Rapid Spin', 'Bulk Up', 'Ice Spinner', ''] };
    const tip = duelTips([me, gholdengo], 0, gholdengo, ['Headlong Rush', 'Earthquake'], fixtureData).tips.find(t => t.id === 'move')!;
    expect(tip.options).toHaveLength(4);
    expect(tip.options.map(o => o.replaced)).toEqual(['Rapid Spin', 'Bulk Up', 'Ice Spinner', '']);
    const top = Math.max(...tip.options.map(o => o.overall ?? -1));
    expect(tip.options[tip.best].overall ?? -1).toBe(top);
    if (tip.options[3].overall === top) expect(tip.best).toBe(3);
    expect(tip.options[tip.best].set.moves).toContain(tip.move);
  });

  it('voto bloccato: overall null, i consigli ci sono lo stesso', () => {
    const illegal = { ...tusk, evs: { hp: 252, atk: 252, def: 252 } };
    const r = duelTips([illegal, gholdengo], 0, gholdengo, ['Headlong Rush', 'Earthquake'], fixtureData);
    expect(r.overall).toBeNull();
    for (const t of r.tips) for (const o of t.options) expect(o.overall).toBeNull();
  });

  it('senza meta: nessun effetto', () => {
    const me = { ...tusk, evs: { hp: 4, atk: 252, spe: 252 } };
    const r = duelTips([me, gholdengo], 0, gholdengo, [], { ...fixtureData, ignoreMeta: true });
    for (const t of r.tips) for (const o of t.options) expect(o.effects).toEqual([]);
  });
});

describe('consigli della Sfida: correzioni del controllo finale', () => {
  const sets = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight', 'Toxapex', 'Rotom-Wash', 'Garchomp']
    .map(name => mostCommonSet(fixtureData.stats, name)!).filter(Boolean);
  it('ogni opzione EV migliora davvero la sua riga (mai un consiglio che non cambia niente)', () => {
    const variants = [
      { hp: 252, atk: 252, spe: 4 }, { hp: 252, def: 252, spe: 4 }, { hp: 248, spd: 252, spe: 8 }, { hp: 252, spa: 252, spe: 4 },
    ];
    let checked = 0;
    for (const base of sets) for (const opp of sets) for (const evs of variants) {
      if (base === opp) continue;
      const me = { ...base, evs, nature: 'Serious' };
      const was = editorDuel(me, opp);
      for (const tip of duelTips([me, opp], 0, opp, [], fixtureData).tips) {
        for (const o of tip.options) {
          checked++;
          const now = editorDuel(o.set, opp);
          if (tip.id === 'def') expect(now.theirs!.hitsMaybe).toBeGreaterThan(was.theirs!.hitsMaybe);
          if (tip.id === 'atk') expect(now.mine!.hitsSure).toBeLessThan(was.mine!.hitsSure);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('quickTips: con 510 EV e nessuna statistica che può pagare, niente chip di EV', () => {
    const me = { ...tusk, evs: { hp: 84, atk: 84, def: 84, spa: 84, spd: 84, spe: 84 } };
    const quick = quickTips(me, gholdengo, []);
    for (const q of quick) if (q.id !== 'move') expect(evSources(me, q.add).length).toBeGreaterThan(0);
    const free = { ...tusk, evs: { atk: 252 } };
    expect(quickTips(free, gholdengo, []).map(q => q.id)).toEqual(duelTips([free, gholdengo], 0, gholdengo, [], fixtureData).tips.map(t => t.id));
  });
});
