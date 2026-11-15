import { useState } from 'react';
import { COVERED_LEVEL } from '../../engine/coach';
import { battleSpecies } from '../../engine/dex';
import type { TeamOffense } from '../../engine/offense';
import { bestAttackMultiplier, teamField, TYPES } from '../../engine/types';
import { ColName, EffTag, effClass, effLabel } from '../effTag';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { TypeIcons } from '../typeIcons';
import { offenseSlots } from './slots';

/** Colore della riga Copertura: rosso a 0, giallo sotto il livello coperto (50), verde da lì. */
const coverTone = (value: number) => (value === 0 ? 'bad' : value < COVERED_LEVEL ? 'warn' : 'good');

/**
 * Il pacchetto dei tipi dell'Offesa: stessa griglia della Difesa (un membro per riga, 18 tipi in colonna) con, per ogni tipo,
 * il danno del colpo migliore del membro sul Pokémon medio (verde = oltre il 66%, vale almeno metà; giallo = oltre il 33%,
 * conta; vuota = non conta). Il filo sotto l'icona è rosso sui tipi che nessuno manda KO in due colpi (scoperti); in fondo la riga
 * Copertura. Chi il motore ha scartato resta con le caselle vuote. In basso a sinistra ×2 (o ×4) se il membro ha almeno una
 * mossa superefficace sul tipo, anche se il danno migliore viene da un'altra; "Solo superefficaci" (`ctx.effOnly`) spegne le
 * altre caselle. Col puntatore la colonna si accende e sotto l'icona compare il tipo.
 * Sotto la tabella, in fondo al pannello, una riga bassa con la legenda dei colori.
 */
export function OffenseTypes({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const { rows, holes } = offense.types;
  const byType = new Map(rows.map(row => [row.label, row]));
  const slots = offenseSlots(team, offense.members);
  const field = teamField(team);
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`def-frame off-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="def-col-mon" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {TYPES.map((type, i) => {
                const hole = holes.includes(type);
                return (
                  <th key={type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')} title={typeName(type, lang)}
                    onMouseEnter={() => setHover({ row: -1, col: i })}>
                    <TypeIcons types={[type]} />
                    {hover?.col === i && <ColName name={typeName(type, lang)} />}
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(type, lang)}{hole && ` ${t('odetail.types.hole')}`}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const member = slots[slot] === null ? null : offense.members[slots[slot]!];
              return (
                <tr key={`${name}-${slot}`} className={hover?.row === slot ? 'x-row' : undefined}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {TYPES.map((type, i) => {
                    if (slots[slot] === null) return <td key={type} className={colClass(i, `ct-cell${ctx.effOnly ? ' eff-dim' : ''}`)} onMouseEnter={() => setHover({ row: slot, col: i })}>—</td>;
                    const tag = effLabel(bestAttackMultiplier(set, [type], '', field), 'offense');
                    const found = member?.hits.find(h => h.label === type);
                    const hit = found && found.credit > 0 ? found : undefined;
                    const strong = !!hit && hit.credit >= 0.5;
                    return (
                      <td key={type} className={colClass(i, `ct-cell${hit ? (strong ? ' ok-full' : ' ok-half') : ''}${effClass(tag, 'offense', ctx.effOnly)}`)}
                        title={hit ? `${member!.species}: ${hit.move ?? ''} ${hit.pct}%` : undefined} onMouseEnter={() => setHover({ row: slot, col: i })}>
                        {hit && <>
                          {hit.pct}%
                          <span className="visually-hidden"> {t(strong ? 'odetail.types.covers' : 'odetail.types.half')}</span>
                        </>}
                        <EffTag label={tag} side="offense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('detail.level')}</th>
              {TYPES.map((type, i) => {
                const level = byType.get(type)?.level ?? 0;
                return <td key={type} className={colClass(i)}><span className={`ct-pill ${coverTone(level)}`}>{level}%</span></td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rob-legend ht-foot"><span className="area-legend" aria-hidden="true"><OffenseTypesLegend /></span></div>
    </div>
  );
}

/** La legenda dei colori della scheda dei tipi dell'Offesa, nella riga in fondo alla tabella: forte, conta. */
function OffenseTypesLegend() {
  const t = useT();
  return (
    <>
      <span className="area-legend-swatch"><i className="ok-full" />{t('odetail.types.legendFull')}</span>
      <span className="area-legend-swatch"><i className="ok-half" />{t('odetail.types.legendHalf')}</span>
    </>
  );
}
