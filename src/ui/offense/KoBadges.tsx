import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { getMove } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, goText, HiddenText, TipGo, useFloatAnchor } from '../FloatTip';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { KoBadge } from '../KoBadge';
import { countClass } from '../CardsLegend';
import { TipGlyph, TipHead, TipSec } from '../TipHead';
import { TypeTile } from '../typeIcons';

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
    ? <span className="kot-type"><TypeTile type={target.label} />{typeName(target.label as TypeName, lang)}</span>
    : <span className="kot-mon" title={target.label}><Sprite species={target.label} size={SPRITE_TIP_ROW} /></span>;
}

const TAG: Record<KoBand, string> = { ohko: 'OHKO', two: '2HKO' };

/**
 * La misura di un pezzo, la stessa nelle Generali dell'Offesa (KoBadges) e della Difesa (HoldBars): il CSS dà a ogni pezzo
 * il minimo per etichetta e numero, più una parte dello spazio che resta in proporzione al suo conto (`--n`, flex-grow).
 */
export const pieceSize = (n: number) => ({ '--n': Math.max(0, n) } as CSSProperties);

/**
 * Una barra a pezzi larga quanto la colonna: OHKO (verde pieno), 2HKO (verde col bordo) e in fondo, grigio, quelli che il
 * colpo semplice non manda KO in due colpi; ogni pezzo col minimo più una parte in proporzione al suo conto (pieceSize), un pezzo a zero
 * non c'è (salvo che il setup ci porti qualcuno: allora resta, spento, col triangolo). `alarm` (la riga del team): il
 * pezzo che resta è in rosso, sono gli scoperti. Passando su un pezzo il tooltip DreamDex elenca i bersagli, poi in righe a
 * parte quelli in più dopo la danza o con Tera/Z. A destra della barra il conto "11/18": quanti ne manda KO in due colpi o
 * meglio (solo nella riga del team i colori dei conti delle carte, countClass, su ogni schermo; un membro ha il conto neutro). `who`: il nome nella testata (il membro o il team);
 * `mon`: il membro (la sua sprite in testata; la riga del team ha la spada); `of`: la parola sotto il conto ("tipi").
 * La testata dice la fascia nella riga sotto il nome (il badge OHKO o 2HKO e la frase) e a destra il conto "5/18".
 * Coi pezzi cliccabili (`onPick`) il tooltip finisce col piede TipGo verso `pickPlace` ("Clic: vai a Coverage tipi").
 */
