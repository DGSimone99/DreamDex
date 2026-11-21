import { analyzeTeam, UNIFORM_TYPE_WEIGHTS, usesMeta, type TeamAnalysis, type ThreatRow } from './analysis';
import type { EngineData } from './data';
import { battleAbility, battleName, battleSpecies, dex, getMove, toID } from './dex';
import { hitQuality, memberPower, teamPower, type MemberPower } from './power';
import { teamOffense, type TeamOffense } from './offense';
import { teamDefense, type TeamDefense } from './defense';
import { BALANCE_SPAN, resistPoints, typeSafety } from './typeSafety';

export { BALANCE_SPAN, resistPoints, typeSafety };
import { typeMix, type Archetype, type TypeMix } from './archetype';
import { isPassive, isStall } from './roles';
import { hitRules, isOneType, rulesOf, type FormatRules } from './formatRules';
import type { TeamNeeds } from './needs';
import { FAMILIES, hasDoublesRole, type SubRoleValues } from './subRoles';
import { PIVOT_POINTS, pivotLinks, type PivotParts } from './pivotBonus';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS, teamRolesArea, type TeamRoles } from './rolesArea';
import { teamSpeedArea, type TeamSpeed } from './speedArea';
import { usageOf } from './stats';
import type { TeamSet } from './sets';
import { lockedStatusMoves, withUsableMoves } from './lockedMoves';
import { t, type Lang } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { teamField, TYPES } from './types';
import { benefits, conditionConflicts, conditionLabel, enables, teamEnabler, usesCondition, viaName, unmetBeneficiaries, unusedEnablers, sabotagedMembers, weakenedMoves, weatherMitigations, type Condition } from './synergy';
import { heldByOf, teamCores, type Core, type HeldBy } from './cores';
import { blockedReason, voteTeam } from './legalTeam';
import { unheldDuels, type DuelRow } from './duel';

export type AreaKey = 'coverage' | 'defense' | 'strength' | 'bulk' | 'roles' | 'speed' | 'meta';
/** Le aree del voto senza meta. */
/**
 * La Coverage offensiva è una sottostatistica dell'Offesa (offense.ts); Robustezza, Coverage difensiva e Meta
 * sono parti della Difesa (defense.ts).
 */
export type BaseArea = Exclude<AreaKey, 'meta' | 'coverage' | 'bulk' | 'roles'>;
/** Nell'ordine del pannello: Difesa, Offesa e Velocità (i Ruoli sono una lista: malus e bonus, rolesArea.ts). */
const BASE_AREAS: BaseArea[] = ['defense', 'strength', 'speed'];

/**
 * Peso di ogni area secondo il tipo di team (somma 100): ognuno si giudica su quello con cui vince.
 * Un hyper offense su Offesa e Velocità, uno stall soprattutto sulla Difesa (i Ruoli non hanno peso: contano come malus e bonus);
 * il balance tiene tutto quasi alla pari.
 * Un team incompleto si giudica come balance. Trick Room è una condizione della Velocità (speedArea.ts).
 */
export const ARCHETYPE_WEIGHTS: Record<Archetype, Record<BaseArea, number>> = {
  // Tutti i formati tranne National Dex OU (NATDEX_OU_WEIGHTS).
  // L'Offesa ha preso il peso della vecchia Coverage offensiva, la Difesa quello di Coverage difensiva e Robustezza.
  // 2026-10-31: Difesa dimezzata in HO, BO e balance. Sul banco la Difesa dà lo stesso numero ai team da torneo e a
  // quelli medi (75 contro 76: distingue solo i brutti), mentre Offesa, Ruoli e Velocità li separano; col peso spostato
  // il distacco torneo − medio sale da 7,1 a 8,0 e le partite vere da 52,7% a 53,0%. Semi-stall e stall come prima.
  // 2026-11-02: i Ruoli diventano una lista (malus e bonus) e il loro peso si divide in proporzione fra le altre tre.
  // 2026-11-03 (test dei pesi): balance più difensivo (era 28/54/18: il tipo giudicato peggio, 16% di A fra i team da
  // torneo, perché giudicato per metà sull'Offesa dove fa 72); stall con meno Difesa e un po' di Velocità (era 76/24/0:
  // bastava essere uno stall per prendere A, anche sul ladder). HO, BO e semi-stall provati e lasciati.
  hyperOffense: { defense: 12, strength: 62, speed: 26 },
  bulkyOffense: { defense: 20, strength: 58, speed: 22 },
  balance: { defense: 40, strength: 45, speed: 15 },
  semiStall: { defense: 57, strength: 33, speed: 10 },
  stall: { defense: 65, strength: 25, speed: 10 },
  doubles: { defense: 1 / 3, strength: 1 / 3, speed: 1 / 3 },
};

export type AreaWeightTable = Record<Archetype, Record<BaseArea, number>>;

/**
 * National Dex OU (typeRule 'recoverySpeed', 2026-11-05), col tipo riconosciuto dal recupero e dalla velocità:
 * una scala regolare, perché due tipi vicini hanno pesi vicini e uno sbaglio di un passo costa poco (prima la Difesa
 * saltava da 20 a 40 fra BO e Balance). Sul banco fra torneo e ladder cambia solo la Difesa (68 contro 61, anche negli HO),
 * ma nelle partite vere vince più spesso chi ha più Offesa: una via di mezzo. Separazione torneo/ladder da 1,00 a 1,16,
 * dentro lo stesso tipo da 1,11 a 1,23, partite vere 54,4% → 54,5%; A o S fra i team da torneo HO 60%, BO 59%, Balance 68%.
 * 2026-11-13: HO 25/50/25, BO 30/50/20, Balance 40/40/20 (era 20/50/30, 30/45/25, 45/40/15), insieme alle nuove quote di
 * Offesa e Difesa, alla profondità 70/20/10 e senza il punto fisso per membro: su 710 team il livello resta quello di
 * prima (torneo 81,5 → 81,4, ladder 74,4 → 74,5), partite vere 52,7% → 53,2%.
 */
