import type { CSSProperties } from 'react';
import { useState } from 'react';
import { battleSpecies, getSpecies, toID } from '../engine/dex';
import type { TypeName } from '../engine/types';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';

/** Colori classici dei tipi. */
export const TYPE_COLORS: Record<TypeName, string> = {
  Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030', Grass: '#78C850', Ice: '#98D8D8',
  Fighting: '#C03028', Poison: '#A040A0', Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
  Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848', Steel: '#B8B8D0', Fairy: '#EE99AC',
};

/** Testo scuro sui tipi chiari, bianco su quelli scuri. */
export function inkFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#10142b' : '#ffffff';
}

export const typeColor = (type: string): string => TYPE_COLORS[type as TypeName] ?? '#8890b0';

export function TypeChip({ type }: { type: string }) {
  const lang = useLang();
  const color = typeColor(type);
  const label = typeName(type, lang);
  // Nomi lunghi ("Coleottero"): testo ridotto, così il chip resta della stessa larghezza degli altri
  // Colore in una variabile: nelle card del team lo sfondo è un parallelogramma disegnato a parte
  return <span className={`type-chip${label.length > 8 ? ' long' : ''}`} style={{ '--chip': color, color: inkFor(color) } as CSSProperties}>{label}</span>;
}

/** Id degli sprite di Showdown: "landorus-therian", "charizard-megay". */
function spriteId(name: string): string | null {
  const species = getSpecies(name);
  if (!species) return null;
  const base = toID(species.baseSpecies);
  return species.forme ? `${base}-${toID(species.forme)}` : base;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Sprite del Pokémon (la forma Mega se tiene la sua pietra). Se manca, resta lo spazio vuoto.
 * Con `animated` sopra lo statico va l'idle animato di Showdown (gen5ani): lo statico resta visibile
 * finché l'animato non è caricato, e resta da solo se l'animazione non esiste o il sistema riduce le animazioni.
 */
export function Sprite({ species, item = '', size = 96, animated = false, shiny = false }: { species: string; item?: string; size?: number; animated?: boolean; shiny?: boolean }) {
  const name = battleSpecies({ species, item })?.name ?? species;
  const id = spriteId(name);
  const [failed, setFailed] = useState<string | null>(null);
  const [ani, setAni] = useState<{ id: string; ready: boolean; failed: boolean; height?: number } | null>(null);
  if (!id || failed === id) return <span className="sprite missing" style={{ width: size, height: size }} aria-hidden="true" />;
  const state = ani?.id === id ? ani : { id, ready: false, failed: false };
  const showAni = animated && !state.failed && !reducedMotion();
  return (
    <>
      <img
        className={`sprite${showAni && state.ready ? ' covered' : ''}`}
        src={`https://play.pokemonshowdown.com/sprites/gen5${shiny ? '-shiny' : ''}/${id}.png`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(id)}
      />
      {showAni && (
        <img
          className="sprite-ani"
          src={`https://play.pokemonshowdown.com/sprites/gen5ani${shiny ? '-shiny' : ''}/${id}.gif`}
          alt=""
          // Altezza vera della GIF (ritagliata sul Pokémon, da ~40 a 143 px): il CSS la usa per farla stare nella card
          style={state.height ? { '--ani-h': state.height } as CSSProperties : undefined}
          onLoad={e => setAni({ id, ready: true, failed: false, height: e.currentTarget.naturalHeight || undefined })}
          onError={() => setAni({ id, ready: false, failed: true })}
        />
      )}
    </>
  );
}
