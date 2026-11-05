import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, COVERED_LEVEL, describeDiff, MIN_COVERAGE_WEIGHT, rankedChanges, verdictFor } from '../../src/engine/coach';
import { teamOffense } from '../../src/engine/offense';
import { superEffectiveMoves, type TypeName } from '../../src/engine/types';
import { topReason } from '../../src/engine/explain';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import { emptySet, importShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rateTeam } from '../../src/engine/rating';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';
import { adviceOf } from '../helpers/coach';

const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });

describe('coachTeam', () => {
  const coaching = coachTeam([tusk, gholdengo], DEFAULT_FORMAT, fixtureData);

  it('verdetto con conteggi', () => {
    expect(coaching.verdict).toBe('Team incompleto');
    // Gravi solo i tipi che nessuno manda KO in due colpi e che pesano: Great Tusk e Gholdengo arrivano al 50% su tutti
    expect(coaching.problems.filter(p => p.severity === 'serious').map(p => p.key)).toEqual([]);
    // Pivot e Rimozione Strumenti sono voci minori: nessun problema "Ruoli importanti mancanti"
    expect(coaching.problems.filter(p => p.category !== 'meta')).toHaveLength(11);
  });

  it('punti di forza', () => {
    expect(coaching.strengths).toEqual([
      'Gestisce bene Poison, Bug, Rock',
      // Solo le voci essenziali dell'archetipo (balance: i gruppi degli attaccanti, i muri, Recupero e Hazard); la rimozione è importante
      'Ruoli coperti: Sweeper, Wallbreaker, Attaccante fisico, Muro Fisico, Recupero',
      'Colpisce super efficace 15/18 tipi',
    ]);
  });

  it('i check contro i Pokémon più usati non sono tra i problemi, ma hanno i loro rimedi', () => {
    expect(coaching.problems.filter(p => p.category !== 'meta').some(p => p.text.includes('check') || p.text.includes('Minacce'))).toBe(false);
    expect(coaching.threatFixes.Dragapult).toContain('Kingambit');
    expect(coaching.threatFixes.Corviknight).toContain('Rotom-Wash');
    expect(coaching.threatFixes.Kingambit).toBeUndefined();
  });

  it('problemi minori: debolezze, ruoli, coverage', () => {
    const minor = coaching.problems.filter(p => p.severity === 'minor' && p.category !== 'meta').map(p => p.text);
    expect(minor).toEqual([
      'Debole a Fire: 1 Debole, 0 Resistono',
      'Debole a Water: 1 Debole, 0 Resistono',
      'Debole a Ground: 1 Debole, 0 Resistono',
      'Debole a Ghost: 1 Debole, 0 Resistono',
      // Le voci essenziali mancanti (nel Balance gli Hazard sono essenziali); Pivot e Rimozione Strumenti sono minori,
      // quindi non c'è la riga delle importanti
      'Ruoli mancanti: Muro Speciale, Hazard',
      // Il pacchetto dei tipi dell'Offesa: un problema per tipo sotto 50, nell'ordine dei tipi (due membri arrivano al massimo a 80)
      // Great Tusk con la Booster Energy (Attacco ×1,3) copre Flying e Psychic
      ...['Water', 'Grass', 'Fighting', 'Ground', 'Bug', 'Dragon'].map(type => `Coperto poco ${type}: nessuno lo manda KO in un colpo e pochi lo colpiscono forte`),
    ]);
    const fire = coaching.problems.find(p => p.text.startsWith('Debole a Fire'))!;
    expect([...fire.fixes].sort()).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('debolezza seria: 3 membri deboli a Ice', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const ice = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.find(p => p.text.startsWith('Debole a Ice'));
    expect(ice).toMatchObject({ severity: 'serious', text: 'Debole a Ice: 3 Deboli, 0 Resistono' });
  });

  it('i preferiti non ricevono mai suggerimenti di sostituzione', () => {
    const team = [tusk, gholdengo, { ...junk('Magikarp'), favorite: true }];
    expect(adviceOf([tusk, gholdengo, junk('Magikarp')], DEFAULT_FORMAT, fixtureData).fixes.some(f => f.index === 2)).toBe(true);
    expect(adviceOf(team, DEFAULT_FORMAT, fixtureData).fixes.some(f => f.index === 2)).toBe(false);
    const allFavorite = [tusk, gholdengo, junk('Magikarp')].map(s => ({ ...s, favorite: true }));
    expect(adviceOf(allFavorite, DEFAULT_FORMAT, fixtureData).fixes.filter(f => f.kind === 'swap')).toEqual([]);
  });

  it('testo di un cambio', () => {
    const diff = { gains: { roles: ['pivot' as const], covers: [], resists: [] }, losses: { roles: [], covers: [], resists: [] }, lostResists: [] };
    expect(describeDiff(diff)).toEqual({ pros: ['Pivot'], cons: [] });
    expect(describeDiff({ ...diff, gains: { roles: [], covers: [], resists: [] } })).toEqual({ pros: [], cons: [] });
  });

  it('un membro non legale nel formato è un problema serio (Regole)', () => {
    const team = [tusk, gholdengo, { ...emptySet('Mewtwo'), item: 'Mewtwonite Y' }];
    const problems = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems;
    expect(problems).toContainEqual({ severity: 'serious', category: 'rules', text: 'Mewtwo-Mega-Y non è legale in National Dex OU', fixes: [], key: 'rules:Mewtwo-Mega-Y non è legale in National Dex OU', subjects: ['Mewtwo-Mega-Y'] });
    expect(problems.filter(p => p.category === 'rules')).toHaveLength(1);
  });

  it('seconda Mega: problema serio, assente se ammessa', () => {
    const megas: TeamSet[] = [
      { ...emptySet('Lopunny'), item: 'Lopunnite' },
      { ...emptySet('Charizard-Mega-Y') },
    ];
    const text = 'Più Mega nel team (Lopunny-Mega, Charizard-Mega-Y): in National Dex ne è ammessa una sola';
    const strict = coachTeam(megas, DEFAULT_FORMAT, megaData).problems;
    expect(strict).toContainEqual({ severity: 'serious', category: 'rules', text, fixes: [], key: 'rules:megas' });
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
      verdict: 'Aggiungi almeno 2 Pokémon per ricevere il coaching', teamType: null, strengths: [], problems: [], threatFixes: {},
    });
  });

  it('senza statistiche: niente minacce, rimedi né sostituzioni', () => {
    const noData = coachTeam([tusk, gholdengo, emptySet('Fakemon-Xyz')], DEFAULT_FORMAT, { stats: null, sets: null });
    const advice = adviceOf([tusk, gholdengo, emptySet('Fakemon-Xyz')], DEFAULT_FORMAT, { stats: null, sets: null });
    expect(advice.fixes).toEqual([]);
    expect(advice.steps).toEqual([]);
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
    expect(pros[0].area).toBe('defense');
    expect(pros[1].area).toBe('roles');
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

describe('chiavi dei problemi e minacce del meta', () => {
  const team = [tusk, gholdengo];

  it('ogni problema ha una chiave stabile', () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    expect(problems.find(p => p.category === 'defense')!.key).toMatch(/^defense:[A-Z][a-z]+$/);
    const keys = problems.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    const weak = coachTeam([emptySet('Snorlax'), emptySet('Tyranitar')], DEFAULT_FORMAT, fixtureData).problems;
    expect(weak.map(p => p.key)).toContain('defense:Fighting');
  });

  it('le debolezze portano i conteggi (deboli, resistono) della riga di analisi; gli altri problemi no', () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const rows = analyzeTeam(team, fixtureData).weakness;
    const defense = problems.filter(p => p.category === 'defense');
    expect(defense.length).toBeGreaterThan(0);
    for (const p of defense) {
      const row = rows.find(r => `defense:${r.type}` === p.key)!;
      expect(p.counts).toEqual({ weak: row.weak, resist: row.resist });
    }
    expect(problems.filter(p => p.category !== 'defense').every(p => p.counts === undefined)).toBe(true);
  });

  it('col meta, una minaccia senza check è un problema minore', () => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const open = analyzeTeam(team, fixtureData).threats.filter(t => !t.handledBy.length);
    expect(open.length).toBeGreaterThan(0);
    for (const threat of open) {
      const problem = coaching.problems.find(p => p.key === `meta:${threat.name}`)!;
      expect(problem).toMatchObject({ category: 'meta', severity: 'minor' });
      expect(problem.fixes).toEqual(coaching.threatFixes[threat.name]);
    }
  });

  it('senza meta, nessun problema minaccia', () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, { ...fixtureData, ignoreMeta: true });
    expect(problems.some(p => p.category === 'meta')).toBe(false);
  });

  it("coverage: un problema per tipo del pacchetto dei tipi dell'Offesa (livello sotto 50)", () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };
    const coverage = teamOffense(team, data).types;
    expect(COVERED_LEVEL).toBe(50);
    const weights = analyzeTeam(team, data).typeWeights as Record<string, number>;
    const open = coverage.rows.filter(r => r.level < COVERED_LEVEL);
    const found = problems.filter(p => p.category === 'coverage');
    expect(open.length).toBeGreaterThan(1);
    expect(found.map(p => p.key).sort()).toEqual(open.map(r => `coverage:${r.label}`).sort());
    for (const row of open) {
      const p = found.find(x => x.key === `coverage:${row.label}`)!;
      expect(p.subjects).toEqual([row.label]);
      if (coverage.holes.includes(row.label)) {
        expect(p).toMatchObject({ size: 2, text: `Scoperto ${row.label}: nessuno lo manda KO in due colpi`, severity: weights[row.label] >= MIN_COVERAGE_WEIGHT ? 'serious' : 'minor' });
      } else {
        expect(p).toMatchObject({ size: 1, severity: 'minor', text: `Coperto poco ${row.label}: nessuno lo manda KO in un colpo e pochi lo colpiscono forte` });
      }
    }
    // In inglese
    const en = coachTeam(team, DEFAULT_FORMAT, fixtureData, 'en').problems.filter(p => p.category === 'coverage').map(p => p.text);
    expect(en.some(text => /^(Uncovered \w+: nobody 2HKOs it|Weakly covered \w+: nobody OHKOs it and few hit it hard)$/.test(text))).toBe(true);
  });

  it('coverage: i rimedi sono candidati con una mossa super efficace contro il tipo (anche per i coperti a metà)', () => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const found = coaching.problems.filter(p => p.category === 'coverage');
    const half = found.filter(p => p.size === 1);
    expect(half.length).toBeGreaterThan(0);
    expect(half.some(p => p.fixes.length > 0)).toBe(true);
    // Solo le specie con statistiche: senza, il set è vuoto e non c'è nulla da verificare
    const withStats = found.flatMap(p => p.fixes.filter(species => mostCommonSet(fixtureStats, species)).map(species => ({ p, species })));
    expect(withStats.length).toBeGreaterThan(0);
    for (const { p, species } of withStats) {
      expect(superEffectiveMoves(mostCommonSet(fixtureStats, species)!, p.subjects![0] as TypeName).length).toBeGreaterThan(0);
    }
  });

  it('il giudizio non cambia per le minacce', () => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const grade = rateTeam(team, fixtureData, 'it')?.grade ?? 'D';
    expect(coaching.verdict).toBe(verdictFor(team, coaching.problems.filter(p => p.category !== 'meta'), grade, 'it'));
  });
});

