/**
 * Pezzi in comune fra fetch-games.ts e fetch-replays.ts: la copia locale dei log e la forma da squadra di un Pokémon
 * visto in battaglia.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dex, toID } from '../src/engine/dex';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** I log scaricati restano in data/replay-logs (fuori da git): rileggerli col parser corretto non riscarica niente. */
const LOG_DIR = join('data', 'replay-logs');

/** Log di una partita: dalla copia locale se c'è, altrimenti da Showdown (null se non esiste più). */
export async function replayLog(id: string, delay = 300): Promise<string | null> {
  const file = join(LOG_DIR, `${id}.log`);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://replay.pokemonshowdown.com/${id}.log`, { headers: { 'User-Agent': 'DreamDex bench (personal project)' } });
      await sleep(delay);
      if (res.ok) {
        const log = await res.text();
        mkdirSync(LOG_DIR, { recursive: true });
        writeFileSync(file, log);
        return log;
      }
      if (res.status === 404) return null;
    } catch { /* riprova */ }
    await sleep(2000);
  }
  return null;
}

/**
 * La forma da squadra di una forma vista in battaglia: Mimikyu-Busted → Mimikyu, Ogerpon-Wellspring-Tera →
 * Ogerpon-Wellspring, Palafin-Hero → Palafin. Le Mega, le Archeo e Zacian/Zamazenta-Crowned restano: il resto
 * dell'app le conosce così.
 */
export function teamForme(name: string): string {
  const species = dex.species.get(name);
  if (!species.exists || typeof species.battleOnly !== 'string') return name;
  if (species.isMega || species.isPrimal || species.forme === 'Crowned') return name;
  return species.battleOnly;
}

/** Se la forma può avere l'abilità (per una Mega valgono anche quelle della forma base, rivelate prima di evolversi). */
export function canHaveAbility(forme: string, ability: string): boolean {
  const species = dex.species.get(forme);
  if (!species.exists) return true;
  const id = toID(ability);
  const own = (s: typeof species) => Object.values(s.abilities).some(a => toID(a) === id);
  return own(species) || ((species.isMega || species.isPrimal || !!species.battleOnly) && own(dex.species.get(species.baseSpecies)));
}
