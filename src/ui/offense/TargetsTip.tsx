import { useId, type ReactNode } from 'react';
import { typeAverage } from '../../engine/coverage';
import type { FormatId } from '../../engine/format';
import { TYPES, type TypeName } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, goText, HiddenText, TipGo, useFloatAnchor } from '../FloatTip';
import { Icon } from '../icons';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { TipGlyph, TipHead, TipSec } from '../TipHead';
import { TypeIcons } from '../typeIcons';

/*
 * I bersagli dell'Offesa nel tooltip di un "?": il Pokémon medio dei 18 tipi (Coverage tipi) e le minacce del meta
 * (Coverage meta). Nella guida accanto ai Bersagli e nella Generale accanto alle testate Tipi e Meta.
 */

/**
 * Un "?" accanto al testo (la variante in riga del pulsante d'aiuto, stessa icona): passandoci sopra (o col fuoco) il
 * tooltip DreamDex con il dettaglio dei bersagli (la tabella intera, uguale dentro e fuori dalla guida). `guide`: fuori
 * dalla guida (le testate della Generale) il clic apre la guida dell'area, col piede "Clic: apri la guida"; dentro la
 * guida niente piede. `short`: il contenuto è corto (largo M, i tooltip della guida della Velocità).
 */
export function Ask({ label, guide, short = false, children }: { label: string; guide?: () => void; short?: boolean; children: ReactNode }) {
  const t = useT();
  const tip = useFloatAnchor<true>();
  const descId = useId();
  return (
    <>
      <button type="button" className="guide-ask" aria-label={label} aria-describedby={guide ? descId : undefined}
        onClick={guide ? () => { tip.close(); guide(); } : undefined}
        onMouseEnter={e => tip.open(true, e.currentTarget)} onMouseLeave={tip.close}
        onFocus={e => tip.open(true, e.currentTarget)} onBlur={tip.close}><Icon name="help" /></button>
      {guide && <HiddenText id={descId}>{goText(t, t('tip.guide'), 'open')}</HiddenText>}
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className={`gat${short ? ' tip-w-m' : ''}`}>
          {children}
          {guide && <TipGo place={t('tip.guide')} verb="open" />}
        </FloatTip>
      )}
    </>
  );
}

/**
 * La testata di una colonna a pezzi della Generale (Tipi, Meta): la spada (Offesa: colpisci tu) o lo scudo (Difesa:
 * colpiscono te), poi la parola come le altre testate (l'icona basta a dire chi colpisce chi: è solo per gli occhi).
 */
export function BarHead({ icon, word }: { icon: 'sword' | 'shield'; word: string }) {
  return (
    <span className="bar-head">
      <span className="bar-head-ic"><Icon name={icon} /></span>
      <span className="bar-head-word">{word}</span>
    </span>
  );
}

/** Una colonna della tabella dei 18 tipi: la testata (PS, ATT…) e il numero di ogni tipo. */
export interface TypeStatCol { label: string; value: (type: TypeName) => number }

/**
 * La tabella dei 18 tipi nei tooltip dei "?" (Offesa: PS/DIF/DIFSP del Pokémon medio; Difesa: ATT/ATTSP
 * dell'attaccante): due metà da 9 tipi divise da un filo, righe a strisce come le tabelle della Generale (una sì e una
 * no in Raised, senza linee), la tessera del tipo e il nome, i numeri allineati a destra. In ogni colonna i 3 più alti
 * sono in Text 700 (i più forti si leggono subito), gli altri in Muted: risalto neutro, non è un giudizio.
 */
export function TypeStatTable({ cols }: { cols: TypeStatCol[] }) {
  const lang = useLang();
  const values = TYPES.map(type => cols.map(c => c.value(type)));
  // La soglia dei 3 più alti di ogni colonna (a pari merito tutti quelli uguali al terzo)
  const top = cols.map((_, i) => values.map(v => v[i]).sort((a, b) => b - a)[2]);
  return (
    <div className="gat-cols">
      {[0, 9].map(from => (
        <table key={from} className="gat-table">
          <thead><tr><th scope="col" />{cols.map(c => <th key={c.label} scope="col">{c.label}</th>)}</tr></thead>
          <tbody>
            {TYPES.slice(from, from + 9).map((type, k) => (
              <tr key={type}>
                <th scope="row"><TypeIcons types={[type]} />{typeName(type, lang)}</th>
                {values[from + k].map((v, i) => <td key={cols[i].label} className={v >= top[i] ? 'gat-top' : undefined}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/** Il Pokémon medio dei 18 tipi: PS, Difesa e Difesa Speciale base nel Pokédex del formato, in due colonne. */
export function TypeAverages({ formatId }: { formatId: FormatId }) {
  const t = useT();
  const avg = (type: TypeName) => typeAverage(type, { stats: null, sets: null, formatId });
  return (
    <>
      <TipHead lead={<TipGlyph icon="sword" />} title={t('guide.off.targets.typesTitle')} sub={t('guide.off.targets.tableTip')} />
      <TipSec>
        <TypeStatTable cols={[
          { label: t('stat.hp'), value: type => avg(type).hp },
          { label: t('stat.def'), value: type => avg(type).def },
          { label: t('stat.spd'), value: type => avg(type).spd },
        ]} />
      </TipSec>
    </>
  );
}

/** Le minacce del meta usate come bersagli: le sprite in una griglia ordinata (10 per riga), dalla più usata. */
export function MetaTargets({ species, icon = 'sword' }: { species: string[]; icon?: 'sword' | 'shield' }) {
  const t = useT();
  return (
    <>
      <TipHead lead={<TipGlyph icon={icon} />} title={t('guide.off.targets.metaTitle', { n: species.length })} sub={t('guide.off.targets.metaSub')} />
      <TipSec>
        <div className="gat-mons">{species.map(name => <span key={name} title={name}><Sprite species={name} size={SPRITE_TIP_ROW} /></span>)}</div>
      </TipSec>
    </>
  );
}
