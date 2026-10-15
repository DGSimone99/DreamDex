import { Icons } from '@pkmn/img';
import { Fragment } from 'react';
import { getSpecies } from '../engine/dex';
import { typeColor } from './Sprite';

/** Pallino nel colore del tipo del Pokémon: diviso a metà per i doppi tipi. */
export function TypeDot({ name }: { name: string }) {
  const types = getSpecies(name)?.types;
  if (!types) return null;
  const [first, second = first] = types.map(typeColor);
  return (
    <span
      className="type-dot"
      aria-hidden="true"
      title={types.join(' / ')}
      style={{ background: `linear-gradient(90deg, ${first} 50%, ${second} 50%)` }}
    />
  );
}

/** Mini sprite "chibi" del Pokémon (40×30, le icone dei menu di Showdown). */
export function PokemonIcon({ name }: { name: string }) {
  if (!getSpecies(name)) return null;
  const { css } = Icons.getPokemon(name);
  return <span className="mon-icon" aria-hidden="true" style={css as React.CSSProperties} />;
}

/** Nome del Pokémon in grassetto, con il pallino del tipo (o la mini icona) davanti. */
export function PokemonName({ name, muted = false, icon = false }: { name: string; muted?: boolean; icon?: boolean }) {
  return (
    <span className={`mon-name${muted ? ' muted' : ''}`}>
      {icon ? <PokemonIcon name={name} /> : <TypeDot name={name} />}
      <strong>{name}</strong>
    </span>
  );
}

/** Elenco di Pokémon: "A, B" oppure "A o B". */
export function PokemonList({ names, separator = ', ' }: { names: string[]; separator?: string }) {
  return (
    <>
      {names.map((name, i) => (
        <Fragment key={name}>{i > 0 && separator}<PokemonName name={name} /></Fragment>
      ))}
    </>
  );
}
