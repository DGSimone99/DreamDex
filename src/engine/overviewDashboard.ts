import { usesMeta, type TeamAnalysis } from './analysis';
import { COVERED_LEVEL, holdSeverity, type CoachProblem } from './coach';
import type { PctRange } from './damage';
import type { EngineData } from './data';
import { battleName, toID } from './dex';
import { ownersOf } from './needs';
import { summarizeTeam } from './overviewSummary';
import { ratingThreats, type TeamRating } from './rating';
import { LEVEL_KEYS, type LevelKey } from './roleLevels';
import { usageOf } from './stats';
import { rolesTally, rolesValue } from './rolesArea';
import type { TeamSet } from './sets';
import { poolMedian, speedTier, type SpeedRival } from './speed';
import type { SpeedCondition } from './speedArea';
import { t, type Lang } from '../i18n';

/** Il conteggio dei Ruoli diviso: "7/8" e i punti (0 senza). */
const rolesCount = (roles: TeamRating['roles']) => {
  const { covered, total, points } = rolesTally(roles);
  return { count: `${covered}/${total}`, points };
};

export type CellState = 'ok' | 'minor' | 'bad';
/**
 * resist: quanti membri reggono del tutto il tipo (Coverage tipi della Difesa). Per il tooltip della casella:
 * offenseLevel e hits (i migliori colpi del team sul Pokémon di prova del tipo, come nella scheda Offesa), defenseLevel e
 * members (per membro in ordine di team il moltiplicatore del tipo e il danno % del colpo più forte, fisico o speciale,
 * come nella Coverage tipi della Difesa; null se il motore non conosce il membro). `range`: la forbice dei tiri del colpo
 * vero dietro il numero (da minimo a massimo, in % dei PS), null senza colpo (facoltativa: i dati scritti a mano dei test
 * non la portano) e quando il numero è una media pesata (si mostra il numero solo).
 */
export interface TypeCell {
  type: string; defense: CellState; offense: CellState; defenseNote: string; offenseNote: string; resist: number;
  offenseLevel: number; defenseLevel: number;
  hits: { species: string; move: string | null; pct: number; range?: PctRange | null }[];
  members: { species: string; mult: number; pct: number | null; range?: PctRange | null }[];
}
/** soft: una mancanza che non toglie punti (team con meno di 6 membri). I minori non si mostrano più (2026-11-22, utente). */
export interface RoleChip { need: LevelKey; level: 'essential' | 'important'; covered: boolean; owners: string[]; soft: boolean }
/** Un rivale vicino per velocità: specie, velocità effettiva e cosa la alza (Sciarpa o Booster), per il tooltip della barra. */
export interface SpeedNeighbour { species: string; speed: number; scarf: boolean; booster: boolean }
/** `near`: i rivali del meta (o del tier) appena più veloci e appena più lenti, dal più vicino, e quelli a pari velocità. */
export interface SpeedLane { species: string; speed: number; share: number; above: boolean; near: { faster: SpeedNeighbour[]; slower: SpeedNeighbour[]; ties: SpeedNeighbour[] } | null;
  /** Lo strumento del membro se gli alza la Velocità (Choice Scarf o Booster Energy): l'icona accanto al nome nel tooltip. */
  item?: string }

/** I vicini per il tooltip della barra: chi è appena sopra, appena sotto e a pari velocità (al massimo 3 pari). */
export function laneNear(near: { faster: SpeedRival[]; slower: SpeedRival[]; ties: SpeedRival[] }): NonNullable<SpeedLane['near']> {
  const list = (rivals: SpeedRival[]) => rivals.map(r => ({ species: r.species, speed: r.value, scarf: r.scarf || r.item === 'Choice Scarf', booster: !!r.booster }));
  return { faster: list(near.faster), slower: list(near.slower), ties: list(near.ties.slice(0, 3)) };
}

/** Lo strumento da mostrare accanto al membro: solo quelli che alzano la Velocità. */
export function speedItem(set: TeamSet): string | undefined {
  return set.item === 'Choice Scarf' || set.item === 'Booster Energy' ? set.item : undefined;
}
export interface ThreatPod { species: string; usage: number }

