import { describe, expect, it } from 'vitest';
import { coachTeam, describeSwap, rankedChanges } from '../../src/engine/coach';
import { topReason } from '../../src/engine/explain';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });

describe('coachTeam', () => {
  const coaching = coachTeam([tusk, gholdengo], DEFAULT_FORMAT, fixtureData);

  it('verdetto con conteggi', () => {
    expect(coaching.verdict).toBe('Team incompleto');
    expect(coaching.problems.filter(p => p.severity === 'serious')).toHaveLength(0);
    expect(coaching.problems).toHaveLength(7);
  });

  it('punti di forza', () => {
    expect(coaching.strengths).toEqual([
      'Gestisce bene Poison, Bug, Rock',
      // Solo le voci essenziali dell'archetipo (balance: attaccanti e muri); la rimozione ora è importante
      'Ruoli coperti: Minaccia Offensiva, Muro Fisico',
      'Colpisce super efficace 15/18 tipi',
    ]);
  });

  it('i check contro i Pokémon più usati non sono tra i problemi, ma hanno i loro rimedi', () => {
    expect(coaching.problems.some(p => p.text.includes('check') || p.text.includes('Minacce'))).toBe(false);
    expect(coaching.threatFixes.Dragapult).toContain('Kingambit');
    expect(coaching.threatFixes.Corviknight).toContain('Rotom-Wash');
    expect(coaching.threatFixes.Kingambit).toBeUndefined();
  });

  it('problemi minori: debolezze, minacce, ruoli, coverage', () => {
    const minor = coaching.problems.filter(p => p.severity === 'minor').map(p => p.text);
    expect(minor).toEqual([
      'Debole a Fire: 1 Debole – 0 Resistono',
      'Debole a Water: 1 Debole – 0 Resistono',
      'Debole a Ground: 1 Debole – 0 Resistono',
      'Debole a Ghost: 1 Debole – 0 Resistono',
      // Le voci essenziali mancanti, poi in una riga a parte le importanti (hazard e pivot ora sono importanti)
      'Ruoli mancanti: Muro Speciale',
      'Ruoli importanti mancanti: Hazard, Pivot, Hazer/Phazer, Rimozione Strumenti',
      'Nessuna mossa super efficace contro Water, Fighting',
    ]);
    const fire = coaching.problems.find(p => p.text.startsWith('Debole a Fire'))!;
    expect([...fire.fixes].sort()).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('debolezza seria: 3 membri deboli a Ice', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const ice = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.find(p => p.text.startsWith('Debole a Ice'));
    expect(ice).toMatchObject({ severity: 'serious', text: 'Debole a Ice: 3 Deboli – 0 Resistono' });
  });

  it('sostituzioni: il membro peggiore per primo, guadagno ≥ 10, massimo 2', () => {
    const team = [tusk, gholdengo, junk('Magikarp')];
    const swaps = coachTeam(team, DEFAULT_FORMAT, fixtureData).swaps;
    expect(swaps[0]).toMatchObject({ index: 2, member: 'Magikarp' });
    for (const s of swaps) expect(s.score - s.fit).toBeGreaterThanOrEqual(10);
    const junkTeam = ['Magikarp', 'Caterpie', 'Weedle', 'Metapod', 'Kakuna', 'Sunkern'].map(junk);
    expect(coachTeam(junkTeam, DEFAULT_FORMAT, fixtureData).swaps).toHaveLength(2);
  });

  it('i preferiti non ricevono mai suggerimenti di sostituzione', () => {
    const team = [tusk, gholdengo, { ...junk('Magikarp'), favorite: true }];
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).swaps.some(s => s.member === 'Magikarp')).toBe(false);
    const allFavorite = [tusk, gholdengo, junk('Magikarp')].map(s => ({ ...s, favorite: true }));
    expect(coachTeam(allFavorite, DEFAULT_FORMAT, fixtureData).swaps).toEqual([]);
  });

  it('testo della sostituzione', () => {
    const swap = { index: 2, member: 'Magikarp', fit: 20, replacement: 'Corviknight', set: emptySet('Corviknight'), score: 60, similar: false, ratingGain: 6, level: 'recommended' as const, diff: { gains: { roles: ['pivot' as const], covers: [], resists: [] }, losses: { roles: [], covers: [], resists: [] }, lostResists: [] } };
    expect(describeSwap(swap)).toEqual({ gain: 6, pros: ['Pivot'], cons: [] });
    expect(describeSwap({ ...swap, similar: true, diff: { gains: { roles: [], covers: [], resists: [] }, losses: { roles: [], covers: [], resists: [] }, lostResists: [] } }))
      .toEqual({ gain: 6, pros: [], cons: [] });
  });

  it('un membro non legale nel formato è un problema serio (Regole)', () => {
    const team = [tusk, gholdengo, { ...emptySet('Mewtwo'), item: 'Mewtwonite Y' }];
    const problems = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems;
    expect(problems).toContainEqual({ severity: 'serious', category: 'rules', text: 'Mewtwo-Mega-Y non è legale in National Dex OU', fixes: [] });
    expect(problems.filter(p => p.category === 'rules')).toHaveLength(1);
  });

  it('seconda Mega: problema serio, assente se ammessa', () => {
    const megas: TeamSet[] = [
      { ...emptySet('Lopunny'), item: 'Lopunnite' },
      { ...emptySet('Charizard-Mega-Y') },
    ];
    const text = 'Più Mega nel team (Lopunny-Mega, Charizard-Mega-Y): in National Dex ne è ammessa una sola';
    const strict = coachTeam(megas, DEFAULT_FORMAT, megaData).problems;
    expect(strict).toContainEqual({ severity: 'serious', category: 'rules', text, fixes: [] });
    const relaxed = coachTeam(megas, { ...DEFAULT_FORMAT, allowMultipleMegas: true }, megaData).problems;
    expect(relaxed.map(p => p.text)).not.toContain(text);
  });

  it('con una Mega in team i rimedi non propongono altre Mega', () => {
    const team: TeamSet[] = [{ ...emptySet('Lopunny'), item: 'Lopunnite' }, mostCommonSet(megaData.stats, 'Great Tusk')!];
    const fixes = coachTeam(team, DEFAULT_FORMAT, megaData).problems.flatMap(p => p.fixes);
    expect(fixes).not.toContain('Charizard-Mega-Y');
  });

  it('0–1 membri: solo invito ad aggiungere', () => {
    expect(coachTeam([tusk], DEFAULT_FORMAT, fixtureData)).toEqual({
      verdict: 'Aggiungi almeno 2 Pokémon per ricevere il coaching', teamType: null, strengths: [], problems: [], swaps: [], threatFixes: {},
    });
  });

  it('senza statistiche: niente minacce, rimedi né sostituzioni', () => {
    const noData = coachTeam([tusk, gholdengo, emptySet('Fakemon-Xyz')], DEFAULT_FORMAT, { stats: null, sets: null });
    expect(noData.swaps).toEqual([]);
    expect(noData.problems.every(p => p.fixes.length === 0)).toBe(true);
    expect(noData.problems.some(p => p.text.includes('check'))).toBe(false);
    expect(noData.strengths.some(s => s.startsWith('Ferma'))).toBe(false);
  });
});

