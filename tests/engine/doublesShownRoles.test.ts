import { describe, expect, it } from 'vitest';
import { analyzeTeam } from '../../src/engine/analysis';
import { cardRoles } from '../../src/engine/archetype';
import { formatRules } from '../../src/engine/formatRules';
import { diffContribution } from '../../src/engine/replace';
import { detectRoles, roleDescription, roleLabel, shownRoles } from '../../src/engine/roles';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { rolesList, rolesListFor, setSubRoles } from '../../src/engine/subRoles';
import { fixtureData } from '../fixtures/data';

const doubles = formatRules('natdexdoubles');
const ou = formatRules('ou');
const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Adamant', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });

const incineroar = mk('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Parting Shot', 'Flare Blitz', 'Knock Off'], 'Adamant', { hp: 252, atk: 252, spd: 4 });
const amoonguss = mk('Amoonguss', 'Rocky Helmet', 'Regenerator', ['Rage Powder', 'Spore', 'Protect', 'Pollen Puff'], 'Bold', { hp: 252, def: 252, spd: 4 });
const skarmory = mk('Skarmory', 'Leftovers', 'Sturdy', ['Roost', 'Stealth Rock', 'Defog', 'Brave Bird'], 'Impish', { hp: 252, def: 252, spd: 4 });

describe('doppio: la lista dei ruoli di un membro', () => {
  it('Incineroar: Fake Out, priorità e pivot; niente ruoli del singolo', () => {
    const roles = detectRoles(incineroar, doubles);
    expect(roles).toEqual(expect.arrayContaining(['fakeOut', 'firstStrike', 'pivot']));
    expect(roles).not.toContain('itemRemoval');
    expect(roles).not.toContain('debuff');
  });

  it('Amoonguss: Redirector e Protect; niente stati', () => {
    const roles = detectRoles(amoonguss, doubles);
    expect(roles).toEqual(expect.arrayContaining(['redirector', 'protect']));
    expect(roles).not.toContain('dot');
    expect(roles).not.toContain('debuff');
    expect(roles).not.toContain('recovery');
  });

  it('recupero, hazard e rimozione: in doppio resta solo l\'hazard', () => {
    const roles = detectRoles(skarmory, doubles);
    expect(roles).toContain('hazards');
    expect(roles).not.toContain('recovery');
    expect(roles).not.toContain('removal');
  });

  it('nel singolo la lista è quella di sempre', () => {
    for (const set of [incineroar, amoonguss, skarmory]) {
      expect(detectRoles(set, ou)).toEqual(rolesList(setSubRoles(set, ou)));
      expect(rolesListFor(setSubRoles(set, ou), ou)).toEqual(rolesList(setSubRoles(set, ou)));
    }
    expect(detectRoles(skarmory, ou)).toEqual(expect.arrayContaining(['recovery', 'removal', 'hazards']));
  });

  it('gli attaccanti di un lato entrano solo se misurati, subito dopo sweeper e wallbreaker', () => {
    expect(rolesListFor({ physicalAttacker: 1, fakeOut: 1, physicalWall: 1 }, doubles)).toEqual(['physicalAttacker', 'physicalWall', 'fakeOut']);
    // Nel singolo restano fuori dalla lista, come sempre
    expect(rolesListFor({ physicalAttacker: 1, physicalWall: 1 }, ou)).toEqual(['physicalWall']);
  });
});

describe('doppio: Attaccante e Muro sono una voce sola', () => {
  it('i sotto-ruoli d\'attacco e i due muri si fondono, al posto del primo', () => {
    expect(shownRoles(['physicalSweeper', 'physicalBreaker', 'physicalWall', 'fakeOut'], doubles)).toEqual(['anyAttacker', 'anyWall', 'fakeOut']);
    expect(shownRoles(['physicalWall', 'specialWall', 'specialAttacker', 'protect'], doubles)).toEqual(['anyWall', 'anyAttacker', 'protect']);
  });

  it('nel singolo la lista non cambia', () => {
    const list = ['physicalSweeper', 'physicalBreaker', 'physicalWall', 'hazards'] as const;
    expect(shownRoles([...list], ou)).toEqual([...list]);
  });

  it('hanno nome e descrizione nelle due lingue', () => {
    expect(roleLabel('anyAttacker', 'it')).toBe('Attaccante');
    expect(roleLabel('anyWall', 'it')).toBe('Muro');
    expect(roleLabel('anyWall', 'en')).toBe('Wall');
    for (const lang of ['it', 'en'] as const) for (const role of ['anyAttacker', 'anyWall'] as const) {
      expect(roleDescription(role, lang)).not.toContain('roleDesc.');
      expect(roleDescription(role, lang).length).toBeGreaterThan(10);
    }
  });
});

