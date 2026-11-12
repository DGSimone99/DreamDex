import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Archetype } from '../../src/engine/archetype';
import type { EngineData } from '../../src/engine/data';
import { battleAbility, battleName, isMega, toID } from '../../src/engine/dex';
import { bestCoherentPreset } from '../../src/engine/bestPreset';
import { coherenceGaps, contradictorySet } from '../../src/engine/coherence';
import { defaultChoice, FILL_FAVORITE_MARGIN, fillProposals, matchesChoice, MAX_ATTEMPTS, maxShared, MAX_MISSES, MIN_OVERALL, proposalOrder, PROPOSALS_PER_ROUND, REPEAT_PENALTY, type FillChoice, type Proposal } from '../../src/engine/fillProposals';
import { formatRules } from '../../src/engine/formatRules';
import { DEFAULT_FORMAT, type Format } from '../../src/engine/format';
import { rateTeam } from '../../src/engine/rating';
import { emptySet, type TeamSet } from '../../src/engine/sets';
import { effectiveLists, EMPTY_LISTS, isUserFavorite } from '../../src/engine/lists';
import { benefits, enables } from '../../src/engine/synergy';
import { fillData } from '../fixtures/fillData';

/** Le proposte di un giro (il generatore produce anche `null` come segnale di avanzamento). */
// Il meta di prova è piccolo: le regole si verificano senza voto minimo, tranne nel test che lo riguarda
const take = (team: TeamSet[], choice: FillChoice, shown: string[][] = [], format: Format = DEFAULT_FORMAT, data: EngineData = fillData, minOverall = 0) =>
  [...fillProposals(team, choice, shown, format, data, minOverall)].filter((p): p is Proposal => p !== null);
const any: FillChoice = { archetype: null, style: null };
/** Un Pokémon si distingue per forma in battaglia: Charizard e Charizard-Mega-Y sono due Pokémon diversi. */
const formes = (sets: TeamSet[]) => sets.map(s => toID(battleName(s)));
const set = (name: string, moves: string[], item = ''): TeamSet => ({ ...emptySet(name), moves, item });
const setterOf = (p: Proposal, condition: 'rain' | 'sun') => p.added.find(s => enables(s).some(e => e.condition === condition));

