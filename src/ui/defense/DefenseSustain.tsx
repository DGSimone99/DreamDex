import type { TeamDefense } from '../../engine/defense';
import { useT } from '../../i18n/react';
import { Sprite } from '../Sprite';

export const pct = (x: number) => `${Math.round(100 * x)}%`;
/** Larghezza di una barra: 50% = mezza larghezza piena. */
const half = (x: number) => `${Math.min(100, Math.round(200 * x))}%`;

/**
 * La Sostenibilità: una riga per membro con le barre divergenti attorno allo zero, a sinistra quanto si perde per turno
 * (Stealth Rock all'ingresso + Life Orb), a destra il recupero con le fonti, in fondo il valore.
 */
export function DefenseSustain({ defense }: { defense: TeamDefense }) {
  const t = useT();
  return (
    <>
      <h4>{t('ddetail.sustain')}</h4>
      <div className="ad-scroll">
        <table className="sus-table">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col" className="sus-r">{t('ddetail.sus.loss')}</th>
              <th scope="col">{t('ddetail.sus.gain')}</th>
              <th scope="col" className="sus-r">{t('ddetail.sustain')}</th>
            </tr>
          </thead>
          <tbody>
            {defense.members.map((m, i) => {
              const p = m.sustainParts;
              const loss = p.rocks + p.lifeOrb;
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={30} />{m.species}</span></th>
                  <td className="sus-loss">
                    <div className="sus-flex">
                      {loss > 0 && <span className="sus-num bad">{`−${pct(loss)}`}</span>}
                      <span className="sus-track end" aria-hidden="true"><i style={{ width: half(loss) }} /></span>
                    </div>
                  </td>
                  <td className="sus-gain">
                    <div className="sus-flex">
                      <span className="sus-track" aria-hidden="true"><i style={{ width: half(p.recovery) }} /></span>
                      {p.recovery > 0 && <span className="sus-num good">{`+${pct(p.recovery)}`}</span>}
                      {p.sources.length > 0 && <small className="ad-src"><b>{p.sources.join(' + ')}</b></small>}
                      {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}>{t('ddetail.halved')}</small>}
                    </div>
                  </td>
                  <td className="sus-val">{m.sustain}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sus-legend">{t('ddetail.sus.legend')}</p>
    </>
  );
}