describe('pro e contro pesati', () => {
  const diff = {
    gains: { roles: ['pivot' as const], covers: [], resists: ['Fairy' as const] },
    losses: { roles: ['hazards' as const], covers: ['Steel' as const], resists: [] },
    lostResists: [],
  };
  it("il bonus principale è quello dell'area che sale di più", () => {
    const { pros } = rankedChanges(diff, { roles: 1, defense: 5 }, 'it');
    expect(pros[0].text).toMatch(/Folletto|Fairy/);
    expect(pros[0].points).toBe(5);
    expect(pros[1].points).toBe(1);
  });
  it("il malus principale è quello dell'area che scende di più", () => {
    const { cons } = rankedChanges(diff, { roles: -1, strength: -4 }, 'it');
    expect(cons[0].points).toBe(-4);
    expect(cons[1].points).toBe(-1);
  });
  it('un pro in un\'area che scende vale 0', () => {
    const { pros } = rankedChanges(diff, { roles: -2, defense: 3 }, 'it');
    expect(pros.find(p => !/Folletto|Fairy/.test(p.text))?.points).toBe(0);
  });
  it('topReason prende il peso più alto', () => {
    expect(topReason([{ component: 'defense', weight: 1, text: 'a' }, { component: 'offense', weight: 3, text: 'b' }] as never)?.text).toBe('b');
    expect(topReason([])).toBeUndefined();
  });
});
