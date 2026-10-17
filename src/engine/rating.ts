import { analyzeTeam, threatScore, usesMeta, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, toID } from './dex';
import { hitQuality, memberPower, teamPower, type MemberPower } from './power';
import type { Archetype } from './archetype';
import { attackStyle, detectRoles, isPassive, isStall, teamRoles } from './roles';
import { rulesOf, type FormatRules } from './formatRules';
import { meetsNeed, needCoverage, NEEDS } from './needs';
import { teamSpeed } from './speed';
import { strengthComponent } from './scoring';
import { usageOf } from './stats';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { effectiveness, superEffectiveMoves, teamField, TYPES } from './types';
import { benefits, conditionConflicts, conditionLabel, enables, viaName, unmetBeneficiaries, unusedEnablers, weakenedMoves, weatherMitigations, type Condition } from './synergy';

export type AreaKey = 'coverage' | 'defense' | 'strength' | 'bulk' | 'roles' | 'speed' | 'meta';
/** Le aree del voto senza meta. */
type BaseArea = Exclude<AreaKey, 'meta'>;
/** Nell'ordine del pannello, a coppie: Coverage offensiva e difensiva, Offesa e Robustezza, Ruoli e Velocità. */
const BASE_AREAS: BaseArea[] = ['coverage', 'defense', 'strength', 'bulk', 'roles', 'speed'];

/**
 * Peso dell'area Velocità: è ciò che più distingue i team da torneo (i loro due più veloci superano
 * il 78% delle minacce più usate, gli altri team il 58%). Le altre aree si dividono il resto.
 */
export const SPEED_WEIGHT = 0.2;
/** Proporzioni delle altre aree (Statistiche 30%). */
const OTHER_AREAS = { defense: 0.284375, coverage: 0.21875, roles: 0.196875, strength: 0.3 };

/** Pesi delle aree nel voto senza meta. Somma = 1. */
export const AREA_WEIGHTS: Record<BaseArea, number> = {
  defense: (1 - SPEED_WEIGHT) * OTHER_AREAS.defense,
  coverage: (1 - SPEED_WEIGHT) * OTHER_AREAS.coverage,
  roles: (1 - SPEED_WEIGHT) * OTHER_AREAS.roles,
  strength: (1 - SPEED_WEIGHT) * OTHER_AREAS.strength,
  speed: SPEED_WEIGHT,
  // La Robustezza prende la sua parte dal peso della difesa, secondo il tipo di team (BULK_SHARE)
  bulk: 0,
};

/**
 * Pesi per uno stall: la velocità non conta, la copertura conta la metà (attacca poco per scelta)
 * e il resto va alla difesa.
 */
export const STALL_AREA_WEIGHTS: Record<BaseArea, number> = {
  defense: OTHER_AREAS.defense + OTHER_AREAS.coverage / 2,
  coverage: OTHER_AREAS.coverage / 2,
  roles: OTHER_AREAS.roles,
  strength: OTHER_AREAS.strength,
  speed: 0,
  bulk: 0,
};
/**
 * Quanto i pesi di un team non stall si spostano verso quelli dello stall, secondo il tipo di team:
 * un semi-stall o un balance non vincono con la velocità, e la difesa conta di più.
 */
export const DEFENSIVE_BLEND: Record<Archetype, number> = { hyperOffense: 0, bulkyOffense: 0, balance: 0.3, semiStall: 0.6, stall: 0.6 };
const blendWeights = (amount: number): Record<BaseArea, number> => Object.fromEntries((Object.keys(AREA_WEIGHTS) as BaseArea[])
  .map(key => [key, (1 - amount) * AREA_WEIGHTS[key] + amount * STALL_AREA_WEIGHTS[key]])) as Record<BaseArea, number>;

/** Pesi per un team con Trick Room, lento per scelta: la velocità non conta, il resto come sempre. */
const TRICK_ROOM_WEIGHTS: Record<BaseArea, number> = { ...OTHER_AREAS, speed: 0, bulk: 0 };

