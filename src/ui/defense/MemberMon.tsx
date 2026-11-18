import type { ReactNode } from 'react';
import { battleSpecies, getSpecies } from '../../engine/dex';
import { speedStat } from '../../engine/speed';
import { statLines } from '../../engine/statCalc';
import type { TeamSet } from '../../engine/sets';
import { useT } from '../../i18n/react';
import { StatIcon } from '../StatIcon';
import { PokemonIcon } from '../PokemonName';
import { useMemberTip } from '../MemberCard';
import { TypeIcons } from '../typeIcons';

/** Il set del team per una specie della Difesa (che usa il nome in battaglia, es. le Mega). */
export const setOf = (team: TeamSet[], species: string) => team.find(set => (battleSpecies(set)?.name ?? set.species) === species);

/**
 * Il membro nella prima colonna delle tabelle della Difesa: icona del box (nitida anche piccola, cresce con la riga), nome e
 * tipi; con `stats` sotto il nome PS, Difesa e Difesa Speciale finali (con `'offense'`: Attacco, Attacco Speciale e Velocità; livello 100, con EV, IV e natura: in verde o rosso
 * se la natura le alza o le abbassa; la Velocità è sempre quella reale, Sciarpa compresa; con `'speed'`: solo la Velocità, scritta "Speed 300" col numero in corsivo), coi simboli e i nomi per lo screen reader. `children` (es. "Anello debole") va accanto
 * alle statistiche, così il nome resta intero. `nameTag` (nella Velocità: "priorità") va dopo il nome e i tipi.
 */
export function MemberMon({ name, set, stats = false, children, nameTag }: { name: string; set?: TeamSet; stats?: boolean | 'offense' | 'speed'; children?: ReactNode; nameTag?: ReactNode }) {
  const t = useT();
  const species = set ? battleSpecies(set) : getSpecies(name);
  const lines = stats && set ? statLines(set) : null;
  const stat = (id: 'hp' | 'def' | 'spd' | 'atk' | 'spa' | 'spe') => {
    const line = lines!.find(l => l.stat === id)!;
    return (
      <span className={line.nature ?? undefined} title={t(`stat.${id}`)}>
        <StatIcon stat={id} /><span className="visually-hidden">{t(`stat.${id}`)}</span>{line.value}
      </span>
    );
  };
  /** La Velocità reale del set (EV, natura e Sciarpa Scelta), col segno della Sciarpa. */
  const realSpeed = (s: TeamSet) => {
    const real = speedStat(s);
    const line = lines!.find(l => l.stat === 'spe')!;
    return (
      <span className={line.nature ?? undefined} title={t('stat.spe')}>
        <StatIcon stat="spe" /><span className="visually-hidden">{t('stat.spe')}</span>{real.value}
        {real.scarf && <small className="sp-mark">{t('sdetail.mark.scarf')}</small>}
      </span>
    );
  };
  /** Nella scheda Velocità la Velocità reale a parole: "Speed 300" (il numero in corsivo), col segno della Sciarpa. */
  const speedWord = (s: TeamSet) => {
    const real = speedStat(s);
    const line = lines!.find(l => l.stat === 'spe')!;
    return (
      <span className="def-mon-speed">
        {t('sdetail.mon.speed')} <em className={line.nature ?? undefined}>{real.value}</em>
        {real.scarf && <small className="sp-mark">{t('sdetail.mark.scarf')}</small>}
      </span>
    );
  };
  // Su sprite e nome, dopo un attimo: la carta del Pokémon di lato alla colonna dei membri (non copre i nomi né le righe), se il set c'è
  const memberTip = useMemberTip(400, 'th, td', true);
  const tip = set ? memberTip.bind(set) : {};
  return (
    <span className="ad-mon def-mon">
      <span className="def-mon-hit" {...tip}>
        <span className="def-box"><PokemonIcon name={name} /></span>
      </span>
      <span className="def-mon-text">
        <span className="def-mon-line">
          <span className="def-mon-name" {...tip}>{name}</span>
          {species && <TypeIcons types={species.types} className="def-mon-types" />}
          {nameTag}
          {children && <span className="def-mon-tag line">{children}</span>}
        </span>
        {lines && <span className="def-mon-stats">{stats === 'offense'
          ? <>{stat('atk')}{stat('spa')}{realSpeed(set!)}</>
          : stats === 'speed' ? speedWord(set!) : <>{stat('hp')}{stat('def')}{stat('spd')}</>}{children && <span className="def-mon-tag">{children}</span>}</span>}
      </span>
      {set && memberTip.tip}
    </span>
  );
}
