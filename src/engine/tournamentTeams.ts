import { battleName, battleSpecies, getSpecies, toID } from './dex';
import { emptySet, STAT_IDS, type StatID, type TeamSet } from './sets';

/** Una squadra da torneo (fonte pkmn): nome, autore e i suoi Pokémon. */
export interface TournamentTeam { name: string; author: string; team: TeamSet[] }

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

function stats(value: unknown): Partial<Record<StatID, number>> {
  const out: Partial<Record<StatID, number>> = {};
  if (isRecord(value)) for (const id of STAT_IDS) if (typeof value[id] === 'number') out[id] = value[id] as number;
  return out;
}

/** Un set della fonte nella forma dell'app; i campi che mancano si riempiono come in `emptySet`. */
function normalizeSet(raw: unknown): TeamSet | null {
  if (!isRecord(raw)) return null;
  const species = text(raw.species);
  if (!species) return null;
  const base = emptySet(species);
  const ivs = stats(raw.ivs);
  const teraType = text(raw.teraType);
  return {
    ...base,
    item: typeof raw.item === 'string' ? raw.item : base.item,
    ability: text(raw.ability) ?? base.ability,
    moves: Array.isArray(raw.moves) ? raw.moves.filter((m): m is string => typeof m === 'string' && !!m).slice(0, 4) : [],
    nature: text(raw.nature) ?? base.nature,
    evs: stats(raw.evs),
    ...(Object.keys(ivs).length ? { ivs } : {}),
    ...(teraType ? { teraType } : {}),
  };
}

/** Il JSON della fonte (lista di `{ name, author?, data: Set[] }`) o quello già salvato da fetch-data (`team: Set[]`): tiene le squadre da 1 a 6 set validi, scarta il resto. */
export function normalizeTeams(raw: unknown): TournamentTeam[] {
  if (!Array.isArray(raw)) return [];
  const teams: TournamentTeam[] = [];
  for (const entry of raw) {
    const sets = isRecord(entry) ? (Array.isArray(entry.data) ? entry.data : entry.team) : null;
    if (!isRecord(entry) || !Array.isArray(sets) || sets.length < 1 || sets.length > 6) continue;
    const team = sets.map(normalizeSet);
    if (team.some(set => !set)) continue;
    teams.push({ name: text(entry.name) ?? '', author: text(entry.author) ?? '', team: team as TeamSet[] });
  }
  return teams;
}

/**
 * La forma in battaglia e, solo per chi cambia forma in battaglia (Mega, Primal, forme da pietra o da lotta), la
 * specie da cui parte: Charizard combacia con Charizard-Mega-Y, ma Rotom-Wash non con Rotom-Heat né Ninetales con
 * Ninetales-Alola.
 */
function identity(set: TeamSet): { exact: string; base: string | null } {
  const battle = battleSpecies(set);
  const exact = toID(battleName(set));
  const changes = !!battle && (!!battle.battleOnly || battle.name !== getSpecies(set.species)?.name);
  const from = battle && (typeof battle.battleOnly === 'string' ? battle.battleOnly : battle.baseSpecies);
  return { exact, base: changes && from ? toID(from) : null };
}

/** Lo stesso Pokémon: stessa forma, oppure uno dei due cambia forma in battaglia e parte dall'altro (o dalla stessa specie). */
const samePokemon = (a: { exact: string; base: string | null }, b: { exact: string; base: string | null }) =>
  a.exact === b.exact || (!!a.base && (a.base === b.exact || a.base === b.base)) || (!!b.base && b.base === a.exact);

/** Le squadre con gli indici dei loro Pokémon in comune col team attuale, da quelle con più in comune; a parità, ordine della fonte. */
export function rankTournamentTeams(teams: TournamentTeam[], current: TeamSet[]): { entry: TournamentTeam; shared: number[] }[] {
  const mine = current.map(identity);
  return teams
    .map((entry, order) => ({ entry, order, shared: entry.team.flatMap((set, i) => {
      const theirs = identity(set);
      return mine.some(other => samePokemon(theirs, other)) ? [i] : [];
    }) }))
    .sort((a, b) => b.shared.length - a.shared.length || a.order - b.order)
    .map(({ entry, shared }) => ({ entry, shared }));
}
