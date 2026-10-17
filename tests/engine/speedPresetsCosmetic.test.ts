import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import type { EngineData } from '../../src/engine/data';
import { getSpecies, isCosmeticForme } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { EMPTY_FILTERS, searchCandidates } from '../../src/engine/filters';
import { rateTeam } from '../../src/engine/rating';
import { detectRoles, teamRoles } from '../../src/engine/roles';
import { teamNeeds } from '../../src/engine/needs';
import { defaultSet, emptySet, presetsFor, presetsForSet, sameSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, tusk } from '../fixtures/data';

const set = (species: string, moves: string[], item = '', ability = ''): TeamSet => ({ ...emptySet(species), moves, item, ...(ability ? { ability } : {}) });

describe('Controllo velocità: solo con mosse che la controllano', () => {
  const gardevoir = set('Gardevoir', ['Hyper Voice', 'Mystical Fire', 'Psyshock', 'Calm Mind'], 'Gardevoirite');

  it('essere veloci non è controllo velocità (Mega Gardevoir, Scarf)', () => {
    expect(detectRoles(gardevoir)).not.toContain('speed');
    expect(detectRoles(set('Landorus-Therian', ['Earthquake', 'U-turn'], 'Choice Scarf'))).not.toContain('speed');
  });

  it('paralisi, Sticky Web, Trick Room, Tailwind, Icy Wind sì', () => {
    for (const move of ['Thunder Wave', 'Glare', 'Nuzzle', 'Stun Spore', 'Sticky Web', 'Trick Room', 'Tailwind', 'Icy Wind', 'Electroweb']) {
      expect(detectRoles(set('Clefable', ['Moonblast', move]))).toContain('speed');
    }
  });

  it('per giudicare il team la velocità resta coperta anche da un membro veloce o con Scarf', () => {
    expect(teamRoles(gardevoir)).toContain('speed');
    expect(teamRoles(set('Great Tusk', ['Headlong Rush'], 'Choice Scarf'))).toContain('speed');
    expect(teamNeeds([gardevoir, tusk]).missingRoles).not.toContain('speed');
  });

  it('il coaching non chiede controllo velocità a un team con membri veloci', () => {
    const texts = coachTeam([gardevoir, tusk], DEFAULT_FORMAT, fixtureData).problems.map(p => p.text).join(' | ');
    expect(texts).not.toMatch(/Controllo velocità/);
  });

  it('il voto conta la velocità di un membro veloce come prima', () => {
    const withFast = rateTeam([gardevoir, tusk], fixtureData)!.areas.find(a => a.key === 'roles')!.value!;
    const slow = rateTeam([set('Toxapex', ['Scald', 'Recover']), tusk], fixtureData)!.areas.find(a => a.key === 'roles')!.value!;
    expect(withFast).toBeGreaterThan(slow);
  });
});

describe('preset di una Mega o di una Primal: quelli della specie base', () => {
  const stone = { ...emptySet('Gardevoir'), item: 'Gardevoirite', moves: ['Hyper Voice'] };
  const plain = { ...emptySet('Gardevoir'), item: 'Choice Specs', moves: ['Moonblast'] };
  const data: EngineData = {
    stats: null, sets: {},
    presets: { Gardevoir: [{ name: 'Specs', format: 'gen9nationaldex', set: plain }, { name: 'Mega', format: 'gen9nationaldex', set: stone }] },
  };

  it('la Mega trova i preset della base con la sua pietra', () => {
    const presets = presetsFor(data, 'Gardevoir-Mega');
    expect(presets.map(p => p.name)).toEqual(['Mega']);
  });

  it("il set di riferimento della Mega è il suo preset, così l'editor lo riconosce", () => {
    const mega = defaultSet(data, 'Gardevoir-Mega');
    expect(mega.item).toBe('Gardevoirite');
    expect(presetsForSet(data, mega).find(p => sameSet(p.set, mega))?.name).toBe('Mega');
  });

  it('senza preset con la pietra il set di riferimento resta quello di prima', () => {
    const noStone: EngineData = { ...data, presets: { Gardevoir: [{ name: 'Specs', format: 'gen9nationaldex', set: plain }] } };
    expect(defaultSet(noStone, 'Gardevoir-Mega').item).toBe('Gardevoirite');
  });

  it('la specie base ha solo i preset senza pietra', () => {
    expect(presetsFor(data, 'Gardevoir').map(p => p.name)).toEqual(['Specs']);
  });
});

describe('forme estetiche: doppioni della specie base', () => {
  it('Greninja-Bond, Vivillon e Pikachu con il cappello sono estetiche; le forme vere no', () => {
    for (const name of ['Greninja-Bond', 'Vivillon-Polar', 'Pikachu-Original', 'Magearna-Original']) expect(isCosmeticForme(getSpecies(name)!)).toBe(true);
    for (const name of ['Greninja', 'Rotom-Wash', 'Landorus-Therian', 'Charizard-Mega-Y', 'Kyogre-Primal']) expect(isCosmeticForme(getSpecies(name)!)).toBe(false);
  });

  it('la ricerca per nome non mostra Greninja-Bond', () => {
    const names = searchCandidates([tusk], DEFAULT_FORMAT, fixtureData, { ...EMPTY_FILTERS, query: 'greninja' }, 20).map(s => s.species);
    expect(names).toContain('Greninja');
    expect(names).not.toContain('Greninja-Bond');
  });
});