export function KoBadges({ bands, who, mon, of, total, setupMove, onceName, onPick, pickPlace, alarm = false }: {
  bands: KoBands; who: string; mon?: string; of: string; total: number; setupMove?: string | null; onceName?: string | null;
  /** Clic su un pezzo OHKO / 2HKO: apre il dettaglio su quei bersagli. */
  onPick?: (band: KoBand | 'rest') => void;
  /** Dove porta il clic su un pezzo (il nome della sottoscheda, es. "Coverage tipi"): il piede TipGo del tooltip e la descrizione. */
  pickPlace?: string;
  alarm?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<KoBand | 'rest'>();
  const key = tip.anchor?.key;
  const id = useId();
  // Per lo screen reader i bersagli del pezzo (quelli del tooltip), nella descrizione: i nomi, poi quelli in più col setup
  const names = (items: KoTarget[]) => items.map(x => (x.kind === 'type' ? typeName(x.label as TypeName, lang) : x.label)).join(', ');
  const setupName = setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : t('kob.setupWord');
  const describe = (b: KoBand | 'rest') => (b === 'rest' ? names(bands.rest) : [
    names(bands.plain[b]),
    bands.setup[b].length ? `${setupName} +${bands.setup[b].length}: ${names(bands.setup[b])}` : '',
    bands.once[b].length && onceName ? `${onceName} +${bands.once[b].length}: ${names(bands.once[b])}` : '',
  ].filter(Boolean).join('. '));
  // Dove porta il clic (solo sui pezzi che si cliccano): in fondo al tooltip e alla descrizione
  const go = onPick && pickPlace ? goText(t, pickPlace) : '';
  const picks = (b: KoBand | 'rest') => !!go && (b === 'rest' || bands.plain[b].length > 0);
  const withGo = (b: KoBand | 'rest', text: string) => (picks(b) ? `${text}. ${go}` : text);
  // Ogni pezzo si raggiunge con le frecce (data-nav: il gruppo è la tabella della Generale); col clic è un pulsante
  const piece = (b: KoBand | 'rest', pick: boolean) => ({
    'data-nav': '', ...tip.bind(b), 'aria-describedby': `${id}-${b}`,
    ...(pick && onPick
      ? { role: 'button', onClick: () => { tip.close(); onPick(b); }, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tip.close(); onPick(b); } } }
      : { role: 'img' }),
  });
  const list = (items: KoTarget[]) => <div className={`kot-list${items[0]?.kind === 'mon' ? ' mons' : ''}`}>{items.map(x => <Target key={x.label} target={x} />)}</div>;
  const rest = bands.rest.length;
  const restBad = alarm && rest > 0;
  // Quanti bersagli manda KO in due colpi o meglio (colpo semplice): "11/18", da leggere al volo
  const hit = bands.plain.ohko.length + bands.plain.two.length;
  // Solo il conto del team ha i colori (countClass: verde pieno, giallo da 85%, rosso sotto); quello di un membro è neutro
  const ratio = total ? hit / total : 0;
  // In testata il membro con la sua sprite (un tooltip su un Pokémon), la riga del team con la spada
  const lead = mon ? { sprite: mon } : { lead: <TipGlyph icon="sword" /> };
  const countTone = alarm ? ` ${countClass(hit, total)}` : '';
  return (
    <span className="kob-line">
    <span className="kob-row">
      {(['ohko', 'two'] as const).map(b => {
        const n = bands.plain[b].length;
        const extra = bands.setup[b].length;
        if (n === 0 && extra === 0) return null;
        return (
          <span key={b} className={`kob ${b}${n === 0 ? ' zero' : ''}${extra > 0 ? ' has-setup' : ''}${onPick && n > 0 ? ' pick' : ''}`}
            style={pieceSize(n)}
            {...piece(b, n > 0)}
            aria-label={`${TAG[b]} ${n}${extra ? `, ${t('kob.setupAria', { n: extra })}` : ''}`}>
            {/* L'etichetta a sinistra, il numero a destra; il setup è solo il triangolo nell'angolo (il tooltip dice quanti) */}
            <em aria-hidden="true">{TAG[b]}</em>
            <span className="kob-num"><b>{n}</b></span>
            <HiddenText id={`${id}-${b}`}>{withGo(b, describe(b) || t('kob.none'))}</HiddenText>
          </span>
        );
      })}
      {rest > 0 && (
        <span className={`kob rest${restBad ? ' bad' : ''}${onPick ? ' pick' : ''}`} style={pieceSize(rest)}
          {...piece('rest', true)}
          aria-label={`${restBad ? t('kob.uncovered') : t('kob.restAria')} ${rest}`}>
          {/* Fuori dalla riga del team una lineetta: chi non va KO lo dice il tooltip; gli scoperti del team restano contati */}
          <span className="kob-num"><b aria-hidden={restBad ? undefined : true}>{restBad ? rest : '—'}</b></span>
          <HiddenText id={`${id}-rest`}>{withGo('rest', describe('rest'))}</HiddenText>
        </span>
      )}
      {key === 'rest' && (
        <FloatTip rect={tip.anchor!.rect} tone={restBad ? 'var(--bad)' : 'var(--faint)'} className="kot">
          <TipHead {...lead} title={who} sub={restBad ? t('kob.uncoveredTitle') : t('kob.restSub')}
            num={<>{rest}<small>/{total}</small></>} qualifier={of} />
          <TipSec>{list(bands.rest)}</TipSec>
          {picks('rest') && <TipGo place={pickPlace!} />}
        </FloatTip>
      )}
      {key && key !== 'rest' && (
        <FloatTip rect={tip.anchor!.rect} tone="var(--good)" className="kot">
          <TipHead {...lead} title={who} sub={<><KoBadge side="off" band={key} />{t(key === 'ohko' ? 'kob.say.ohko' : 'kob.say.two')}</>}
            num={<>{bands.plain[key].length}<small>/{total}</small></>} qualifier={of} />
          <TipSec>{bands.plain[key].length ? list(bands.plain[key]) : <p className="kot-none">{t('kob.none')}</p>}</TipSec>
          {/* In più col setup o con Tera/Z: il nome a sinistra e, allineata al badge della testata, la fascia col totale
              (quelli di sopra più questi): "Granfisico … OHKO 14" */}
          {bands.setup[key].length > 0 && <Extra icon={<i className="kob-tri" aria-hidden="true" />} label={setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : t('kob.setupWord')}
            badge={<KoBadge side="off" band={key} n={bands.plain[key].length + bands.setup[key].length} />}>{list(bands.setup[key])}</Extra>}
          {bands.once[key].length > 0 && onceName && <Extra label={onceName}
            badge={<KoBadge side="off" band={key} n={bands.plain[key].length + bands.once[key].length} />}>{list(bands.once[key])}</Extra>}
          {picks(key) && <TipGo place={pickPlace!} />}
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

function Extra({ icon, label, badge, children }: { icon?: ReactNode; label: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <TipSec className="kot-extra" label={<><span className="kot-extra-name">{icon}{label}</span>{badge && <span className="kot-extra-badge">{badge}</span>}</>}>{children}</TipSec>
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
export function FocusNote({ name, band, onClear, text }: { name: string; band: KoBand | 'rest'; onClear?: () => void; text?: string }) {
  const t = useT();
  return (
    <span className="kf-note">
      <span>{text ?? (band === 'rest' ? t('kob.focusRest', { name }) : t('kob.focus', { name, band: t(band === 'ohko' ? 'kob.bandOhko' : 'kob.bandTwo') }))}</span>
      {onClear && <button type="button" className="kf-clear" onClick={onClear}>{t('kob.focusClear')}</button>}
    </span>
  );
}