describe('doppio: i ruoli sulla carta', () => {
  it('Incineroar: il principale e Fake Out (non la priorità, che Fake Out implica)', () => {
    const roles = cardRoles(incineroar, doubles);
    expect(roles).toHaveLength(2);
    expect(['anyAttacker', 'anyWall']).toContain(roles[0]);
    expect(roles[1]).toBe('fakeOut');
  });

  it('un attaccante con Protect e Heat Wave: la mossa a più bersagli, Protect per ultimo non entra', () => {
    const volcarona = mk('Volcarona', 'Life Orb', 'Flame Body', ['Heat Wave', 'Bug Buzz', 'Giga Drain', 'Protect'], 'Timid', { spa: 252, spe: 252, spd: 4 });
    expect(cardRoles(volcarona, doubles)).toEqual(['anyAttacker', 'spread']);
  });

  it('chi porta il meteo lo mostra per secondo', () => {
    const torkoal = mk('Torkoal', 'Charcoal', 'Drought', ['Eruption', 'Heat Wave', 'Earth Power', 'Protect'], 'Quiet', { hp: 252, spa: 252, spd: 4 });
    expect(cardRoles(torkoal, doubles)[1]).toBe('weather');
  });

  it('un attacco con priorità senza Fake Out: Priorità', () => {
    const scizor = mk('Scizor', 'Life Orb', 'Technician', ['Bullet Punch', 'Bug Bite', 'Close Combat', 'Swords Dance']);
    expect(cardRoles(scizor, doubles)).toEqual(['anyAttacker', 'firstStrike']);
  });

  it('solo Protect: è il secondo ruolo quando non c\'è altro', () => {
    const dragapult = mk('Dragapult', 'Life Orb', 'Clear Body', ['Dragon Darts', 'Phantom Force', 'Sucker Punch', 'Protect'], 'Jolly');
    const noPriority = { ...dragapult, moves: ['Dragon Darts', 'Phantom Force', 'Fire Blast', 'Protect'] };
    expect(cardRoles(noPriority, doubles)).toEqual(['anyAttacker', 'protect']);
  });

  it('coi valori misurati usa quelli (un attaccante di un lato vale Attaccante)', () => {
    expect(cardRoles(amoonguss, doubles, { specialAttacker: 1, redirector: 1, protect: 1 })).toEqual(['anyAttacker', 'redirector']);
  });

  it('nel singolo la carta è quella di sempre', () => {
    expect(cardRoles(skarmory, ou)).toEqual(['physicalWall', 'hazards']);
  });
});

describe('doppio: Porta / Toglie', () => {
  const data = { ...fixtureData, formatId: 'natdexdoubles' as const };

  it('team senza Fake Out: il candidato che lo porta lo guadagna', () => {
    const kingambit = mk('Kingambit', 'Black Glasses', 'Defiant', ['Kowtow Cleave', 'Iron Head', 'Swords Dance', 'Protect']);
    const garchomp = mk('Garchomp', 'Life Orb', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Rock Slide', 'Protect'], 'Jolly');
    const original = mk('Arcanine', 'Sitrus Berry', 'Intimidate', ['Flare Blitz', 'Extreme Speed', 'Close Combat', 'Protect']);
    const diff = diffContribution(original, incineroar, analyzeTeam([kingambit, garchomp], data), [kingambit, garchomp]);
    expect(diff.gains.roles).toContain('fakeOut');
    // Tutti e due attaccano: "Attaccante" non è né guadagnato né perso, e non compaiono sotto-ruoli d'attacco sciolti
    expect([...diff.gains.roles, ...diff.losses.roles].filter(role => /Sweeper|Breaker|Attacker$/.test(role))).toEqual([]);
  });
});
