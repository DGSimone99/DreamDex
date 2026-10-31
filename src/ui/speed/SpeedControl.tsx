import type { TeamSpeed } from '../../engine/speedArea';
import { useT } from '../../i18n/react';
import { PokemonIcon } from '../PokemonName';
import { MoveName } from '../TypeText';

/**
 * Controllo velocità: ogni mossa di controllo che il team porta (Sticky Web, Trick Room, Tailwind, paralisi e
 * rallentamenti), chi la porta, quanti membri ne guadagnano e quanti punti aggiunge da sola alla Velocità.
 */
export function SpeedControl({ speed }: { speed: TeamSpeed }) {
  const t = useT();
  if (!speed.sources.length) {
    return <div className="def-frame sp-control"><p className="ad-holes sp-none">{t('sdetail.control.none')}</p></div>;
  }
  return (
    <div className="def-frame sp-control">
      <div className="ad-scroll">
        <table className="def-grid def-members sp-sources">
          <colgroup><col className="def-col-mon" /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col" className="left">{t('sdetail.move')}</th>
              <th scope="col">{t('sdetail.helps')}</th>
              <th scope="col">{t('sdetail.points')}</th>
            </tr>
          </thead>
          <tbody>
            {speed.sources.map(src => (
              <tr key={`${src.condition}-${src.move}`}>
                <th scope="row">
                  <span className="ad-mon def-mon">
                    {src.by.map(name => <span key={name} className="def-box"><PokemonIcon name={name} /></span>)}
                    <span className="def-mon-text"><span className="def-mon-line"><span className="def-mon-name">{src.by.join(', ')}</span></span></span>
                  </span>
                </th>
                <td className="left"><MoveName move={src.move} /></td>
                <td>{t(src.helped === 1 ? 'sdetail.mates.one' : 'sdetail.mates.many', { n: src.helped })}</td>
                <td className="total"><span className={`ct-pill ${src.plus > 0 ? 'good' : 'zero'}`}>+{src.plus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
