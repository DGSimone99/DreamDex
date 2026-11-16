import { battleName, dex, getMove, getSpecies, toID } from './dex';
import { statsEntry, type StatsData } from './stats';

/** Quanti Pokémon mostra la scheda Meta. */
export const META_BOARD_SIZE = 40;

/** Un Pokémon della classifica del meta. */
export interface MetaEntry { name: string; rank: number; usage: number; types: string[] }
/** Un membro del team: posizione (null = fuori dalla classifica mostrata) e uso (null = non nelle statistiche). */
export interface TeamUsage { name: string; rank: number | null; usage: number | null }
export interface MetaBoard { top: MetaEntry[]; team: TeamUsage[]; average: number | null }
/** Il set più usato di un Pokémon del meta (nomi inglesi: li traduce la UI). */
export interface MetaProfile {
  name: string; rank: number; usage: number; types: string[];
  item: { name: string; pct: number } | null;
  ability: { name: string; pct: number } | null;
  moves: { name: string; type: string; pct: number }[];
  mates: string[];
}

/** Tutti i Pokémon validi delle statistiche, dal più usato. */
function ranked(stats: StatsData | null): { name: string; usage: number; types: string[] }[] {
  if (!stats) return [];
  return Object.entries(stats.pokemon)
    .sort((a, b) => b[1].usage - a[1].usage)
    .flatMap(([name, entry]) => {
      const species = getSpecies(name);
      return species ? [{ name, usage: entry.usage, types: [...species.types] }] : [];
    });
}

const byPct = (record: Record<string, number>) => Object.entries(record).sort((a, b) => b[1] - a[1]);

/** La classifica dei più usati (al massimo `size`) e l'uso di ogni membro del team. Solo informativo: il voto non la usa. */
export function metaBoard(stats: StatsData | null, team: { species: string; item: string }[], size = META_BOARD_SIZE): MetaBoard {
  const all = ranked(stats);
  const top = all.slice(0, size).map((entry, i) => ({ ...entry, rank: i + 1 }));
  const members = team.map(set => {
    const name = battleName(set);
    const index = all.findIndex(entry => toID(entry.name) === toID(name));
    const rank = index >= 0 && index < size ? index + 1 : null;
    const usage = statsEntry(stats, name)?.usage ?? null;
    return { name, rank, usage };
  });
  const known = members.flatMap(m => (m.usage === null ? [] : [m.usage]));
  return { top, team: members, average: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null };
}

/** Strumento e abilità più usati, le 4 mosse più usate e i 5 compagni più frequenti; null se il Pokémon non c'è. */
export function metaProfile(stats: StatsData | null, name: string): MetaProfile | null {
  const entry = statsEntry(stats, name);
  const species = getSpecies(name);
  if (!entry || !species) return null;
  const all = ranked(stats);
  const rank = all.findIndex(e => toID(e.name) === toID(name)) + 1;
  const first = (record: Record<string, number>, get: (id: string) => { exists: boolean; name: string }) => {
    for (const [id, pct] of byPct(record)) {
      const found = id ? get(id) : null;
      if (found?.exists) return { name: found.name, pct };
    }
    return null;
  };
  const moves = byPct(entry.moves).flatMap(([id, pct]) => {
    const move = getMove(id);
    return move ? [{ name: move.name, type: move.type, pct }] : [];
  }).slice(0, 4);
  const mates = byPct(entry.teammates).flatMap(([mate]) => {
    const found = getSpecies(mate);
    return found ? [String(found.name)] : [];
  }).slice(0, 5);
  return {
    name: species.name, rank, usage: entry.usage, types: [...species.types],
    item: first(entry.items, id => dex.items.get(id)),
    ability: first(entry.abilities, id => dex.abilities.get(id)),
    moves, mates,
  };
}
