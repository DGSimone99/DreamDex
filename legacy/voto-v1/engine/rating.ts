import { analyzeTeam, threatScore, UNIFORM_TYPE_WEIGHTS, usesMeta, type TeamAnalysis } from './analysis';
import type { EngineData } from './data';
import { battleAbility, battleName, battleSpecies, toID } from './dex';
import { hitQuality, memberPower, teamPower, type MemberPower } from './power';
import { teamOffense, type TeamOffense } from './offense';
import { teamDefense, type TeamDefense } from './defense';
import { BALANCE_SPAN, resistPoints, typeSafety } from './typeSafety';

export { BALANCE_SPAN, resistPoints, typeSafety };
import type { Archetype } from './archetype';
import { hasSpeedControl, isPassive, isStall } from './roles';
import { rulesOf } from './formatRules';
import type { TeamNeeds } from './needs';
import { FAMILIES, type SubRoleValues } from './subRoles';
import { ESSENTIAL_POINTS, ONE_STYLE_POINTS, teamRolesArea, type TeamRoles } from './rolesArea';
import { teamSpeedArea, type TeamSpeed } from './speedArea';
import { strengthComponent } from './scoring';
import { usageOf } from './stats';
import type { TeamSet } from './sets';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { effectiveness, superEffectiveMoves, teamField, TYPES } from './types';
import { conditionConflicts, conditionLabel, enables, viaName, unmetBeneficiaries, unusedEnablers, weakenedMoves, weatherMitigations, type Condition } from './synergy';

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
 * Un hyper offense su Offesa e Velocità, uno stall su Difesa e Ruoli (hazard, rimozione, recupero);
 * il balance tiene tutto quasi alla pari.
 * Un team incompleto si giudica come balance. Trick Room è una condizione della Velocità (speedArea.ts).
 */
