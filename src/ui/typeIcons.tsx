import type { CSSProperties } from 'react';
import type { TypeName } from '../engine/types';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { hint } from './MoveTip';
import { typeColor } from './Sprite';

// Icone ufficiali di Scarlatto/Violetto (PokeAPI sprites, types/generation-ix/scarlet-violet/small; grafica Nintendo),
// incluse nel bundle da Vite: niente rete a runtime
const TYPE_ICONS = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/types/*.png', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/**
 * L'icona del tipo come quadretto alla Champions (prova 2026-11-22): il colore del tipo dietro l'icona tonda, angoli
 * appena smussati (classe `ti-sq`, in marks.css). Da mettere sull'img insieme a `className="ti-sq"`.
 */
export const tileStyle = (type: string) => ({ '--c': typeColor(type) }) as CSSProperties;

/** L'indirizzo dell'icona del tipo ("Fire" → fire.png). */
export const typeIconUrl = (type: string): string | undefined => TYPE_ICONS[type.toLowerCase()];

/**
 * Le icone tonde dei tipi, decorative: una per un tipo solo, due sovrapposte per i doppi tipi (la seconda scivola
 * sotto la prima). Il nome dei tipi va nel testo vicino, nel tooltip (`title`) o, con `hints`, nel fumetto di ogni
 * icona (dove le icone stanno da sole, senza il nome scritto).
 */
export function TypeIcons({ types, title, className = '', hints = false, bubble }: { types: readonly string[]; title?: string; className?: string; hints?: boolean; bubble?: string }) {
  const lang = useLang();
  // `bubble`: il nome dei tipi nel fumetto dell'app per tutto il gruppo (al posto del titolo del browser)
  return (
    <span className={`type-icons${className ? ` ${className}` : ''}`} aria-hidden="true" title={hints || bubble ? undefined : title} {...(bubble ? hint(bubble) : {})}>
      {types.map(type => <img key={type} className="ti-sq" style={tileStyle(type)} src={typeIconUrl(type)} alt="" draggable={false} {...(hints ? hint(typeName(type as TypeName, lang)) : {})} />)}
    </span>
  );
}
