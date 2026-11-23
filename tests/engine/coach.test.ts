import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeTeam } from '../../src/engine/analysis';
import { coachTeam, voteDiff, COVERED_LEVEL, HELD_LEVEL, describeDiff, MIN_COVERAGE_WEIGHT, rankedChanges, verdictFor } from '../../src/engine/coach';
import { teamOffense } from '../../src/engine/offense';
import { superEffectiveMoves, type TypeName } from '../../src/engine/types';
import { topReason } from '../../src/engine/explain';
import { DEFAULT_FORMAT } from '../../src/engine/format';
import type { TeamGain } from '../../src/engine/teamGain';
import { emptySet, importShowdown, mostCommonSet, type TeamSet } from '../../src/engine/sets';
import { rateTeam, ratingThreats } from '../../src/engine/rating';
import { fixtureData, fixtureStats, gholdengo, tusk } from '../fixtures/data';
import { megaData } from '../fixtures/megaData';
import { adviceOf } from '../helpers/coach';

const junk = (species: string): TeamSet => ({ ...emptySet(species), moves: ['Splash'] });

describe('coachTeam', () => {
  const coaching = coachTeam([tusk, gholdengo], DEFAULT_FORMAT, fixtureData);

  it('verdetto con conteggi', () => {
    expect(coaching.verdict).toBe('Team incompleto');
    // Gravi solo i tipi che nessuno regge sul lato peggiore (weak della Coverage tipi della Difesa)
    const { weak } = rateTeam([tusk, gholdengo], fixtureData, 'it')!.defense.coverageTypes;
    expect(weak).toEqual(['Fire', 'Water', 'Ground', 'Ghost']);
    expect(coaching.problems.filter(p => p.severity === 'serious').map(p => p.key)).toEqual(weak.map(type => `defense:${type}`));
    // 4 gravi e 6 minori in difesa, una riga di ruoli, 2 tipi coperti poco (sotto 60); Pivot e Rimozione Strumenti sono voci minori:
    // nessun problema "Ruoli importanti mancanti"
    expect(coaching.problems.filter(p => p.category !== 'meta')).toHaveLength(13);
  });

  it('punti di forza', () => {
    // Nessun tipo retto da due membri; 16 tipi coperti in attacco dal livello 60
    expect(coaching.strengths).toEqual([
      // Solo le voci essenziali dell'archetipo (balance: Sweeper o Wallbreaker, i muri, Recupero e Hazard); fisico, speciale e rimozione sono importanti
      'Ruoli coperti: Sweeper o Wallbreaker, Muro Fisico, Recupero',
      'Copre 16/18 tipi in attacco',
    ]);
  });

  it('punti di forza: "regge bene" i tipi retti da almeno due membri nella Coverage tipi della Difesa', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const rows = rateTeam(team, fixtureData, 'it')!.defense.coverageTypes.rows;
    const solid = rows.filter(r => r.heldBy.length >= 2).map(r => r.type);
    expect(solid).toEqual(['Electric', 'Rock']);
    expect(coachTeam(team, DEFAULT_FORMAT, fixtureData).strengths[0]).toBe('Regge bene Electric, Rock');
  });

  it("punti di forza: \"copre n/18\" conta i tipi del pacchetto dell'Offesa dal livello 60, da 15 in su", () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    for (const members of [[tusk, gholdengo], team]) {
      const covered = rateTeam(members, fixtureData, 'it')!.offense.types.rows.filter(r => r.level >= COVERED_LEVEL).length;
      const line = coachTeam(members, DEFAULT_FORMAT, fixtureData).strengths.find(x => x.startsWith('Copre '));
      expect(line).toBe(covered >= 15 ? `Copre ${covered}/18 tipi in attacco` : undefined);
    }
  });

  it('i check contro i Pokémon più usati non sono tra i problemi, ma hanno i loro rimedi', () => {
    expect(coaching.problems.filter(p => p.category !== 'meta').some(p => p.text.includes('check') || p.text.includes('Minacce'))).toBe(false);
    // I rimedi solo per le minacce che nessuno regge del tutto nella Coverage meta della Difesa
    const open = ratingThreats(rateTeam([tusk, gholdengo], fixtureData, 'it'), fixtureData).filter(t => !t.handledBy.length).map(t => t.name);
    expect(open).toEqual(['Great Tusk', 'Gholdengo']);
    expect(Object.keys(coaching.threatFixes)).toEqual(open);
    // Kingambit e Dragapult li regge Great Tusk: niente rimedi
    expect(coaching.threatFixes.Kingambit).toBeUndefined();
    expect(coaching.threatFixes.Dragapult).toBeUndefined();
  });

  it('problemi minori: debolezze, ruoli, coverage', () => {
    const minor = coaching.problems.filter(p => p.severity === 'minor' && p.category !== 'meta').map(p => p.text);
    expect(minor).toEqual([
      // In difesa: i tipi sotto il livello 50 della Coverage tipi che qualcuno regge almeno in parte
      ...['Ice', 'Psychic', 'Dragon', 'Dark', 'Steel', 'Fairy'].map(type => `Coperto poco in difesa contro ${type}: pochi reggono bene i suoi colpi`),
      // Le voci essenziali mancanti (nel Balance gli Hazard sono essenziali); Pivot e Rimozione Strumenti sono minori,
      // quindi non c'è la riga delle importanti
      'Ruoli mancanti: Muro Speciale, Hazard',
      // Il pacchetto dei tipi dell'Offesa: un problema per tipo sotto 60, nell'ordine dei tipi (due membri arrivano al massimo a 90)
      ...['Bug', 'Dragon'].map(type => `Coperto poco in attacco contro ${type}: nessuno lo manda KO in un colpo e pochi lo colpiscono forte`),
    ]);
    const rows = rateTeam([tusk, gholdengo], fixtureData, 'it')!.defense.coverageTypes.rows;
    const minorTypes = coaching.problems.filter(p => p.category === 'defense' && p.severity === 'minor').map(p => p.subjects![0]);
    expect(minorTypes.every(type => rows.find(r => r.type === type)!.level < HELD_LEVEL)).toBe(true);
    const fire = coaching.problems.find(p => p.key === 'defense:Fire')!;
    expect(fire).toMatchObject({ severity: 'serious', text: 'Scoperto in difesa contro Fire: nessuno regge bene i suoi colpi' });
    expect([...fire.fixes].sort()).toEqual(['Rotom-Wash', 'Toxapex']);
  });

  it('difesa grave: 3 membri deboli a Ice, nessuno lo regge', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    expect(rateTeam(team, fixtureData, 'it')!.defense.coverageTypes.weak).toContain('Ice');
    const ice = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.find(p => p.key === 'defense:Ice');
    expect(ice).toMatchObject({ severity: 'serious', text: 'Scoperto in difesa contro Ice: nessuno regge bene i suoi colpi', counts: { held: 0 } });
  });

  it('difesa: un tipo retto dal livello 50 in su non è un problema', () => {
    const team = ['Great Tusk', 'Garchomp', 'Dragapult'].map(n => mostCommonSet(fixtureStats, n)!);
    const rows = rateTeam(team, fixtureData, 'it')!.defense.coverageTypes.rows;
    const keys = coachTeam(team, DEFAULT_FORMAT, fixtureData).problems.filter(p => p.category === 'defense').map(p => p.key);
    for (const row of rows.filter(r => r.level >= HELD_LEVEL)) expect(keys).not.toContain(`defense:${row.type}`);
    expect(keys).not.toContain('defense:Electric');
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
    expect(problems).toContainEqual({ severity: 'serious', category: 'rules', text: 'Mewtwo-Mega-Y non è legale in National Dex OU: tier troppo alto', fixes: [], key: 'rules:Mewtwo-Mega-Y non è legale in National Dex OU: tier troppo alto', subjects: ['Mewtwo-Mega-Y'] });
    expect(problems.filter(p => p.category === 'rules')).toHaveLength(1);
  });

  it('seconda Mega: problema serio, assente se ammessa', () => {
    const megas: TeamSet[] = [
      { ...emptySet('Lopunny'), item: 'Lopunnite' },
      { ...emptySet('Charizard-Mega-Y') },
    ];
    const text = 'Più Mega nel team (Lopunny-Mega, Charizard-Mega-Y): se ne può usare una sola';
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
    const { pros } = rankedChanges(diff, { areaPoints: { roles: 1, defense: 5 } } as TeamGain, 'it');
    expect(pros[0].text).toMatch(/Folletto|Fairy/);
    expect(pros[0].points).toBe(5);
    expect(pros[0].area).toBe('defense');
    expect(pros[1].area).toBe('roles');
    expect(pros[1].points).toBe(1);
  });
  it("il malus principale è quello dell'area che scende di più", () => {
    const { cons } = rankedChanges(diff, { areaPoints: { roles: -1, strength: -4 } } as TeamGain, 'it');
    expect(cons[0].points).toBe(-4);
    expect(cons[1].points).toBe(-1);
  });
  it('un pro in un\'area che scende vale 0', () => {
    const { pros } = rankedChanges(diff, { areaPoints: { roles: -2, defense: 3 } } as TeamGain, 'it');
    expect(pros.find(p => !/Folletto|Fairy/.test(p.text))?.points).toBe(0);
  });
  it("le voci di tipo restano solo se il voto è d'accordo", () => {
    const typeDiff = {
      gains: { roles: [], covers: ['Normal' as const, 'Ice' as const], resists: ['Fire' as const, 'Water' as const] },
      losses: { roles: [], covers: [], resists: [] },
      lostResists: ['Ground' as const, 'Rock' as const],
    };
    const shift = { offense: { Normal: -16, Ice: 8 }, defense: { Fire: 2, Water: 6 }, defenseAfter: { Ground: 75, Rock: 30 }, weakAfter: [] };
    const kept = voteDiff(typeDiff, shift);
    expect(kept.gains.covers).toEqual(['Ice']);
    expect(kept.gains.resists).toEqual(['Water']);
    expect(kept.lostResists).toEqual(['Rock']);
    // Senza voto restano tutte
    expect(voteDiff(typeDiff, undefined)).toBe(typeDiff);
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

  it('i problemi di difesa portano quanti reggono il tipo (Coverage tipi della Difesa); gli altri problemi no', () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const rows = rateTeam(team, fixtureData, 'it')!.defense.coverageTypes.rows;
    const defense = problems.filter(p => p.category === 'defense');
    expect(defense.length).toBeGreaterThan(0);
    for (const p of defense) {
      const row = rows.find(r => `defense:${r.type}` === p.key)!;
      expect(p.counts).toEqual({ held: row.heldBy.length });
    }
    expect(problems.filter(p => p.category !== 'defense').every(p => p.counts === undefined)).toBe(true);
  });

  it('col meta, una minaccia che nessuno regge (Coverage meta della Difesa) è un problema minore', () => {
    const coaching = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const threats = ratingThreats(rateTeam(team, fixtureData, 'it'), fixtureData);
    const open = threats.filter(t => !t.handledBy.length);
    expect(open.length).toBeGreaterThan(0);
    // Chi qualcuno regge del tutto non è un problema
    for (const threat of threats.filter(t => t.handledBy.length)) expect(coaching.problems.some(p => p.key === `meta:${threat.name}`)).toBe(false);
    for (const threat of open) {
      const problem = coaching.problems.find(p => p.key === `meta:${threat.name}`)!;
      expect(problem).toMatchObject({ category: 'meta', severity: 'minor' });
      expect(problem.fixes).toEqual(coaching.threatFixes[threat.name]);
    }
  });

  it("col meta, un Pokémon del meta che nessuno manda KO in due colpi (Coverage meta dell'Offesa) è un problema minore", () => {
    // Solo Splash: nessuno manda KO nessuno
    const weak = [junk('Magikarp'), junk('Sunkern')];
    const coaching = coachTeam(weak, DEFAULT_FORMAT, fixtureData);
    // I buchi sono combinazioni di tipi: il problema nomina il Pokémon che le rappresenta (come la Coverage meta dell'Offesa)
    const meta = rateTeam(weak, fixtureData, 'it')?.offense.coverageMeta;
    const holes = (meta?.holes ?? []).map(label => meta!.rows.find(r => r.label === label)!.species);
    expect(holes.length).toBeGreaterThan(0);
    expect(coaching.problems.filter(p => p.category === 'metaHit').map(p => p.key)).toEqual(holes.map(s => `metaHit:${s}`));
    for (const species of holes) {
      expect(coaching.problems.find(p => p.key === `metaHit:${species}`)).toMatchObject({ severity: 'minor', subjects: [species], text: `Senza check in attacco contro ${species}: nessuno lo manda KO in due colpi` });
    }
  });

  it('senza meta, nessun problema minaccia', () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, { ...fixtureData, ignoreMeta: true });
    expect(problems.some(p => p.category === 'meta' || p.category === 'metaHit')).toBe(false);
  });

  it("coverage: un problema per tipo del pacchetto dei tipi dell'Offesa (livello sotto 60)", () => {
    const { problems } = coachTeam(team, DEFAULT_FORMAT, fixtureData);
    const data = { ...fixtureData, formatId: DEFAULT_FORMAT.formatId };
    const coverage = teamOffense(team, data).types;
    expect(COVERED_LEVEL).toBe(60);
    const weights = analyzeTeam(team, data).typeWeights as Record<string, number>;
    const open = coverage.rows.filter(r => r.level < COVERED_LEVEL);
    const found = problems.filter(p => p.category === 'coverage');
    expect(open.length).toBeGreaterThan(1);
    expect(found.map(p => p.key).sort()).toEqual(open.map(r => `coverage:${r.label}`).sort());
    for (const row of open) {
      const p = found.find(x => x.key === `coverage:${row.label}`)!;
      expect(p.subjects).toEqual([row.label]);
      if (coverage.holes.includes(row.label)) {
        expect(p).toMatchObject({ size: 2, text: `Scoperto in attacco contro ${row.label}: nessuno lo manda KO in due colpi`, severity: weights[row.label] >= MIN_COVERAGE_WEIGHT ? 'serious' : 'minor' });
      } else {
        expect(p).toMatchObject({ size: 1, severity: 'minor', text: `Coperto poco in attacco contro ${row.label}: nessuno lo manda KO in un colpo e pochi lo colpiscono forte` });
      }
    }
    // In inglese
    const en = coachTeam(team, DEFAULT_FORMAT, fixtureData, 'en').problems.filter(p => p.category === 'coverage').map(p => p.text);
    expect(en.some(text => /^(Uncovered on offense vs \w+: nobody 2HKOs it|Weakly covered on offense vs \w+: nobody OHKOs it and few hit it hard)$/.test(text))).toBe(true);
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
    expect(texts).toContain('Scoperto in attacco contro Ground: nessuno lo manda KO in due colpi');
  });
});
