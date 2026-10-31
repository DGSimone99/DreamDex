import type { ReactNode } from 'react';
import { battleSpecies, getSpecies } from '../../engine/dex';
import { speedStat } from '../../engine/speed';
import { statLines } from '../../engine/statCalc';
import type { TeamSet } from '../../engine/sets';
import { useT } from '../../i18n/react';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';
import { TypeIcons } from '../typeIcons';

/** Il set del team per una specie della Difesa (che usa il nome in battaglia, es. le Mega). */
export const setOf = (team: TeamSet[], species: string) => team.find(set => (battleSpecies(set)?.name ?? set.species) === species);

/**
 * Il membro nella prima colonna delle tabelle della Difesa: icona del box (nitida anche piccola, cresce con la riga), nome e
 * tipi; con `stats` sotto il nome PS, Difesa e Difesa Speciale finali (con `'offense'`: Attacco, Attacco Speciale e Velocità; livello 100, con EV, IV e natura: in verde o rosso
 * se la natura le alza o le abbassa; con `'speed'`: solo la Velocità reale, Sciarpa compresa), coi simboli e i nomi per lo screen reader. `children` (es. "Anello debole") va accanto
 * alle statistiche, così il nome resta intero.
 */
export function MemberMon({ name, set, stats = false, children }: { name: string; set?: TeamSet; stats?: boolean | 'offense' | 'speed'; children?: ReactNode }) {
  const t = useT();
  const species = set ? battleSpecies(set) : getSpecies(name);
  const lines = stats && set ? statLines(set) : null;
  const stat = (id: 'hp' | 'def' | 'spd' | 'atk' | 'spa' | 'spe', icon: 'heart' | 'physical' | 'special' | 'speed') => {
    const line = lines!.find(l => l.stat === id)!;
    return (
      <span className={line.nature ?? undefined} title={t(`stat.${id}`)}>
        <Icon name={icon} /><span className="visually-hidden">{t(`stat.${id}`)}</span>{line.value}
      </span>
    );
  };
  /** La Velocità reale del set (EV, natura e Sciarpa Scelta), col segno della Sciarpa. */
  const realSpeed = (s: TeamSet) => {
    const real = speedStat(s);
    const line = lines!.find(l => l.stat === 'spe')!;
    return (
      <span className={line.nature ?? undefined} title={t('stat.spe')}>
        <Icon name="speed" /><span className="visually-hidden">{t('stat.spe')}</span>{real.value}
        {real.scarf && <small className="sp-mark">{t('sdetail.mark.scarf')}</small>}
      </span>
    );
  };
  return (
    <span className="ad-mon def-mon">
      <span className="def-box"><PokemonIcon name={name} /></span>
      <span className="def-mon-text">
        <span className="def-mon-line">
          <span className="def-mon-name">{name}</span>
          {species && <TypeIcons types={species.types} className="def-mon-types" />}
          {children && <span className="def-mon-tag line">{children}</span>}
        </span>
        {lines && <span className="def-mon-stats">{stats === 'offense'
          ? <>{stat('atk', 'physical')}{stat('spa', 'special')}{stat('spe', 'speed')}</>
          : stats === 'speed' ? realSpeed(set!) : <>{stat('hp', 'heart')}{stat('def', 'physical')}{stat('spd', 'special')}</>}{children && <span className="def-mon-tag">{children}</span>}</span>}
      </span>
    </span>
  );
}
