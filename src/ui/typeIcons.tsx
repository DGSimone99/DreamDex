// Icone ufficiali di Scarlatto/Violetto (PokeAPI sprites, types/generation-ix/scarlet-violet/small; grafica Nintendo),
// incluse nel bundle da Vite: niente rete a runtime
const TYPE_ICONS = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/types/*.png', { eager: true, import: 'default' }))
    .map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]),
);

/** L'indirizzo dell'icona del tipo ("Fire" → fire.png). */
export const typeIconUrl = (type: string): string | undefined => TYPE_ICONS[type.toLowerCase()];

/**
 * Le icone tonde dei tipi, decorative: una per un tipo solo, due sovrapposte per i doppi tipi (la seconda scivola
 * sotto la prima). Il nome dei tipi va nel tooltip (`title`) o nel testo vicino.
 */
export function TypeIcons({ types, title, className = '' }: { types: readonly string[]; title?: string; className?: string }) {
  return (
    <span className={`type-icons${className ? ` ${className}` : ''}`} aria-hidden="true" title={title}>
      {types.map(type => <img key={type} src={typeIconUrl(type)} alt="" draggable={false} />)}
    </span>
  );
}
