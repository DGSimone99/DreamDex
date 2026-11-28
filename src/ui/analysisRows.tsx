import type { ReactNode } from 'react';
import { PokemonIcon } from './PokemonName';
import { useT } from '../i18n/react';

/**
 * Una riga della scheda dal basso di Coverage e Meta: l'icona e il nome del membro (sotto, piccolo, `sub`), poi i suoi
 * valori; senza valori un trattino. `dim`: con "Solo superefficaci" la riga senza superefficace si attenua.
 */
export function SheetRow({ className, dim, name, sub, children }: {
  className: string;
  dim?: boolean;
  name: string;
  sub?: ReactNode;
  children: ReactNode | null;
}) {
  return (
    <li className={`ct-sheet-row ${className}${dim ? ' eff-dim' : ''}`}>
      <PokemonIcon name={name} />
      <span className="ct-sheet-name">{name}{sub}</span>
      {children ?? <span className="ct-sheet-none">—</span>}
    </li>
  );
}

/** "Mostra altre N (ne restano M)" sotto le carte del meta: ogni clic ne aggiunge `step`. */
export function MoreCards({ left, step, onMore }: { left: number; step: number; onMore: () => void }) {
  const t = useT();
  return (
    <button type="button" className="cm-cards-more" onClick={onMore}>
      {t('odetail.cards.more', { n: Math.min(step, left), left })}
    </button>
  );
}

/**
 * Dentro la casella di una minaccia nella griglia Meta: la sprite (la carta del Pokémon passandoci sopra, `bind`), il nome
 * sotto (nelle colonne, `named`) e il filo nel colore di quanti la coprono o la reggono (`tone`).
 */
export function MetaHeadMon({ species, bind, tone, named = false }: { species: string; bind: object; tone: string; named?: boolean }) {
  return (
    <>
      <span className="def-box cm-head-mon" {...bind}><PokemonIcon name={species} /></span>
      {named && <span className="cm-head-name" aria-hidden="true">{species}</span>}
      <span className={`cm-flag ${tone}`} aria-hidden="true" />
    </>
  );
}
