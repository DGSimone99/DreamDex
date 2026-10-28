import type { ReactNode } from 'react';
import { PokemonIcon } from '../PokemonName';

/** Il membro nella prima colonna delle tabelle della Difesa: icona del box (nitida anche piccola, cresce con la riga) e nome. */
export function MemberMon({ name, children }: { name: string; children?: ReactNode }) {
  return <span className="ad-mon def-mon"><span className="def-box"><PokemonIcon name={name} /></span>{name}{children}</span>;
}
