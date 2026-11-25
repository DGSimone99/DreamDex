import { describe, expect, it } from 'vitest';
import { defenderPanel, PANEL_SIZE } from '../../src/engine/defenders';
import { getSpecies } from '../../src/engine/dex';
import { formatRules } from '../../src/engine/formatRules';
import { isPassive, legacyWall } from '../../src/engine/roles';
import { referenceSpeeds, tierSpecies } from '../../src/engine/speed';
import { usageOf } from '../../src/engine/stats';
import { fixtureData, fixtureStats } from '../fixtures/data';

// Come isDefensiveSet: passivo o muro legacy (l'investimento lo garantisce già il filtro del pannello)
const defensive = (set: Parameters<typeof isPassive>[0]) => {
  const rules = formatRules('ou');
  return isPassive(set, rules) || legacyWall(set, rules);
};
const bulk = (name: string) => { const s = getSpecies(name)!.baseStats; return s.hp * (s.def + s.spd); };

describe('defenderPanel', () => {
  it('col meta: al massimo 12, prima i difensivi più usati del meta', () => {
    const panel = defenderPanel(fixtureData);
    expect(panel.length).toBe(PANEL_SIZE);
    const fromMeta = panel.filter(set => set.moves.length > 0); // i set standard del tier non hanno mosse
    expect(fromMeta.every(defensive)).toBe(true);
    const usages = fromMeta.map(set => usageOf(fixtureStats, set.species));
    expect(usages).toEqual([...usages].sort((a, b) => b - a));
  });

  it('senza meta o senza statistiche: i 12 più robusti del tier, con un set difensivo standard', () => {
    for (const data of [{ ...fixtureData, ignoreMeta: true, formatId: 'ou' as const }, { stats: null, sets: null, formatId: 'ou' as const }]) {
      const panel = defenderPanel(data);
      expect(panel.length).toBe(PANEL_SIZE);
      const pool: string[] = tierSpecies('ou').map(s => s.name);
      expect(panel.every(set => pool.includes(set.species))).toBe(true);
      const bulks = panel.map(set => bulk(set.species));
      expect(bulks).toEqual([...bulks].sort((a, b) => b - a));
      for (const set of panel) {
        const s = getSpecies(set.species)!;
        const side = s.baseStats.def >= s.baseStats.spd ? 'def' : 'spd';
        expect(set.evs).toEqual({ hp: 252, [side]: 252 });
        expect(set.nature).toBe(side === 'def' ? 'Bold' : 'Calm');
        expect(set.item).toBe('Leftovers');
        expect(set.ability).toBe(s.abilities[0]);
      }
    }
  });

  it('col meta ogni difensore investe almeno 400 EV fra PS e difese: un attaccante con statistiche alte non è un difensore', () => {
    const panel = defenderPanel(fixtureData).filter(set => set.moves.length > 0);
    for (const set of panel) {
      const rules = formatRules('ou');
      const investment = (set.evs.hp ?? 0) + (set.evs.def ?? 0) + (set.evs.spd ?? 0);
      expect(investment).toBeGreaterThanOrEqual(400);
    }
  });

  it('senza meta: niente forme solo da battaglia, e solo Pokémon più difensivi che offensivi', () => {
    const panel = defenderPanel({ stats: null, sets: null, formatId: 'ou' });
    for (const set of panel) {
      const s = getSpecies(set.species)!;
      expect(s.battleOnly).toBeFalsy();
      expect(Math.max(s.baseStats.def, s.baseStats.spd)).toBeGreaterThanOrEqual(Math.max(s.baseStats.atk, s.baseStats.spa));
    }
  });

  it('si calcola una volta per formato e meta', () => {
    expect(defenderPanel(fixtureData)).toBe(defenderPanel(fixtureData));
  });
});

describe('tierSpecies', () => {
  it('la Velocità di riferimento non cambia', () => {
    const ou = referenceSpeeds('ou');
    expect([ou.length, ou[0], ou[ou.length - 1]]).toEqual([43, 152, 412]);
    expect(tierSpecies('ou').length).toBe(43);
  });
});
