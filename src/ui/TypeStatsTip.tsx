import type { TypeName } from '../engine/types';
import { useLang } from '../i18n/react';
import { typeName } from '../i18n/game';
import { tileStyle, typeIconUrl } from './typeIcons';

/**
 * Il tooltip del tipo in testata alle tabelle Coverage tipi (Offesa e Difesa): icona e nome del tipo, poi le statistiche
 * base del Pokémon su cui si misurano i colpi della colonna, in caselle affiancate, e una riga che dice cosa sono.
 * Offesa: PS, Dif e DifSp del Pokémon medio del tipo; Difesa: Att e AttSp dell'attaccante di quel tipo.
 */
export function TypeStatsTip({ type, stats, foot }: { type: string; stats: [string, number][]; foot: string }) {
  const lang = useLang();
  return (
    <>
      <div className="ftip-head">
        <img className="ti-sq" style={tileStyle(type)} src={typeIconUrl(type)} alt="" draggable={false} />
        <b>{typeName(type as TypeName, lang)}</b>
      </div>
      <div className="tst-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}
      </div>
      <p className="ftip-foot">{foot}</p>
    </>
  );
}