/**
 * Valore da cui un'area è piena: un team da torneo non resiste a tutto né ha sei Pokémon fortissimi,
 * e non deve servire la perfezione per arrivare in S (come l'area Meta, piena a META_FULL).
 */
export const AREA_FULL: Record<BaseArea, number> = { defense: 0.8, coverage: 0.9, roles: 0.95, strength: 0.92, speed: 0.9, bulk: 0.9 };

/**
 * Oltre il 95% del valore di riferimento l'area sale più piano: arrivare al riferimento vale circa 97,
 * il 100 solo con la perfezione (per la coverage offensiva: tre membri diversi su ogni tipo).
 * Sotto il ginocchio il valore resta quello di prima, così i voti dei team normali non cambiano.
 */
export const AREA_KNEE = 0.95;
export function areaValue(value: number, full: number): number {
  const x = value / full;
  if (x <= AREA_KNEE) return Math.max(0, x);
  const perfect = 1 / full;
  return Math.min(1, AREA_KNEE + (1 - AREA_KNEE) * (x - AREA_KNEE) / (perfect - AREA_KNEE));
}

/**
 * Difesa = tipi coperti + robustezza media dei membri, con una quota di robustezza che cresce col tipo di team:
 * un hyper offense vince attaccando, uno stall incassando.
 */
export const BULK_SHARE: Record<Archetype, number> = { hyperOffense: 0.2, bulkyOffense: 0.3, balance: 0.35, semiStall: 0.45, stall: 0.5 };
/** Robustezza media (percentile) da cui l'area Robustezza è piena. */
export const BULK_FULL = AREA_FULL.bulk;
/**
 * Offesa media (percentile) da cui l'area Offesa è piena. L'area misura quanto colpiscono forte i membri:
 * i team da torneo stanno a 72, gli altri team buoni a 64. Nello stall resta "Statistiche" (robustezza dei muri passivi).
 */
export const OFFENSE_FULL = 0.8;

/**
 * Coverage in profondità: per ogni tipo, il colpo migliore del 1°, 2° e 3° membro che lo colpisce vale 70%, 20% e 10%.
 * Un solo Pokémon che colpisce un tipo non basta per la copertura piena.
 */
export const COVERAGE_DEPTH = [0.7, 0.2, 0.1];

/** Nei Ruoli: quota data da quanti compiti copre in media ogni membro ("role compression"), piena a 3. */
export const ROLE_COMPRESSION = 0.3;
const FULL_JOBS = 3;

/** Peso dell'area Meta nel voto col meta; il resto è il voto senza meta. */
export const META_WEIGHT = 0.3;
/** Nelle minacce gestite: quota delle 3 più usate (il resto: tutte, pesate per uso). */
export const TOP_THREATS = 0.5;
/** Nell'area Meta: quota delle minacce gestite (il resto è l'uso dei membri nel formato). */
export const META_THREATS = 2 / 3;
/** Punteggio meta che vale l'area piena: i team Smogon stanno intorno a questo valore. */
export const META_FULL = 0.78;

/**
 * Soglie tarate sui dati reali (2026-09, 1630+): team ben costruiti 88–90,
 * team casuali di Pokémon del meta mediana 74, team con membri inutili sotto 60.
 */
const GRADES: { min: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' }[] = [
  { min: 90, grade: 'S' },
  { min: 82, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 0, grade: 'D' },
];

export interface RatingArea {
  key: AreaKey;
  label: string;
  /** 0–100, o null se mancano i dati per calcolarla. */
  value: number | null;
}

export interface Redundancy {
  text: string;
  points: number;
}

export interface Redundancies {
  total: number;
  items: Redundancy[];
}

/** L'area Meta scomposta: minacce gestite e uso dei membri nel formato (0–100). */
export interface MetaScore {
  threats: number;
  usage: number;
}

