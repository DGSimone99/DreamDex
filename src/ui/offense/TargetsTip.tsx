import type { ReactNode } from 'react';
import { typeAverage } from '../../engine/coverage';
import type { FormatId } from '../../engine/format';
import { TYPES } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite } from '../Sprite';
import { TypeIcons } from '../typeIcons';

/*
 * I bersagli dell'Offesa nel tooltip di un "?": il Pokémon medio dei 18 tipi (Coverage tipi) e le minacce del meta
 * (Coverage meta). Nella guida accanto ai Bersagli e nella Generale accanto alle testate Tipi e Meta.
 */

/** Un "?" accanto al testo: passandoci sopra (o col fuoco) il tooltip DreamDex con il dettaglio dei bersagli. */
export function Ask({ label, children }: { label: string; children: ReactNode }) {
  const tip = useFloatAnchor<true>();
  return (
    <>
      <button type="button" className="guide-ask" aria-label={label}
        onMouseEnter={e => tip.open(true, e.currentTarget)} onMouseLeave={tip.close}
        onFocus={e => tip.open(true, e.currentTarget)} onBlur={tip.close}>?</button>
      {tip.anchor && <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className="gat">{children}</FloatTip>}
    </>
  );
}

/** Il Pokémon medio dei 18 tipi: PS, Difesa e Difesa Speciale base nel Pokédex del formato, in due colonne. */
export function TypeAverages({ formatId }: { formatId: FormatId }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <div className="ftip-head"><b>{t('guide.off.targets.typesTitle')}</b></div>
      <div className="gat-cols">
        {[TYPES.slice(0, 9), TYPES.slice(9)].map((part, col) => (
          <table key={col} className="gat-table">
            <thead><tr><th scope="col" /><th scope="col">{t('stat.hp')}</th><th scope="col">{t('stat.def')}</th><th scope="col">{t('stat.spd')}</th></tr></thead>
            <tbody>
              {part.map(type => {
                const a = typeAverage(type, { stats: null, sets: null, formatId });
                return <tr key={type}><th scope="row"><TypeIcons types={[type]} />{typeName(type, lang)}</th><td>{a.hp}</td><td>{a.def}</td><td>{a.spd}</td></tr>;
              })}
            </tbody>
          </table>
        ))}
      </div>
    </>
  );
}

/** Le minacce del meta usate come bersagli: le sprite, dalla più usata. */
export function MetaTargets({ species }: { species: string[] }) {
  const t = useT();
  return (
    <>
      <div className="ftip-head"><b>{t('guide.off.targets.metaTitle', { n: species.length })}</b></div>
      <div className="gat-mons">{species.map(name => <span key={name} title={name}><Sprite species={name} size={40} /></span>)}</div>
    </>
  );
}
