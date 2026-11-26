import type { ReactNode } from 'react';
import type { TeamSet } from '../engine/sets';
import { PokemonIcon } from './PokemonName';
import { useT } from '../i18n/react';

/**
 * Telefono e tablet piccolo, le tabelle dell'Analisi "una sopra l'altra": una riga con l'etichetta corta a sinistra e la
 * barra (o il valore) larga quanto lo schermo, niente da scorrere di lato.
 */
export const barRow = (label: string, cell: ReactNode, key: string, extra?: string) => (
  <tr key={key} className={`og-bar-row${extra ? ` ${extra}` : ''}`}>
    <th scope="row" className="og-bar-label">{label}</th>
    <td colSpan={2}>{cell}</td>
  </tr>
);

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
 * La testata delle tabelle girate (telefono e tablet: tipi o minacce in riga, i membri in colonna): nell'angolo il nome
 * delle righe per i lettori di schermo, poi un'icona per membro (la sua carta passandoci sopra, `bind`). La colonna del
 * membro scelto (`focusSlot`) resta accesa; `cellProps` aggiunge alla casella i gestori della tabella (fuoco, passaggio).
 */
export function FlipHead({ corner, team, nameOf, bind, focusSlot, cellProps }: {
  corner: string;
  team: TeamSet[];
  nameOf: (set: TeamSet, i: number) => string;
  bind: (set: TeamSet) => object;
  focusSlot?: number | null;
  cellProps?: (i: number) => object;
}) {
  return (
    <thead>
      <tr>
        <th scope="col" className="def-mon-h"><span className="visually-hidden">{corner}</span></th>
        {team.map((set, i) => {
          const name = nameOf(set, i);
          return (
            <th key={`${name}-${i}`} scope="col" className={`ct-mon-h${focusSlot === i ? ' kf-col' : ''}`} {...cellProps?.(i)}>
              <span className="ct-mon-box" {...bind(set)}><PokemonIcon name={name} /></span>
              <span className="visually-hidden">{name}</span>
            </th>
          );
        })}
      </tr>
    </thead>
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
