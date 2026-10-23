import { analyzeTeam, threatScore, UNIFORM_TYPE_WEIGHTS, usesMeta, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleName, battleSpecies, toID } from './dex';
import { hitQuality, memberPower, teamPower, type MemberPower } from './power';
import { teamOffense, type TeamOffense } from './offense';
import { teamDefense, type TeamDefense } from './defense';
import { BALANCE_SPAN, DEFENSE_FULL, resistPoints, typeSafety } from './typeSafety';

export { BALANCE_SPAN, DEFENSE_FULL, resistPoints, typeSafety };
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
/**
 * La Coverage offensiva è una sottostatistica dell'Offesa (offense.ts); Robustezza, Coverage difensiva e Meta
 * sono parti della Difesa (defense.ts).
 */
type BaseArea = Exclude<AreaKey, 'meta' | 'coverage' | 'bulk'>;
/** Nell'ordine del pannello: Difesa e Offesa, Ruoli e Velocità. */
const BASE_AREAS: BaseArea[] = ['defense', 'strength', 'roles', 'speed'];

/**
 * Peso di ogni area secondo il tipo di team (somma 100): ognuno si giudica su quello con cui vince.
 * Un hyper offense su Offesa e Velocità, uno stall su Robustezza, Coverage difensiva e Ruoli
 * (hazard, rimozione, recupero); il balance tiene tutto quasi alla pari.
 * Un team incompleto si giudica come balance. Con Trick Room la Velocità non conta.
 */
export const ARCHETYPE_WEIGHTS: Record<Archetype, Record<BaseArea, number>> = {
  // L'Offesa ha preso il peso della vecchia Coverage offensiva, la Difesa quello di Coverage difensiva e Robustezza
  hyperOffense: { defense: 20, strength: 46, roles: 14, speed: 20 },
  bulkyOffense: { defense: 28, strength: 42, roles: 16, speed: 14 },
  balance: { defense: 36, strength: 34, roles: 18, speed: 12 },
  semiStall: { defense: 46, strength: 26, roles: 20, speed: 8 },
  stall: { defense: 56, strength: 18, roles: 26, speed: 0 },
};


/**
 * Per le aree con un riferimento: oltre il 95% del riferimento l'area sale più piano,
 * il 100 arriva solo con la perfezione. Sotto il ginocchio il valore è lineare.
 */
export const AREA_KNEE = 0.95;
export function areaValue(value: number, full: number): number {
  const x = value / full;
  if (x <= AREA_KNEE) return Math.max(0, x);
  const perfect = 1 / full;
  return Math.min(1, AREA_KNEE + (1 - AREA_KNEE) * (x - AREA_KNEE) / (perfect - AREA_KNEE));
}



/** Nei Ruoli: quota data da quanti compiti copre in media ogni membro ("role compression"), piena a 3. */
export const ROLE_COMPRESSION = 0.3;
const FULL_JOBS = 3;

/** Nelle minacce gestite: quota delle 3 più usate (il resto: tutte, pesate per uso). */
export const TOP_THREATS = 0.5;

/**
 * Il meta è solo una penalità: un team adatto al meta non guadagna niente (il voto sono le sue aree),
 * uno che gestisce meno del 65% delle minacce perde 1 punto ogni 4% sotto la soglia, fino a 12.
 * Conta solo quante minacce gestisce: l'uso dei suoi Pokémon (circolare) resta un'informazione.
 */