export interface TeamRating {
  /** Voto pesato delle aree, prima della penalità. */
  base: number;
  penalty: Redundancies;
  bonus: Redundancies;
  /** Forza dei singoli membri dalle statistiche base. */
  power: MemberPower[];
  overall: number;
  grade: string;
  label: string;
  provisional: boolean;
  areas: RatingArea[];
  /** Archetipo riconosciuto che cambia il calcolo dei ruoli (per ora solo lo stall). */
  archetype: 'stall' | null;
  /** Dettaglio dell'area Meta, o null se il voto è senza meta. */
  meta: MetaScore | null;
  /** Peso di ogni area nel voto senza meta (somma 1) e peso dell'area Meta nel voto col meta (0 senza). */
  weights: Partial<Record<AreaKey, number>>;
  metaWeight: number;
  /** Tipi colpiti super efficace da ogni membro (col meteo e il campo del team), per il tooltip della Coverage offensiva. */
  coverageByMember: { species: string; types: number }[];
}


const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Penalità massima per ridondanze: da sole non possono affossare un team. */
export const MAX_PENALTY = 15;
/** Bonus massimo per debolezze smorzate dal meteo: il meteo non è sempre attivo. */
export const MAX_BONUS = 6;

const HAZARDS: Record<string, string> = {
  stealthrock: 'Stealth Rock', stoneaxe: 'Stealth Rock',
  spikes: 'Spikes', ceaselessedge: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web',
};
const REMOVAL = new Set(['defog', 'rapidspin', 'mortalspin', 'tidyup', 'courtchange']);

/** Ruoli e tipi ripetuti senza bisogno: stesso hazard, più rimozioni, 3+ membri dello stesso tipo. */
export function roleAndTypeRedundancies(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const items: Redundancy[] = [];
  const setters = new Map<string, number>();
  for (const set of team) {
    for (const hazard of new Set(set.moves.map(m => HAZARDS[toID(m)]).filter(Boolean))) {
      setters.set(hazard, (setters.get(hazard) ?? 0) + 1);
    }
  }
  for (const [hazard, n] of setters) if (n > 1) items.push({ text: t(lang, 'rating.redundancy.setters', { n, hazard: gameName('move', hazard, lang) }), points: 2 * (n - 1) });
  const removers = team.filter(set => set.moves.some(m => REMOVAL.has(toID(m)))).length;
  if (removers > 1) items.push({ text: t(lang, 'rating.redundancy.removers', { n: removers }), points: removers - 1 });
  for (const type of TYPES) {
    const n = team.filter(set => (battleSpecies(set)?.types as readonly string[] | undefined)?.includes(type)).length;
    if (n >= 3) items.push({ text: t(lang, 'rating.redundancy.sameType', { n, type: typeName(type, lang) }), points: n - 2 });
  }
  return items;
}

/** Meteo/campi in conflitto (−3) e −1 per ogni membro con mosse indebolite dal meteo del team. */
export function weatherClashes(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return [
    ...conditionConflicts(team, lang).map(c => ({ text: t(lang, 'rating.redundancy.conflict', { kind: t(lang, `conflict.${c.kind}`), list: c.setters.join(', ') }), points: 3 })),
    ...weakenedMoves(team).map(w => ({
      text: t(lang, 'rating.redundancy.weakens', { condition: cap(conditionLabel(w.condition, lang)), setter: w.setter, type: typeName(w.type, lang), member: w.member }),
      points: WEATHER_HURT,
    })),
  ];
}

/** Forza sotto cui un membro senza utilità chiave è considerato debole. */
export const WEAK_POWER = 30;
/** Ruoli che danno al team un'utilità chiave anche a un Pokémon debole (Delibird con Spikes). */
const UTILITY_ROLES = ['hazards', 'removal', 'speed'] as const;

