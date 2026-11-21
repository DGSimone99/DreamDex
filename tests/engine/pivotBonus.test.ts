import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rankedChanges } from '../../src/engine/coach';
import { PIVOT_POINTS, pivotLinks, type PivotParts } from '../../src/engine/pivotBonus';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rankByTeamGain, type TeamGain } from '../../src/engine/teamGain';
import { TYPES, type TypeName } from '../../src/engine/types';
import { fixtureData } from '../fixtures/data';

/** Un membro coi soli numeri che la regola legge: velocità, quanto regge, quanto attacca, e i tipi che para. */
interface Spec {
  species: string;
  moves?: string[];
  /** Quota del gruppo superata (0–1). */
  speed?: number;
  /** Quanto regge delle minacce del meta (0–100); null = voto senza meta, allora conta `hold`. */
  metaHold?: number | null;
  hold?: number;
  attack?: number;
  primary?: 'attack' | 'wall' | null;
  /** Tipi di cui para il colpo (meno di un terzo dei PS). */
  blocks?: TypeName[];
}

const build = (specs: Spec[]): { team: TeamSet[]; parts: PivotParts } => ({
  team: specs.map(m => ({ ...emptySet(m.species), moves: m.moves ?? [] })),
  parts: {
    offense: { members: specs.map(m => ({ total: m.attack ?? 0 })) },
    defense: {
      members: specs.map(m => ({ metaHold: m.metaHold === undefined ? 25 : m.metaHold, hold: m.hold ?? 30 })),
      typed: specs.map(m => ({ cells: TYPES.map(type => ({ band: m.blocks?.includes(type) ? 'four' : 'two' })) })),
    },
    speed: { members: specs.map(m => ({ raw: m.speed ?? 0.5 })) },
    roles: { members: specs.map(m => ({ primary: m.primary ?? null })) },
  } as unknown as PivotParts,
});
const links = (specs: Spec[]) => {
  const { team, parts } = build(specs);
  return pivotLinks(team, parts);
};

const alomomola: Spec = { species: 'Alomomola', moves: ['Flip Turn', 'Wish'], speed: 0.2, metaHold: 50, primary: 'wall' };
const weavile: Spec = { species: 'Weavile', moves: ['Knock Off'], speed: 0.9, metaHold: 10, attack: 70, primary: 'attack' };
// Tornadus-Therian (Volante) è debole a Elettro, Ghiaccio e Roccia
const tornadus: Spec = { species: 'Tornadus-Therian', moves: ['U-turn', 'Bleakwind Storm'], speed: 0.9, metaHold: 25, attack: 60, primary: 'attack' };

