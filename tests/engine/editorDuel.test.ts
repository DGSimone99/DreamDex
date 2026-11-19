import { describe, expect, it } from 'vitest';
import { battleSpeed, duelSpeed, editorDuel, TIP_MAX_EVS } from '../../src/engine/editorDuel';
import { importShowdown } from '../../src/engine/sets';

const [tusk, gholdengo] = importShowdown([
  'Great Tusk @ Booster Energy\nAbility: Protosynthesis\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Headlong Rush\n- Ice Spinner\n- Rapid Spin\n- Close Combat',
  'Gholdengo @ Choice Specs\nAbility: Good as Gold\nEVs: 252 SpA / 4 SpD / 252 Spe\nTimid Nature\n- Make It Rain\n- Shadow Ball\n- Focus Blast\n- Trick',
].join('\n\n')).sets;

describe('sfida dell\'editor', () => {
  it('il colpo migliore di ognuno, coi colpi per il KO', () => {
    const d = editorDuel(tusk, gholdengo);
    expect(d.mine?.move).toBe('Headlong Rush');
    expect(d.mine!.hitsSure).toBeGreaterThanOrEqual(d.mine!.hitsMaybe);
    expect(d.theirs).not.toBeNull();
    expect(d.theirs!.category).toBe('Special');
  });

  it('il consiglio di EV sposta davvero la soglia', () => {
    const d = editorDuel(tusk, gholdengo);
    if (!d.tip) return;
    expect(d.tip.total % 4).toBe(0);
    const evs = { ...tusk.evs };
    for (const [stat, n] of Object.entries(d.tip.add)) evs[stat as keyof typeof evs] = (evs[stat as keyof typeof evs] ?? 0) + n!;
    const after = editorDuel({ ...tusk, evs }, gholdengo);
    if (d.tip.side === 'defense') expect(after.theirs!.hitsMaybe).toBeGreaterThanOrEqual(d.tip.hits);
    else expect(after.mine!.hitsSure).toBeLessThanOrEqual(d.tip.hits);
  });
});

describe('sfida: consiglio solo se è un ritocco', () => {
  it('un consiglio che chiederebbe più di TIP_MAX_EVS non compare (Great Tusk contro Make It Rain servirebbero 388 EV)', () => {
    const d = editorDuel(tusk, gholdengo);
    expect(d.tip === null || d.tip.total <= TIP_MAX_EVS).toBe(true);
  });
});

describe('sfida: una mossa migliore da mettere nel set', () => {
  // Great Tusk con solo Ice Spinner contro Gholdengo: Headlong Rush (nel pool) lo manda KO con meno colpi
  const weak = { ...tusk, moves: ['Ice Spinner', 'Rapid Spin'] };
  it('propone una mossa del pool che non ha, con meno colpi del colpo di oggi', () => {
    const d = editorDuel(weak, gholdengo, ['Headlong Rush', 'Ice Spinner', 'Swords Dance', 'Fissure']);
    expect(d.moveTip?.move).toBe('Headlong Rush');
    expect(d.moveTip!.hits).toBeLessThan(d.mine!.hitsSure);
  });
  it('niente consiglio senza pool o se il colpo di oggi manda già KO in 1', () => {
    expect(editorDuel(weak, gholdengo).moveTip).toBeNull();
    const d = editorDuel(tusk, gholdengo, ['Headlong Rush', 'Earthquake']);
    if (d.mine!.hitsSure <= 1) expect(d.moveTip).toBeNull();
  });
});

describe('sfida: la Velocità', () => {
  it('chi muove prima, e il consiglio di EV supera davvero l\'avversario', () => {
    const slow = { ...tusk, evs: { ...tusk.evs, spe: 0 } };
    const s = duelSpeed(slow, gholdengo);
    expect(s.order).toBe(s.mine > s.theirs ? 'mine' : s.mine < s.theirs ? 'theirs' : 'tie');
    if (s.tip) {
      expect(s.tip.evs % 4).toBe(0);
      expect(battleSpeed({ ...slow, evs: { ...slow.evs, spe: s.tip.evs } })).toBeGreaterThan(s.theirs);
    }
  });
  it('la Sciarpa conta', () => {
    expect(battleSpeed({ ...gholdengo, item: 'Choice Scarf' })).toBeGreaterThan(battleSpeed(gholdengo));
  });
});