/** Il membro porta un'utilità chiave: hazard, rimozione, controllo velocità, meteo, campo o Trick Room. */
function bringsUtility(set: TeamSet, rules: FormatRules): boolean {
  const roles = detectRoles(set, rules);
  return UTILITY_ROLES.some(role => roles.includes(role)) || enables(set).length > 0;
}
/** Attaccanti minimi perché un team tutto fisico o tutto speciale sia una scelta e non un caso. */
const ONE_STYLE_ATTACKERS = 4;

/**
 * Membri deboli senza utilità chiave (−3, −7, −12…; non dipende dal meta: Pelipper che porta la pioggia è esente)
 * e team senza attaccanti fisici o speciali (−3; mai per uno stall, che attacca poco per scelta).
 */
export function memberIssues(team: TeamSet[], lang: Lang, rules: FormatRules): Redundancy[] {
  const items: Redundancy[] = [];
  const roles = team.map(set => detectRoles(set, rules));
  // La penalità cresce col numero di membri deboli: −3, −7, −12… (il k-esimo pesa 2 + k)
  let weak = 0;
  for (const [i, set] of team.entries()) {
    const power = memberPower(set);
    // Un muro passivo si giudica dalla sua robustezza (Mega Sableye), gli altri dalla forza complessiva
    if (power && (isPassive(set, roles[i]) ? power.bulk : power.power) < WEAK_POWER && !bringsUtility(set, rules)) {
      weak += 1;
      items.push({ text: t(lang, 'rating.redundancy.weakMember', { member: battleName(set) }), points: 2 + weak });
    }
  }
  if (!isStall(team, roles)) {
    const styles = team.map(attackStyle);
    const physical = styles.filter(s => s === 'physical' || s === 'mixed').length;
    const special = styles.filter(s => s === 'special' || s === 'mixed').length;
    if (physical + special >= ONE_STYLE_ATTACKERS && (physical === 0 || special === 0)) {
      const missing = physical === 0 ? 'physical' : 'special';
      items.push({ text: t(lang, 'rating.redundancy.oneStyle', { style: t(lang, `analysis.style.${missing}`) }), points: 3 });
    }
  }
  return items;
}

/** Regole del formato: in Ubers e UU un team completo senza hazard perde punti. */
export function formatIssues(team: TeamSet[], rules: FormatRules, lang: Lang = 'it'): Redundancy[] {
  const hazards = team.some(set => detectRoles(set, rules).includes('hazards'));
  return rules.noHazardsPenalty > 0 && team.length === 6 && !hazards
    ? [{ text: t(lang, 'rating.redundancy.noHazards'), points: rules.noHazardsPenalty }]
    : [];
}

export function redundancies(team: TeamSet[], analysis: TeamAnalysis, lang: Lang = 'it'): Redundancies {
  const common = 1 / TYPES.length;
  const weaknesses = analysis.weakness
    .filter(row => row.weak - row.resist >= 2)
    .map(row => ({
      text: t(lang, 'rating.redundancy.sharedWeak', {
        n: row.weak, type: typeName(row.type, lang),
        resistText: row.resist === 0 ? t(lang, 'rating.redundancy.noneResist') : t(lang, 'rating.redundancy.someResist', { n: row.resist }),
      }),
      points: (row.weak - row.resist - 1) * (analysis.typeWeights[row.type] >= common ? 2 : 1),
    }));
  const dependencies = [
    ...unmetBeneficiaries(team).map(i => ({ text: t(lang, 'rating.redundancy.unmet', { member: i.member, via: viaName(i.via, lang), condition: conditionLabel(i.condition, lang) }), points: 3 })),
    ...unusedEnablers(team).map(i => ({ text: t(lang, 'rating.redundancy.unused', { via: viaName(i.via, lang), member: i.member }), points: 2 })),
  ];
  const items = [
    ...weaknesses, ...roleAndTypeRedundancies(team, lang), ...dependencies, ...weatherClashes(team, lang),
    ...memberIssues(team, lang, analysis.needs.rules), ...formatIssues(team, analysis.needs.rules, lang),
  ];
  return { total: Math.min(MAX_PENALTY, sum(items.map(i => i.points))), items };
}

