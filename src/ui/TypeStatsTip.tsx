import type { TypeName } from '../engine/types';
import { useLang } from '../i18n/react';
import { typeName } from '../i18n/game';
import { TipHead, TipSec, TipTypeIcon } from './TipHead';

/**
 * Il tooltip del tipo in testata alle tabelle Coverage tipi (Offesa e Difesa): la testata unica (tessera e nome del tipo,
 * sotto la frase che dice cosa sono i numeri), poi le statistiche base del Pokémon su cui si misurano i colpi della
 * colonna, affiancate (etichetta in maiuscoletto spento sopra il numero).
 * Offesa: PS, Dif e DifSp del Pokémon medio del tipo; Difesa: Att e AttSp dell'attaccante di quel tipo.
 */
export function TypeStatsTip({ type, stats, sub }: { type: string; stats: [string, number][]; sub: string }) {
  const lang = useLang();
  return (
    <>
      <TipHead lead={<TipTypeIcon type={type} />} title={typeName(type as TypeName, lang)} sub={sub} />
      <TipSec>
        <div className="tst-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}
        </div>
      </TipSec>
    </>
  );
}
