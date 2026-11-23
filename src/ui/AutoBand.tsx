import { useRef, type MutableRefObject, type ReactNode } from 'react';
import { useAutoCollapse } from './useAutoCollapse';

/**
 * La fascia del team. Sul telefono si riduce da sola scorrendo (useAutoCollapse): lo stato vive qui e non nell'app,
 * così il cambio ridisegna solo il team e il voto, non tutta la pagina (è immediato, la striscia compare al punto giusto
 * a qualunque velocità si scorra). `control` riceve la funzione che lo riduce e riporta la pagina in cima.
 */
export function AutoBand({ phone, collapsed: fixed, control, off = false, children }: {
  phone: boolean;
  /** Ridotto o no fuori dal telefono (il tasto, l'editor aperto) */
  collapsed: boolean;
  control: MutableRefObject<(() => void) | null>;
  /** Nascosta (telefono fuori dalla scheda Pokémon): resta montata, coi suoi stati e l'editor. */
  off?: boolean;
  children: (collapsed: boolean) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const auto = useAutoCollapse(phone, ref);
  control.current = auto.collapseToTop;
  const collapsed = phone ? auto.collapsed : fixed;
  return <div ref={ref} className={`band${collapsed ? ' collapsed' : ''}${phone ? ' auto' : ''}${off ? ' off' : ''}`}>{children(collapsed)}</div>;
}