describe('Pivot sfruttato: la regola', () => {
  it('lento e robusto con un attaccante fragile: lo fa entrare', () => {
    expect(links([alomomola, weavile])).toEqual([{ kind: 'slow', pivot: 'Alomomola', move: 'Flip Turn', partners: ['Weavile'] }]);
  });

  it('lento ma non robusto, o senza un attaccante fragile: niente', () => {
    expect(links([{ ...alomomola, metaHold: 20 }, weavile])).toEqual([]);
    // Weavile che regge (non è fragile), che attacca poco, o che non è un attaccante
    expect(links([alomomola, { ...weavile, metaHold: 30 }])).toEqual([]);
    expect(links([alomomola, { ...weavile, attack: 30 }])).toEqual([]);
    expect(links([alomomola, { ...weavile, primary: 'wall' }])).toEqual([]);
  });

  it('il fragile da far entrare non è il pivot stesso', () => {
    expect(links([{ ...weavile, moves: ['U-turn'], speed: 0.2, metaHold: 40 }])).toEqual([]);
  });

  it('senza la mossa pivot niente, anche se tutto il resto torna', () => {
    expect(links([{ ...alomomola, moves: ['Wish', 'Scald'] }, weavile])).toEqual([]);
  });

  it('Teleport è sempre lento, anche su un membro veloce', () => {
    const result = links([{ species: 'Blissey', moves: ['Teleport'], speed: 0.9, metaHold: 45, primary: 'wall' }, weavile]);
    expect(result).toEqual([{ kind: 'slow', pivot: 'Blissey', move: 'Teleport', partners: ['Weavile'] }]);
  });

  it('ingresso sicuro (pivot veloce): ogni debolezza di tipo ha un compagno che la para', () => {
    const cover: Spec = { species: 'Ting-Lu', blocks: ['Electric', 'Rock'], metaHold: 60 };
    const ice: Spec = { species: 'Heatran', blocks: ['Ice'], metaHold: 50 };
    expect(links([tornadus, cover, ice])).toEqual([{ kind: 'cover', pivot: 'Tornadus-Therian', move: 'U-turn', partners: ['Ting-Lu', 'Heatran'] }]);
    // Una debolezza scoperta (Ghiaccio): niente
    expect(links([tornadus, cover])).toEqual([]);
  });

  it('ingresso sicuro: nel testo solo i compagni che bastano', () => {
    const all: Spec = { species: 'Ting-Lu', blocks: ['Electric', 'Rock', 'Ice'], metaHold: 60 };
    const one: Spec = { species: 'Heatran', blocks: ['Ice'], metaHold: 50 };
    expect(links([tornadus, one, all])[0].partners).toEqual(['Ting-Lu']);
  });

  it('né lento né veloce: vale l\'ingresso sicuro, non "regge il colpo"', () => {
    const cover: Spec = { species: 'Ting-Lu', blocks: ['Electric', 'Rock', 'Ice'], metaHold: 60 };
    const middle = { ...tornadus, speed: 0.4 };
    expect(links([middle, cover, weavile])).toEqual([{ kind: 'cover', pivot: 'Tornadus-Therian', move: 'U-turn', partners: ['Ting-Lu'] }]);
    // Robusto e con un fragile accanto, ma senza chi para le sue debolezze: niente (non è lento)
    expect(links([{ ...middle, metaHold: 50 }, weavile])).toEqual([]);
  });

  it('un pivot lento non prende l\'ingresso sicuro: gli serve reggere il colpo e un fragile da far entrare', () => {
    // Alomomola (Acqua) è debole a Erba ed Elettro, tutte e due parate: ma è lento
    const cover: Spec = { species: 'Ferrothorn', blocks: ['Grass', 'Electric'], metaHold: 60 };
    expect(links([alomomola, cover])).toEqual([]);
    expect(links([alomomola, cover, weavile]).map(l => l.kind)).toEqual(['slow']);
  });

  it('senza meta conta quanto regge i colpi di tipo', () => {
    const noMeta = (m: Spec, hold: number): Spec => ({ ...m, metaHold: null, hold });
    expect(links([noMeta(alomomola, 50), noMeta(weavile, 15)])).toHaveLength(1);
    expect(links([noMeta(alomomola, 30), noMeta(weavile, 15)])).toEqual([]);
    expect(links([noMeta(alomomola, 50), noMeta(weavile, 25)])).toEqual([]);
  });

  it('prima i lenti e difensivi, poi gli ingressi sicuri', () => {
    const cover: Spec = { species: 'Ting-Lu', blocks: ['Electric', 'Rock', 'Ice'], metaHold: 60 };
    expect(links([tornadus, cover, alomomola, weavile]).map(l => l.kind)).toEqual(['slow', 'cover']);
  });
});

const s = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, hp: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });

describe('Pivot sfruttato: nel voto', () => {
  const team: TeamSet[] = [
    s('Great Tusk', 'Leftovers', 'Protosynthesis', ['Headlong Rush', 'Close Combat', 'Rapid Spin', 'Knock Off']),
    s('Kingambit', 'Leftovers', 'Supreme Overlord', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Swords Dance'], 'Adamant'),
    s('Garchomp', 'Rocky Helmet', 'Rough Skin', ['Earthquake', 'Stealth Rock', 'Dragon Tail', 'Fire Fang']),
    s('Dragapult', 'Choice Band', 'Clear Body', ['Dragon Darts', 'U-turn', 'Phantom Force', 'Sucker Punch']),
    s('Corviknight', 'Leftovers', 'Pressure', ['Brave Bird', 'Roost', 'U-turn', 'Bulk Up'], 'Impish', { hp: 252, def: 252, spd: 4 }),
    s('Skarmory', 'Rocky Helmet', 'Sturdy', ['Brave Bird', 'Roost', 'Whirlwind', 'Spikes'], 'Impish', { hp: 252, def: 252, spd: 4 }),
  ];

  it('vale +1 una volta sola, anche con più pivot, ed è la voce dei legami trovati', () => {
    const rating = rateTeam(team, fixtureData)!;
    const items = rating.bonus.items.filter(i => i.catalog === 'pivotLink');
    const found = pivotLinks(team, rating);
    expect(items).toHaveLength(found.length ? 1 : 0);
    for (const item of items) {
      expect(item.points).toBe(PIVOT_POINTS);
      expect(item.text).toContain(found[0].pivot);
    }
  });

  it('i ruoli minori coperti non danno più punti', () => {
    const rating = rateTeam(team, fixtureData)!;
    expect(rating.roles.rows.some(r => r.level === 'minor' && r.value >= 0.5)).toBe(true);
    expect(rating.bonus.items.map(i => i.text).join(' ')).not.toMatch(/ruolo extra/);
  });
});

describe('Pivot sfruttato: nel Coaching', () => {
  const ouData = { ...fixtureData, formatId: 'ou' as const };
  // Il team di riferimento del banco: Corviknight (posto 4) ha U-turn, regge il colpo e fa entrare i compagni fragili
  const reference = (JSON.parse(readFileSync('scripts/bench/teams.json', 'utf8')) as { team: TeamSet[] }[])[0].team;
  const without = reference.map((set, i) => (i === 4 ? { ...set, moves: set.moves.map(move => (move === 'U-turn' ? 'Defog' : move)) } : set));
  const hasBonus = (team: TeamSet[]) => rateTeam(team, ouData)!.bonus.items.some(i => i.catalog === 'pivotLink');

  it('il team di riferimento ha il bonus; senza la mossa pivot no', () => {
    expect(reference[4].species).toBe('Corviknight');
    expect(hasBonus(reference)).toBe(true);
    expect(hasBonus(without)).toBe(false);
  });

  it('un cambio che porta il bonus lo dice, e uno che lo toglie pure', () => {
    const [gains] = rankByTeamGain([{ set: reference[4], score: 0 }], without, 4, ouData, 'it');
    expect(gains.teamGain!.pivot).toBe('gained');
    const [loses] = rankByTeamGain([{ set: without[4], score: 0 }], reference, 4, ouData, 'it');
    expect(loses.teamGain!.pivot).toBe('lost');
    // Un cambio che non tocca il bonus non lo nomina
    const [same] = rankByTeamGain([{ set: { ...reference[0], moves: reference[0].moves.slice(0, 3) }, score: 0 }], reference, 0, ouData, 'it');
    expect(same.teamGain!.pivot).toBeUndefined();
  });

  it('pro e contro lo nominano, col suo punto', () => {
    const none = { roles: [], covers: [], resists: [] };
    const diff = { gains: none, losses: none, lostResists: [] };
    expect(rankedChanges(diff, { pivot: 'gained', areaPoints: {} } as unknown as TeamGain, 'it').pros)
      .toEqual([{ text: 'Pivot sfruttato', points: PIVOT_POINTS, area: 'roles', bonus: true }]);
    expect(rankedChanges(diff, { pivot: 'lost', areaPoints: {} } as unknown as TeamGain, 'it').cons)
      .toEqual([{ text: 'Pivot non più sfruttato', points: -PIVOT_POINTS, area: 'roles', bonus: true }]);
    // Il suo punto è fisso: non toglie punti dell'area alle altre voci dei Ruoli
    const withRole = { gains: { ...none, roles: ['hazards' as const] }, losses: none, lostResists: [] };
    const { pros } = rankedChanges(withRole, { pivot: 'gained', areaPoints: { roles: 4 } } as unknown as TeamGain, 'it');
    expect(pros.map(p => p.points)).toEqual([4, PIVOT_POINTS]);
  });
});