export const META_FLOOR = 65;
export const META_STEP = 4;
export const META_MAX_PENALTY = 12;
export function metaPenalty(threats: number): number {
  return Math.min(META_MAX_PENALTY, Math.max(0, Math.ceil((META_FLOOR - threats) / META_STEP)));
}

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
  /** Tipo di team con cui si sono scelti i pesi delle aree (balance per un team incompleto). */
  teamType: Archetype;
  /** Il team usa Trick Room: la Velocità non conta. */
  trickRoom: boolean;
  /** Dettaglio dell'area Meta, o null se il voto è senza meta. */
  meta: MetaScore | null;
  /** Peso di ogni area nel voto (somma 1); il Meta non pesa, è una penalità. */
  weights: Partial<Record<AreaKey, number>>;
  /** Offesa: danno vero dei set contro i difensori del formato, con le sottostatistiche per membro. */
  offense: TeamOffense;
  /** Difesa: robustezza, sostenibilità e coverage difensiva di tipi e del meta, con le sottostatistiche per membro. */
  defense: TeamDefense;
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
  // Ogni membro debole scoperto oltre il primo costa 2 punti, su qualsiasi tipo (il meta conta solo nell'area Meta)
  const weaknesses = analysis.weakness
    .filter(row => row.weak - row.resist >= 2)
    .map(row => ({
      text: t(lang, 'rating.redundancy.sharedWeak', {
        n: row.weak, type: typeName(row.type, lang),
        resistText: row.resist === 0 ? t(lang, 'rating.redundancy.noneResist') : t(lang, 'rating.redundancy.someResist', { n: row.resist }),
      }),
      points: (row.weak - row.resist - 1) * 2,
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
  // I 18 tipi pesano uguale (il meta del mese non cambia le coverage); l'Offesa invece si misura contro i difensori del meta, se attivo
  const weights = UNIFORM_TYPE_WEIGHTS;

  const rules = rulesOf(data);
  const memberRoles = team.map(set => teamRoles(set, rules));
  // Stall riconosciuto "senza esagerare": a metà tra la valutazione normale e quella da stall
  const archetype = isStall(team, memberRoles) ? 'stall' as const : null;
  // Nello stall un muro passivo non deve fare danni: conta la sua robustezza, e i suoi colpi valgono pieni
  const passive = archetype ? team.map((set, i) => isPassive(set, memberRoles[i])) : [];

  // Ruoli richiesti in base all'archetipo del team (uno stall non ha bisogno di sweeper, un hyper offense di wall),
  // più quanti compiti copre ogni membro: nei team da torneo ognuno fa 2-3 cose
  const jobs = sum(team.map(set => NEEDS.filter(need => meetsNeed(need, set, rules)).length)) / team.length;
  const roles = (1 - ROLE_COMPRESSION) * needCoverage(analysis.needs) + ROLE_COMPRESSION * Math.min(1, jobs / FULL_JOBS);
  const power = teamPower(team, passive, rules);
  const offense = teamOffense(team, data);
  const defense = teamDefense(team, data);
  const trickRoom = team.some(set => set.moves.some(move => toID(move) === 'trickroom'));
  // I pesi dal tipo di team (un team incompleto si giudica come balance); con Trick Room la Velocità non conta
  const table = ARCHETYPE_WEIGHTS[analysis.needs.archetype];
  const effective: Record<BaseArea, number> = trickRoom ? { ...table, speed: 0 } : table;
  // Velocità: col meta contro le minacce più usate, senza contro tutti i Pokémon
  // Velocità: contro il riferimento del formato, uguale col meta e senza (il meta conta solo nell'area Meta)
  const speed = teamSpeed(team, data);

  // Offesa e Difesa dal danno vero (offense.ts, defense.ts)
  const attack = offense.members.length ? offense.value / 100 : null;
  const raw: Record<BaseArea, number | null> = {
    defense: defense.members.length ? defense.value / 100 : null, strength: attack,
    roles: Math.min(1, roles), speed: Math.min(1, speed),
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
    // Informazione per l'Analisi: nel voto le minacce stanno nella Coverage meta della Difesa
  }
  const areas = (Object.keys(raw) as (keyof typeof raw)[])
    // Con uno stall o Trick Room la Velocità non conta e non si mostra
    .filter(key => (areaWeights[key] ?? 0) > 0)
    .map(key => ({
      key,
      label: t(lang, `area.${key}`),
      value: raw[key] === null ? null : Math.round(100 * raw[key]!),
    }));
  const base = Math.round(100 * score);
  const redundant = redundancies(team, analysis, lang);
  // Niente più penalità del meta: le minacce scoperte abbassano la Coverage meta della Difesa
  const penalty = redundant;
  const weather = weatherBonus(team, lang);
  const tera = teraBonus(team, analysis, rules.teraBonusCap, lang);
  const bonus = { total: Math.min(MAX_BONUS, weather.total + sum(tera.map(i => i.points))), items: [...weather.items, ...tera] };
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  return {
    base, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: team.length < 6, areas, archetype, meta,
    teamType: analysis.needs.archetype, trickRoom,
    weights: areaWeights, offense, defense,
  };
}

