import { describe, expect, it } from 'vitest';
import { parries, teamCores } from '../../src/engine/cores';
import { emptySet } from '../../src/engine/sets';
import type { TeamSet } from '../../src/engine/sets';

const mk = (species: string, ability?: string): TeamSet => {
  const s = emptySet(species);
  return ability ? { ...s, ability } : s;
};

const garchomp = mk('Garchomp', 'Rough Skin');
const scizor = mk('Scizor', 'Technician');
const valiant = mk('Iron Valiant', 'Quark Drive');
const toxapex = mk('Toxapex', 'Regenerator');

describe('parries', () => {
  it('Scizor copre Garchomp', () => {
    expect(parries(scizor, garchomp)).toEqual(expect.arrayContaining(['Ice', 'Dragon', 'Fairy']));
  });
  it('Garchomp copre Scizor', () => expect(parries(garchomp, scizor)).toEqual(['Fire']));
  it('Iron Valiant copre Garchomp', () => expect(parries(valiant, garchomp)).toEqual(['Dragon']));
  it('con abilità: Levitate para il Terreno', () => {
    const rotom = mk('Rotom-Wash', 'Levitate');
    expect(parries(rotom, mk('Heatran', 'Flash Fire'))).toContain('Ground');
  });
});

describe('teamCores', () => {
  const team = [garchomp, scizor, valiant, toxapex];
  it('trio Garchomp, Scizor, Iron Valiant in ciclo valido', () => {
    const [core] = teamCores(team);
    expect(core.members).toEqual(['Garchomp', 'Scizor', 'Iron Valiant']);
    expect(core.names).toEqual([['Dragon'], ['Steel'], ['Fairy']]);
    expect(core.sides).toHaveLength(3);
    const sets: Record<string, TeamSet> = { Garchomp: garchomp, Scizor: scizor, 'Iron Valiant': valiant };
    for (const s of core.sides) expect(parries(sets[s.from], sets[s.to])).toContain(s.type);
    expect(core.sides.find((s) => s.from === 'Iron Valiant' && s.to === 'Garchomp')?.type).toBe('Dragon');
  });
  it('il trio assorbe le coppie, nessun membro in due core', () => {
    const cores = teamCores(team, 5);
    const all = cores.flatMap((c) => c.members);
    expect(new Set(all).size).toBe(all.length);
    for (const c of cores.slice(1)) {
      expect(c.members.filter((m) => ['Garchomp', 'Scizor', 'Iron Valiant'].includes(m)).length).toBeLessThan(2);
    }
  });
  it('coppia Pelipper + Ferrothorn', () => {
    const cores = teamCores([mk('Pelipper'), mk('Ferrothorn')]);
    expect(cores).toHaveLength(1);
    expect(cores[0].names).toEqual([['Water', 'Flying'], ['Grass', 'Steel']]);
  });
  it('nome di ripiego: solo via Levitate -> tipo primario', () => {
    const [core] = teamCores([mk('Rotom-Frost', 'Levitate'), mk('Heatran', 'Flash Fire')]);
    expect(core).toBeDefined();
    expect(core.names[0]).toEqual(['Electric']);
  });
  it('vuoti o un solo membro -> []; mai più di max', () => {
    const blank = { ...emptySet(''), species: '' };
    expect(teamCores([blank, blank])).toEqual([]);
    expect(teamCores([garchomp])).toEqual([]);
    expect(teamCores(team, 1).length).toBeLessThanOrEqual(1);
    expect(teamCores(team).length).toBeLessThanOrEqual(2);
  });
});
