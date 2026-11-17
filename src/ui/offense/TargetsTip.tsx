import type { ReactNode } from 'react';
import { typeAverage } from '../../engine/coverage';
import type { FormatId } from '../../engine/format';
import { TYPES } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { TypeIcons } from '../typeIcons';

/*
 * I bersagli dell'Offesa nel tooltip di un "?": il Pokémon medio dei 18 tipi (Coverage tipi) e le minacce del meta
 * (Coverage meta). Nella guida accanto ai Bersagli e nella Generale accanto alle testate Tipi e Meta.
 */

/** Un "?" accanto al testo (la variante in riga del pulsante d'aiuto, stessa icona): passandoci sopra (o col fuoco) il tooltip DreamDex con il dettaglio dei bersagli. */
export function Ask({ label, children }: { label: string; children: ReactNode }) {
  const tip = useFloatAnchor<true>();
  return (
    <>
      <button type="button" className="guide-ask" aria-label={label}
        onMouseEnter={e => tip.open(true, e.currentTarget)} onMouseLeave={tip.close}
        onFocus={e => tip.open(true, e.currentTarget)} onBlur={tip.close}><Icon name="help" /></button>
      {tip.anchor && <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className="gat">{children}</FloatTip>}
    </>
  );
}

/**
 * La testata di una colonna a pezzi della Generale (Tipi, Meta): la spada (Offesa: colpisci tu) o lo scudo (Difesa:
 * colpiscono te), la parola come le altre testate e dopo una frase corta in tono spento che dice chi colpisce chi
 * ("· quanti ne colpisci"). Il punto è solo per gli occhi: ai lettori di schermo arriva "Tipi, quanti ne colpisci".
 * Se la colonna è stretta la frase si nasconde (resta per i lettori di schermo), la testata non va a capo.
 */
export function BarHead({ icon, word, phrase }: { icon: 'sword' | 'shield'; word: string; phrase: string }) {
  return (
    <span className="bar-head">
      <span className="bar-head-ic"><Icon name={icon} /></span>
      {/* La virgola nascosta e lo spazio fuori dagli span (nel flex non si vede): il nome resta "Tipi, quanti ne colpisci" */}
      <span className="bar-head-word">{word}</span><span className="visually-hidden">,</span>{' '}
      <span className="bar-head-phrase">{phrase}</span>
    </span>
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
      <div className="gat-mons">{species.map(name => <span key={name} title={name}><Sprite species={name} size={SPRITE_TIP_ROW} /></span>)}</div>
    </>
  );
}
