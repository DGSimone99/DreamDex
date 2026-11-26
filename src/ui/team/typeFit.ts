import { createContext } from 'react';

/**
 * Tipi nelle carte del team, a passi uguali per tutte le carte (TeamPanel misura la fila e scende di un passo appena
 * una delle coppie del team non entra): 3 = una larghezza unica (il nome più lungo), 2 = tre larghezze fisse (nomi
 * corti, medi, lunghi), 1 = larghezza che segue il nome (scritta più piccola nelle carte strette), 0 = solo le icone.
 */
export const TypeTextContext = createContext(true);

export const TYPE_STEPS = ['icons', 'fit', 'sized', 'full'] as const;

export const typesOverflow = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>('.slot-card .types')].some(row => row.scrollWidth > row.clientWidth + 1);

/** Nome tagliato: righe in più della seconda o puntini. Qualche px di tolleranza: il corsivo sborda un poco a destra. */
// In larghezza 1px di tolleranza (la pendenza del corsivo): il nome su una riga sola tagliato di 2px si vede
export const nameCut = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 1;
