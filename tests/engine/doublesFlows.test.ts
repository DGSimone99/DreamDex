import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { defaultChoice, fillProposals, matchesChoice, type FillChoice } from '../../src/engine/fillProposals';
import { rateTeam } from '../../src/engine/rating';
import { coherenceGaps } from '../../src/engine/coherence';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { levelKeysFor } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { teamSummary } from '../../src/engine/teamSummary';
import { dashboardData } from '../../src/engine/overviewDashboard';
import { analyzeTeam } from '../../src/engine/analysis';
import { fixtureData } from '../fixtures/data';
import { fillData } from '../fixtures/fillData';

const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Adamant', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 252, def: 252, spd: 4 };
const special = { spa: 252, spe: 252, spd: 4 };
const full: TeamSet[] = [
  mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'], 'Adamant', { hp: 252, atk: 252, spd: 4 }),
  mk('Amoonguss', 'Rocky Helmet', 'Regenerator', ['Rage Powder', 'Spore', 'Pollen Puff', 'Protect'], 'Bold', bulky),
  mk('Landorus-Therian', 'Life Orb', 'Intimidate', ['Earthquake', 'Rock Slide', 'Stealth Rock', 'Protect'], 'Jolly'),
  mk('Kingambit', 'Black Glasses', 'Defiant', ['Sucker Punch', 'Kowtow Cleave', 'Iron Head', 'Swords Dance']),
  mk('Flutter Mane', 'Choice Specs', 'Protosynthesis', ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Mystical Fire'], 'Timid', special),
  mk('Cresselia', 'Leftovers', 'Levitate', ['Psychic', 'Moonlight', 'Helping Hand', 'Icy Wind'], 'Bold', bulky),
];

const doubles: Format = { ...DEFAULT_FORMAT, formatId: 'natdexdoubles' };
const doublesData = { ...fixtureData, formatId: 'natdexdoubles' as const };

describe('doppio: le voci dei Ruoli per formato', () => {
  it('in doppio le nove voci, in singolo tutte le altre (nessuna del doppio)', () => {
    expect(levelKeysFor('oneType')).toEqual(['anyAttacker', 'secondProtect', 'anyWall', 'spread', 'fakeOut', 'redirector', 'hazards', 'pivot', 'secondFirstStrike']);
    for (const rule of ['walls', 'recoverySpeed', undefined] as const) {
      const keys = levelKeysFor(rule);
      for (const key of ['secondProtect', 'anyWall', 'spread', 'fakeOut', 'redirector', 'secondFirstStrike'] as const) expect(keys).not.toContain(key);
      expect(keys).toContain('removal');
      expect(keys).toHaveLength(26);
    }
  });
});

describe('doppio: un tipo scelto a mano si ignora', () => {
  it('il voto con un tipo del singolo forzato è uguale al voto senza', () => {
    const plain = rateTeam(full, doublesData)!;
    const forced = rateTeam(full, doublesData, 'it', { archetype: 'stall' })!;
    expect(forced.teamType).toBe('doubles');
    expect(forced.overall).toBe(plain.overall);
    expect(forced.roles.rows.map(r => r.key)).toEqual(plain.roles.rows.map(r => r.key));
  });

  it('Completa team: una scelta salvata col tipo "stall" vale come nessun tipo, senza errori', () => {
    const stale: FillChoice = { ...defaultChoice(full), archetype: 'stall' };
    expect(matchesChoice(full, stale, doubles)).toBe(true);
    expect(matchesChoice(full, stale, DEFAULT_FORMAT)).toBe(false);
    const data = { ...fillData, formatId: 'natdexdoubles' as const };
    const run = (choice: FillChoice) => [...fillProposals(full.slice(0, 4), choice, [], doubles, data)].filter((p): p is NonNullable<typeof p> => !!p);
    const withType = run(stale);
    const without = run(defaultChoice(full.slice(0, 4)));
    expect(withType.map(p => p.added.map(s => s.species))).toEqual(without.map(p => p.added.map(s => s.species)));
    for (const proposal of withType) expect(proposal.archetype).toBe('doubles');
  });
});

describe('doppio: Completa team non ragiona con le trappole del singolo', () => {
  it('in doppio "manca chi mette / toglie le trappole" non è un buco; le debolezze condivise sì', () => {
    // Nessuno mette né toglie trappole
    const bare = full.map(set => (set.species === 'Landorus-Therian' ? { ...set, moves: ['Earthquake', 'Rock Slide', 'U-turn', 'Protect'] } : set));
    expect(coherenceGaps(bare, NATDEX_OU_RULES).map(g => g.kind)).toEqual(expect.arrayContaining(['hazards', 'removal']));
    expect(coherenceGaps(bare, DOUBLES_RULES).map(g => g.kind).filter(kind => kind !== 'weakness')).toEqual([]);
    // Tre deboli allo stesso tipo senza nessuno che lo resista: resta un buco anche in doppio
    const rock = ['Charizard', 'Volcarona', 'Articuno', 'Moltres', 'Talonflame', 'Butterfree'].map(species => mk(species, '', '', ['Protect']));
    expect(coherenceGaps(rock, DOUBLES_RULES).map(g => g.kind)).toContain('weakness');
  });

  it('nessuna proposta del doppio porta il buco delle trappole', () => {
    const data = { ...fillData, formatId: 'natdexdoubles' as const };
    const proposals = [...fillProposals(full.slice(0, 2), defaultChoice(full.slice(0, 2)), [], doubles, data)].filter((p): p is NonNullable<typeof p> => !!p);
    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) expect(proposal.gaps.map(g => g.kind).filter(kind => kind !== 'weakness')).toEqual([]);
  });
});

