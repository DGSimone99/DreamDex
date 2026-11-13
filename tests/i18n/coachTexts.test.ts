import { describe, expect, it } from 'vitest';
import { coachTeam } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, importShowdown } from '../../src/engine/sets';
import { fixtureData, gholdengo, tusk } from '../fixtures/data';

describe('coaching e valutazione in inglese', () => {
  it('verdetto, problemi e categorie', () => {
    const coaching = coachTeam([tusk, gholdengo, { ...emptySet('Mewtwo'), item: 'Mewtwonite Y' }], DEFAULT_FORMAT, fixtureData, 'en');
    expect(coaching.verdict).toBe('Incomplete team');
    expect(coaching.problems).toContainEqual({ severity: 'serious', category: 'rules', text: 'Mewtwo-Mega-Y is not legal in National Dex OU: tier too high', fixes: [], key: 'rules:Mewtwo-Mega-Y is not legal in National Dex OU: tier too high', subjects: ['Mewtwo-Mega-Y'] });
    // Difesa: grave se nessuno regge il tipo, minore se lo regge poco
    expect(coaching.problems.some(p => p.category === 'defense' && p.severity === 'serious' && /^Uncovered on defense vs \w+: nobody withstands its hits$/.test(p.text))).toBe(true);
    expect(coaching.problems.some(p => p.category === 'defense' && p.severity === 'minor' && /^Weakly covered on defense vs \w+: few withstand its hits$/.test(p.text))).toBe(true);
    expect(coaching.problems.some(p => p.category === 'meta' && /^Uncovered on defense vs [\w-]+( [\w-]+)?: nobody withstands its hits$/.test(p.text))).toBe(true);
  });

  it('meno di due membri', () => {
    expect(coachTeam([tusk], DEFAULT_FORMAT, fixtureData, 'en').verdict).toBe('Add at least 2 Pokémon to get coaching');
  });

  it('voto e aree in inglese', () => {
    const rating = rateTeam([tusk, gholdengo], fixtureData, 'en')!;
    expect(['Excellent', 'Great', 'Good', 'Fair', 'Weak']).toContain(rating.label);
    expect(rating.areas.map(a => a.label)).toEqual(['Defense', 'Offense', 'Speed']);
  });

  it('errori di import in inglese', () => {
    expect(importShowdown('Notapokemon\n- Tackle', 'en').errors).toContain('Pokémon "Notapokemon" not found: check the name (in English, as on Showdown)');
  });
});
