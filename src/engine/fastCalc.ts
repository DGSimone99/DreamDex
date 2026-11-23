import { Field, Move, Pokemon } from '@smogon/calc';

/**
 * La libreria dei danni più veloce, con gli stessi risultati. Il voto del team fa migliaia di colpi (e sul telefono
 * secondi di calcolo prima che la pagina si mostri): il tempo andava quasi tutto in due cose della libreria.
 *
 * 1. Le domande "ha questa abilità / questo strumento / è questa mossa?" (hasAbility('Aerilate', 'Galvanize', …)): la
 *    libreria ricopia ogni volta i nomi in una lista nuova prima di cercarci dentro, e le chiama migliaia di volte per
 *    colpo. Qui la stessa ricerca, sui nomi così come arrivano.
 * 2. La copia di attaccante, difensore e mossa prima di ogni colpo (il calcolo ne cambia statistiche, boost e flag):
 *    la libreria ricostruisce tutto da capo, con una copia profonda dei dati della specie. Qui la copia riusa i dati
 *    della specie (la libreria non li cambia mai: cambia solo i campi del Pokémon) e copia a parte gli oggetti che il
 *    calcolo cambia: boost, statistiche (Wonder Room scambia anche le difese grezze), IV, EV, mosse, tipi e i flag della
 *    mossa (Long Reach, Punching Glove).
 *
 * tests/engine/fastCalc.test.ts confronta danni e descrizioni con la libreria com'è, su tanti colpi.
 */
let installed = false;

/** `value` è fra gli argomenti (come `[...args].includes(value)`, senza la lista nuova). */
function among(args: IArguments, value: unknown): boolean {
  for (let i = 0; i < args.length; i++) if (args[i] === value) return true;
  return false;
}

type Names = (...names: string[]) => boolean;

export function installFastClone(): void {
  if (installed) return;
  installed = true;
  const pokemon = Pokemon.prototype as unknown as Record<string, unknown>;
  pokemon.hasAbility = function hasAbility(this: Pokemon) { return !!this.ability && among(arguments, this.ability); } as Names;
  pokemon.hasItem = function hasItem(this: Pokemon) { return !!this.item && among(arguments, this.item); } as Names;
  pokemon.hasStatus = function hasStatus(this: Pokemon) { return !!this.status && among(arguments, this.status); } as Names;
  pokemon.named = function named(this: Pokemon) { return among(arguments, this.name); } as Names;
  pokemon.hasType = function hasType(this: Pokemon) {
    const tera = this.teraType && this.teraType !== 'Stellar' ? this.teraType : null;
    for (let i = 0; i < arguments.length; i++) {
      if (tera ? tera === arguments[i] : (this.types as string[]).includes(arguments[i])) return true;
    }
    return false;
  } as Names;
  pokemon.hasOriginalType = function hasOriginalType(this: Pokemon) {
    for (let i = 0; i < arguments.length; i++) if ((this.types as string[]).includes(arguments[i])) return true;
    return false;
  } as Names;
  const move = Move.prototype as unknown as Record<string, unknown>;
  move.named = function named(this: Move) { return among(arguments, this.name); } as Names;
  move.hasType = function hasType(this: Move) { return among(arguments, this.type); } as Names;
  const field = Field.prototype as unknown as Record<string, unknown>;
  field.hasWeather = function hasWeather(this: Field) { return !!this.weather && among(arguments, this.weather); } as Names;
  field.hasTerrain = function hasTerrain(this: Field) { return !!this.terrain && among(arguments, this.terrain); } as Names;

  Pokemon.prototype.clone = function clone(this: Pokemon): Pokemon {
    const copy: Pokemon = Object.assign(Object.create(Pokemon.prototype) as Pokemon, this);
    copy.types = [...this.types] as Pokemon['types'];
    copy.ivs = { ...this.ivs };
    copy.evs = { ...this.evs };
    copy.boosts = { ...this.boosts };
    copy.rawStats = { ...this.rawStats };
    copy.stats = { ...this.stats };
    copy.moves = this.moves.slice();
    return copy;
  };
  Move.prototype.clone = function clone(this: Move): Move {
    const copy: Move = Object.assign(Object.create(Move.prototype) as Move, this);
    copy.flags = { ...this.flags };
    return copy;
  };
}

/** Le funzioni della libreria com'è, per il confronto nei test. */
const KEYS = {
  pokemon: ['hasAbility', 'hasItem', 'hasStatus', 'named', 'hasType', 'hasOriginalType', 'clone'],
  move: ['named', 'hasType', 'clone'],
  field: ['hasWeather', 'hasTerrain'],
} as const;
const protos = { pokemon: Pokemon.prototype, move: Move.prototype, field: Field.prototype } as unknown as Record<keyof typeof KEYS, Record<string, unknown>>;
const original = Object.fromEntries(Object.entries(KEYS).map(([k, keys]) => [k, Object.fromEntries(keys.map(key => [key, protos[k as keyof typeof KEYS][key]]))]));

/** Rimette la libreria com'è (solo per i test: confronto prima/dopo). */
export function uninstallFastClone(): void {
  for (const [k, fns] of Object.entries(original)) Object.assign(protos[k as keyof typeof KEYS], fns);
  installed = false;
}
