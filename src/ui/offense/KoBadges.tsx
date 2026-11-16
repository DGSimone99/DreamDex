import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { getMove } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite } from '../Sprite';
import { typeIconUrl } from '../typeIcons';

/** Le due fasce che contano per la Coverage: KO in un colpo e in due (il 3HKO quasi non conta: ignorato). */
export type KoBand = 'ohko' | 'two';
const bandOf = (pct: number): KoBand | null => (pct >= 100 ? 'ohko' : pct >= 50 ? 'two' : null);

/** Un bersaglio (tipo o minaccia del meta) col danno del colpo semplice, dopo una danza e con Tera/Z (null se non c'è). */
export interface KoTarget { label: string; kind: 'type' | 'mon'; plain: number; setup: number | null; once: number | null }

/** Le fasce di un membro: i bersagli del colpo semplice e quelli che entrano solo col setup o con Tera/Z. */
export interface KoBands { plain: Record<KoBand, KoTarget[]>; setup: Record<KoBand, KoTarget[]>; once: Record<KoBand, KoTarget[]>;
  /** Quelli che il colpo semplice non manda KO in due colpi. */
  rest: KoTarget[] }

/** Per fascia: il colpo semplice; col setup (o Tera/Z) quelli che salgono a quella fascia da una più bassa. */
export function koBands(targets: KoTarget[]): KoBands {
  const empty = (): Record<KoBand, KoTarget[]> => ({ ohko: [], two: [] });
  const out: KoBands = { plain: empty(), setup: empty(), once: empty(), rest: [] };
  const rank = (b: KoBand | null) => (b === 'ohko' ? 2 : b === 'two' ? 1 : 0);
  for (const target of targets) {
    const base = bandOf(target.plain);
    if (base) out.plain[base].push(target);
    else out.rest.push(target);
    for (const key of ['setup', 'once'] as const) {
      const value = target[key];
      const up = value === null ? null : bandOf(value);
      if (up && rank(up) > rank(base)) out[key][up].push(target);
    }
  }
  return out;
}

/** Un bersaglio nel tooltip: icona tonda e nome del tipo, o la sprite col nome. */
export function Target({ target }: { target: KoTarget }) {
  const lang = useLang();
  return target.kind === 'type'
    ? <span className="kot-type"><img src={typeIconUrl(target.label)} alt="" draggable={false} />{typeName(target.label as TypeName, lang)}</span>
    : <span className="kot-mon" title={target.label}><Sprite species={target.label} size={40} /></span>;
}

const TAG: Record<KoBand, string> = { ohko: 'OHKO', two: '2HKO' };

/**
 * Una barra a pezzi larga quanto la colonna: OHKO (verde pieno), 2HKO (verde col bordo) e in fondo, grigio, quelli che il
 * colpo semplice non manda KO in due colpi; ogni pezzo lungo quanto il suo conto (un minimo per il numero), un pezzo a zero
 * non c'è (salvo che il setup ci porti qualcuno: allora resta, spento, col triangolo). `alarm` (la riga del team): il
 * pezzo che resta è in rosso, sono gli scoperti. Passando su un pezzo il tooltip DreamDex elenca i bersagli, poi in righe a
 * parte quelli in più dopo la danza o con Tera/Z. A destra della barra il conto "11/18": quanti ne manda KO in due colpi o
 * meglio (nella riga del team verde se li copre tutti, rosso se no). `who`: il nome nella testata (il membro o il team); `of`: "tipi su 18".
 */