/**
 * Perché una minaccia del meta è gestita male, da un lato: `side` dice dove (Difesa: chi la regge, Offesa: chi la manda
 * KO in due colpi), `by` chi lo fa (vuoto: nessuno; uno solo: lo fa solo lui).
 */
export interface ThreatReason { side: 'defense' | 'offense'; by: string[] }
/**
 * Una minaccia della carta "Minacce del meta" della Panoramica. `status`: 'open' (scoperta: nessuno la regge o nessuno la
 * manda KO in due colpi) o 'thin' (a fatica: lo fa un membro solo). `reasons`: i lati che la rendono tale, dal peggiore;
 * il primo decide dove porta il clic (`side`).
 */
export interface MetaThreat { species: string; usage: number; status: 'open' | 'thin'; side: 'defense' | 'offense'; reasons: ThreatReason[] }

/** Difesa: chi regge del tutto il colpo migliore della minaccia (la regola di metaThreats e del Coaching). */
export const defenseHandlers = (row: { heldBy: { species: string; partial: boolean }[] }): string[] =>
  row.heldBy.filter(h => !h.partial).map(h => h.species);
/** Offesa: chi manda il Pokémon del meta KO in due colpi (la regola di metaThreats). */
export const offenseHandlers = (row: { coveredBy: { species: string }[] }): string[] =>
  [...new Set(row.coveredBy.map(c => c.species))];

/**
 * L'ordine di Coverage meta (prima le minacce coperte peggio), con la regola delle carte della Panoramica (metaThreats) su un lato solo: prima
 * le scoperte (nessuno le gestisce), poi quelle a fatica (uno solo), poi le altre; dentro, la più usata e poi il nome.
 * `count`: quanti membri la gestiscono, lo stesso numero che la tabella mostra nella riga Team Coverage (così i fili
 * rossi, gialli e verdi in testata vengono in quest'ordine).
 */
export function byThreat<R extends { species: string; weight: number }>(rows: readonly R[], count: (row: R) => number): R[] {
  const rank = (row: R) => Math.min(2, count(row));
  return [...rows].sort((a, b) => rank(a) - rank(b) || b.weight - a.weight || a.species.localeCompare(b.species));
}
/** Il più usato nel meta per primo, poi il nome: il #N d'uso sulle carte di Coverage meta. */
export const byUsage = <R extends { species: string; weight: number }>(rows: readonly R[]): R[] =>
  [...rows].sort((a, b) => b.weight - a.weight || a.species.localeCompare(b.species));

/**
 * Le minacce del meta che il team gestisce peggio, dai dati del voto (Coverage meta della Difesa e dell'Offesa).
 *
 * Regola: in Difesa una minaccia è scoperta se nessun membro regge del tutto il suo colpo migliore (`heldBy` senza
 * `partial`, la stessa regola del Coaching e della scheda), a fatica se lo regge uno solo; in Offesa è scoperta se
 * nessuno la manda KO in due colpi (`coveredBy` vuoto, i buchi della Coverage meta), a fatica se lo fa uno solo. Un
 * Pokémon che compare in tutti e due i lati è una minaccia sola con le due ragioni (prima la peggiore; a parità la
 * Difesa). Ordine: prima le scoperte, poi quelle a fatica; dentro, prima chi è scoperta su tutti e due i lati, poi la
 * più usata nel meta, poi il nome. Vuota senza meta.
 */
