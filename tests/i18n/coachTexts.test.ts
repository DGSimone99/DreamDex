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
    // Difesa: solo i tipi che nessuno regge (grave); "regge poco" non è più un problema del Coaching (2026-11-24)
    expect(coaching.problems.some(p => p.category === 'defense' && p.severity === 'serious' && /^Uncovered on defense vs \w+: nobody withstands its hits$/.test(p.text))).toBe(true);
    expect(coaching.problems.some(p => p.category === 'defense' && p.severity === 'minor')).toBe(false);
    // Minacce scoperte dai due lati (nessuno le regge, nessuno le manda KO in due colpi): un problema solo
    const empty = coachTeam([emptySet('Snorlax'), emptySet('Tyranitar')], DEFAULT_FORMAT, fixtureData, 'en');
    expect(empty.problems.some(p => p.category === 'meta' && /^Unanswered threat: [\w-]+( [\w-]+)?\. Nobody takes its hits well and nobody 2HKOs it$/.test(p.text))).toBe(true);
  });

  it('meno di due membri', () => {
    expect(coachTeam([tusk], DEFAULT_FORMAT, fixtureData, 'en').verdict).toBe('Add another Pokémon to get coaching');
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
