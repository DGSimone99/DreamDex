import { Fragment } from 'react';
import { getMove } from '../engine/dex';
import { TYPES, type TypeName } from '../engine/types';
import { TYPE_COLORS } from './Sprite';

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

// Un tipo come parola a sé: "Debole a Ground" sì, "Calyrex-Ice" o "Rotom-Fire" no
const TYPE_WORD = new RegExp(`(?<![\\w-])(${TYPES.join('|')})(?![\\w-])`, 'g');

/** Testo libero con i nomi dei tipi colorati. */
export function Typed({ text }: { text: string }) {
  const parts = text.split(TYPE_WORD);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1
        ? <TypeLabel key={i} type={part} />
        : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}
