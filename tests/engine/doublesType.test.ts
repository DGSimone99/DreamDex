import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { teamArchetype, typeMix } from '../../src/engine/archetype';
import { DOUBLES_RULES, formatRules, isOneType, NATDEX_OU_RULES } from '../../src/engine/formatRules';
import { needsArchetype } from '../../src/engine/needs';
import { rateTeam, setDoublesWeights } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { t } from '../../src/i18n';
import { fixtureData } from '../fixtures/data';

const mk = (species: string, item: string, ability: string, moves: string[], nature = 'Jolly', evs: TeamSet['evs'] = { atk: 252, spe: 252, spd: 4 }): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, nature, evs });
const bulky = { hp: 248, def: 252, spd: 8 };

// Tutti e 6 passivi: in singolo è uno stall
const stallTeam: TeamSet[] = [
  mk('Dondozo', 'Leftovers', 'Unaware', ['Body Press', 'Liquidation', 'Rest', 'Sleep Talk'], 'Impish', bulky),
  mk('Blissey', 'Leftovers', 'Natural Cure', ['Protect', 'Seismic Toss', 'Toxic', 'Wish'], 'Bold', bulky),
  mk('Clodsire', 'Leftovers', 'Unaware', ['Amnesia', 'Poison Jab', 'Recover', 'Spikes'], 'Careful', bulky),
  mk('Corviknight', 'Leftovers', 'Pressure', ['Body Press', 'Defog', 'Iron Defense', 'Roost'], 'Impish', bulky),
  mk('Gliscor', 'Toxic Orb', 'Poison Heal', ['Earthquake', 'Protect', 'Stealth Rock', 'Toxic'], 'Impish', bulky),
  mk('Toxapex', 'Rocky Helmet', 'Regenerator', ['Knock Off', 'Recover', 'Scald', 'Toxic Spikes'], 'Bold', bulky),
];

const doublesData = { ...fixtureData, formatId: 'natdexdoubles' as const };
const ouData = { ...fixtureData, formatId: 'ou' as const };
const benchTeams = JSON.parse(readFileSync('scripts/bench/teams.json', 'utf8')) as { name: string; team: TeamSet[] }[];

afterEach(() => setDoublesWeights(null));

describe('doppio: un tipo di team solo', () => {
  it('National Dex Doubles usa la regola del tipo unico, il singolo no', () => {
    expect(formatRules('natdexdoubles')).toBe(DOUBLES_RULES);
    expect(isOneType(DOUBLES_RULES)).toBe(true);
    expect(isOneType(NATDEX_OU_RULES)).toBe(false);
  });

  it('in doppio il tipo è sempre "doubles", anche con un team da stall o incompleto', () => {
    expect(teamArchetype(stallTeam, DOUBLES_RULES)!.archetype).toBe('doubles');
    expect(teamArchetype(stallTeam.slice(0, 2), DOUBLES_RULES)!.archetype).toBe('doubles');
    expect(needsArchetype(stallTeam.slice(0, 2), DOUBLES_RULES)).toBe('doubles');
    expect(teamArchetype([], DOUBLES_RULES)).toBeNull();
  });

  it('in doppio le tre aree pesano un terzo e non c\'è "vicino a"', () => {
    const r = rateTeam(stallTeam, doublesData)!;
    expect(r.teamType).toBe('doubles');
    expect(r.weights).toEqual({ strength: 1 / 3, defense: 1 / 3, speed: 1 / 3 });
    expect(r.typeMix).toBeNull();
    expect(typeMix(benchTeams[0].team, DOUBLES_RULES)).toBeNull();
    // Anche incompleto: "doubles", non "balance"
    expect(rateTeam(stallTeam.slice(0, 2), doublesData)!.teamType).toBe('doubles');
  });

  it('setDoublesWeights cambia solo i pesi del doppio', () => {
    const before = rateTeam(benchTeams[0].team, ouData)!;
    setDoublesWeights({ strength: 0.5, defense: 0.3, speed: 0.2 });
    expect(rateTeam(stallTeam, doublesData)!.weights).toEqual({ strength: 0.5, defense: 0.3, speed: 0.2 });
    const during = rateTeam(benchTeams[0].team, ouData)!;
    expect(during.overall).toBe(before.overall);
    expect(during.weights).toEqual(before.weights);
    setDoublesWeights(null);
    expect(rateTeam(stallTeam, doublesData)!.weights).toEqual({ strength: 1 / 3, defense: 1 / 3, speed: 1 / 3 });
  });

  it('il singolo non cambia: stesso tipo e stesso voto di prima per tre team OU', () => {
    // Valori letti prima di toccare il codice (2026-11-20), coi dati di prova
    const expected: [number, number, string][] = [[0, 80, 'hyperOffense'], [8, 76, 'balance'], [11, 66, 'stall']];
    for (const [index, overall, type] of expected) {
      const r = rateTeam(benchTeams[index].team, ouData)!;
      expect([benchTeams[index].name, r.overall, r.teamType]).toEqual([benchTeams[index].name, overall, type]);
    }
  });

  it('i nomi: Doppio / Doubles', () => {
    expect(t('it', 'archetype.doubles')).toBe('Doppio');
    expect(t('en', 'archetype.doubles')).toBe('Doubles');
  });
});
