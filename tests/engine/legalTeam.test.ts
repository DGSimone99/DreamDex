import { describe, expect, it } from 'vitest';
import { battleName } from '../../src/engine/dex';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { coachTeam } from '../../src/engine/coach';
import { duplicateSpecies, missingFormeItem, overEvMembers, voteTeam } from '../../src/engine/legalTeam';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { megaData } from '../fixtures/megaData';

const set = (species: string, item: string, ability = ''): TeamSet => ({ species, item, ability, moves: ['Tackle'], nature: 'Serious', evs: {} });
const names = (team: TeamSet[], multi = false) => voteTeam(team, multi).map(battleName);

describe('il team come in partita, per il voto', () => {
  it('una forma senza il suo strumento torna la forma da cui nasce', () => {
    expect(names([set('Zacian-Crowned', 'Leftovers')])).toEqual(['Zacian']);
    expect(names([set('Zacian-Crowned', 'Rusted Sword')])).toEqual(['Zacian-Crowned']);
    expect(names([set('Ogerpon-Wellspring', 'Leftovers', 'Water Absorb')])).toEqual(['Ogerpon']);
    expect(voteTeam([set('Ogerpon-Wellspring', 'Leftovers', 'Water Absorb')])[0].ability).toBe('Defiant');
    expect(names([set('Charizard-Mega-X', 'Leftovers')])).toEqual(['Charizard']);
    // La pietra giusta per l'altra Mega: diventa quella
    expect(names([set('Charizard-Mega-X', 'Charizardite Y')])).toEqual(['Charizard-Mega-Y']);
    expect(names([set('Arceus-Fire', 'Leftovers')])).toEqual(['Arceus']);
    expect(missingFormeItem(set('Arceus-Fire', 'Firium Z'))).toBeNull();
    expect(missingFormeItem(set('Lopunny', 'Lopunnite'))).toBeNull();
  });

  it('un set nuovo di una forma che vuole lo strumento nasce con quello', () => {
    expect(emptySet('Zacian-Crowned').item).toBe('Rusted Sword');
    expect(emptySet('Charizard-Mega-Y').item).toBe('Charizardite Y');
    expect(emptySet('Garchomp').item).toBe('');
  });

  it('senza "Più Mega ammesse" è Mega solo la prima del team', () => {
    const team = [set('Garchomp', 'Leftovers'), set('Lopunny', 'Lopunnite'), set('Charizard', 'Charizardite Y')];
    expect(names(team)).toEqual(['Garchomp', 'Lopunny-Mega', 'Charizard']);
    expect(voteTeam(team)[2].item).toBe('');
    expect(names(team, true)).toEqual(['Garchomp', 'Lopunny-Mega', 'Charizard-Mega-Y']);
    // Le Mega con la pietra sbagliata non contano come prima Mega
    expect(names([set('Charizard-Mega-X', 'Leftovers'), set('Lopunny', 'Lopunnite')])).toEqual(['Charizard', 'Lopunny-Mega']);
  });

  it('al massimo 6 membri', () => {
    expect(voteTeam(Array.from({ length: 7 }, () => set('Garchomp', 'Leftovers')))).toHaveLength(6);
  });

  it('EV oltre 510: niente voto, e il coach lo dice', () => {
    const tusk = mostCommonSet(megaData.stats, 'Great Tusk')!;
    const chomp = { ...mostCommonSet(megaData.stats, 'Charizard-Mega-Y')!, evs: { hp: 252, atk: 252, spe: 252 } };
    expect(overEvMembers([tusk, chomp])).toEqual([chomp]);
    expect(rateTeam([tusk, chomp], megaData)).toBeNull();
    expect(rateTeam([tusk, { ...chomp, evs: { atk: 252, spe: 252, hp: 4 } }], megaData)).not.toBeNull();
    const texts = coachTeam([tusk, chomp], DEFAULT_FORMAT, megaData).problems.map(p => p.text);
    expect(texts).toContain('Charizard-Mega-Y: 756 EV, più del massimo di 510. Il voto è bloccato finché non li sistemi');
  });

  it('specie doppia (Species Clause): niente voto, il coach lo dice; non in Anything Goes', () => {
    const tusk = mostCommonSet(megaData.stats, 'Great Tusk')!;
    const zard = mostCommonSet(megaData.stats, 'Charizard-Mega-Y')!;
    expect(duplicateSpecies([tusk, zard, tusk], 'ou')).toEqual([2]);
    // Forme diverse della stessa specie e la Mega con la base: stessa specie
    expect(duplicateSpecies([set('Rotom-Wash', 'Leftovers'), set('Rotom-Heat', 'Leftovers')], 'ou')).toEqual([1]);
    expect(duplicateSpecies([set('Charizard', ''), zard], 'ou')).toEqual([1]);
    expect(duplicateSpecies([tusk, tusk], 'gen9ag')).toEqual([]);
    expect(rateTeam([tusk, zard, tusk], megaData)).toBeNull();
    expect(rateTeam([tusk, zard], megaData)).not.toBeNull();
    const texts = coachTeam([tusk, zard, tusk], DEFAULT_FORMAT, megaData).problems.map(p => p.text);
    expect(texts).toContain('Great Tusk: questa specie è già nel team (Species Clause). Il voto è bloccato finché non la cambi');
  });

  it('una seconda Mega non alza il voto oltre quello della forma base', () => {
    const lopunny = mostCommonSet(megaData.stats, 'Lopunny-Mega') ?? set('Lopunny', 'Lopunnite');
    const zard = mostCommonSet(megaData.stats, 'Charizard-Mega-Y')!;
    const base = { ...zard, species: 'Charizard', item: '', ability: 'Blaze' };
    expect(rateTeam([lopunny, zard], megaData)!.overall).toBe(rateTeam([lopunny, base], megaData)!.overall);
  });
});