describe('proposte di Completa team', () => {
  it('team vuoto: proposte di 6, al massimo 5, nessun Pokémon in comune', () => {
    const list = take([], any);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.length).toBeLessThanOrEqual(PROPOSALS_PER_ROUND);
    for (const p of list) expect(p.team).toHaveLength(6);
    const added = list.flatMap(p => formes(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it('ogni tipo di team ha proposte, e ognuna è di quel tipo', () => {
    const archetypes: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
    for (const archetype of archetypes) {
      const choice = { archetype, style: null };
      const list = take([], choice);
      expect(list.length, archetype).toBeGreaterThanOrEqual(1);
      for (const p of list) {
        expect(p.archetype).toBe(archetype);
        expect(matchesChoice(p.team, choice, DEFAULT_FORMAT)).toBe(true);
      }
    }
  });

  it('pioggia, sole e Trick Room hanno proposte con quello stile', () => {
    for (const style of ['rain', 'sun', 'trickroom'] as const) {
      const list = take([], { archetype: null, style });
      expect(list.length, style).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.styles).toContain(style);
    }
  }, 30000);

  it('nessuna proposta sotto il voto minimo', () => {
    for (const choice of [any, { archetype: null, style: 'rain' as const }, { archetype: 'balance' as const, style: null }]) {
      for (const p of take([], choice, [], DEFAULT_FORMAT, fillData, MIN_OVERALL)) expect(p.overall, JSON.stringify(choice)).toBeGreaterThanOrEqual(MIN_OVERALL);
    }
  }, 60000);

  it('in "Altre proposte" i portatori già mostrati ruotano: non sempre lo stesso', () => {
    // Pioggia: Pelipper è l'unico del meta, gli altri arrivano dal Pokédex; finiti i nuovi, i già mostrati si alternano
    const shown: string[][] = [];
    take([], { archetype: null, style: 'sun' }, shown);
    const again = take([], { archetype: null, style: 'sun' }, shown);
    const setters = again.map(p => toID(battleName(setterOf(p, 'sun')!)));
    if (setters.length >= 2) expect(new Set(setters).size).toBeGreaterThan(1);
  }, 60000);

  it('chi porta lo stile si ripete solo se non ce n’è uno nuovo; gli altri nel primo giro mai, dopo con la regola della metà', () => {
    const first = take([], { archetype: null, style: 'sun' });
    expect(first.length).toBeGreaterThanOrEqual(2);
    // Due portatori del sole (Torkoal, Charizard-Mega-Y): le prime due proposte ne usano due diversi
    expect(toID(battleName(setterOf(first[0], 'sun')!))).not.toBe(toID(battleName(setterOf(first[1], 'sun')!)));
    // Pioggia: un solo portatore, che può tornare nel giro dopo; gli altri membri no
    const shown: string[][] = [];
    const rain = take([], { archetype: null, style: 'rain' }, shown);
    const more = take([], { archetype: null, style: 'rain' }, shown);
    expect(rain.length + more.length).toBeGreaterThanOrEqual(2);
    const others = (p: Proposal) => p.added.filter(s => s !== setterOf(p, 'rain')).map(s => toID(battleName(s)));
    const firstRound = rain.flatMap(others);
    expect(new Set(firstRound).size).toBe(firstRound.length);
    const all = [...rain, ...more];
    for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) {
      const before = new Set(others(all[j]));
      expect(others(all[i]).filter(id => before.has(id)).length).toBeLessThanOrEqual(maxShared(all[i].added.length));
    }
  });

  it('i membri attuali restano primi e intatti', () => {
    const team = [set('Garchomp', ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'], 'Rocky Helmet')];
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.team[0]).toBe(team[0]);
  });

  it('la storia cresce con le proposte: per ognuna, le forme dei nuovi', () => {
    const shown: string[][] = [];
    const list = take([], any, shown);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(shown).toEqual(list.map(p => formes(p.added)));
  });

  it('un solo slot: un Pokémon diverso per proposta', () => {
    // Great Tusk mette e toglie le trappole: l'ultimo posto è libero di scegliere fra tanti
    const team = [set('Great Tusk', ['Rapid Spin', 'Stealth Rock']), ...['Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect']))];
    const list = take(team, any);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const p of list) expect(p.added).toHaveLength(1);
    const added = list.flatMap(p => formes(p.added));
    expect(new Set(added).size).toBe(added.length);
  });

  it("con una Mega nel team non ne aggiunge un'altra, anche con allowMultipleMegas", () => {
    const team = [set('Gardevoir', ['Hyper Voice'], 'Gardevoirite')];
    for (const allowMultipleMegas of [false, true]) {
      const list = take(team, any, [], { ...DEFAULT_FORMAT, allowMultipleMegas });
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.added.some(isMega)).toBe(false);
    }
  });

  it('in National Dex la prima proposta ha esattamente una Mega', () => {
    const [first] = take([], any);
    expect(first.team.filter(isMega)).toHaveLength(1);
  });

  it('la Mega col set sulla specie base (Charizard @ Charizardite Y) si esclude per la sua forma', () => {
    const data: EngineData = { ...fillData, presets: { Charizard: [{ name: 'Mega Y', format: 'gen9nationaldex',
      set: { ...emptySet('Charizard'), item: 'Charizardite Y', ability: 'Blaze', moves: ['Flamethrower', 'Solar Beam'] } }] } };
    const shown: string[][] = [];
    // Senza stile: chi porta il sole non ha l'eccezione di poter tornare
    const list = take([], any, shown, DEFAULT_FORMAT, data);
    const zard = list.filter(p => p.added.some(s => toID(battleName(s)) === 'charizardmegay'));
    expect(zard.length).toBeLessThanOrEqual(1);
    if (zard.length) expect(shown.flat()).toContain('charizardmegay');
  });

  it('voto della proposta = rateTeam del team proposto', () => {
    for (const p of take([], any)) expect(p.overall).toBe(rateTeam(p.team, fillData, 'en')!.overall);
  });

  it('la neve trova proposte anche se nel meta nessuno la sfrutta (Pokémon e set da tutto il Pokédex)', () => {
    const list = take([], { archetype: null, style: 'snow' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.styles).toContain('snow');
  }, 30000);

  it('con un meteo, nessuno porta un altro meteo o dipende da un altro meteo', () => {
    // Pioggia: niente Chlorophyll né Drought (Venusaur, Torkoal); sole: niente Swift Swim né Drizzle (Barraskewda, Pelipper)
    const against = { rain: ['sun', 'sand', 'snow'], sun: ['rain', 'sand', 'snow'] } as const;
    for (const style of ['rain', 'sun'] as const) {
      const list = take([], { archetype: null, style });
      expect(list.length, style).toBeGreaterThanOrEqual(1);
      for (const p of list) for (const s of p.added) {
        expect(enables(s).some(e => (against[style] as readonly string[]).includes(e.condition)), `${style}: ${s.species}`).toBe(false);
        // Protosynthesis e Quark Drive funzionano con la Booster Energy: non dipendono dal meteo
        const dependent = benefits(s).some(b => (against[style] as readonly string[]).includes(b.condition) && toID(b.via) === toID(battleAbility(s))
          && !['protosynthesis', 'quarkdrive'].includes(toID(b.via)));
        expect(dependent, `${style}: ${s.species}`).toBe(false);
      }
    }
  }, 30000);

  it('con un meteo almeno 2 membri lo sfruttano, oltre a chi lo porta', () => {
    for (const style of ['rain', 'sun'] as const) {
      const [first] = take([], { archetype: null, style });
      const users = first.added.filter(s => !enables(s).some(e => e.condition === style) && benefits(s).some(b => b.condition === style && toID(b.via) !== 'weatherball'));
      expect(users.length, style).toBeGreaterThanOrEqual(2);
    }
  }, 30000);

  it('in Trick Room, dopo chi la porta, i membri sono lenti', () => {
    const list = take([], { archetype: null, style: 'trickroom' });
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      const others = p.added.filter(s => !enables(s).some(e => e.condition === 'trickroom'));
      for (const s of others) expect(benefits(s).some(b => b.condition === 'trickroom'), s.species).toBe(true);
    }
  }, 30000);

  it('senza proposte possibili produce solo segnali di avanzamento, poi si ferma', () => {
    // Stall con Trick Room e pioggia insieme non esiste: si chiede Stall + neve su un team già offensivo
    const team = ['Dragapult', 'Weavile', 'Cinderace', 'Iron Valiant', 'Gholdengo'].map(name => set(name, ['Protect']));
    const steps = [...fillProposals(team, { archetype: 'stall', style: 'snow' }, [], DEFAULT_FORMAT, fillData)];
    expect(steps.every(step => step === null)).toBe(true);
    expect(steps.length).toBeLessThanOrEqual(MAX_MISSES);
  });

  it('un giro difficile insiste oltre i vecchi 8 tentativi, ma mai più di MAX_MISSES di fila né MAX_ATTEMPTS in tutto', () => {
    // Garchomp + Hyper Offense nel meta di prova: la prima proposta arriva solo dopo più di 8 tentativi a vuoto (prima
    // il giro si arrendeva a 8 senza proposte)
    const steps = [...fillProposals([set('Garchomp', ['Protect'])], { archetype: 'hyperOffense', style: null }, [], DEFAULT_FORMAT, fillData, 0)];
    const firstFound = steps.findIndex(step => step !== null);
    expect(firstFound).toBeGreaterThan(8);
    expect(steps.filter(step => step === null).length).toBeLessThanOrEqual(MAX_ATTEMPTS);
    let run = 0;
    for (const step of steps) {
      run = step === null ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(MAX_MISSES);
    }
  }, 30000);

  it("come finisce il giro: fermato dai tentativi non vuol dire finiti, e il giro dopo ne trova altre", () => {
    /** Consuma il giro e dà le proposte e come è finito. */
    const round = (team: TeamSet[], choice: FillChoice, shown: string[][], data: EngineData = fillData) => {
      const steps = fillProposals(team, choice, shown, DEFAULT_FORMAT, data, 0);
      const list: Proposal[] = [];
      for (let next = steps.next(); ; next = steps.next()) {
        if (next.done) return { list, end: next.value };
        if (next.value) list.push(next.value);
      }
    };
    // Manca solo chi toglie le trappole: tanti tentativi finiscono su proposte con il buco, il giro si ferma prima di PROPOSALS_PER_ROUND
    const team = [set('Garchomp', ['Stealth Rock', 'Earthquake']), ...['Toxapex', 'Kingambit', 'Blissey'].map(name => set(name, ['Protect'])),
      set('Gardevoir', ['Hyper Voice'], 'Gardevoirite')];
    const shown: string[][] = [];
    const first = round(team, any, shown);
    expect(first.list.length).toBeGreaterThanOrEqual(1);
    expect(first.list.length).toBeLessThan(PROPOSALS_PER_ROUND);
    expect(first.end).toBe('stopped');
    const second = round(team, any, shown);
    expect(second.list.length).toBeGreaterThanOrEqual(1);
    expect(second.end).not.toBe('exhausted');
    // Un giro pieno è 'complete'
    const full = round([set('Great Tusk', ['Rapid Spin', 'Stealth Rock']), ...['Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect']))], any, []);
    expect(full.list).toHaveLength(PROPOSALS_PER_ROUND);
    expect(full.end).toBe('complete');
    // Nessun candidato (solo preferiti, e non ce ne sono): finiti
    const none = round(team.slice(0, 3), { ...any, favorites: 'only' }, []);
    expect(none).toEqual({ list: [], end: 'exhausted' });
    // Nessuna proposta: con gli stessi esclusi il giro dopo sarebbe identico, quindi anche questo è "finiti"
    expect(round(['Dragapult', 'Weavile', 'Cinderace', 'Iron Valiant', 'Gholdengo'].map(name => set(name, ['Protect'])),
      { archetype: 'stall', style: 'snow' }, []).end).toBe('exhausted');
    expect(fillProposals([], any, [], DEFAULT_FORMAT, { stats: null, sets: {} }).next()).toEqual({ done: true, value: 'exhausted' });
  }, 60000);

  it('senza statistiche non produce nulla', () => {
    expect(take([], any, [], DEFAULT_FORMAT, { stats: null, sets: {} })).toEqual([]);
  });
});

