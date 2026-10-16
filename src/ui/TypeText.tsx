import { Fragment, type ReactNode } from 'react';
import { getMove, speciesNames } from '../engine/dex';
import { TYPES, type TypeName } from '../engine/types';
import { TYPE_COLORS } from './Sprite';
import { TypeDot } from './PokemonName';
import type { Lang } from '../i18n';
import { gameName, gameNamesVersion, namesWithTypes, typeName, typeNames } from '../i18n/game';
import { useLang } from '../i18n/react';

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
  const lang = useLang();
  return <span className="type-name" style={{ color: typeTextColor(type) }}>{typeName(type, lang)}</span>;
}

/** Il nome di una mossa, nel colore del suo tipo. */
export function MoveName({ move }: { move: string }) {
  const lang = useLang();
  const type = getMove(move)?.type;
  return <span className="move-name" style={type ? { color: typeTextColor(type) } : undefined}>{gameName('move', move, lang)}</span>;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Nomi dei Pokémon (i più lunghi prima: "Charizard-Mega-Y" prima di "Charizard") e tipi, come parole a sé:
// "Debole a Ground" sì, "Calyrex-Ice" o "Rotom-Fire" non sono tipi
const SPECIES = speciesNames().sort((a, b) => b.length - a.length).map(escape);
// Una regex per lingua: in italiano i tipi sono "Terra", "Spettro"… (solo con l'iniziale maiuscola).
// Per lingua e versione dei nomi: caricati i nomi italiani, si ricostruisce
const NAMED = new Map<string, { regex: RegExp; english: Map<string, string> }>();
function namedFor(lang: Lang) {
  const key = `${lang}:${gameNamesVersion()}`;
  let entry = NAMED.get(key);
  if (!entry) {
    const types = typeNames(lang);
    const local = types.map(x => escape(x.local)).sort((a, b) => b.length - a.length);
    // Mosse/abilità/strumenti che contengono un tipo ("Pugno Fuoco"): presi interi, così il tipo dentro non si colora
    const kept = namesWithTypes(lang).sort((a, b) => b.length - a.length).map(escape);
    entry = {
      regex: new RegExp(`(?<![\\w-])(?:(${SPECIES.join('|')})|(${kept.length ? kept.join('|') : '(?!)'})|(${local.join('|')}))(?![\\w-])`, 'g'),
      english: new Map(types.map(x => [x.local, x.english])),
    };
    NAMED.set(key, entry);
  }
  return entry;
}

/** Testo libero con i nomi dei tipi colorati e quelli dei Pokémon in grassetto. */
export function Typed({ text }: { text: string }) {
  const lang = useLang();
  const { regex, english } = namedFor(lang);
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    parts.push(match[1]
      ? <span key={index} className="mon-ref"><TypeDot name={match[1]} /><strong>{match[1]}</strong></span>
      : match[2] ? match[2]
      : <TypeLabel key={index} type={english.get(match[3]) ?? match[3]} />);
    last = index + match[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)}</>;
}