describe('doppio: coach, Panoramica e riassunto', () => {
  it('il coach non parla di ruoli che in doppio non contano e non tiene fermo nessun tipo', () => {
    // Senza Fake Out e con un solo Protect: i problemi dei ruoli nominano solo voci del doppio
    const team = full.map(set => (set.species === 'Incineroar' ? { ...set, moves: ['Flare Blitz', 'Knock Off', 'Parting Shot', 'Snarl'] }
      : set.species === 'Landorus-Therian' ? { ...set, moves: ['Earthquake', 'Rock Slide', 'Stealth Rock', 'U-turn'] } : set));
    const coaching = coachTeam(team, doubles, doublesData);
    expect(coaching.teamType).toEqual({ archetype: 'doubles', styles: [] });
    const text = coaching.problems.map(p => p.text).join(' | ');
    expect(text).toContain('Protect (2 membri)');
    expect(text).toContain('Fake Out');
    for (const gone of ['Controllo Hazard', 'Recupero', 'Screen Setter', 'Sweeper', 'Wallbreaker', 'Attaccante fisico', 'Attaccante speciale', 'Anti-setup']) expect(text).not.toContain(gone);
  });

  it('il riassunto dice Doppio con al massimo uno stile, anche a team incompleto', () => {
    const sun = [mk('Torkoal', 'Charcoal', 'Drought', ['Eruption', 'Earth Power', 'Protect'], 'Quiet', { hp: 252, spa: 252, spd: 4 }), mk('Venusaur', 'Life Orb', 'Chlorophyll', ['Sludge Bomb', 'Energy Ball', 'Protect'], 'Modest', special), full[0]];
    const coaching = coachTeam(sun, doubles, doublesData);
    const rating = rateTeam(sun, doublesData)!;
    const summary = teamSummary(sun, rating, coaching, dashboardData(sun, analyzeTeam(sun, doublesData), rating, coaching.problems, doublesData, 'it'), doublesData);
    expect(summary.archetype).toBe('doubles');
    expect(summary.typeRule).toBe('oneType');
    expect(summary.styles).toEqual(['sun']);
  });
});