export const NATDEX_OU_WEIGHTS: AreaWeightTable = {
  hyperOffense: { defense: 25, strength: 50, speed: 25 },
  bulkyOffense: { defense: 30, strength: 50, speed: 20 },
  balance: { defense: 40, strength: 40, speed: 20 },
  // 2026-11-07: semi-stall come lo stall (era 55/35/10). Col 35 all'Offesa 5 team da torneo su 13 prendevano C; a 65/25
  // ne resta 1, il resto del banco non si muove e il salto fra stall e semi-stall si accorcia (stessi pesi, restano i
  // Ruoli diversi). Il 55% di vittorie nelle partite visto allora veniva da un solo team ripetuto (letto Semi-stall quando
  // vince, Stall quando perde): contando ogni team una volta il semi-stall vince circa il 50% (controllo 2026-11-08).
  semiStall: { defense: 65, strength: 25, speed: 10 },
  stall: { defense: 65, strength: 25, speed: 10 },
  doubles: { defense: 1 / 3, strength: 1 / 3, speed: 1 / 3 },
};

/**
 * Doppio (2026-11-21): un tipo solo, le tre aree a un terzo ciascuna (scelta dell'autore: in doppio i team puntano tutti
 * sull'equilibrio; sulle partite i tipi del singolo non separavano niente). Un set fisso: nessun riconoscimento di tipi,
 * nessuna miscela.
 */
const DOUBLES_THIRDS: Record<BaseArea, number> = ARCHETYPE_WEIGHTS.doubles;
let DOUBLES_WEIGHTS: AreaWeightTable = NATDEX_OU_WEIGHTS;
/** Per test e bench (confronto dei pesi del doppio): `null` rimette i terzi. Non va cambiato a runtime nell'interfaccia. */
export function setDoublesWeights(w: Record<BaseArea, number> | null): void {
  DOUBLES_WEIGHTS = { ...NATDEX_OU_WEIGHTS, doubles: w ?? DOUBLES_THIRDS };
}

/** I pesi delle aree del formato: quelli di National Dex OU con la sua regola dei tipi, il set fisso del doppio, altrimenti quelli di sempre. */
export const areaWeightTable = (rules: FormatRules): AreaWeightTable =>
  isOneType(rules) ? DOUBLES_WEIGHTS : rules.typeRule === 'recoverySpeed' ? NATDEX_OU_WEIGHTS : ARCHETYPE_WEIGHTS;





/**
 * Soglie tarate sul banco col meta (2026-10-31, scripts/bench): team da torneo mediana 80 (S il 5%, A il 57%),
 * team veri del ladder medio (rating 1100–1400) mediana 75 (B il 57%), team brutti tutti sotto 55.
 * S = tra i migliori team da torneo, A = livello torneo, B = il team tipico di un giocatore medio, C = buchi evidenti, D = debole.
 */
export const GRADES: { min: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' }[] = [
  { min: 90, grade: 'S' },
  { min: 80, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 0, grade: 'D' },
];

export interface RatingArea {
  key: AreaKey;
  label: string;
  /** 0–100, o null se mancano i dati per calcolarla. */
  value: number | null;
  /** Ha un valore ma peso 0 nel voto (oggi nessuna area: lo stall ha Velocità 10): si mostrerebbe in grigio. */
  inactive?: boolean;
}

/** Chiave della voce del catalogo bonus/malus a cui appartiene una voce del voto. */
export type CatalogKey = 'sharedWeak' | 'sameType' | 'hazardDuplicate' | 'weatherClash' | 'unmetCondition' | 'unusedEnabler'
  | 'weakMember' | 'lockedStatus' | 'essentialRole' | 'importantRole' | 'trickRoomFast' | 'defenseHole' | 'unanswered'
  | 'coreTrio' | 'minorRole' | 'pivotLink' | 'weakCovered' | 'typeVariety' | 'conditionUsed' | 'weatherHelp' | 'weatherSabotage';

export interface Redundancy {
  text: string;
  points: number;
  /** Assente nelle voci solo-coach: non fanno parte del voto. */
  catalog?: CatalogKey;
  /** Identità della voce senza nomi né conteggi (chiave del problema nel coaching), dove il testo non basta. */
  key?: string;
  /**
   * I pezzi che cambiano nel testo (tipo, membro, mosse… già nella lingua scelta): servono alla scheda Bonus/Malus per
   * scrivere il caso corto, senza ripetizioni, quando quello lungo non sta nella medaglia (src/ui/bonusMalusShort.ts).
   */
  parts?: Record<string, string>;
}

export interface Redundancies {
  total: number;
  items: Redundancy[];
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
  /** Meno di 6 specie riconosciute: i ruoli mancanti non tolgono punti (si mostrano senza rosso). */
  provisional: boolean;
  /** Avviso "Voto provvisorio" (giallo): specie, mosse o strumenti sconosciuti, membri senza mosse. Il voto non cambia. */
  notes: string[];
  areas: RatingArea[];
  /** Stall riconosciuto: i membri passivi si giudicano dalla robustezza nella forza mostrata (non cambia i pesi né i ruoli). */
  archetype: 'stall' | null;
  /** Tipo di team con cui si sono scelti i pesi delle aree (balance per un team incompleto). */
  teamType: Archetype;
  /** Vicino a una soglia (solo National Dex OU): il tipo accanto e la sua quota nel voto (riga "Vicino a…"), altrimenti null. */
  typeMix: TypeMix | null;
  /** Il team usa Trick Room (premia i membri lenti nella Velocità; in un team veloce è un malus). */
  trickRoom: boolean;
  /** Il voto usa il meta (statistiche presenti e modalità senza meta non scelta). */
  meta: boolean;
  /** Peso di ogni area nel voto (somma 1); il Meta non pesa, è una penalità. */
  weights: Partial<Record<AreaKey, number>>;
  /** La tabella dei pesi per tipo usata dal formato (per la guida del voto). */
  weightTable: AreaWeightTable;
  /** Offesa: danno vero dei set contro i difensori del formato, con le sottostatistiche per membro. */
  offense: TeamOffense;
  /** Difesa: robustezza, Recupero e coverage difensiva di tipi e del meta, con le sottostatistiche per membro. */
  defense: TeamDefense;
  /** Velocità: ogni membro coi guadagni (setup, meteo, priorità) e il controllo velocità del team. */
  speed: TeamSpeed;
  /** Ruoli: voci importanti e minori dell'archetipo coi valori del team, e le mancanze essenziali (penalità). */
  roles: TeamRoles;
  /** Bisogni del team (tipo, livelli e valori dei Ruoli) con cui si è calcolato il voto. */
  needs: TeamNeeds;
  /** I core a tre che il voto conta (al massimo due), nell'ordine del bonus: la scheda Bonus/Malus li disegna. */
  cores: Core[];
}


