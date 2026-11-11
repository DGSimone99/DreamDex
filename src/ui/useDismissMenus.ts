import { useEffect } from 'react';

/** I menu a tendina fatti con <details>: Formato, Import / Export, Team salvati, Filtri, Spread più usati. */
const MENUS = 'details.popover[open], details.filters[open], details.spread-panel[open]';

/**
 * I menu aperti si chiudono con un clic in qualunque altro punto della pagina, o con Esc (il fuoco torna al pulsante
 * del menu). Un clic dentro il menu lo lascia aperto; aprirne uno chiude gli altri.
 */
export function useDismissMenus(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(MENUS)) {
        // Sul telefono il menu ha uno sfondo scuro (il ::before del menu stesso): toccarlo chiude il menu
        if (target && target !== menu && menu.contains(target)) continue;
        menu.open = false;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const open = [...document.querySelectorAll<HTMLDetailsElement>(MENUS)];
      if (!open.length) return;
      // Esc chiude solo il menu, non anche l'editor o la finestra sotto
      event.stopPropagation();
      for (const menu of open) menu.open = false;
      const inside = open.find(menu => menu.contains(document.activeElement));
      inside?.querySelector<HTMLElement>(':scope > summary')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
