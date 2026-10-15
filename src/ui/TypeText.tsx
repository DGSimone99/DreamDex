import { Fragment, type ReactNode } from 'react';
import { getMove, speciesNames } from '../engine/dex';
import { TYPES, type TypeName } from '../engine/types';
import { TYPE_COLORS } from './Sprite';
import { TypeDot } from './PokemonName';

const PANEL = '#0f1735';

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const hexToRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** Il colore del tipo, schiarito quanto basta per leggersi come testo sul fondo scuro (contrasto ≥ 6, uniforme tra i tipi). */
function readable(hex: string): string {
  const base = hexToRgb(hex);
  const background = luminance(hexToRgb(PANEL));
  for (let mix = 0; mix <= 1; mix += 0.05) {
    const rgb = base.map(c => Math.round(c + (255 - c) * mix));
    if ((luminance(rgb) + 0.05) / (background + 0.05) >= 6) return `rgb(${rgb.join(', ')})`;
  }
  return '#ffffff';
}

const TEXT_COLORS = Object.fromEntries(TYPES.map(type => [type, readable(TYPE_COLORS[type])])) as Record<TypeName, string>;

export const typeTextColor = (type: string): string | undefined => TEXT_COLORS[type as TypeName];

/** Il nome di un tipo, nel suo colore. */
export function TypeLabel({ type }: { type: string }) {
  return <span className="type-name" style={{ color: typeTextColor(type) }}>{type}</span>;
}

/** Il nome di una mossa, nel colore del suo tipo. */
export function MoveName({ move }: { move: string }) {
  const type = getMove(move)?.type;
  return <span className="move-name" style={type ? { color: typeTextColor(type) } : undefined}>{move}</span>;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Nomi dei Pokémon (i più lunghi prima: "Charizard-Mega-Y" prima di "Charizard") e tipi, come parole a sé:
// "Debole a Ground" sì, "Calyrex-Ice" o "Rotom-Fire" non sono tipi
const SPECIES = speciesNames().sort((a, b) => b.length - a.length).map(escape);
const NAMED = new RegExp(`(?<![\\w-])(?:(${SPECIES.join('|')})|(${TYPES.join('|')}))(?![\\w-])`, 'g');

/** Testo libero con i nomi dei tipi colorati e quelli dei Pokémon in grassetto. */
export function Typed({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(NAMED)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(match[1]
      ? <span key={index} className="mon-ref"><TypeDot name={match[1]} /><strong>{match[1]}</strong></span>
      : <TypeLabel key={index} type={match[2]} />);
    last = index + match[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</>;
}
