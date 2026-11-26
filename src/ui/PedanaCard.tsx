import type { ReactNode, Ref } from 'react';
import { Sprite, typePair } from './Sprite';
import { TypeIcons } from './typeIcons';

/**
 * Lo sfondo delle carte Pedana: la striscia dei tipi in cima, la luce dall'alto (`beam`: le carte della lista e del meta)
 * e la pedana con il disco sotto lo sprite.
 */
export function PedanaBack({ beam = false }: { beam?: boolean }) {
  return (
    <>
      <span className="pedana-stripe" aria-hidden="true" />
      {beam && <span className="pedana-beam" aria-hidden="true" />}
      <span className="pedana-stage" aria-hidden="true"><span className="pedana-disc" /></span>
    </>
  );
}

/**
 * La carta Pedana delle schede dell'Analisi (pedana.css): la striscia dei tipi in cima, lo sprite sulla pedana col nome
 * (la parte alta apre la scheda del Pokémon), l'etichetta, le icone dei tipi, poi il contenuto della scheda (barre, righe).
 */
export function PedanaCard({ className, types, name, species, item, size = 80, openLabel, onOpen, disabled, openRef, tag, children }: {
  /** Le classi dopo `og-card pedana-face` (es. "wall", "cm-card ok"). */
  className?: string;
  types: readonly string[];
  name: string;
  species: string;
  item?: string;
  size?: number;
  openLabel: string;
  onOpen: () => void;
  disabled?: boolean;
  openRef?: Ref<HTMLButtonElement>;
  /** L'etichetta sotto il nome (quota, velocità, posizione nel meta). */
  tag: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`og-card pedana-face${className ? ` ${className}` : ''}`}
      style={typePair(types)}>
      <PedanaBack />
      <button ref={openRef} type="button" className="og-card-open" disabled={disabled} aria-label={openLabel} onClick={onOpen}>
        <span className="og-card-sprite" aria-hidden="true"><Sprite species={species} item={item} size={size} /></span>
        <span className="og-card-name">{name}</span>
      </button>
      {tag}
      <TypeIcons types={types} className="og-card-types" />
      {children}
    </li>
  );
}