/** Punti di un membro contro un tipo: immunità +2, ×¼ +1,5, ×½ +1, neutro 0, ×2 −1, ×4 −2. */
export function resistPoints(multiplier: number): number {
  if (multiplier === 0) return 2;
  if (multiplier <= 0.25) return 1.5;
  if (multiplier < 1) return 1;
  if (multiplier >= 4) return -2;
  return multiplier > 1 ? -1 : 0;
}

/** Saldo che separa un tipo scoperto (0) da uno sicuro (1); a saldo 0 il tipo vale 0,5. */
export const BALANCE_SPAN = 2;

/**
 * Quanto il team è al sicuro da un tipo, dal saldo fra resistenze e debolezze dei membri:
 * un'immunità o due resistenze lo rendono sicuro, un ×4 o due ×2 scoperti lo lasciano scoperto.
 */
export function typeSafety(multipliers: number[]): number {
  const net = sum(multipliers.map(resistPoints));
  return Math.min(1, Math.max(0, 0.5 + net / (2 * BALANCE_SPAN)));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Il meteo/campo del team vale +1 se giova ad almeno un membro, comunque e a quanti; −1 per ogni membro che danneggia. */
export const WEATHER_HELP = 1;
export const WEATHER_HURT = 1;

/**
 * +1 una volta sola se il meteo o il campo che il team porta giova a qualcuno: smorza una debolezza
 * o abilita un'abilità o una mossa di un membro. Il meteo non è sempre attivo: non conta quanti ne godono.
 */
export function weatherBonus(team: TeamSet[], lang: Lang = 'it'): Redundancies {
  const helped = new Map<string, { setter: string; members: Set<string> }>();
  const add = (condition: string, setter: string, member: string) => {
    const entry = helped.get(condition) ?? { setter, members: new Set<string>() };
    entry.members.add(member);
    helped.set(condition, entry);
  };
  for (const m of weatherMitigations(team)) {
    for (const x of m.members.filter(x => x.to <= 1)) add(m.condition, m.source.split(' (')[0], x.species);
  }
  for (const setter of team) {
    for (const e of enables(setter)) {
      for (const member of team) {
        if (benefits(member).some(b => b.condition === e.condition && b.via !== e.via)) add(e.condition, battleName(setter), battleName(member));
      }
    }
  }
  const items = [...helped].map(([condition, { setter, members }]) => ({
    text: t(lang, 'rating.bonus.helps', { condition: capitalize(conditionLabel(condition as Condition, lang)), setter, list: [...members].join(', ') }),
    points: 0,
  }));
  // Un solo punto per tutto il team: si mostra sulla prima voce
  if (items.length) items[0].points = WEATHER_HELP;
  return { total: items.length ? WEATHER_HELP : 0, items };
}

/**
 * Tera come via d'uscita (Gen 9): +1 per ogni tipo a cui il team è debole (più deboli che resistenti)
 * e che il Tera dichiarato di un membro fa resistere, fino al limite del formato. Non cambia la difesa del team:
 * il Tera si usa una volta sola per partita.
 */
export function teraBonus(team: TeamSet[], analysis: TeamAnalysis, cap: number, lang: Lang = 'it'): Redundancy[] {
  if (cap <= 0) return [];
  const items: Redundancy[] = [];
  for (const row of analysis.weakness.filter(r => r.weak > r.resist)) {
    const member = team.find(set => (TYPES as readonly string[]).includes(set.teraType ?? '')
      && effectiveness(row.type, [set.teraType!]) < 1);
    if (!member) continue;
    items.push({ text: t(lang, 'rating.bonus.tera', { tera: typeName(member.teraType!, lang), member: battleName(member), type: typeName(row.type, lang) }), points: 1 });
    if (items.length === cap) break;
  }
  return items;
}

export function gradeFor(score: number, lang: Lang = 'it'): { grade: string; label: string } {
  const { grade } = GRADES.find(g => score >= g.min)!;
  return { grade, label: t(lang, `grade.${grade}`) };
}

export function rateTeam(team: TeamSet[], data: EngineData, lang: Lang = 'it'): TeamRating | null {
  if (team.length === 0) return null;
  const analysis = analyzeTeam(team, data);
  const weights = analysis.typeWeights;

  const rules = rulesOf(data);
  const memberRoles = team.map(set => teamRoles(set, rules));
  // Stall riconosciuto "senza esagerare": a metà tra la valutazione normale e quella da stall
  const archetype = isStall(team, memberRoles) ? 'stall' as const : null;
  // Nello stall un muro passivo non deve fare danni: conta la sua robustezza, e i suoi colpi valgono pieni
  const passive = archetype ? team.map((set, i) => isPassive(set, memberRoles[i])) : [];

  const typeDefense = sum(analysis.weakness.map(row => weights[row.type] * typeSafety(row.multipliers)));
  // Ogni tipo vale secondo i colpi che lo prendono (un Close Combat di Alakazam non vale uno di Great Tusk)
  // e secondo quanti membri diversi lo colpiscono: se l'unico che lo colpisce è KO, il tipo resta scoperto
  const quality = (set: TeamSet, i: number, move: string) => (passive[i] ? 1 : hitQuality(set, move));
  const field = teamField(team);
  const coverage = sum(TYPES.map(type => {
    const best = team.map((set, i) => Math.max(0, ...superEffectiveMoves(set, type, field).map(move => quality(set, i, move))))
      .sort((a, b) => b - a);
    return weights[type] * Math.min(1, sum(COVERAGE_DEPTH.map((share, i) => share * (best[i] ?? 0))));
  }));
  // Ruoli richiesti in base all'archetipo del team (uno stall non ha bisogno di sweeper, un hyper offense di wall),
  // più quanti compiti copre ogni membro: nei team da torneo ognuno fa 2-3 cose
  const jobs = sum(team.map(set => NEEDS.filter(need => meetsNeed(need, set, rules)).length)) / team.length;
  const roles = (1 - ROLE_COMPRESSION) * needCoverage(analysis.needs) + ROLE_COMPRESSION * Math.min(1, jobs / FULL_JOBS);
  const power = teamPower(team, passive, rules);
  // Robustezza e offesa medie dei membri (confrontate col formato, come le Statistiche)
  const members = team.map(set => memberPower(set, rules.strengthPool)).filter((m): m is MemberPower => m !== null);
  const average = (pick: (m: MemberPower) => number) => (members.length ? sum(members.map(pick)) / members.length / 100 : null);
  const bulk = average(m => m.bulk);
  const offense = average(m => m.offense);
  const trickRoom = team.some(set => set.moves.some(move => toID(move) === 'trickroom'));
  // Con meno di sei membri il tipo di team è solo presunto (balance): niente spostamento verso la difesa
  const blend = archetype || trickRoom || team.length < 6 ? 0 : DEFENSIVE_BLEND[analysis.needs.archetype];
  const weightsFor = archetype ? STALL_AREA_WEIGHTS : trickRoom ? TRICK_ROOM_WEIGHTS : blendWeights(blend);
  const strength = power.value === null ? null : power.value / 100;
  // Velocità: col meta contro le minacce più usate, senza contro tutti i Pokémon
  const speed = teamSpeed(team, data, usesMeta(data) ? analysis.threats.map(x => x.name) : null);

  // Ogni area sale fino al suo valore di riferimento, poi più piano fino alla perfezione
  const full = (key: BaseArea, value: number | null) => (value === null ? null : areaValue(value, AREA_FULL[key]));
  // Coverage difensiva (tipi) e Robustezza si dividono il peso della difesa: la Robustezza conta di più in uno stall
  const bulkShare = bulk === null ? 0 : BULK_SHARE[analysis.needs.archetype];
  const effective: Record<BaseArea, number> = { ...weightsFor, defense: weightsFor.defense * (1 - bulkShare), bulk: weightsFor.defense * bulkShare };
  // Offesa: quanto colpiscono forte i membri (nello stall: Statistiche, la robustezza dei muri passivi)
  // Un semi-stall o un balance ha muri passivi per scelta: con la stessa quota dei pesi, l'Offesa si avvicina
  // alle Statistiche dello stall (quanto incassano i muri, quanto colpiscono gli altri)
  const walls = blend > 0 ? teamPower(team, team.map((set, i) => isPassive(set, memberRoles[i])), rules).value : null;
  // Offesa, Robustezza e Statistiche 1:1: la media dei membri è il valore dell'area (89, 90, 88, 96, 100, 75 → 90)
  const offenseArea = offense === null ? null : Math.min(1, offense);
  const attack = archetype ? (strength === null ? null : Math.min(1, strength))
    : offenseArea === null ? null
    : walls === null ? offenseArea : (1 - blend) * offenseArea + blend * Math.min(1, walls / 100);
  const raw: Record<AreaKey, number | null> = {
    // Coverage offensiva 1:1: un membro su ogni tipo vale 70, due 90, tre 100
    coverage: Math.min(1, coverage), defense: full('defense', typeDefense), strength: attack, bulk: bulk === null ? null : Math.min(1, bulk),
    roles: full('roles', roles), speed: full('speed', speed), meta: null,
  };
  const available = BASE_AREAS.filter(key => raw[key] !== null && effective[key] > 0);
  const totalWeight = sum(available.map(key => effective[key]));
  const areaWeights = Object.fromEntries(available.map(key => [key, effective[key] / totalWeight])) as Partial<Record<AreaKey, number>>;
  let score = sum(available.map(key => areaWeights[key]! * raw[key]!));
  // Col meta: minacce gestite (metà dalle 3 più usate) e uso dei membri contano per il 30%, il resto è il voto senza meta
  let meta: MetaScore | null = null;
  if (usesMeta(data)) {
    const top = analysis.threats.slice(0, 3);
    const topHandled = top.length ? top.filter(x => x.handledBy.length > 0).length / top.length : 0.5;
    const threats = (1 - TOP_THREATS) * ((threatScore(analysis) ?? 50) / 100) + TOP_THREATS * topHandled;
    const usage = sum(team.map(set => strengthComponent(usageOf(data.stats, battleName(set))))) / team.length;
    meta = { threats: Math.round(100 * threats), usage: Math.round(100 * usage) };
    raw.meta = areaValue(META_THREATS * threats + (1 - META_THREATS) * usage, META_FULL);
    score = (1 - META_WEIGHT) * score + META_WEIGHT * raw.meta;
  }
  const areas = (Object.keys(raw) as AreaKey[])
    // Senza meta l'area Meta non c'è; con uno stall o Trick Room la Velocità non conta e non si mostra
    .filter(key => (key === 'meta' ? !!meta : (areaWeights[key] ?? 0) > 0))
    .map(key => ({
      key,
      label: t(lang, key === 'strength' && archetype ? 'area.strengthStall' : `area.${key}`),
      value: raw[key] === null ? null : Math.round(100 * raw[key]!),
    }));
  const base = Math.round(100 * score);
  const penalty = redundancies(team, analysis, lang);
  const weather = weatherBonus(team, lang);
  const tera = teraBonus(team, analysis, rules.teraBonusCap, lang);
  const bonus = { total: Math.min(MAX_BONUS, weather.total + sum(tera.map(i => i.points))), items: [...weather.items, ...tera] };
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  const coverageByMember = team.map(set => ({ species: battleName(set), types: TYPES.filter(type => superEffectiveMoves(set, type, field).length > 0).length }));
  return {
    base, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: team.length < 6, areas, archetype, meta,
    weights: areaWeights, metaWeight: meta ? META_WEIGHT : 0, coverageByMember,
  };
}