describe('Completa team: preferiti dell\'utente', () => {
  const lists = (favorites: string[]) => effectiveLists({ ...EMPTY_LISTS, universal: { favorites, bans: [] } }, 'ou');
  const firstPicks = (data: EngineData) => formes(take([], any, [], DEFAULT_FORMAT, data)[0].added);

  it('nessun preferito: proposte come prima', () => {
    expect(firstPicks({ ...fillData, userLists: lists([]) })).toEqual(firstPicks(fillData));
  });

  it('a voto quasi pari un preferito passa davanti', () => {
    const before = new Set(firstPicks(fillData));
    const others = Object.keys(fillData.stats!.pokemon).filter(name => !before.has(toID(name)));
    const after = firstPicks({ ...fillData, userLists: lists(others) });
    expect(after.some(id => !before.has(id))).toBe(true);
  });
});

describe('Completa team 2.0: preferiti in tre modi, coerenza, set dei membri', () => {
  const lists = (favorites: string[], bans: string[] = []) => effectiveLists({ ...EMPTY_LISTS, universal: { favorites, bans } }, 'ou');
  const rules = formatRules(DEFAULT_FORMAT.formatId);
  const proposal = (overall: number, favorites: number) => ({ overall, favorites }) as Proposal;

  it('ordine delle proposte: con priorità un preferito passa davanti fino a 5 punti, senza priorità conta solo il voto', () => {
    expect(FILL_FAVORITE_MARGIN).toBe(5);
    const fav = proposal(80, 1);
    expect([proposal(84, 0), fav].sort((a, b) => proposalOrder(a, b, 'priority'))[0]).toBe(fav);
    const higher = proposal(86, 0);
    expect([fav, higher].sort((a, b) => proposalOrder(a, b, 'priority'))[0]).toBe(higher);
    const plain = proposal(84, 0);
    expect([fav, plain].sort((a, b) => proposalOrder(a, b, 'off'))[0]).toBe(plain);
    expect([fav, plain].sort((a, b) => proposalOrder(a, b, 'only'))[0]).toBe(plain);
    // A pari chiave vince chi ha più preferiti
    const two = proposal(80, 2);
    expect([fav, two].sort((a, b) => proposalOrder(a, b, 'priority'))[0]).toBe(two);
  });

  it('scelta di partenza: preferiti con priorità e tutti i set tenuti', () => {
    const team = [set('Garchomp', ['Earthquake'])];
    expect(defaultChoice(team)).toEqual({ archetype: null, style: null, favorites: 'priority', keepSets: [true] });
  });

  it('"solo preferiti": i nuovi sono tutti preferiti; senza preferiti nessuna proposta', () => {
    const team = ['Garchomp', 'Toxapex', 'Kingambit'].map(name => set(name, ['Protect']));
    const data = { ...fillData, userLists: lists(['Corviknight', 'Great Tusk', 'Iron Valiant', 'Blissey']) };
    const list = take(team, { ...any, favorites: 'only' }, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      for (const s of p.added) expect(isUserFavorite(s, data.userLists), s.species).toBe(true);
      expect(p.favorites).toBe(p.added.length);
    }
    expect(take(team, { ...any, favorites: 'only' }, [], DEFAULT_FORMAT, { ...fillData, userLists: lists([]) })).toEqual([]);
  });

  it('nessun set contraddittorio tra i nuovi (Gholdengo con Choice Scarf e Nasty Plot resta fuori)', () => {
    const shown: string[][] = [];
    const list = [...take([], any, shown), ...take([], any, shown)];
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) for (const s of p.added) expect(contradictorySet(s), s.species).toBe(false);
    expect(list.flatMap(p => formes(p.added))).not.toContain('gholdengo');
  });

  it('ogni proposta ha i suoi buchi di coerenza, quelli del team proposto', () => {
    for (const p of take([], any)) {
      expect(Array.isArray(p.gaps)).toBe(true);
      expect(p.gaps).toEqual(coherenceGaps(p.team, rules));
    }
  });

  it("se l'ultimo posto non può mettere e togliere le trappole, le proposte escono lo stesso con la nota", () => {
    // Membri con la sola Protect: nessuno mette né toglie le trappole, e chi le toglie tra i candidati è bannato
    const team = ['Garchomp', 'Toxapex', 'Kingambit', 'Blissey', 'Dragapult'].map(name => set(name, ['Protect']));
    const data = { ...fillData, userLists: lists([], ['Corviknight', 'Great Tusk', 'Torkoal', 'Cinderace']) };
    const list = take(team, any, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    // Nessuno mette né toglie le trappole: chi porta uno dei due ruoli lascia l'altro scoperto, e la nota lo dice
    for (const p of list) expect(p.gaps.some(g => g.kind === 'removal' || g.kind === 'hazards'), formes(p.added).join()).toBe(true);
    expect(list.some(p => p.gaps.some(g => g.kind === 'removal'))).toBe(true);
  });

  it("trappole e debolezze sono rigide: all'ultimo posto entra solo chi toglie le trappole, finché ce n'è uno", () => {
    // Con una Mega già nel team l'ultimo posto non deve per forza essere una Mega
    // Garchomp mette le trappole: manca solo chi le toglie. Senza Corviknight (bannato) restano Great Tusk, Torkoal e Cinderace:
    // Skarmory vale qualche punto in più ma non le toglie, quindi non entra; finiti quelli il giro si ferma
    const team = [set('Garchomp', ['Stealth Rock', 'Earthquake']), ...['Toxapex', 'Kingambit', 'Blissey'].map(name => set(name, ['Protect'])),
      set('Gardevoir', ['Hyper Voice'], 'Gardevoirite')];
    const list = take(team, any, [], DEFAULT_FORMAT, { ...fillData, userLists: lists([], ['Corviknight']) });
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.gaps, formes(p.added).join()).toEqual([]);
    expect(list.flatMap(p => formes(p.added))).not.toContain('skarmory');
  });

  it('se un completamento coerente esiste, nessuna proposta ha buchi (trappole, chi le toglie, debolezze)', () => {
    const scenarios: [TeamSet[], FillChoice][] = [
      [[], any],
      [[], { archetype: 'hyperOffense', style: null }],
      [[], { archetype: 'balance', style: null }],
      [[set('Kingambit', ['Swords Dance', 'Sucker Punch']), set('Garchomp', ['Stealth Rock', 'Earthquake'])], any],
      [[set('Kingambit', ['Swords Dance', 'Sucker Punch']), set('Garchomp', ['Stealth Rock', 'Earthquake'])], { archetype: 'hyperOffense', style: null }],
      [['Great Tusk', 'Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect'])), any],
    ];
    for (const [team, choice] of scenarios) {
      const list = take(team, choice);
      const label = `${formes(team).join('+') || 'vuoto'} ${choice.archetype ?? 'migliore'}`;
      expect(list.length, label).toBeGreaterThanOrEqual(1);
      for (const p of list) expect(p.gaps, `${label}: ${formes(p.added).join()}`).toEqual([]);
    }
  }, 60000);

  it('tre membri già deboli allo stesso tipo e nessuno che lo resista tra i candidati: proposte con la nota, mai vuote', () => {
    // Cinque membri deboli al Ghiaccio senza resistenze; i candidati che resistono al Ghiaccio sono bannati
    const team = ['Garchomp', 'Gliscor', 'Dragapult', 'Great Tusk', 'Clodsire'].map(name => set(name, ['Protect']));
    const resists = Object.keys(fillData.stats!.pokemon).filter(name => !team.some(s => s.species === name)
      && coherenceGaps([...team, set(name, ['Protect'])], rules).every(g => g.kind !== 'weakness' || g.type !== 'Ice'));
    const data = { ...fillData, userLists: lists([], resists) };
    const list = take(team, any, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) expect(p.gaps.some(g => g.kind === 'weakness' && g.type === 'Ice')).toBe(true);
  });

  it('set sbloccato: cambia solo quel membro (mai la specie), gli altri restano identici', () => {
    const strong = { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'] };
    const data: EngineData = { ...fillData, presets: { Garchomp: [{ name: 'Forte', format: 'gen9nationaldex', set: strong }] } };
    const team = [set('Garchomp', ['Protect']), set('Toxapex', ['Recover', 'Toxic', 'Haze', 'Toxic Spikes'], 'Black Sludge'), set('Kingambit', ['Kowtow Cleave'])];
    const list = take(team, { ...any, keepSets: [false, true, true] }, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      expect(p.team[1]).toEqual(team[1]);
      expect(p.team[2]).toEqual(team[2]);
      expect(p.team[0].species).toBe('Garchomp');
      if (p.changed.includes(0)) expect(p.team[0]).not.toEqual(team[0]);
      expect(p.changed.every(i => i === 0)).toBe(true);
      expect(p.overall).toBe(rateTeam(p.team, data, 'en')!.overall);
    }
    expect(list.some(p => p.changed.includes(0))).toBe(true);
  });

  it('set sbloccato: se il preset vale meno del set di adesso, il set resta com’è', () => {
    const strong = { ...set('Garchomp', ['Earthquake', 'Outrage', 'Stealth Rock', 'Swords Dance'], 'Rocky Helmet'), ability: 'Rough Skin' };
    const data: EngineData = { ...fillData, presets: { Garchomp: [{ name: 'Debole', format: 'gen9nationaldex', set: set('Garchomp', ['Splash']) }] } };
    const team = [strong, set('Kingambit', ['Kowtow Cleave'])];
    const list = take(team, { ...any, keepSets: [false, true] }, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      expect(p.changed).toEqual([]);
      expect(p.team[0]).toEqual(strong);
    }
  });

  it('set sbloccato: un preset senza trappole non apre il buco delle trappole', () => {
    // Ting-Lu è l'unico che mette le trappole (gli altri che le mettono sono bannati); il suo preset non ha Stealth Rock
    const data: EngineData = { ...fillData,
      userLists: lists([], ['Skarmory', 'Clodsire', 'Gliscor', 'Blissey', 'Torkoal', 'Toxapex', 'Garchomp']),
      presets: { 'Ting-Lu': [{ name: 'Senza trappole', format: 'gen9nationaldex',
        set: { ...set('Ting-Lu', ['Earthquake', 'Ruination', 'Payback', 'Heavy Slam'], 'Leftovers'), ability: 'Vessel of Ruin' } }] } };
    const team = [set('Ting-Lu', ['Stealth Rock', 'Tackle']), set('Kingambit', ['Kowtow Cleave'])];
    const list = take(team, { ...any, keepSets: [false, true] }, [], DEFAULT_FORMAT, data);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      expect(p.gaps).not.toContainEqual({ kind: 'hazards' });
      // Il cambio non apre buchi che col set di prima non c'erano
      const before = coherenceGaps([team[0], ...p.team.slice(1)], rules);
      for (const gap of p.gaps) expect(before).toContainEqual(gap);
    }
  });

  it('set tenuti (scelta di partenza): nessun cambio e membri identici', () => {
    const team = [set('Garchomp', ['Protect']), set('Kingambit', ['Kowtow Cleave'])];
    const list = take(team, defaultChoice(team));
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const p of list) {
      expect(p.changed).toEqual([]);
      expect(p.team.slice(0, 2)).toEqual(team);
    }
  });
});

