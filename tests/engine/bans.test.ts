import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildBans, parseFormats, parseRulesets, resolveBans } from '../../scripts/showdown-bans';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { bannedParts, initBans, isBannedIn } from '../../src/engine/formats';
import { initLearnsets } from '../../src/engine/learnsets';
import { defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const FORMATS = [
  'export const Formats = [',
  '\t{',
  '\t\tname: "[Gen 9] OU",',
  '\t\tmod: \'gen9\',',
  '\t\truleset: [\'Standard\', \'Sleep Moves Clause\', \'!Sleep Clause Mod\'],',
  '\t\tbanlist: [\'Uber\', \'AG\', \'Moody\', \'King\\\'s Rock\', \'Shed Tail\', \'Hypnosis + Gengarite\'],',
  '\t},',
  '\t{',
  '\t\tname: "[Gen 9] UU",',
  '\t\truleset: [\'[Gen 9] OU\'],',
  '\t\tbanlist: [\'OU\', \'UUBL\'],',
  '\t},',
  '];',
].join('\n');
const RULESETS = [
  'export const Rulesets = {',
  '\tstandard: {',
  '\t\tname: \'Standard\',',
  '\t\truleset: [\'OHKO Clause\', \'Evasion Moves Clause\', \'Sleep Clause Mod\'],',
  '\t},',
  '\tevasionmovesclause: {',
  '\t\tname: \'Evasion Moves Clause\',',
  '\t\tbanlist: [\'Minimize\', \'Double Team\'],',
  '\t},',
  '\tohkoclause: {',
  '\t\tname: \'OHKO Clause\',',
  '\t},',
  '\tsleepmovesclause: {',
  '\t\tname: \'Sleep Moves Clause\',',
  '\t\tbanlist: [\'Yawn\'],',
  '\t},',
  '};',
].join('\n');

describe('ban di Showdown', () => {
  const rules = [...parseFormats(FORMATS), ...parseRulesets(RULESETS)];

  it('legge formati e regole, anche coi nomi tra parentesi quadre', () => {
    expect(rules.find(r => r.name === '[Gen 9] UU')!.ruleset).toEqual(['[Gen 9] OU']);
    expect(rules.find(r => r.name === '[Gen 9] OU')!.banlist).toContain("King's Rock");
  });

  it('eredita da formati e regole; le regole che vietano con del codice tornano come clausole', () => {
    const { names, clauses } = resolveBans('[Gen 9] UU', rules);
    expect(names).toEqual(expect.arrayContaining(['Moody', 'Shed Tail', 'Minimize', 'Yawn', 'OU']));
    expect(clauses).toEqual(expect.arrayContaining(['OHKO Clause', 'Sleep Moves Clause']));
  });

  it('divide per tipo, salta tier e combinazioni, ricostruisce OHKO e Sleep Moves Clause', () => {
    const bans = buildBans(rules).gen9uu;
    expect(bans.abilities).toEqual(['Moody']);
    expect(bans.items).toEqual(["King's Rock"]);
    expect(bans.moves).toEqual(expect.arrayContaining(['Shed Tail', 'Minimize', 'Yawn', 'Fissure', 'Spore', 'Hypnosis']));
    expect(bans.species).toEqual([]);
  });
});

describe('ban nel set', () => {
  beforeAll(() => initLearnsets());
  afterEach(() => initBans(null));
  const gen9 = { ...DEFAULT_FORMAT, formatId: 'gen9ou' as const };
  const set = (moves: string[], ability: string, item: string): TeamSet => ({ ...emptySet('Amoonguss'), moves, ability, item });

  it('mosse, abilità e strumento vietati dal formato', () => {
    initBans({ gen9ou: { moves: ['Spore'], abilities: ['Moody'], items: ["King's Rock"], species: [] } });
    expect(bannedParts(set(['Spore', 'Giga Drain'], 'Moody', "King's Rock"), gen9)).toEqual({ moves: ['Spore'], ability: 'Moody', item: "King's Rock" });
    // Con "Ignora ban" non si segnala niente
    expect(bannedParts(set(['Spore'], 'Moody', ''), { ...gen9, ignoreBans: true }).moves).toEqual([]);
  });

  it('un Pokémon vietato per nome (Shedinja in National Dex Ubers)', () => {
    initBans({ ubers: { moves: [], abilities: [], items: [], species: ['Shedinja'] } });
    expect(isBannedIn(getSpecies('Shedinja')!, { ...DEFAULT_FORMAT, formatId: 'ubers' })).toBe(true);
    expect(isBannedIn(getSpecies('Shedinja')!, DEFAULT_FORMAT)).toBe(false);
  });

  it('il coach lo segnala come problema di regole', () => {
    initBans({ ou: { moves: ['Shed Tail'], abilities: [], items: [], species: [] } });
    const team = [{ ...emptySet('Cyclizar'), ability: 'Regenerator', moves: ['Shed Tail', 'Rapid Spin'] }, { ...emptySet('Great Tusk'), ability: 'Protosynthesis', moves: ['Headlong Rush'] }];
    const rules = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.filter(p => p.category === 'rules').map(p => p.text);
    expect(rules).toContain('Cyclizar: Mosse vietate in National Dex OU: Shed Tail');
  });

  it('il set predefinito non porta mosse vietate', () => {
    initBans({ gen9ou: { moves: ['Spore'], abilities: [], items: [], species: [] } });
    const data: EngineData = { ...fixtureData, formatId: 'gen9ou', sets: { Amoonguss: set(['Spore', 'Giga Drain', 'Clear Smog', 'Sludge Bomb'], 'Regenerator', 'Black Sludge') } };
    expect(defaultSet(data, 'Amoonguss', 9)!.moves).not.toContain('Spore');
  });
});