export const ARCHETYPE_WEIGHTS: Record<Archetype, Record<BaseArea, number>> = {
  // L'Offesa ha preso il peso della vecchia Coverage offensiva, la Difesa quello di Coverage difensiva e Robustezza.
  // 2026-10-31: Difesa dimezzata in HO, BO e balance. Sul banco la Difesa dà lo stesso numero ai team da torneo e a
  // quelli medi (75 contro 76: distingue solo i brutti), mentre Offesa, Ruoli e Velocità li separano; col peso spostato
  // il distacco torneo − medio sale da 7,1 a 8,0 e le partite vere da 52,7% a 53,0%. Semi-stall e stall come prima.
  hyperOffense: { defense: 10, strength: 52, roles: 16, speed: 22 },
  bulkyOffense: { defense: 16, strength: 48, roles: 18, speed: 18 },
  balance: { defense: 22, strength: 42, roles: 22, speed: 14 },
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



/** Nelle minacce gestite: quota delle 3 più usate (il resto: tutte, pesate per uso). */
export const TOP_THREATS = 0.5;

/**
 * Soglie tarate sul banco col meta (2026-10-31, scripts/bench): team da torneo mediana 80 (S il 5%, A il 57%),
 * team veri del ladder medio (rating 1100–1400) mediana 75 (B il 57%), team brutti tutti sotto 55.
 * S = tra i migliori team da torneo, A = livello torneo, B = il team tipico di un giocatore medio, C = buchi evidenti, D = debole.
 */
export const GRADES: { min: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' }[] = [
  { min: 86, grade: 'S' },
  { min: 79, grade: 'A' },
  { min: 68, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 0, grade: 'D' },
];

export interface RatingArea {
  key: AreaKey;
  label: string;
  /** 0–100, o null se mancano i dati per calcolarla. */
  value: number | null;
  /** Ha un valore ma peso 0 nel voto (oggi solo la Velocità nello stall): si mostra in grigio. */
  inactive?: boolean;
}

/** Chiave della voce del catalogo bonus/malus a cui appartiene una voce del voto. */
export type CatalogKey = 'sharedWeak' | 'hazardDuplicate' | 'removers' | 'weatherClash' | 'weakenedMove' | 'unmetCondition' | 'unusedEnabler'
  | 'weakMember' | 'essentialRole' | 'oneStyle' | 'trickRoomFast' | 'weatherHelp' | 'tera';

export interface Redundancy {
  text: string;
  points: number;
  /** Assente nelle voci solo-coach (stesso tipo): non fanno parte del voto. */
  catalog?: CatalogKey;
  /** Identità della voce senza nomi né conteggi (chiave del problema nel coaching), dove il testo non basta. */
  key?: string;
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
  /** Tetto del bonus Tera nel formato (0 fuori dalla Gen 9): serve al catalogo bonus/malus. */
  teraCap: number;
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
  /** Il team usa Trick Room (premia i membri lenti nella Velocità; in un team veloce è un malus). */
  trickRoom: boolean;
  /** Dettaglio dell'area Meta, o null se il voto è senza meta. */
  meta: MetaScore | null;
  /** Peso di ogni area nel voto (somma 1); il Meta non pesa, è una penalità. */
  weights: Partial<Record<AreaKey, number>>;
  /** Offesa: danno vero dei set contro i difensori del formato, con le sottostatistiche per membro. */
  offense: TeamOffense;
  /** Difesa: robustezza, sostenibilità e coverage difensiva di tipi e del meta, con le sottostatistiche per membro. */
  defense: TeamDefense;
  /** Velocità: ogni membro coi guadagni (setup, meteo, priorità) e il controllo velocità del team. */
  speed: TeamSpeed;
  /** Ruoli: voci importanti e minori dell'archetipo coi valori del team, e le mancanze essenziali (penalità). */
  roles: TeamRoles;
  /** Bisogni del team (tipo, livelli e valori dei Ruoli) con cui si è calcolato il voto. */
  needs: TeamNeeds;
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

/** Un setter in più dello stesso hazard costa 1 punto. */
export const HAZARD_DUPLICATE = 1;
/** Ogni rimuovitore di hazard oltre il primo costa 1 punto. */
export const REMOVER_EXTRA_POINTS = 1;
/** Meteo o campi in conflitto costano 3 punti. */
export const WEATHER_CLASH_POINTS = 3;
/** Un attivatore (meteo, campo, Trick Room) che nessun compagno usa costa 2 punti. */
export const UNUSED_ENABLER_POINTS = 2;

/**
 * Ruoli ripetuti senza bisogno: stesso hazard, più rimozioni. Con `sameType` anche i 3+ membri dello stesso tipo:
 * nel voto non è una penalità (lo misura la Difesa), ma il coach lo consiglia ancora.
 */
export function roleAndTypeRedundancies(team: TeamSet[], lang: Lang = 'it', opts: { sameType?: boolean } = {}): Redundancy[] {
  const items: Redundancy[] = [];
  const setters = new Map<string, number>();
  for (const set of team) {
    for (const hazard of new Set(set.moves.map(m => HAZARDS[toID(m)]).filter(Boolean))) {
      setters.set(hazard, (setters.get(hazard) ?? 0) + 1);
    }
  }
  for (const [hazard, n] of setters) if (n > 1) items.push({ text: t(lang, 'rating.redundancy.setters', { n, hazard: gameName('move', hazard, lang) }), points: HAZARD_DUPLICATE * (n - 1), catalog: 'hazardDuplicate' });
  const removers = team.filter(set => set.moves.some(m => REMOVAL.has(toID(m)))).length;
  if (removers > 1) items.push({ text: t(lang, 'rating.redundancy.removers', { n: removers }), points: (removers - 1) * REMOVER_EXTRA_POINTS, catalog: 'removers' });
  for (const type of opts.sameType ? TYPES : []) {
    const n = team.filter(set => (battleSpecies(set)?.types as readonly string[] | undefined)?.includes(type)).length;
    if (n >= 3) items.push({ text: t(lang, 'rating.redundancy.sameType', { n, type: typeName(type, lang) }), points: n - 2 });
  }
  return items;
}

/** Una mossa STAB indebolita dal meteo del team costa di più di una di coverage. */
export const WEATHER_HURT_STAB = 2;

/** Meteo/campi in conflitto (−3) e per ogni membro con mosse indebolite dal meteo del team −2 (STAB) o −1 (coverage). */
export function weatherClashes(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return [
    ...conditionConflicts(team, lang).map(c => ({ text: t(lang, 'rating.redundancy.conflict', { kind: t(lang, `conflict.${c.kind}`), list: c.setters.join(', ') }), points: WEATHER_CLASH_POINTS, catalog: 'weatherClash' as const, key: `conflict:${c.kind}` })),
    ...weakenedMoves(team).map(w => ({
      text: t(lang, 'rating.redundancy.weakens', { condition: cap(conditionLabel(w.condition, lang)), setter: w.setter, type: typeName(w.type, lang), member: w.member }),
      points: w.stab ? WEATHER_HURT_STAB : WEATHER_HURT,
      catalog: 'weakenedMove' as const,
      key: `weakens:${w.condition}:${w.member}:${w.type}`,
    })),
  ];
}

/** Trick Room rallenta un membro che supera da solo almeno questa quota del meta; il malus si ferma a −3. */
export const TRICK_ROOM_FAST = 0.5;
/** Ogni membro veloce sotto Trick Room costa 1 punto. */
export const TRICK_ROOM_FAST_POINTS = 1;
export const TRICK_ROOM_MAX = 3;

/** Forza sotto cui un membro senza utilità chiave è considerato debole. */
export const WEAK_POWER = 30;
/** Valore minimo di un sotto-ruolo di Campo o Disturbo perché un Pokémon debole porti un'utilità chiave. */
export const UTILITY_MIN = 0.5;
const UTILITY_ROLES = [...FAMILIES.field, ...FAMILIES.disruption];

/**
 * Il membro porta un'utilità chiave: un sotto-ruolo di Campo o Disturbo (Delibird con Spikes), il controllo velocità
 * (Sticky Web, Thunder Wave, Tailwind…: lo misura la Velocità, ma giustifica un membro debole), o meteo, campo, Trick Room.
 */
function bringsUtility(set: TeamSet, values: SubRoleValues): boolean {
  return UTILITY_ROLES.some(role => (values[role] ?? 0) >= UTILITY_MIN) || hasSpeedControl(set) || enables(set).length > 0;
}

/** Ogni membro debole senza utilità chiave costa 2 punti, fino a un massimo di 6. */
export const WEAK_MEMBER_POINTS = 2;
export const WEAK_MEMBER_MAX = 6;

/**
 * Membri deboli senza utilità chiave (−2 ciascuno, al massimo −6; non dipende dal meta: Pelipper che porta la pioggia è esente).
 * Ditto con Imposter è esente: copia l'avversario, le sue statistiche base non dicono nulla.
 * Lo squilibrio degli attaccanti è una mancanza essenziale dei Ruoli (rolesArea.ts).
 */
export function memberIssues(team: TeamSet[], lang: Lang, needs: TeamNeeds): Redundancy[] {
  const { rules } = needs;
  const items: Redundancy[] = [];
  let total = 0;
  for (const [i, set] of team.entries()) {
    if (toID(battleAbility(set)) === 'imposter') continue;
    const power = memberPower(set);
    // Un muro passivo si giudica dalla sua robustezza (Mega Sableye), gli altri dalla forza complessiva
    if (power && (isPassive(set, rules) ? power.bulk : power.power) < WEAK_POWER && !bringsUtility(set, needs.members[i] ?? {})) {
      // Oltre il tetto i membri restano elencati ma senza punti
      const points = Math.min(WEAK_MEMBER_POINTS, WEAK_MEMBER_MAX - total);
      total += points;
      items.push({ text: t(lang, 'rating.redundancy.weakMember', { member: battleName(set) }), points, catalog: 'weakMember' });
    }
  }
  return items;
}

/**
 * Debolezze condivise: 2 punti per ogni membro debole oltre il primo, solo sui tipi a cui nessuno nel team resiste:
 * un membro che resiste è il cambio normale su quella debolezza (2026-10-30: "3 deboli, 1 resiste" colpiva metà dei
 * team da torneo). Tolte e poi rimesse dall'utente il 2026-10-25 dopo il bench: portano il distacco tra torneo e medi.
 */
export const SHARED_WEAK_POINTS = 2;
/** Un membro che ha bisogno di una condizione (meteo, campo, Trick Room) che il team non porta: −3. */
export const UNMET_POINTS = 3;

export function redundancies(team: TeamSet[], analysis: TeamAnalysis, lang: Lang = 'it'): Redundancies {
  // Il meta conta solo nell'area Meta: le debolezze si contano su tutti i tipi
  const weaknesses = analysis.weakness
    .filter(row => row.resist === 0 && row.weak >= 2)
    .map(row => ({
      text: t(lang, 'rating.redundancy.sharedWeak', { n: row.weak, type: typeName(row.type, lang), resistText: t(lang, 'rating.redundancy.noneResist') }),
      points: (row.weak - 1) * SHARED_WEAK_POINTS,
      catalog: 'sharedWeak' as const,
    }));
  const dependencies = [
    ...unmetBeneficiaries(team).map(i => ({ text: t(lang, 'rating.redundancy.unmet', { member: i.member, via: viaName(i.via, lang), condition: conditionLabel(i.condition, lang) }), points: UNMET_POINTS, catalog: 'unmetCondition' as const })),
    ...unusedEnablers(team).map(i => ({ text: t(lang, 'rating.redundancy.unused', { via: viaName(i.via, lang), member: i.member }), points: UNUSED_ENABLER_POINTS, catalog: 'unusedEnabler' as const })),
  ];
  const items = [
    ...weaknesses, ...roleAndTypeRedundancies(team, lang), ...dependencies, ...weatherClashes(team, lang),
    ...memberIssues(team, lang, analysis.needs),
  ];
  return { total: Math.min(MAX_PENALTY, sum(items.map(i => i.points))), items };
}


const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Il meteo/campo del team vale +1 se smorza una debolezza ad almeno un compagno, comunque e a quanti. */
export const WEATHER_HELP = 1;
export const WEATHER_HURT = 1;

/**
 * +1 una volta sola se il meteo o il campo che il team porta smorza una debolezza di un compagno
 * (da 2× a neutro o da 4× a 1×, mai da 4× a 2×). Il setter non conta e abilitare un'abilità o una
 * mossa non dà bonus: il meteo non è sempre attivo, quindi non conta quanti ne godono.
 */
export function weatherBonus(team: TeamSet[], lang: Lang = 'it'): Redundancies {
  const items: Redundancy[] = [];
  for (const m of weatherMitigations(team)) {
    const setter = m.source.split(' (')[0];
    const members = m.members.filter(x => x.to <= 1 && x.species !== setter).map(x => x.species);
    if (!members.length) continue;
    items.push({
      text: t(lang, 'rating.bonus.helps', { condition: capitalize(conditionLabel(m.condition as Condition, lang)), setter, list: members.join(', ') }),
      points: 0,
      catalog: 'weatherHelp',
    });
  }
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
    items.push({ text: t(lang, 'rating.bonus.tera', { tera: typeName(member.teraType!, lang), member: battleName(member), type: typeName(row.type, lang) }), points: 1, catalog: 'tera' });
    if (items.length === cap) break;
  }
  return items;
}

export function gradeFor(score: number, lang: Lang = 'it'): { grade: string; label: string } {
  const { grade } = GRADES.find(g => score >= g.min)!;
  return { grade, label: t(lang, `grade.${grade}`) };
}

/** Opzioni del voto: `archetype` giudica il team come quel tipo (pesi, livelli dei ruoli, modalità stall), anche se è riconosciuto come un altro. */
export interface RateOptions {
  archetype?: Archetype;
}

export function rateTeam(team: TeamSet[], data: EngineData, lang: Lang = 'it', opts: RateOptions = {}): TeamRating | null {
  if (team.length === 0) return null;
  const analysis = analyzeTeam(team, data, opts.archetype);
  // I 18 tipi pesano uguale (il meta del mese non cambia le coverage); l'Offesa invece si misura contro i difensori del meta, se attivo
  const weights = UNIFORM_TYPE_WEIGHTS;

  const rules = rulesOf(data);
  // Stall riconosciuto "senza esagerare": a metà tra la valutazione normale e quella da stall
  const stallMode = opts.archetype ? opts.archetype === 'stall' : isStall(team, rules);
  const archetype = stallMode ? 'stall' as const : null;
  // Nello stall un muro passivo non deve fare danni: conta la sua robustezza, e i suoi colpi valgono pieni
  const passive = archetype ? team.map(set => isPassive(set, rules)) : [];

  // Ruoli: base delle voci importanti ed extra delle minori sui valori del team (rolesArea.ts)
  const roles = teamRolesArea(team, data, lang, analysis.needs);
  const power = teamPower(team, passive, rules);
  const offense = teamOffense(team, data);
  const defense = teamDefense(team, data);
  const trickRoom = team.some(set => set.moves.some(move => toID(move) === 'trickroom'));
  // I pesi dal tipo di team (un team incompleto si giudica come balance)
  const table = ARCHETYPE_WEIGHTS[analysis.needs.archetype];
  // Trick Room non azzera più la Velocità: è una sua condizione (speedArea.ts), che premia i membri lenti
  const effective: Record<BaseArea, number> = table;
  // Velocità: ogni membro coi guadagni suoi e del controllo del team (speedArea.ts); col meta contro i più usati
  const speed = teamSpeedArea(team, data);

  // Offesa e Difesa dal danno vero (offense.ts, defense.ts)
  const attack = offense.members.length ? offense.value / 100 : null;
  const raw: Record<BaseArea, number | null> = {
    defense: defense.members.length ? defense.value / 100 : null, strength: attack,
    roles: roles.members.length ? roles.value / 100 : null, speed: speed.members.length ? speed.value / 100 : null,
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
    // Con uno stall la Velocità non conta nel voto ma resta visibile (inattiva); senza dati l'area non c'è
    .filter(key => raw[key] !== null)
    .map(key => ({
      key,
      label: t(lang, `area.${key}`),
      value: Math.round(100 * raw[key]!),
      ...(!((areaWeights[key] ?? 0) > 0) && { inactive: true }),
    }));
  const base = Math.round(100 * score);
  const redundant = redundancies(team, analysis, lang);
  // Niente più penalità del meta: le minacce scoperte abbassano la Coverage meta della Difesa.
  // Trick Room in un team veloce: −1 per ogni membro che supera da solo almeno metà del meta (sotto Trick Room perde), fino a −3
  const roomSetter = team.find(set => set.moves.some(move => toID(move) === 'trickroom'));
  const fastMembers = roomSetter ? speed.members.filter(m => m.raw >= TRICK_ROOM_FAST) : [];
  const roomItems = fastMembers.length
    ? [{ text: t(lang, fastMembers.length === 1 ? 'rating.redundancy.trickRoomFastOne' : 'rating.redundancy.trickRoomFast', { setter: battleName(roomSetter!), n: fastMembers.length, list: fastMembers.map(m => m.species).join(', ') }), points: Math.min(TRICK_ROOM_MAX, fastMembers.length * TRICK_ROOM_FAST_POINTS), catalog: 'trickRoomFast' as const }]
    : [];
  // Le mancanze essenziali dei Ruoli (solo team di 6) si sommano alle altre penalità, entro il massimo
  const extraItems = [...roles.failures, ...roomItems];
  const penalty = extraItems.length
    ? { total: Math.min(MAX_PENALTY, redundant.total + sum(extraItems.map(i => i.points))), items: [...redundant.items, ...extraItems] }
    : redundant;
  const weather = weatherBonus(team, lang);
  const tera = teraBonus(team, analysis, rules.teraBonusCap, lang);
  const bonus = { total: Math.min(MAX_BONUS, weather.total + sum(tera.map(i => i.points))), items: [...weather.items, ...tera] };
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  return {
    base, teraCap: rules.teraBonusCap, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: team.length < 6, areas, archetype, meta,
    teamType: analysis.needs.archetype, trickRoom, needs: analysis.needs,
    weights: areaWeights, offense, defense, speed, roles,
  };
}


export interface CatalogEntry {
  key: CatalogKey;
  kind: 'malus' | 'bonus';
  name: string;
  when: string;
  points: string;
  /** Falso se la regola non vale nel formato (il Tera fuori dalla Gen 9). */
  applies: boolean;
}

const CATALOG_ORDER: { key: CatalogKey; kind: 'malus' | 'bonus' }[] = [
  ...(['sharedWeak', 'hazardDuplicate', 'removers', 'weatherClash', 'weakenedMove', 'unmetCondition', 'unusedEnabler', 'weakMember', 'essentialRole', 'oneStyle', 'trickRoomFast'] as const)
    .map(key => ({ key, kind: 'malus' as const })),
  ...(['weatherHelp', 'tera'] as const).map(key => ({ key, kind: 'bonus' as const })),
];

/** Tutti i bonus e malus possibili, con il testo per il modale; i punti nei testi vengono dalle costanti. */
export function bonusMalusCatalog(lang: Lang, teraCap: number): CatalogEntry[] {
  const values = {
    shared: SHARED_WEAK_POINTS, unmet: UNMET_POINTS, hazard: HAZARD_DUPLICATE, hurt: WEATHER_HURT, hurtStab: WEATHER_HURT_STAB, member: WEAK_MEMBER_POINTS, memberMax: WEAK_MEMBER_MAX,
    essential: ESSENTIAL_POINTS, style: ONE_STYLE_POINTS, room: TRICK_ROOM_MAX, roomEach: TRICK_ROOM_FAST_POINTS, remover: REMOVER_EXTRA_POINTS, clash: WEATHER_CLASH_POINTS, unused: UNUSED_ENABLER_POINTS,
    help: WEATHER_HELP, cap: teraCap,
  };
  return CATALOG_ORDER.map(({ key, kind }) => ({
    key, kind,
    name: t(lang, `catalog.${key}.name`, values),
    when: t(lang, `catalog.${key}.when`, values),
    points: t(lang, `catalog.${key}.points`, values),
    applies: key !== 'tera' || teraCap > 0,
  }));
}