describe('Completa team: dalla pagina 2 i già mostrati possono tornare', () => {
  /** Tre pagine di fila con la stessa storia. */
  const pages = (team: TeamSet[], choice: FillChoice = any, count = 3) => {
    const shown: string[][] = [];
    const result: Proposal[][] = [];
    for (let i = 0; i < count; i++) result.push(take(team, choice, shown));
    return { result, shown };
  };
  const two = [set('Kingambit', ['Kowtow Cleave', 'Sucker Punch']), set('Garchomp', ['Earthquake', 'Stealth Rock'])];

  it('la pagina 2 può riprendere Pokémon della pagina 1', () => {
    const { result: [first, second] } = pages([], any, 2);
    expect(second.length).toBeGreaterThanOrEqual(1);
    const before = new Set(first.flatMap(p => formes(p.added)));
    expect(second.flatMap(p => formes(p.added)).some(id => before.has(id))).toBe(true);
  });

  it('ogni proposta ha in comune con ognuna delle precedenti al massimo metà dei nuovi (anche dentro la stessa pagina)', () => {
    for (const team of [[], two]) {
      const all = pages(team).result.flat();
      expect(all.length).toBeGreaterThan(PROPOSALS_PER_ROUND);
      for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) {
        const before = new Set(formes(all[j].added));
        const shared = formes(all[i].added).filter(id => before.has(id)).length;
        expect(shared, `${formes(all[i].added)} / ${formes(all[j].added)}`).toBeLessThanOrEqual(maxShared(all[i].added.length));
      }
    }
  }, 60000);

  it('con un solo posto libero nessun Pokémon si ripete, in nessuna pagina', () => {
    const team = [set('Great Tusk', ['Rapid Spin', 'Stealth Rock']), ...['Gholdengo', 'Kingambit', 'Dragapult', 'Corviknight'].map(name => set(name, ['Protect']))];
    const added = pages(team).result.flat().flatMap(p => formes(p.added));
    expect(added.length).toBeGreaterThan(PROPOSALS_PER_ROUND);
    expect(new Set(added).size).toBe(added.length);
  });

  it('precedenza a chi non è ancora comparso: con tanti mai mostrati, la prima proposta dopo ne ha almeno quanti i già mostrati', () => {
    expect(REPEAT_PENALTY).toBeGreaterThan(0);
    // Il meta di prova è piccolo (27 Pokémon): una sola proposta mostrata lascia tanti mai mostrati
    for (const team of [[], two]) {
      const shown = [formes(take(team, any)[0].added)];
      const before = new Set(shown[0]);
      const ids = formes(take(team, any, shown)[0].added);
      const reused = ids.filter(id => before.has(id)).length;
      expect(ids.length - reused, ids.join()).toBeGreaterThanOrEqual(reused);
    }
  });

  it('la pagina 1 non cambia: nessun Pokémon nuovo si ripete fra le sue proposte', () => {
    const added = take(two, any).flatMap(p => formes(p.added));
    expect(new Set(added).size).toBe(added.length);
  });
});

