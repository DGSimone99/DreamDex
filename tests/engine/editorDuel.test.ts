import { describe, expect, it } from 'vitest';
import { editorDuel } from '../../src/engine/editorDuel';
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