export function metaThreats(rating: TeamRating, data: EngineData): MetaThreat[] {
  const bySpecies = new Map<string, ThreatReason[]>();
  const add = (species: string, reason: ThreatReason) => bySpecies.set(species, [...(bySpecies.get(species) ?? []), reason]);
  for (const row of rating.defense.coverageMeta?.rows ?? []) {
    const by = defenseHandlers(row);
    if (by.length <= 1) add(row.species, { side: 'defense', by });
  }
  for (const row of rating.offense.coverageMeta?.rows ?? []) {
    const by = offenseHandlers(row);
    if (by.length <= 1) add(row.species, { side: 'offense', by });
  }
  const list = [...bySpecies].map(([species, found]) => {
    // La ragione peggiore per prima (nessuno prima di uno solo); a parità la Difesa, che viene prima nella mappa
    const reasons = [...found].sort((a, b) => a.by.length - b.by.length);
    return { species, usage: usageOf(data.stats, species), status: reasons[0].by.length ? 'thin' as const : 'open' as const, side: reasons[0].side, reasons };
  });
  const openSides = (x: MetaThreat) => x.reasons.filter(r => !r.by.length).length;
  return list.sort((a, b) => Number(a.status === 'thin') - Number(b.status === 'thin') || openSides(b) - openSides(a) || b.usage - a.usage || a.species.localeCompare(b.species));
}
/**
 * Un Pokémon del meta contro il tuo team, per il blocco "Contro il tuo team" della scheda Meta: le stesse righe e le
 * stesse regole di `metaThreats` (Difesa: chi regge del tutto il suo colpo migliore; Offesa: chi lo manda KO in due
 * colpi), niente calcoli nuovi. `defense` / `offense`: i membri, o null se il Pokémon non è fra le righe di quel lato
 * (le righe dell'Offesa sono una per combinazione di tipi: chi non la rappresenta non c'è). `status` come le carte
 * della Panoramica: 'open' se un lato ha nessuno, 'thin' se ne ha uno solo, altrimenti 'held'.
 * `own`: è un tuo membro; allora le righe dicono come se la cava il RESTO del team contro una copia avversaria (il
 * membro stesso è tolto dai conti). Null se non è in nessuna riga (meta spento, niente statistiche, fuori dai bersagli).
 */
export interface MetaVersus { defense: string[] | null; offense: string[] | null; status: 'open' | 'thin' | 'held'; own: boolean }

export function metaVersus(rating: TeamRating | null, species: string, team: TeamSet[]): MetaVersus | null {
  if (!rating) return null;
  const id = toID(species);
  const own = team.some(set => toID(battleName(set)) === id || toID(set.species) === id);
  const rest = (names: string[]) => [...new Set(names)].filter(name => !own || toID(name) !== id);
  const def = rating.defense.coverageMeta?.rows.find(row => toID(row.species) === id);
  const off = rating.offense.coverageMeta?.rows.find(row => toID(row.species) === id);
  if (!def && !off) return null;
  const defense = def ? rest(def.heldBy.filter(h => !h.partial).map(h => h.species)) : null;
  const offense = off ? rest(off.coveredBy.map(c => c.species)) : null;
  const counts = [defense, offense].filter((x): x is string[] => x !== null).map(x => x.length);
  const status = counts.some(n => n === 0) ? 'open' : counts.some(n => n === 1) ? 'thin' : 'held';
  return { defense, offense, status, own };
}

export interface DashboardData {
  coverage: { cells: TypeCell[]; defense: string; offense: string };
  /** members: i membri in ordine di team (le colonne della tabella dei ruoli), scritti come gli owners. */
  /** value: "7/8 −4"; count e points lo stesso diviso (la testata scrive i punti come punti: "7/8 −4 pt"). */
  roles: { chips: RoleChip[]; members: string[]; value: string; count?: string; points?: number };
  speed: { lanes: SpeedLane[]; median: number | null; vsMeta: boolean; control: { condition: SpeedCondition; move: string; by: string[] }[]; value: string };
  /** metaOff: il formato non usa il meta (Giochi, No Format); altrimenti, se non disponibile, mancano le statistiche. */
  /** `list`: le minacce gestite peggio per la carta della Panoramica (metaThreats). */
  threats: { pods: ThreatPod[]; list: MetaThreat[]; total: number; available: boolean; metaOff: boolean };
}