describe('preset migliore coerente', () => {
  const team = [set('Garchomp', ['Tackle']), set('Corviknight', ['Roost', 'Brave Bird', 'U-turn', 'Body Press'], 'Leftovers')];
  const scarfSd = { ...emptySet('Garchomp'), item: 'Choice Scarf', ability: 'Rough Skin', moves: ['Earthquake', 'Outrage', 'Swords Dance', 'Stone Edge'] };
  const helmet = { ...emptySet('Garchomp'), item: 'Rocky Helmet', ability: 'Rough Skin', moves: ['Earthquake', 'Outrage', 'Stealth Rock', 'Spikes'] };

  it('salta i preset contraddittori e prende il successivo', () => {
    const data: EngineData = { stats: null, sets: {}, presets: { Garchomp: [
      { name: 'Scarf', format: 'gen9nationaldex', set: scarfSd },
      { name: 'Helmet', format: 'gen9nationaldex', set: helmet },
    ] } };
    const result = bestCoherentPreset(team, 0, data, 9);
    expect(contradictorySet(result)).toBe(false);
    expect(result.item).toBe('Rocky Helmet');
  });

  it("se nessun preset va bene il membro resta com'è", () => {
    const data: EngineData = { stats: null, sets: {}, presets: { Garchomp: [{ name: 'Scarf', format: 'gen9nationaldex', set: scarfSd }] } };
    expect(bestCoherentPreset(team, 0, data, 9)).toBe(team[0]);
  });
});

