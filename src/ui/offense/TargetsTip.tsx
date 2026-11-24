import { useId, type ReactNode } from 'react';
import { THREATS } from '../../engine/attackers';
import { TARGET_SCAN, typeAverage } from '../../engine/coverage';
import type { FormatId } from '../../engine/format';
import { TYPES, type TypeName } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, goText, TipGo, useFloatAnchor } from '../FloatTip';
import type { Lang } from '../../i18n';
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
export function Ask({ label, guide, short = false, describe, children }: { label: string; guide?: () => void; short?: boolean;
  /** Il contenuto del tooltip in parole compatte per i lettori di schermo ("Normale: PS 80, Dif 75…", i nomi del meta). */
  describe?: string; children: ReactNode }) {
  const t = useT();
  const tip = useFloatAnchor<true>();
  const descId = useId();
  // La descrizione sta qui accanto, nascosta (mai nel body): i dati della tabella e, fuori dalla guida, dove porta il clic
  const description = [describe, guide ? goText(t, t('tip.guide'), 'open') : ''].filter(Boolean).join('. ');
  return (
    <>
      <button type="button" className="guide-ask" aria-label={label} aria-describedby={description ? descId : undefined}
        onClick={guide ? () => { tip.close(); guide(); } : undefined}
        onMouseEnter={e => tip.open(true, e.currentTarget)} onMouseLeave={tip.close}
        onFocus={e => tip.open(true, e.currentTarget)} onBlur={tip.close}><Icon name="help" /></button>
      {description && <span id={descId} hidden>{description}</span>}
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

/** La tabella dei 18 tipi in parole, per la descrizione del "?": "Normale: PS 80, Dif 75, DifSp 70; Fuoco: …". */
export const typeStatText = (cols: TypeStatCol[], lang: Lang): string =>
  TYPES.map(type => `${typeName(type, lang)}: ${cols.map(c => `${c.label} ${c.value(type)}`).join(', ')}`).join('; ');

/** Le colonne del Pokémon medio dei 18 tipi (PS, Dif, DifSp base nel Pokédex del formato): tabella e descrizione. */
export const averageCols = (formatId: FormatId, t: ReturnType<typeof useT>): TypeStatCol[] => {
  const avg = (type: TypeName) => typeAverage(type, { stats: null, sets: null, formatId });
  return [
    { label: t('stat.hp'), value: type => avg(type).hp },
    { label: t('stat.def'), value: type => avg(type).def },
    { label: t('stat.spd'), value: type => avg(type).spd },
  ];
};

/** Le minacce del meta in parole, per la descrizione del "?": il titolo e i nomi, dalla più usata. */
export const metaText = (title: string, species: string[]): string => `${title}: ${species.join(', ')}`;

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
  return (
    <>
      <TipHead lead={<TipGlyph icon="sword" />} title={t('guide.off.targets.typesTitle')} sub={t('guide.off.targets.tableTip')} />
      <TipSec>
        <TypeStatTable cols={averageCols(formatId, t)} />
      </TipSec>
    </>
  );
}

/**
 * Le minacce del meta usate come bersagli: le sprite in una griglia ordinata (10 per riga), dalla più usata. Offesa
 * (`sword`): fra i 40 più usati uno per coppia di tipi (il più usato la rappresenta), per questo a volte meno di 40, e la
 * riga sotto il titolo lo dice; Difesa (`shield`): i 40 più usati con almeno una mossa d'attacco (chi non ne ha non colpisce), e la riga lo dice.
 */
export function MetaTargets({ species, icon = 'sword' }: { species: string[]; icon?: 'sword' | 'shield' }) {
  const t = useT();
  return (
    <>
      <TipHead lead={<TipGlyph icon={icon} />} title={t('guide.off.targets.metaTitle', { n: species.length })} sub={icon === 'sword' ? t('guide.off.targets.metaSubOff', { top: TARGET_SCAN }) : t('guide.off.targets.metaSub', { top: THREATS })} />
      <TipSec>
        <div className="gat-mons">{species.map(name => <span key={name} title={name}><Sprite species={name} size={SPRITE_TIP_ROW} /></span>)}</div>
      </TipSec>
    </>
  );
}
