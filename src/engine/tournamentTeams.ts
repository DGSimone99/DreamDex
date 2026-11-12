import { battleName, getSpecies, toID } from './dex';
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

/** Il JSON della fonte (lista di `{ name, author?, data: Set[] }`): tiene le squadre da 1 a 6 set validi, scarta il resto. */
export function normalizeTeams(raw: unknown): TournamentTeam[] {
  if (!Array.isArray(raw)) return [];
  const teams: TournamentTeam[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || !Array.isArray(entry.data) || entry.data.length < 1 || entry.data.length > 6) continue;
    const team = entry.data.map(normalizeSet);
    if (team.some(set => !set)) continue;
    teams.push({ name: text(entry.name) ?? '', author: text(entry.author) ?? '', team: team as TeamSet[] });
  }
  return teams;
}

/** Specie in battaglia e specie base: Charizard combacia con Charizard-Mega-Y. */
function identities(set: TeamSet): string[] {
  const name = battleName(set);
  return [toID(name), toID(getSpecies(name)?.baseSpecies ?? name)];
}

/** Le squadre con gli indici dei loro Pokémon in comune col team attuale, da quelle con più in comune; a parità, ordine della fonte. */
export function rankTournamentTeams(teams: TournamentTeam[], current: TeamSet[]): { entry: TournamentTeam; shared: number[] }[] {
  const mine = new Set(current.flatMap(identities));
  return teams
    .map((entry, order) => ({ entry, order, shared: entry.team.flatMap((set, i) => (identities(set).some(id => mine.has(id)) ? [i] : [])) }))
    .sort((a, b) => b.shared.length - a.shared.length || a.order - b.order)
    .map(({ entry, shared }) => ({ entry, shared }));
}