/** I dati del cruscotto dell'Analisi; gli stati vengono da summarizeTeam e dalla gravità delle debolezze. */
export function dashboardData(team: TeamSet[], analysis: TeamAnalysis, rating: TeamRating, problems: CoachProblem[], data: EngineData, lang: Lang): DashboardData {
  const tiles = summarizeTeam(analysis, rating, problems, data);
  const tile = (key: string) => tiles.find(x => x.key === key)!;

  // Copertura: una cella per tipo, coi conti del voto (Coverage tipi della Difesa, pacchetto dell'Offesa) come il coach
  const offense = rating.offense.types;
  const weakness = new Map(analysis.weakness.map(row => [row.type as string, row.multipliers]));
  const typeIndex = (type: string) => rating.defense.coverageTypes.rows.findIndex(r => r.type === type);
  const cells: TypeCell[] = rating.defense.coverageTypes.rows.map(row => {
    const severity = holdSeverity(rating, row.type);
    const off = offense.rows.find(r => r.label === row.type);
    const hole = offense.holes.includes(row.type);
    const hitters = (off?.best ?? []).filter(b => b.credit > 0).map(b => b.species);
    return {
      type: row.type,
      defense: severity === 'serious' ? 'bad' : severity === 'minor' ? 'minor' : 'ok',
      offense: hole ? 'bad' : (off?.level ?? 0) < COVERED_LEVEL ? 'minor' : 'ok',
      defenseNote: row.heldBy.length ? t(lang, 'dash.heldBy', { list: row.heldBy.join(', ') }) : t(lang, 'dash.heldNone'),
      offenseNote: hole || !hitters.length ? t(lang, 'dash.offenseNone') : t(lang, 'dash.offenseBy', { list: hitters.join(', ') }),
      resist: row.heldBy.length,
      offenseLevel: off?.level ?? 0,
      defenseLevel: row.level,
      hits: (off?.best ?? []).map(b => ({ species: b.species, move: b.move, pct: b.pct, range: b.range })),
      members: team.map((set, m) => {
        const species = battleName(set);
        const typed = rating.defense.typed.find(x => x.species === species);
        const k = typeIndex(row.type);
        return { species, mult: weakness.get(row.type)?.[m] ?? 1, pct: typed?.cells[k]?.pct ?? null, range: typed?.ranges[k]?.range ?? null };
      }),
    };
  });

  // Ruoli: essenziali e importanti (i minori non danno e non tolgono punti: non stanno nella lista)
  const chips: RoleChip[] = [];
  for (const need of LEVEL_KEYS) {
    const level = analysis.needs.levels[need];
    if (level === 'ignored' || level === 'minor') continue;
    const owners = ownersOf(team, analysis.needs, need);
    chips.push({ need, level, covered: owners.length > 0, owners, soft: rating.provisional });
  }

  // Velocità: corsie dal più veloce
  const lanes: SpeedLane[] = rating.speed.members
    .map(m => {
      const set = team.find(s => battleName(s) === m.species);
      const tier = set ? speedTier(set, data) : null;
      return {
        species: m.species, speed: m.speed, share: m.raw, above: m.raw > 0.5,
        near: tier ? laneNear(tier) : null, item: set ? speedItem(set) : undefined,
      };
    })
    .sort((a, b) => b.speed - a.speed);

  const available = !tile('meta').unavailable;
  const threats = ratingThreats(rating, data);
  return {
    coverage: { cells, defense: tile('defense').value, offense: tile('strength').value },
    // Ruoli: lo stesso conteggio di ovunque (essenziali e importanti coperte sul totale, poi i punti: "8/8 +2")
    roles: { chips, members: team.map(set => battleName(set)), value: rolesValue(rating.roles), ...rolesCount(rating.roles) },
    speed: {
      lanes, median: poolMedian(data), vsMeta: usesMeta(data),
      control: rating.speed.sources.map(s => ({ condition: s.condition, move: s.move, by: s.by })),
      value: tile('speed').value,
    },
    threats: {
      pods: threats.filter(x => !x.handledBy.length).sort((a, b) => b.usage - a.usage).map(x => ({ species: x.name, usage: x.usage })),
      list: available ? metaThreats(rating, data) : [],
      total: threats.length,
      available,
      metaOff: !!data.ignoreMeta,
    },
  };
}
