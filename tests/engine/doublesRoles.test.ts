import { describe, expect, it } from 'vitest';
import { DOUBLES_RULES, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { rateTeam } from '../../src/engine/rating';
import { levelOf, ROLE_LEVELS, setRolesCountMeasured } from '../../src/engine/roleLevels';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { DOUBLES_ROLES, hasDoublesRole, setSubRoles } from '../../src/engine/subRoles';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Adamant', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const special = { spa: 252, spe: 252, spd: 4 };
const bulky = { hp: 252, def: 252, spd: 4 };

// Copre tutte e nove le voci del doppio
const full: TeamSet[] = [
  mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Knock Off', 'Parting Shot'], 'Adamant', { hp: 252, atk: 252, spd: 4 }),
  mk('Amoonguss', 'Rocky Helmet', 'Regenerator', ['Rage Powder', 'Spore', 'Pollen Puff', 'Protect'], 'Bold', bulky),
  mk('Landorus-Therian', 'Life Orb', 'Intimidate', ['Earthquake', 'Rock Slide', 'Stealth Rock', 'Protect'], 'Jolly'),
  mk('Kingambit', 'Black Glasses', 'Defiant', ['Sucker Punch', 'Kowtow Cleave', 'Iron Head', 'Swords Dance']),
  mk('Flutter Mane', 'Choice Specs', 'Protosynthesis', ['Moonblast', 'Shadow Ball', 'Dazzling Gleam', 'Mystical Fire'], 'Timid', special),
  mk('Cresselia', 'Leftovers', 'Levitate', ['Psychic', 'Moonlight', 'Helping Hand', 'Icy Wind'], 'Bold', bulky),
];
/** Lo stesso team con le mosse di un membro cambiate. */
const swap = (species: string, moves: string[], team = full): TeamSet[] => team.map(set => (set.species === species ? { ...set, moves } : set));

const doublesData = { ...fixtureData, formatId: 'natdexdoubles' as const };
const ouData = { ...fixtureData, formatId: 'ou' as const };
const rating = (team: TeamSet[]) => rateTeam(team, doublesData)!;
const roles = (team: TeamSet[]) => rating(team).roles;
const row = (team: TeamSet[], key: string) => roles(team).rows.find(r => r.key === key)!;
const lost = (team: TeamSet[], catalog: string) => roles(team).failures.filter(f => f.catalog === catalog).map(f => [f.text, f.points]);
/** Le voci minori coperte (dal 2026-11-21 senza punti: stanno solo nella lista). */
const minors = (team: TeamSet[]) => roles(team).rows.filter(r => r.level === 'minor' && r.value >= 0.5).map(r => r.key);

describe('i Ruoli del doppio', () => {
  it('le voci del doppio sono le nove della tabella, coi loro livelli', () => {
    expect(roles(full).rows.map(r => [r.key, r.level])).toEqual([
      ['anyAttacker', 'essential'], ['secondProtect', 'essential'], ['anyWall', 'important'], ['spread', 'important'], ['fakeOut', 'important'],
      ['redirector', 'minor'], ['hazards', 'minor'], ['pivot', 'minor'], ['secondFirstStrike', 'minor'],
    ]);
  });

  it('il team base copre tutto: nessun malus dai ruoli e quattro minori coperti, che non danno punti', () => {
    expect(roles(full).failures).toEqual([]);
    expect(minors(full)).toHaveLength(4);
    expect(rating(full).bonus.items.map(i => i.text).join(' ')).not.toMatch(/ruolo extra/);
    expect(rating(full).needs.essentialMissing).toEqual([]);
  });

  it('un solo membro con Protect non basta: −4', () => {
    const one = swap('Landorus-Therian', ['Earthquake', 'Rock Slide', 'Stealth Rock', 'U-turn']);
    expect(row(one, 'secondProtect').value).toBeLessThan(0.5);
    expect(lost(one, 'essentialRole')).toEqual([['Doppio senza Protect (2 membri)', 4]]);
    expect(rating(one).needs.essentialMissing).toEqual(['secondProtect']);
  });

  it('Protect e Detect sullo stesso membro contano uno', () => {
    const same = swap('Amoonguss', ['Rage Powder', 'Spore', 'Pollen Puff', 'Stun Spore'], swap('Landorus-Therian', ['Earthquake', 'Detect', 'Stealth Rock', 'Protect']));
    expect(lost(same, 'essentialRole')).toHaveLength(1);
    // Due membri diversi, uno con Detect e uno con Spiky Shield: coperto
    const two = swap('Amoonguss', ['Rage Powder', 'Spore', 'Pollen Puff', 'Spiky Shield'], swap('Landorus-Therian', ['Earthquake', 'Detect', 'Stealth Rock', 'Rock Slide']));
    expect(lost(two, 'essentialRole')).toEqual([]);
  });

  it('senza Fake Out: −2; senza mossa a più bersagli: −2; senza muro: −2', () => {
    const noFake = swap('Incineroar', ['Protect', 'Flare Blitz', 'Knock Off', 'Parting Shot']);
    expect(lost(noFake, 'importantRole')).toEqual([['Doppio senza Fake Out (importante)', 2]]);
    const noSpread = swap('Landorus-Therian', ['Stomping Tantrum', 'Stone Edge', 'Stealth Rock', 'Protect'],
      swap('Flutter Mane', ['Moonblast', 'Shadow Ball', 'Psyshock', 'Mystical Fire'], swap('Cresselia', ['Psychic', 'Moonlight', 'Helping Hand', 'Thunder Wave'])));
    expect(lost(noSpread, 'importantRole')).toEqual([['Doppio senza Mossa a più bersagli (importante)', 2]]);
    const frail = (set: TeamSet): TeamSet => ({ ...set, nature: 'Timid', evs: special });
    // Cresselia regge anche senza EV: al suo posto un Pokémon fragile
    const noWall = full.map(set => (set.species === 'Cresselia' ? mk('Alakazam', 'Life Orb', 'Magic Guard', ['Psychic', 'Dazzling Gleam', 'Icy Wind', 'Helping Hand'], 'Timid', special)
      : ['Amoonguss', 'Incineroar'].includes(set.species) ? frail(set) : set));
    expect(row(noWall, 'anyWall').value).toBeLessThan(0.5);
    expect(lost(noWall, 'importantRole')).toEqual([['Doppio senza Muro (importante)', 2]]);
  });

  it('Redirector è solo Follow Me o Rage Powder (Wide Guard no)', () => {
    expect(minors(full)).toContain('redirector');
    const wide = swap('Amoonguss', ['Wide Guard', 'Spore', 'Pollen Puff', 'Protect']);
    expect(minors(wide)).not.toContain('redirector');
    const follow = swap('Amoonguss', ['Follow Me', 'Spore', 'Pollen Puff', 'Protect']);
    expect(minors(follow)).toContain('redirector');
  });

  it('Priorità: Fake Out su un membro e Sucker Punch su un altro la coprono; tutti e due sullo stesso no', () => {
    expect(minors(full)).toContain('secondFirstStrike');
    const same = swap('Kingambit', ['Fake Out', 'Sucker Punch', 'Iron Head', 'Swords Dance'], swap('Incineroar', ['Protect', 'Flare Blitz', 'Knock Off', 'Parting Shot']));
    expect(row(same, 'secondFirstStrike').value).toBeLessThan(0.5);
    expect(minors(same)).not.toContain('secondFirstStrike');
  });

  it('Earthquake e Dazzling Gleam sono mosse a più bersagli, Moonblast no', () => {
    expect(row(full, 'spread').by.map(b => [b.species, b.source])).toEqual(expect.arrayContaining([['Landorus-Therian', 'Earthquake'], ['Flutter Mane', 'Dazzling Gleam']]));
    expect(row(full, 'spread').by.map(b => b.species)).not.toContain('Kingambit');
    expect(setSubRoles(mk('Charizard', '', 'Blaze', ['Heat Wave']), DOUBLES_RULES).spread).toBe(1);
    expect(setSubRoles(mk('Charizard', '', 'Blaze', ['Flamethrower']), DOUBLES_RULES).spread).toBeUndefined();
  });

  it('nessuna voce di recupero, controllo hazard, schermi, sweeper, wallbreaker, attaccante fisico o speciale', () => {
    const keys = roles(full).rows.map(r => r.key);
    for (const gone of ['recovery', 'removal', 'screens', 'anySweeper', 'anyBreaker', 'sweeperOrBreaker', 'anyPhysical', 'anySpecial', 'physicalSweeper', 'physicalWall', 'specialWall', 'speedControl', 'phazer', 'dot', 'itemRemoval']) {
      expect(keys).not.toContain(gone);
    }
  });

  it('team di 5 in doppio: i ruoli mancanti non costano', () => {
    expect(roles(swap('Incineroar', ['Protect', 'Flare Blitz', 'Knock Off', 'Parting Shot']).slice(0, 5)).failures).toEqual([]);
  });

  it('una specie sconosciuta in doppio: il tipo resta Doppio, i ruoli mancanti non costano, nessun errore', () => {
    const typo = swap('Incineroar', ['Protect', 'Flare Blitz', 'Knock Off', 'Parting Shot']).map(set => (set.species === 'Cresselia' ? { ...set, species: 'Creselia' } : set));
    const r = rating(typo);
    expect(r.teamType).toBe('doubles');
    expect(r.provisional).toBe(true);
    expect(r.roles.failures).toEqual([]);
  });

  it('un team OU non ha nessuna voce del doppio, e i suoi membri nessun sotto-ruolo del doppio', () => {
    const r = rateTeam(full, ouData)!;
    const keys = r.roles.rows.map(row => row.key);
    for (const key of [...DOUBLES_ROLES, 'anyWall', 'secondProtect', 'secondFirstStrike']) expect(keys).not.toContain(key);
    for (const member of r.roles.members) for (const role of DOUBLES_ROLES) expect(member.values[role]).toBeUndefined();
    for (const role of DOUBLES_ROLES) expect(setSubRoles(full[0], NATDEX_OU_RULES)[role]).toBeUndefined();
  });

  it("l'interruttore dei ruoli misurati non tocca la colonna del doppio, e nel singolo le chiavi nuove sono ignorate", () => {
    setRolesCountMeasured(true);
    try { expect(levelOf('doubles', 'anyWall')).toBe('important'); } finally { setRolesCountMeasured(false); }
    expect(levelOf('doubles', 'anyWall')).toBe('important');
    expect(Object.keys(ROLE_LEVELS.doubles)).toHaveLength(9);
    for (const type of ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'] as const) {
      for (const key of ['spread', 'fakeOut', 'redirector', 'anyWall', 'secondProtect', 'secondFirstStrike'] as const) expect(levelOf(type, key)).toBe('ignored');
    }
  });

  it('un candidato con Fake Out copre la voce mancante', () => {
    const noFake = swap('Incineroar', ['Protect', 'Flare Blitz', 'Knock Off', 'Parting Shot']);
    expect(rating(noFake).needs.missingRoles).toContain('fakeOut');
    expect(setSubRoles(mk('Rillaboom', 'Assault Vest', 'Grassy Surge', ['Fake Out', 'Grassy Glide', 'Wood Hammer', 'U-turn']), DOUBLES_RULES).fakeOut).toBe(1);
  });

  it('hasDoublesRole: Fake Out e le due mosse di deviazione', () => {
    expect(hasDoublesRole(full[0], 'fakeOut')).toBe(true);
    expect(hasDoublesRole(full[0], 'redirector')).toBe(false);
    expect(hasDoublesRole(full[1], 'redirector')).toBe(true);
    expect(hasDoublesRole(mk('Clefairy', 'Eviolite', 'Friend Guard', ['Follow Me']), 'redirector')).toBe(true);
    expect(hasDoublesRole(mk('Hitmontop', '', 'Intimidate', ['Wide Guard']), 'redirector')).toBe(false);
  });
});