export function KoBadges({ bands, who, of, total, setupMove, onceName, onPick, alarm = false }: {
  bands: KoBands; who: string; of: string; total: number; setupMove?: string | null; onceName?: string | null;
  /** Clic su un pezzo OHKO / 2HKO: apre il dettaglio su quei bersagli. */
  onPick?: (band: KoBand | 'rest') => void;
  alarm?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<KoBand | 'rest'>();
  const key = tip.anchor?.key;
  const list = (items: KoTarget[]) => <div className={`kot-list${items[0]?.kind === 'mon' ? ' mons' : ''}`}>{items.map(x => <Target key={x.label} target={x} />)}</div>;
  const rest = bands.rest.length;
  const restBad = alarm && rest > 0;
  // Quanti bersagli manda KO in due colpi o meglio (colpo semplice): "11/18", da leggere al volo
  const hit = bands.plain.ohko.length + bands.plain.two.length;
  // Il colore dice quanto copre: pieno verde, da due terzi verde, da un terzo giallo, sotto rosso (zero spento); nella riga
  // del team basta uno scoperto per il rosso
  const ratio = total ? hit / total : 0;
  const countTone = alarm ? (rest > 0 ? ' bad' : ' full') : hit === 0 ? ' zero' : hit === total ? ' full' : ratio >= 2 / 3 ? ' good' : ratio >= 1 / 3 ? ' warn' : ' bad';
  return (
    <span className="kob-line">
    <span className="kob-row">
      {(['ohko', 'two'] as const).map(b => {
        const n = bands.plain[b].length;
        const extra = bands.setup[b].length;
        if (n === 0 && extra === 0) return null;
        return (
          <span key={b} className={`kob ${b}${n === 0 ? ' zero' : ''}${extra > 0 ? ' has-setup' : ''}${onPick && n > 0 ? ' pick' : ''}`}
            style={{ '--k': total ? Math.min(1, n / total) : 0, flexGrow: Math.max(n, 1) } as CSSProperties}
            onMouseEnter={e => tip.open(b, e.currentTarget)} onMouseLeave={tip.close}
            {...(onPick && n > 0 ? { role: 'button', tabIndex: 0, onClick: () => { tip.close(); onPick(b); }, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(b); } } } : {})}
            aria-label={`${TAG[b]} ${n}${extra ? `, ${t('kob.setupAria', { n: extra })}` : ''}`}>
            {/* L'etichetta a sinistra, il numero a destra; il setup è solo il triangolo nell'angolo (il tooltip dice quanti) */}
            <em aria-hidden="true">{TAG[b]}</em>
            <span className="kob-num"><b>{n}</b></span>
          </span>
        );
      })}
      {rest > 0 && (
        <span className={`kob rest${restBad ? ' bad' : ''}${onPick ? ' pick' : ''}`} style={{ flexGrow: rest }}
          onMouseEnter={e => tip.open('rest', e.currentTarget)} onMouseLeave={tip.close}
          {...(onPick ? { role: 'button', tabIndex: 0, onClick: () => { tip.close(); onPick('rest'); }, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick('rest'); } } } : {})}
          aria-label={`${restBad ? t('kob.uncovered') : t('kob.restAria')} ${rest}`}>
          <span className="kob-num"><b>{rest}</b></span>
        </span>
      )}
      {key === 'rest' && (
        <FloatTip rect={tip.anchor!.rect} tone={restBad ? 'var(--bad)' : 'var(--faint)'} className="kot">
          <div className="kot-head"><b>{restBad ? t('kob.uncoveredTitle') : t('kob.restTitle', { name: who })}</b><small>{of}</small></div>
          {list(bands.rest)}
        </FloatTip>
      )}
      {key && key !== 'rest' && (
        <FloatTip rect={tip.anchor!.rect} tone="var(--good)" className="kot">
          <div className="kot-head"><b>{who}</b><span className={`kob labeled ${key}`}><em>{TAG[key]}</em><b>{bands.plain[key].length}</b></span><small>{of}</small></div>
          {bands.plain[key].length ? list(bands.plain[key]) : <p className="kot-none">{t('kob.none')}</p>}
          {/* In più col setup o con Tera/Z: solo il nome e quanti, "Danzaspada +15" */}
          {bands.setup[key].length > 0 && <Extra icon={<i className="kob-tri" aria-hidden="true" />} label={`${setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : t('kob.setupWord')} +${bands.setup[key].length}`}>{list(bands.setup[key])}</Extra>}
          {bands.once[key].length > 0 && onceName && <Extra label={`${onceName} +${bands.once[key].length}`}>{list(bands.once[key])}</Extra>}
        </FloatTip>
      )}
    </span>
    {/* Staccato dalla barra: il numero grande e il totale piccolo, sotto una lineetta che si riempie quanto copre */}
    <span className={`kob-count${countTone}`} style={{ '--r': ratio } as CSSProperties} aria-label={t('kob.countAria', { n: hit, total })}>
      <span className="kob-count-num" aria-hidden="true"><b>{hit}</b><small>/{total}</small></span>
      <span className="kob-count-line" aria-hidden="true" />
    </span>
    </span>
  );
}

function Extra({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="kot-extra">
      <span className="kot-extra-h">{icon}{label}</span>
      {children}
    </div>
  );
}

/** Fascia di un danno % (null sotto il 2HKO): la stessa delle tessere della Generale. */
export const koBandOf = bandOf;
/** Il danno % sta nella fascia evidenziata? 'rest' = non KO in due colpi. */
export const inBand = (pct: number, band: KoBand | 'rest') => (band === 'rest' ? bandOf(pct) === null : bandOf(pct) === band);

/**
 * Nella riga bassa di Coverage tipi / meta, al posto della legenda mentre una tessera della Generale tiene acceso un
 * dettaglio: chi e quale fascia sono evidenziati, e "Mostra tutti" per spegnerlo.
 */
export function FocusNote({ name, band, onClear }: { name: string; band: KoBand | 'rest'; onClear?: () => void }) {
  const t = useT();
  return (
    <span className="kf-note">
      <span>{band === 'rest' ? t('kob.focusRest', { name }) : t('kob.focus', { name, band: t(band === 'ohko' ? 'kob.bandOhko' : 'kob.bandTwo') })}</span>
      {onClear && <button type="button" className="kf-clear" onClick={onClear}>{t('kob.focusClear')}</button>}
    </span>
  );
}