// Con i dati veri (se scaricati): un Bulky Offense deve trovare chi toglie le trappole anche dopo Great Tusk e Iron Treads.
// Prima il filtro "sembra un Bulky Offense" scartava gli altri (Cinderace, Glimmora, Torkoal…) e il giro si fermava a 2
describe('Completa team coi dati veri', () => {
  const dir = 'gen9nationaldex';
  const hasRealData = existsSync(join('data', dir, 'stats.json'));
  it.skipIf(!hasRealData)('Alomomola + Latios-Mega, Bulky Offense: il primo giro si riempie con proposte coerenti', async () => {
    const read = (d: string, name: string) => { const p = join('data', d, `${name}.json`); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
    const { initTiers } = await import('../../src/engine/dex');
    const { presetsForSet } = await import('../../src/engine/sets');
    const real: EngineData = { formatId: DEFAULT_FORMAT.formatId, stats: { meta: read(dir, 'meta'), pokemon: read(dir, 'stats') }, sets: read(dir, 'sets'),
      presets: read(dir, 'presets'), fallback: read('_fallback', 'sets'), fallbackPresets: read('_fallback', 'presets'), fallbackStats: read('_fallback', 'stats') };
    initTiers(read('_tiers', 'tiers'));
    const mk = (name: string, item = '') => { const base = { ...emptySet(name), item }; return presetsForSet(real, base, 9)[0]?.set ?? base; };
    const list = [...fillProposals([mk('Alomomola'), mk('Latios', 'Latiosite')], { archetype: 'bulkyOffense', style: null }, [], DEFAULT_FORMAT, real)]
      .filter((p): p is Proposal => p !== null);
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const p of list) expect(p.gaps).toEqual([]);
  }, 120_000);
});