const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Niente tetti (2026-11-01, scelta dell'utente): penalità e bonus sono la somma delle loro voci.

const HAZARDS: Record<string, string> = {
  stealthrock: 'Stealth Rock', stoneaxe: 'Stealth Rock',
  spikes: 'Spikes', ceaselessedge: 'Spikes',
  toxicspikes: 'Toxic Spikes',
  stickyweb: 'Sticky Web',
};

/** Un setter in più dello stesso hazard costa 1 punto. */
export const HAZARD_DUPLICATE = 1;
/** Meteo o campi in conflitto costano 3 punti. */
export const WEATHER_CLASH_POINTS = 3;
/** Un attivatore (meteo, campo, Trick Room) che nessun compagno usa costa 2 punti. */
export const UNUSED_ENABLER_POINTS = 2;
/** Ogni membro oltre il secondo dello stesso tipo costa 1 punto (3% dei team da torneo, 20% della ladder). */
export const SAME_TYPE_POINTS = 1;

/**
 * Ruoli ripetuti senza bisogno: stesso hazard e i 3+ membri dello stesso tipo (−1 per ogni membro oltre il secondo).
 * Le rimozioni doppie non costano più (2026-11-08): chi le ha vince come gli altri, e togliere la seconda alzava il voto.
 */
export function roleAndTypeRedundancies(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const items: Redundancy[] = [];
  const setters = new Map<string, number>();
  for (const set of team) {
    for (const hazard of new Set(set.moves.map(m => HAZARDS[toID(m)]).filter(Boolean))) {
      setters.set(hazard, (setters.get(hazard) ?? 0) + 1);
    }
  }
  for (const [hazard, n] of setters) if (n > 1) items.push({ text: t(lang, 'rating.redundancy.setters', { n, hazard: gameName('move', hazard, lang) }), points: HAZARD_DUPLICATE * (n - 1), catalog: 'hazardDuplicate', parts: { n: String(n), hazard: gameName('move', hazard, lang) } });
  for (const type of TYPES) {
    const n = team.filter(set => (battleSpecies(set)?.types as readonly string[] | undefined)?.includes(type)).length;
    if (n >= 3) items.push({ text: t(lang, 'rating.redundancy.sameType', { n, type: typeName(type, lang) }), points: (n - 2) * SAME_TYPE_POINTS, catalog: 'sameType', parts: { n: String(n), type: typeName(type, lang) } });
  }
  return items;
}

/** Meteo/campi in conflitto: −3. */
export function weatherClashes(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  return conditionConflicts(team, lang).map(c => ({
    text: t(lang, 'rating.redundancy.conflict', { kind: t(lang, `conflict.${c.kind}`), list: c.setters.join(', ') }), points: WEATHER_CLASH_POINTS,
    catalog: 'weatherClash' as const, key: `conflict:${c.kind}`, parts: { kind: t(lang, `conflict.${c.kind}`), list: c.setters.join(', ') },
  }));
}

/**
 * Mosse indebolite dal meteo del team (il sole sull'Acqua): solo un avviso del coach, senza punti. L'Offesa conta già il
 * danno col meteo del team (a metà); un malus in più contava due volte e premiava chi toglieva la mossa STAB (2026-11-06).
 */
export function weakenedMoveNotes(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return weakenedMoves(team).map(w => ({
    text: t(lang, 'rating.redundancy.weakens', { condition: cap(conditionLabel(w.condition, lang)), setter: w.setter, type: typeName(w.type, lang), member: w.member }),
    points: 0,
    key: `weakens:${w.condition}:${w.member}:${w.type}`,
  }));
}

/**
 * Doppio (2026-11-21): −2 per ogni membro sabotato dal meteo del team (il sole sull'Acqua, la pioggia sul Fuoco), anche
 * se la mossa non è nel set ma è fra le più usate di quel Pokémon (synergy.ts sabotagedMembers). Sulle partite di doppio
 * questi team vincono meno (41% contro 51%) e i giocatori forti li portano meno. In singolo resta solo l'avviso del coach.
 */
export const SABOTAGE_POINTS = 2;

export function weatherSabotage(team: TeamSet[], data: EngineData, lang: Lang = 'it'): Redundancy[] {
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  return sabotagedMembers(team, data).map(w => {
    const parts = { condition: conditionLabel(w.condition, lang), setter: w.setter, type: typeName(w.type, lang), member: w.member };
    return {
      // Se la mossa non è nel set il testo lo dice: "di solito usa mosse…"
      text: cap(t(lang, w.usual ? 'rating.redundancy.sabotageUsual' : 'rating.redundancy.sabotage', parts)), points: SABOTAGE_POINTS, catalog: 'weatherSabotage' as const,
      key: `sabotage:${w.member}`, parts,
    };
  });
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
// Il Pivot da solo non salva un membro debole (Raticate con solo Teleport): cambia ma non porta niente al team
const UTILITY_ROLES = [...FAMILIES.support, ...FAMILIES.utility].filter(role => role !== 'pivot');

/**
 * Il membro porta un'utilità chiave: un sotto-ruolo di Campo o Disturbo giudicato davvero (Delibird con Spikes; Sticky Web e
 * Trick Room sono Controllo velocità pieno), o il meteo o il campo dalla sua abilità (Pelipper con Drizzle).
 * 2026-11-08: una mossa da sola non basta più (Raticate con Thunder Wave o Sunny Day saliva sopra il team con Corviknight):
 * Thunder Wave, Electroweb, Tailwind o una mossa meteo contano solo se fanno un sotto-ruolo.
 */
function bringsUtility(set: TeamSet, values: SubRoleValues): boolean {
  const ability = toID(battleAbility(set));
  return UTILITY_ROLES.some(role => (values[role] ?? 0) >= UTILITY_MIN) || enables(set).some(link => toID(link.via) === ability);
}

/**
 * Ogni membro debole senza utilità chiave costa 4 punti, fino a un massimo di 12 (2026-11-03: era −2; con −2 mettere
 * Raticate al posto di un muro poteva alzare il voto, perché le aree quasi non lo notano. Nessun team da torneo ne ha uno).
 */
export const WEAK_MEMBER_POINTS = 4;
export const WEAK_MEMBER_MAX = 12;

/**
 * Membri deboli senza utilità chiave (−4 ciascuno, al massimo −12; non dipende dal meta: Pelipper che porta la pioggia è esente).
 * Ditto con Imposter è esente: copia l'avversario, le sue statistiche base non dicono nulla.
 * In doppio un membro con Fake Out, Follow Me o Rage Powder non è mai debole: è un supporto vero (Clefairy, Hitmontop).
 * Lo squilibrio degli attaccanti si vede nei Ruoli: le voci Attaccante fisico e Attaccante speciale (rolesArea.ts).
 */
export function memberIssues(team: TeamSet[], lang: Lang, needs: TeamNeeds): Redundancy[] {
  const { rules } = needs;
  const items: Redundancy[] = [];
  let total = 0;
  for (const [i, set] of team.entries()) {
    if (toID(battleAbility(set)) === 'imposter') continue;
    if (isOneType(rules) && (hasDoublesRole(set, 'fakeOut') || hasDoublesRole(set, 'redirector'))) continue;
    const power = memberPower(set);
    // Un muro passivo si giudica dalla sua robustezza (Mega Sableye), gli altri dalla forza complessiva
    if (power && (isPassive(set, rules) ? power.bulk : power.power) < WEAK_POWER && !bringsUtility(set, needs.members[i] ?? {})) {
      // Oltre il tetto i membri restano elencati ma senza punti
      const points = Math.min(WEAK_MEMBER_POINTS, WEAK_MEMBER_MAX - total);
      total += points;
      items.push({ text: t(lang, 'rating.redundancy.weakMember', { member: battleName(set) }), points, catalog: 'weakMember', parts: { member: battleName(set) } });
    }
  }
  return items;
}

/**
 * Choice o Assault Vest con mosse di stato che non servono (lockedMoves.ts): −2 per membro. Le mosse valgono già come
 * se non ci fossero; il malus segnala la combinazione che non ha senso (scelta dell'utente 2026-11-05).
 */
export const LOCKED_STATUS_POINTS = 2;

export function lockedStatusIssues(team: TeamSet[], lang: Lang): Redundancy[] {
  return team.flatMap(set => {
    const locked = lockedStatusMoves(set);
    if (!locked.length) return [];
    const moves = locked.map(m => gameName('move', m, lang)).join(', ');
    const parts = { member: battleName(set), item: gameName('item', set.item, lang), moves };
    return [{ text: t(lang, 'rating.redundancy.lockedStatus', parts), points: LOCKED_STATUS_POINTS, catalog: 'lockedStatus' as const, parts }];
  });
}

/**
 * Debolezze condivise: 1 punto per ogni membro debole oltre il primo, solo sui tipi a cui nessuno nel team resiste:
 * un membro che resiste è il cambio normale su quella debolezza (2026-10-30: "3 deboli, 1 resiste" colpiva metà dei
 * team da torneo). Tolte e poi rimesse dall'utente il 2026-10-25 dopo il bench: portano il distacco tra torneo e medi.
 * 2026-11-04: da 2 a 1 punto. A 2 allargavano le differenze fra team dello stesso tipo senza seguire torneo/ladder
 * (separazione nello stesso tipo 1,31 → 1,38).
 */
export const SHARED_WEAK_POINTS = 1;
/**
 * Buco in Difesa (2026-11-07): −2 per ogni tipo che nessun membro regge nella Coverage di tipi (sul lato peggiore tutti
 * perdono metà vita o più), solo nei team di 6. Sui dati delle partite National Dex è la parte della Difesa che indovina
 * di più chi vince (55%); il 35% dei team ladder ha almeno un buco, contro il 14% dei team da torneo.
 * Resta accanto a "Debolezza condivisa" (tabella dei tipi): provato al suo posto, prevede peggio. Ma sullo stesso tipo non
 * si pagano tutti e due (2026-11-13): col buco la debolezza condivisa di quel tipo non conta, era lo stesso problema due
 * volte (un Hyper Offense con 5 buchi perdeva circa 19 punti).
 */
export const DEFENSE_HOLE_POINTS = 2;
/**
 * Senza risposta (2026-11-17, utente), senza tetto, solo team di 6. Le aree misurano chi regge e chi colpisce a parte, e
 * un team di Pokémon forti teneva alta la media anche con un buco vero.
 * - Tipi: −4 per ogni tipo che nessuno regge (Coverage tipi della Difesa) e nessuno manda KO in due colpi (Coverage tipi
 *   dell'Offesa). Prende il posto del Buco in Difesa (−4 in tutto, non −6). Nessun team da torneo di National Dex OU ne ha.
 * - Pokémon del meta: −2 per ognuno che nessuno regge e nessuno batte prima nel duello (duel.ts: chi lo manda KO prima di
 *   andare KO, entrando gratis), −1 se lo batte solo a pari velocità. Provati −1/−2/−3/−4 e "solo in attacco" (−1 per ogni
 *   minaccia non retta anche se battuta: partite vere National Dex OU 53,8% → 51,8%). Col duello le partite restano
 *   (53,3%, dentro il margine), il distacco torneo − ladder sale da 7,2 a 8,0; i team da torneo in S o A da 396 a 317.
 */
export const UNANSWERED_POINTS = 4;
export const UNANSWERED_META_POINTS = 2;

/** I tipi né retti né battuti, e i Pokémon del meta che nessuno regge né batte prima (`best`: 0 nessuno, 0.5 a pari velocità). */
export function unanswered(team: TeamSet[], offense: TeamOffense, defense: TeamDefense, data?: EngineData): { types: string[]; threats: DuelRow[] } {
  const types = defense.coverageTypes.weak.filter(type => offense.types.holes.includes(type));
  const threats = unheldDuels(team, defense, data ? hitRules(data) : {}).filter(row => row.best < 1);
  return { types, threats };
}
/** Un membro che ha bisogno di una condizione (meteo, campo, Trick Room) che il team non porta: −3. */
export const UNMET_POINTS = 3;

/**
 * `roomFast`: il membro la cui Trick Room ha già il malus "Trick Room in team veloce"; la sua Trick Room non prende
 * anche "attivatore inutilizzato" (stessa mossa, un malus solo). Meteo e campi inutilizzati restano.
 */
export function redundancies(team: TeamSet[], analysis: TeamAnalysis, lang: Lang = 'it', roomFast?: string): Redundancies {
  // Le debolezze si contano su tutti i 18 tipi, senza il meta
  const weaknesses = analysis.weakness
    .filter(row => row.resist === 0 && row.weak >= 2)
    .map(row => ({
      text: t(lang, 'rating.redundancy.sharedWeak', { n: row.weak, type: typeName(row.type, lang), resistText: t(lang, 'rating.redundancy.noneResist') }),
      points: (row.weak - 1) * SHARED_WEAK_POINTS,
      catalog: 'sharedWeak' as const,
      key: `sharedWeak:${row.type}`,
      parts: { n: String(row.weak), type: typeName(row.type, lang) },
    }));
  const dependencies = [
    ...unmetBeneficiaries(team).map(i => {
      const parts = { member: i.member, via: viaName(i.via, lang), condition: conditionLabel(i.condition, lang) };
      return { text: t(lang, 'rating.redundancy.unmet', parts), points: UNMET_POINTS, catalog: 'unmetCondition' as const, parts };
    }),
    ...unusedEnablers(team).filter(i => !(i.condition === 'trickroom' && i.member === roomFast)).map(i => {
      const parts = { via: viaName(i.via, lang), member: i.member };
      return { text: t(lang, 'rating.redundancy.unused', parts), points: UNUSED_ENABLER_POINTS, catalog: 'unusedEnabler' as const, parts };
    }),
  ];
  const items = [
    ...weaknesses, ...roleAndTypeRedundancies(team, lang), ...dependencies, ...weatherClashes(team, lang),
    ...memberIssues(team, lang, analysis.needs),
  ];
  return { total: sum(items.map(i => i.points)), items };
}


const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Il meteo/campo del team vale +1 se smorza una debolezza ad almeno un compagno, comunque e a quanti. */
export const WEATHER_HELP = 1;

/**
 * +1 una volta sola se il meteo o il campo che il team porta smorza una debolezza di un compagno
 * (da 2× a neutro: il meteo dimezza, e da 4× resterebbe 2×). Il setter non conta e abilitare un'abilità o una
 * mossa non dà bonus: il meteo non è sempre attivo, quindi non conta quanti ne godono.
 * Serve un compagno che usi davvero il meteo (stessi utenti di "condizione usata", synergy.ts usesCondition): prima
 * bastava mettere Sunny Day a chiunque per prendere il +1 (2026-11-08, controllo 2 punto 3.1).
 */
export function weatherBonus(team: TeamSet[], lang: Lang = 'it'): Redundancies {
  const items: Redundancy[] = [];
  for (const m of weatherMitigations(team)) {
    const setter = m.source.split(' (')[0];
    if (!team.some(o => battleName(o) !== setter && usesCondition(o, m.condition as Condition))) continue;
    const members = m.members.filter(x => x.to <= 1 && x.species !== setter).map(x => x.species);
    if (!members.length) continue;
    const parts = { condition: capitalize(conditionLabel(m.condition as Condition, lang)), setter, list: members.join(', ') };
    items.push({ text: t(lang, 'rating.bonus.helps', parts), points: 0, catalog: 'weatherHelp', parts });
  }
  // Un solo punto per tutto il team: si mostra sulla prima voce
  if (items.length) items[0].points = WEATHER_HELP;
  return { total: items.length ? WEATHER_HELP : 0, items };
}

/**
 * Un core a tre dell'Analisi (tre membri che si parano le debolezze a giro) vale 3 punti (era 2 quando bastava la tabella
 * dei tipi; ora chi para deve reggere davvero: 2026-11-10); le coppie non danno punti.
 */
export const CORE_TRIO_POINTS = 3;

/** I trii fra i core dell'Analisi (al massimo due): quelli che il voto conta. */
export const coreTrios = (team: TeamSet[], held?: HeldBy): Core[] => teamCores(team, 2, held).filter(core => core.members.length === 3);

/** +3 per ogni trio fra i core dell'Analisi (al massimo due). I trii sono nel 100% dei team da torneo e nel 61% dei brutti. */
export function coreTrioBonus(team: TeamSet[], lang: Lang = 'it', held?: HeldBy, trios: Core[] = coreTrios(team, held)): Redundancy[] {
  return trios.map(core => ({ text: t(lang, 'rating.bonus.coreTrio', { list: core.members.join(', ') }), points: CORE_TRIO_POINTS, catalog: 'coreTrio' as const }));
}

/** Tipi diversi fra i membri da cui il team conta come vario (67% dei team da torneo, 37% della ladder, 0% dei brutti). */
export const TYPE_VARIETY_MIN = 10;
export const TYPE_VARIETY_POINTS = 1;

/** +1 se i membri mettono insieme almeno 10 tipi diversi: lo specchio del malus "stesso tipo". */
export function typeVarietyBonus(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const types = new Set(team.flatMap(set => (battleSpecies(set)?.types as readonly string[] | undefined) ?? []));
  return types.size >= TYPE_VARIETY_MIN
    ? [{ text: t(lang, 'rating.bonus.variety', { n: types.size }), points: TYPE_VARIETY_POINTS, catalog: 'typeVariety' }]
    : [];
}

export const WEAK_COVERED_POINTS = 1;

/**
 * +1 se, in un team da 6, ogni tipo a cui almeno due membri sono deboli ha un membro che lo resiste: lo specchio del
 * malus "debolezza condivisa" (86% dei team da torneo, 58% della ladder, 24% dei brutti).
 */
export function weakCoveredBonus(team: TeamSet[], analysis: TeamAnalysis, lang: Lang = 'it'): Redundancy[] {
  // Servono 6 specie riconosciute: senza tipi non ci sono debolezze, e "tutte coperte" sarebbe vero per niente
  if (team.filter(set => !!battleSpecies(set)).length < 6) return [];
  const shared = analysis.weakness.filter(row => row.weak >= 2);
  return shared.every(row => row.resist >= 1)
    ? [{ text: t(lang, 'rating.bonus.weakCovered', { n: shared.length }), points: WEAK_COVERED_POINTS, catalog: 'weakCovered' }]
    : [];
}

/**
 * +1 (una volta sola, anche con più pivot) se una mossa pivot è sfruttata dal team (pivotBonus.ts): un pivot lento e
 * difensivo che fa entrare un attaccante fragile, o un pivot veloce con chi para ogni sua debolezza. In doppio non si dà.
 */
export function pivotBonus(team: TeamSet[], parts: PivotParts, lang: Lang = 'it'): Redundancy[] {
  const link = pivotLinks(team, parts)[0];
  if (!link) return [];
  const values = { pivot: link.pivot, move: link.move, list: link.partners.join(', ') };
  return [{ text: t(lang, link.kind === 'slow' ? 'rating.bonus.pivotSlow' : 'rating.bonus.pivotFast', values), points: PIVOT_POINTS, catalog: 'pivotLink', key: 'pivotLink', parts: values }];
}

/** Compagni (non il portatore) che devono sfruttare un meteo, un campo o Trick Room perché valga il bonus. */
export const CONDITION_USERS_MIN = 2;
export const CONDITION_USED_POINTS = 1;

/**
 * +1 per ogni condizione portata da un membro e sfruttata da almeno due compagni: lo specchio di "attivatore inutilizzato".
 * In doppio non si dà (rateTeamAs): sulle partite è l'unica voce che va al contrario (i giocatori forti ce l'hanno meno).
 */
export function conditionUsedBonus(team: TeamSet[], lang: Lang = 'it'): Redundancy[] {
  const items: Redundancy[] = [];
  const seen = new Set<Condition>();
  for (const [i, set] of team.entries()) {
    for (const link of enables(set).filter(teamEnabler)) {
      if (seen.has(link.condition)) continue;
      // Gli stessi utenti del malus "non usata" (synergy.ts usesCondition): i due non scattano mai insieme
      const users = team.filter((other, j) => j !== i && usesCondition(other, link.condition));
      if (users.length < CONDITION_USERS_MIN) continue;
      seen.add(link.condition);
      const parts = { condition: capitalize(conditionLabel(link.condition, lang)), setter: battleName(set), list: users.map(battleName).join(', ') };
      items.push({ text: t(lang, 'rating.bonus.conditionUsed', parts), points: CONDITION_USED_POINTS, catalog: 'conditionUsed', parts });
    }
  }
  return items;
}

/**
 * Cosa rende il voto provvisorio in un team di 6: una specie che non si riconosce, un membro senza mosse, mosse o strumento
 * sconosciuti (es. un errore di battitura nell'import). Il voto non cambia: lo si dice soltanto (scelta dell'utente 2026-11-09).
 */
export function provisionalNotes(team: TeamSet[], lang: Lang = 'it'): string[] {
  return team.flatMap(set => {
    if (!set.species) return [];
    if (!battleSpecies(set)) return [t(lang, 'rating.note.species', { name: set.species })];
    const name = set.name || battleName(set);
    const moves = set.moves.filter(Boolean);
    const unknown = moves.filter(m => !getMove(m));
    const notes: string[] = [];
    if (moves.length === unknown.length) notes.push(t(lang, 'rating.note.noMoves', { name }));
    if (unknown.length) notes.push(t(lang, unknown.length === 1 ? 'rating.note.move' : 'rating.note.moves', { name, list: unknown.join(', ') }));
    if (set.item && !dex.items.get(set.item)?.exists) notes.push(t(lang, 'rating.note.item', { name, item: set.item }));
    return notes;
  });
}

export function gradeFor(score: number, lang: Lang = 'it'): { grade: string; label: string } {
  const { grade } = GRADES.find(g => score >= g.min)!;
  return { grade, label: t(lang, `grade.${grade}`) };
}

/** Opzioni del voto: `archetype` giudica il team come quel tipo (pesi, livelli dei ruoli, modalità stall), anche se è riconosciuto come un altro. */
export interface RateOptions {
  archetype?: Archetype;
}

/**
 * Il voto del team. Vicino a una soglia fra due tipi (typeMix, archetype.ts) è una miscela col voto dei tipi accanto
 * (fino a metà proprio sulla soglia; nella fascia Bulky Offense anche con tutti e due i vicini). La differenza non si mostra
 * (prima era una riga "Vicino a…" fra bonus e malus). Con `opts.archetype` (tipo scelto a mano) niente miscela.
 */
export function rateTeam(given: TeamSet[], data: EngineData, lang: Lang = 'it', opts: RateOptions = {}): TeamRating | null {
  // Con EV oltre il massimo o una specie doppia niente voto (l'app lo dice); il resto si giudica come in partita (legalTeam.ts)
  if (blockedReason(given, data.formatId)) return null;
  const input = voteTeam(given, data.allowMultipleMegas);
  // Col tipo unico (doppio) un tipo scelto a mano non ha senso: si ignora
  if (isOneType(rulesOf(data))) opts = {};
  const own = rateTeamAs(input, data, lang, opts);
  if (!own || opts.archetype) return own;
  const mix = typeMix(input.map(withUsableMoves), rulesOf(data));
  if (!mix) return own;
  // Ogni tipo vicino a portata pesa per la sua quota (nella fascia Bulky Offense possono essere due)
  const near = mix.blends.map(blend => ({ ...blend, vote: rateTeamAs(input, data, lang, { archetype: blend.near })!.overall }));
  const rest = 1 - sum(near.map(n => n.share));
  const overall = Math.round(rest * own.overall + sum(near.map(n => n.share * n.vote)));
  // La miscela non si mostra più come riga "Vicino a…" fra bonus e malus (compariva troppo spesso; scelta dell'utente
  // 2026-11-10): il voto resta miscelato, e bonus e malus mostrati non contano questa differenza
  return { ...own, overall, ...gradeFor(overall, lang), typeMix: mix };
}

/** Il voto con un solo tipo: quello riconosciuto, o `opts.archetype`. */
function rateTeamAs(input: TeamSet[], data: EngineData, lang: Lang = 'it', opts: RateOptions = {}): TeamRating | null {
  if (input.length === 0) return null;
  // Le mosse di stato che con la Choice o l'Assault Vest non servono valgono come se non ci fossero (lockedMoves.ts)
  const team = input.map(withUsableMoves);
  const analysis = analyzeTeam(team, data, opts.archetype);
  // I 18 tipi pesano uguale (il meta del mese non cambia le coverage); l'Offesa invece si misura contro i difensori del meta, se attivo
  const weights = UNIFORM_TYPE_WEIGHTS;

  const rules = rulesOf(data);
  // Stall riconosciuto: cambia solo la forza mostrata dei membri passivi (sotto), non i pesi né i ruoli
  const stallMode = isOneType(rules) ? false : opts.archetype ? opts.archetype === 'stall' : isStall(team, rules);
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
  const weightTable = areaWeightTable(rules);
  const table = weightTable[analysis.needs.archetype];
  // Trick Room non azzera più la Velocità: è una sua condizione (speedArea.ts), che premia i membri lenti
  const effective: Record<BaseArea, number> = table;
  // Velocità: ogni membro coi guadagni suoi e del controllo del team (speedArea.ts); col meta contro i più usati
  const speed = teamSpeedArea(team, data);

  // Offesa e Difesa dal danno vero (offense.ts, defense.ts)
  const attack = offense.members.length ? offense.value / 100 : null;
  const raw: Record<BaseArea, number | null> = {
    defense: defense.members.length ? defense.value / 100 : null, strength: attack,
    speed: speed.members.length ? speed.value / 100 : null,
  };
  const available = BASE_AREAS.filter(key => raw[key] !== null && effective[key] > 0);
  const totalWeight = sum(available.map(key => effective[key]));
  const areaWeights = Object.fromEntries(available.map(key => [key, effective[key] / totalWeight])) as Partial<Record<AreaKey, number>>;
  let score = sum(available.map(key => areaWeights[key]! * raw[key]!));
  const areas = (Object.keys(raw) as (keyof typeof raw)[])
    // Un'area con peso 0 resterebbe visibile (inattiva); senza dati l'area non c'è
    .filter(key => raw[key] !== null)
    .map(key => ({
      key,
      label: t(lang, `area.${key}`),
      value: Math.round(100 * raw[key]!),
      ...(!((areaWeights[key] ?? 0) > 0) && { inactive: true }),
    }));
  // Le aree sono numeri interi: il piccolo margine evita che un ,5 esatto (56,4999… per i calcoli in virgola) scenda
  // di un punto rispetto al conto fatto a mano con le aree mostrate
  const base = Math.round(100 * score + 1e-9);
  // Niente più penalità del meta: le minacce scoperte abbassano la Coverage meta della Difesa.
  // Trick Room in un team veloce: −1 per ogni membro che supera da solo almeno metà del meta (sotto Trick Room perde), fino a −3
  const roomSetter = team.find(set => set.moves.some(move => toID(move) === 'trickroom'));
  const fastMembers = roomSetter ? speed.members.filter(m => m.raw >= TRICK_ROOM_FAST) : [];
  // Con quel malus la stessa Trick Room non conta anche come attivatore inutilizzato
  const redundant = redundancies(team, analysis, lang, fastMembers.length ? battleName(roomSetter!) : undefined);
  const roomItems = fastMembers.length
    ? [{ text: t(lang, fastMembers.length === 1 ? 'rating.redundancy.trickRoomFastOne' : 'rating.redundancy.trickRoomFast', { setter: battleName(roomSetter!), n: fastMembers.length, list: fastMembers.map(m => m.species).join(', ') }), points: Math.min(TRICK_ROOM_MAX, fastMembers.length * TRICK_ROOM_FAST_POINTS), catalog: 'trickRoomFast' as const, parts: { list: fastMembers.map(m => m.species).join(', ') } }]
    : [];
  // Le mancanze dei Ruoli (essenziali e importanti, solo team di 6) si sommano alle altre penalità
  const complete = team.filter(set => !!battleSpecies(set)).length >= 6;
  const holeItems = complete
    ? defense.coverageTypes.weak.map(type => ({ text: t(lang, 'rating.redundancy.defenseHole', { type: typeName(type, lang) }), points: DEFENSE_HOLE_POINTS, catalog: 'defenseHole' as const, key: `defenseHole:${type}`, parts: { type: typeName(type, lang) } }))
    : [];
  // Un tipo che nessuno regge paga solo il buco, non anche la debolezza condivisa dello stesso tipo
  const holeKeys = new Set(holeItems.map(i => `sharedWeak:${i.key.slice('defenseHole:'.length)}`));
  const redundantItems = redundant.items.filter(i => !i.key || !holeKeys.has(i.key));
  // Senza risposta (né retto né battuto, solo team di 6): sul tipo prende il posto del Buco in Difesa
  const open = complete ? unanswered(team, offense, defense, data) : { types: [], threats: [] };
  const unansweredItems = [
    ...open.types.map(type => ({ text: t(lang, 'rating.redundancy.unansweredType', { type: typeName(type, lang) }), points: UNANSWERED_POINTS, catalog: 'unanswered' as const, key: `unanswered:type:${type}` })),
    ...open.threats.map(row => ({
      text: t(lang, row.best ? 'rating.redundancy.unansweredThreatTie' : 'rating.redundancy.unansweredThreat', { species: row.species, list: row.winners.join(', ') }),
      points: row.best ? UNANSWERED_META_POINTS / 2 : UNANSWERED_META_POINTS, catalog: 'unanswered' as const, key: `unanswered:meta:${row.species}`,
    })),
  ];
  const shownHoles = holeItems.filter(i => !open.types.includes(i.key.slice('defenseHole:'.length)));
  // Doppio: il sabotaggio del meteo è un malus, e il bonus "condizione usata" non si dà
  const oneType = isOneType(rules);
  const sabotageItems = oneType ? weatherSabotage(team, data, lang) : [];
  const extraItems = [...unansweredItems, ...roles.failures, ...roomItems, ...shownHoles, ...lockedStatusIssues(input, lang), ...sabotageItems];
  const allItems = [...redundantItems, ...extraItems];
  const penalty = { total: sum(allItems.map(i => i.points)), items: allItems };
  // Bonus: le cose fatte bene, senza tetto (core a tre, debolezze coperte, tipi vari, condizione sfruttata, meteo, ruoli minori).
  // 2026-11-07: tolto il bonus Tera (+1 per debolezza coperta da un Tera, fino a +3): lo prendevano quasi tutti allo
  // stesso modo (torneo 2,1, ladder 2,2) e il Tera si usa una volta sola, scelto in partita: troppe variabili
  const trios = coreTrios(team, heldByOf(defense.coverageTypes.rows));
  const bonusItems = [
    ...coreTrioBonus(team, lang, undefined, trios), ...weakCoveredBonus(team, analysis, lang), ...typeVarietyBonus(team, lang), ...(oneType ? [] : conditionUsedBonus(team, lang)),
    ...weatherBonus(team, lang).items, ...roles.bonuses, ...(oneType ? [] : pivotBonus(team, { offense, defense, speed, roles }, lang)),
  ];
  const bonus = { total: sum(bonusItems.map(i => i.points)), items: bonusItems };
  // 2026-11-13: via il punto fisso per membro (+6 a un team completo, non mostrato). Lo sostituiscono le quote di Offesa e
  // Difesa, la profondità 70/20/10 e i pesi nuovi: stesso livello di voto, con regole che si spiegano.
  const overall = Math.min(100, Math.max(0, base - penalty.total + bonus.total));
  // Sulle mosse scritte (input), non su quelle usabili: una Choice con sole mosse di stato ha già il suo avviso
  const notes = provisionalNotes(input, lang);
  return {
    base, penalty, bonus, power: power.members, overall, ...gradeFor(overall, lang), provisional: !complete, notes, areas, archetype, meta: usesMeta(data),
    teamType: analysis.needs.archetype, typeMix: null, trickRoom, needs: analysis.needs,
    weights: areaWeights, weightTable, offense, defense, speed, roles, cores: trios,
  };
}


export interface CatalogEntry {
  key: CatalogKey;
  kind: 'malus' | 'bonus';
  name: string;
  when: string;
  points: string;
}

const CATALOG_ORDER: { key: CatalogKey; kind: 'malus' | 'bonus' }[] = [
  ...(['sharedWeak', 'sameType', 'hazardDuplicate', 'weatherClash', 'weatherSabotage', 'unmetCondition', 'unusedEnabler', 'weakMember', 'lockedStatus', 'essentialRole', 'importantRole', 'trickRoomFast', 'defenseHole', 'unanswered'] as const)
    .map(key => ({ key, kind: 'malus' as const })),
  ...(['coreTrio', 'weakCovered', 'typeVariety', 'conditionUsed', 'weatherHelp', 'pivotLink', 'minorRole'] as const).map(key => ({ key, kind: 'bonus' as const })),
];

/** Voci che esistono solo in doppio, e voci del singolo che in doppio non ci sono. */
const DOUBLES_ONLY = new Set<CatalogKey>(['weatherSabotage']);
const SINGLES_ONLY = new Set<CatalogKey>(['conditionUsed', 'pivotLink']);

/**
 * Tutti i bonus e malus possibili nel formato (`rules`; senza, quelli del singolo), con il testo per il modale; i punti
 * nei testi vengono dalle costanti.
 */
export function bonusMalusCatalog(lang: Lang, rules?: FormatRules): CatalogEntry[] {
  const doubles = !!rules && isOneType(rules);
  const values = {
    shared: SHARED_WEAK_POINTS, hole: DEFENSE_HOLE_POINTS, unanswered: UNANSWERED_POINTS, unansweredMeta: UNANSWERED_META_POINTS, unansweredTie: UNANSWERED_META_POINTS / 2, unmet: UNMET_POINTS, hazard: HAZARD_DUPLICATE, member: WEAK_MEMBER_POINTS, memberMax: WEAK_MEMBER_MAX, locked: LOCKED_STATUS_POINTS,
    essential: ESSENTIAL_POINTS, important: IMPORTANT_POINTS, minor: MINOR_POINTS, room: TRICK_ROOM_MAX, roomEach: TRICK_ROOM_FAST_POINTS, clash: WEATHER_CLASH_POINTS, unused: UNUSED_ENABLER_POINTS,
    help: WEATHER_HELP,
    same: SAME_TYPE_POINTS, trio: CORE_TRIO_POINTS, covered: WEAK_COVERED_POINTS, variety: TYPE_VARIETY_POINTS, varietyMin: TYPE_VARIETY_MIN,
    pivot: PIVOT_POINTS, used: CONDITION_USED_POINTS, users: CONDITION_USERS_MIN, sabotage: SABOTAGE_POINTS,
  };
  return CATALOG_ORDER.filter(({ key }) => !(doubles ? SINGLES_ONLY : DOUBLES_ONLY).has(key)).map(({ key, kind }) => ({
    key, kind,
    name: t(lang, `catalog.${key}.name`, values),
    when: t(lang, `catalog.${key}.when`, values),
    points: t(lang, `catalog.${key}.points`, values),
  }));
}

/**
 * Le minacce del meta come le giudica il voto (Coverage meta della Difesa), per coach, Panoramica e scheda Meta:
 * gestita = almeno un membro regge del tutto il suo colpo migliore. Vuota senza meta.
 */
export function ratingThreats(rating: TeamRating | null, data: EngineData): ThreatRow[] {
  const rows = rating?.defense.coverageMeta?.rows ?? [];
  return rows.map(row => ({
    name: row.species,
    usage: usageOf(data.stats, row.species),
    handledBy: row.heldBy.filter(h => !h.partial).map(h => h.species),
  }));
}
