import { beforeAll, describe, expect, it } from 'vitest';
import type { EngineData } from '../../src/engine/data';
import { getSpecies } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { dexOf, isLegalIn, pokedexOf, teraAllowed, tierIn } from '../../src/engine/formats';
import { illegalParts, initLearnsets } from '../../src/engine/learnsets';
import { rateTeam } from '../../src/engine/rating';
import { DEFAULT_RULES } from '../../src/engine/formatRules';
import { hasSetup, isPassive } from '../../src/engine/roles';
import { defaultSet, emptySet, type TeamSet } from '../../src/engine/sets';
import { fixtureData } from '../fixtures/data';

const set = (species: string, item: string, ability: string, moves: string[], teraType?: string): TeamSet =>
  ({ ...emptySet(species), item, ability, moves, ...(teraType ? { teraType } : {}) });
const gen9 = { ...DEFAULT_FORMAT, formatId: 'gen9ou' as const };
const sp = (name: string) => getSpecies(name)!;

beforeAll(() => initLearnsets());

describe('Gen 9 OU: Pokédex di Scarlatto/Violetto', () => {
  it('nel menu sotto Gen 9, con Tera ammesso', () => {
    expect(dexOf('gen9ou')).toBe('gen9');
    expect(pokedexOf(gen9)).toBe('sv');
    expect(teraAllowed(gen9)).toBe(true);
  });

  it('solo i Pokémon di Scarlatto/Violetto e coi tier di Gen 9', () => {
    expect(isLegalIn(sp('Great Tusk'), gen9)).toBe(true);
    // Le Mega non esistono in Scarlatto/Violetto; in National Dex OU sì
    expect(isLegalIn(sp('Lopunny-Mega'), gen9)).toBe(false);
    expect(isLegalIn(sp('Lopunny-Mega'), DEFAULT_FORMAT)).toBe(true);
    // Garchomp è OU in National Dex ma UUBL in Gen 9: legale in OU in entrambi
    expect(tierIn(sp('Garchomp'), gen9)).not.toBe(tierIn(sp('Garchomp'), DEFAULT_FORMAT));
    expect(isLegalIn(sp('Koraidon'), gen9)).toBe(false);
  });

  it('le mosse che non esistono in Scarlatto/Violetto sono illegali solo lì', () => {
    const weavile = set('Weavile', 'Choice Band', 'Pressure', ['Triple Axel', 'Knock Off', 'Ice Shard', 'Pursuit']);
    expect(illegalParts(weavile, 9, 'sv').moves).toEqual(['Pursuit']);
    expect(illegalParts(weavile, 9, 'natdex').moves).toEqual([]);
  });

  it('il set predefinito non porta mosse né strumenti estranei a Scarlatto/Violetto', () => {
    const data: EngineData = { ...fixtureData, formatId: 'gen9ou', sets: { Weavile: set('Weavile', 'Normalium Z', 'Pressure', ['Triple Axel', 'Knock Off', 'Ice Shard', 'Pursuit']) } };
    const result = defaultSet(data, 'Weavile', 9)!;
    expect(result.moves).not.toContain('Pursuit');
    expect(result.item).not.toBe('Normalium Z');
    // In National Dex il set resta com'è
    expect(defaultSet({ ...data, formatId: 'ou' }, 'Weavile', 9)!.moves).toContain('Pursuit');
  });
});

describe('niente bonus Tera (tolto il 2026-11-07)', () => {
  it('un Tera che copre una debolezza non dà punti nel voto', () => {
    const team = [
      set('Heatran', 'Leftovers', 'Flash Fire', ['Magma Storm', 'Earth Power', 'Stealth Rock', 'Taunt'], 'Flying'),
      set('Iron Valiant', 'Booster Energy', 'Quark Drive', ['Moonblast', 'Close Combat', 'Knock Off', 'Encore'], 'Ghost'),
      set('Kingambit', 'Black Glasses', 'Supreme Overlord', ['Swords Dance', 'Kowtow Cleave', 'Sucker Punch', 'Iron Head'], 'Dark'),
    ];
    const r = rateTeam(team, { ...fixtureData, formatId: 'gen9ou' })!;
    expect(r.bonus.items.some(i => i.text.includes('Tera'))).toBe(false);
  });
});
describe('Iron Defense con Body Press', () => {
  it('è un setup: Zamazenta veloce è uno sweeper, non un muro passivo; Corviknight lento resta un muro', () => {
    const zamazenta = set('Zamazenta', 'Leftovers', 'Dauntless Shield', ['Iron Defense', 'Body Press', 'Crunch', 'Roar']);
    const corviknight = set('Corviknight', 'Leftovers', 'Pressure', ['Iron Defense', 'Body Press', 'Roost', 'Defog']);
    // Il setup non è più un ruolo: si riconosce sulle mosse (filtro ed etichetta della carta)
    expect(hasSetup(zamazenta)).toBe(true);
    expect(isPassive(zamazenta, DEFAULT_RULES)).toBe(false);
    expect(isPassive(corviknight, DEFAULT_RULES)).toBe(true);
  });
});
