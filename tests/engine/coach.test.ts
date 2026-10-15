import { describe, expect, it } from 'vitest';
import { coachTeam, describeSwap } from '../../src/engine/coach';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';

const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });

describe('coachTeam', () => {
  const coaching = coachTeam([tusk, gholdengo], DEFAULT_FORMAT, fixtureData);

  it('verdetto con conteggi', () => {
    expect(coaching.verdict).toBe('Team incompleto: mancano 4 membri · 0 problemi seri, 6 minori');
  });

  it('punti di forza', () => {
    expect(coaching.strengths).toEqual([
      'Gestisce bene Poison, Bug, Rock',
      'Ruoli coperti: Rimozione hazard',
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
      'Debole a Fire: 1 debole contro 0 che resistono',
      'Debole a Water: 1 debole contro 0 che resistono',
      'Debole a Ground: 1 debole contro 0 che resistono',
      'Debole a Ghost: 1 debole contro 0 che resistono',
      'Ruoli mancanti: Hazard, Pivot, Priorità, Controllo velocità',
      'Nessuna mossa super efficace contro Water, Fighting',
    ]);
    const fire = coaching.problems.find(p => p.text.startsWith('Debole a Fire'))!;
    expect([...fire.fixes].sort()).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('debolezza seria: 3 membri deboli a Ice', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const ice = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.find(p => p.text.startsWith('Debole a Ice'));
    expect(ice).toMatchObject({ severity: 'serious', text: 'Debole a Ice: 3 membri su 3 subiscono danni super efficaci e nessuno resiste' });
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
    const swap = { index: 2, member: 'Magikarp', fit: 20, replacement: 'Corviknight', score: 60, similar: false, level: 'recommended' as const, diff: { gains: ['+ Pivot'], losses: [] } };
    expect(describeSwap(swap)).toBe('Valuta di sostituire Magikarp · Corviknight si adatta meglio (+40): porta Pivot');
    expect(describeSwap({ ...swap, similar: true, diff: { gains: [], losses: [] } }))
      .toBe('Corviknight fa un lavoro simile a Magikarp ma si adatta meglio (+40)');
  });

  it('seconda Mega: problema serio, assente se ammessa', () => {
    const megas: TeamSet[] = [
      { ...emptySet('Lopunny'), item: 'Lopunnite' },
      { ...emptySet('Charizard-Mega-Y') },
    ];
    const text = 'Più Mega nel team (Lopunny, Charizard-Mega-Y): in National Dex ne è ammessa una sola';
    const strict = coachTeam(megas, DEFAULT_FORMAT, megaData).problems;
    expect(strict).toContainEqual({ severity: 'serious', text, fixes: [] });
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
      verdict: 'Aggiungi almeno 2 Pokémon per ricevere il coaching', strengths: [], problems: [], swaps: [], threatFixes: {},
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
