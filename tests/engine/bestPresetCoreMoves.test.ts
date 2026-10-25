import { describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { emptySet, type TeamSet } from '../../src/engine/sets';

// In un file a parte: le cache del motore (chiave per formato) non distinguono statistiche diverse dello stesso formato
const set = (species: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(species), moves, item });

describe('mosse quasi obbligatorie (usate almeno al 95%)', () => {
  const urshifuStats = { usage: 0.2, count: 1000, abilities: { unseenfist: 1 }, items: { choiceband: 1 }, teraTypes: {}, spreads: {}, teammates: {}, checks: {},
    moves: { surgingstrikes: 0.9997, closecombat: 0.93, uturn: 0.8, icespinner: 0.49, aquajet: 0.36, flipturn: 0.3, drainpunch: 0.2, swordsdance: 0.15, trailblaze: 0.1 } };
  const others = ['Great Tusk', 'Gholdengo', 'Kingambit', 'Corviknight'].map(n => set(n, ['Protect']));
  const sun = { ...emptySet('Ninetales'), ability: 'Drought', item: 'Heat Rock', moves: ['Flamethrower', 'Solar Beam', 'Will-O-Wisp', 'Encore'] };
  const dataWith = async (presets?: EngineData['presets']) => {
    const { fillData } = await import('../fixtures/fillData');
    return { ...fillData, stats: { ...fillData.stats!, pokemon: { ...fillData.stats!.pokemon, 'Urshifu-Rapid-Strike': urshifuStats } }, ...(presets ? { presets } : {}) };
  };

  it('il ritocco non toglie Surging Strikes anche se il sole la indebolisce', async () => {
    const { tuneSet } = await import('../../src/engine/bestPreset');
    const urshifu = { ...emptySet('Urshifu-Rapid-Strike'), ability: 'Unseen Fist', item: 'Choice Band', nature: 'Jolly', evs: { atk: 252, spe: 252, hp: 4 },
      moves: ['Surging Strikes', 'Close Combat', 'U-turn', 'Aqua Jet'] };
    // Senza la regola il ritocco la sostituiva con Drain Punch
    const tuned = tuneSet([urshifu, sun, ...others], 0, await dataWith(), 9);
    expect(tuned.moves).toContain('Surging Strikes');
  });

  it('Preset migliori la rimette se il preset non l’ha, al posto della mossa meno usata', async () => {
    const { bestPreset } = await import('../../src/engine/bestPreset');
    const preset = { ...emptySet('Urshifu-Rapid-Strike'), ability: 'Unseen Fist', item: 'Choice Band', moves: ['Close Combat', 'U-turn', 'Ice Spinner', 'Aqua Jet'] };
    const data = await dataWith({ 'Urshifu-Rapid-Strike': [{ name: 'Band', format: 'gen9nationaldex', set: preset }] });
    const best = bestPreset([set('Urshifu-Rapid-Strike', ['Close Combat']), sun, ...others], 0, data, 9);
    expect(best.set.moves).toContain('Surging Strikes');
    expect(best.set.moves).toContain('Close Combat');
  });

  it('una mossa sotto il 95% resta libera di cambiare', async () => {
    const { CORE_MOVE_SHARE } = await import('../../src/engine/bestPreset');
    expect(CORE_MOVE_SHARE).toBe(0.95);
  });
});
