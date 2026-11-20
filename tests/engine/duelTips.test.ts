import { describe, expect, it } from 'vitest';
import { evSources, metaEffects } from '../../src/engine/duelTips';
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