describe('copertura sul team di prova del pacchetto (National Dex OU)', () => {
  it('ci sono problemi di copertura, ma non su Lotta e Drago (Gardevoir-Mega li manda KO)', () => {
    const team = importShowdown(readFileSync(join('tests', 'fixtures', 'offensePackTeam.txt'), 'utf8')).sets;
    expect(team).toHaveLength(6);
    const keys = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.filter(p => p.category === 'coverage').map(p => p.key);
    expect(keys).not.toContain('coverage:Fighting');
    expect(keys).not.toContain('coverage:Dragon');
  });
});

describe('scoperto sotto il 50%', () => {
  it('un tipo colpito solo fra il 33% e il 50% è scoperto, non coperto poco', () => {
    // Toxapex con Surf fa il 33,5% al Terra medio: conta per il pacchetto, ma nessuno lo manda KO in due colpi
    const pex = { ...emptySet('Toxapex'), ability: 'Regenerator', moves: ['Surf'], nature: 'Bold', evs: { hp: 252, def: 252 } };
    const wall = { ...emptySet('Blissey'), moves: ['Soft-Boiled', 'Toxic'] };
    const texts = coachTeam([pex, wall], DEFAULT_FORMAT, fixtureData).problems.filter(p => p.category === 'coverage').map(p => p.text);
    expect(texts).toContain('Scoperto Ground: nessuno lo manda KO in due colpi');
  });
});
