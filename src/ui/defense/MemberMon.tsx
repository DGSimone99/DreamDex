import type { ReactNode } from 'react';
import { battleSpecies, effectiveStats, getSpecies } from '../../engine/dex';
import type { TeamSet } from '../../engine/sets';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';
import { TypeIcons } from '../typeIcons';

/** Il set del team per una specie della Difesa (che usa il nome in battaglia, es. le Mega). */
export const setOf = (team: TeamSet[], species: string) => team.find(set => (battleSpecies(set)?.name ?? set.species) === species);

/**
 * Il membro nella prima colonna delle tabelle della Difesa: icona del box (nitida anche piccola, cresce con la riga), nome e
 * tipi; con `stats` sotto il nome PS, Difesa e Difesa Speciale base (coi simboli, i nomi per lo screen reader).
 */
export function MemberMon({ name, set, stats = false, children }: { name: string; set?: TeamSet; stats?: boolean; children?: ReactNode }) {
  const t = useT();
  const species = set ? battleSpecies(set) : getSpecies(name);
  const base = stats && set ? effectiveStats(set) : null;
  return (
    <span className="ad-mon def-mon">
      <span className="def-box"><PokemonIcon name={name} /></span>
      <span className="def-mon-text">
        <span className="def-mon-line">
          <span className="def-mon-name">{name}</span>
          {species && <TypeIcons types={species.types} className="def-mon-types" />}
          {children}
        </span>
        {base && (
          <span className="def-mon-stats">
            <span title={t('stat.hp')}><Icon name="heart" /><span className="visually-hidden">{t('stat.hp')}</span>{base.hp}</span>
            <span title={t('stat.def')}><Icon name="physical" /><span className="visually-hidden">{t('stat.def')}</span>{base.def}</span>
            <span title={t('stat.spd')}><Icon name="special" /><span className="visually-hidden">{t('stat.spd')}</span>{base.spd}</span>
          </span>
        )}
      </span>
    </span>
  );
}
