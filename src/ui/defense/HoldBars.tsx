import type { CSSProperties, ReactNode } from 'react';
import { dummyStats, holdBand, type HoldBand } from '../../engine/defense';
import type { FormatId } from '../../engine/format';
import { TYPES } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { TypeIcons, typeIconUrl } from '../typeIcons';
import { Sprite } from '../Sprite';
import { Target } from '../offense/KoBadges';
import { HOLD_BANDS } from './holds';

/*
 * La barra a pezzi della Generale della Difesa, sorella di quella dell'Offesa (KoBadges): per un membro (o per il team)
 * quanti dei 18 tipi o delle minacce del meta lo mandano KO in un colpo, in due, in tre, in quattro o più. I colori sono
 * quelli di Coverage tipi della Difesa; i pezzi vanno dal migliore (regge, a sinistra) al peggiore.
 */

/** Un bersaglio (tipo o minaccia del meta) con la fascia del colpo che il membro prende. */
export interface HoldTarget { label: string; kind: 'type' | 'mon'; band: HoldBand }

/** Le fasce dalla migliore. */
const ORDER: HoldBand[] = ['four', 'three', 'two', 'ohko'];
/** I tre pezzi da sinistra: quelli che regge (4HKO+ e 3HKO insieme), poi 2HKO e OHKO. */
type Piece = 'held' | 'two' | 'ohko';
const PIECES: Piece[] = ['held', 'two', 'ohko'];
const PIECE_CLS: Record<Piece, string> = { held: 'hb-held', two: 'hb-2', ohko: 'hb-ohko' };
const pieceOf = (b: HoldBand): Piece => (b === 'four' || b === 'three' ? 'held' : b);

/** I 18 tipi per un membro: la fascia del lato peggiore (fisico o speciale). */
export const typeHolds = (cells: { band: HoldBand }[]): HoldTarget[] =>
  cells.map((c, k) => ({ label: TYPES[k], kind: 'type', band: c.band }));

/** Le minacce del meta per un membro: chi non è in `heldBy` lo manda KO in un colpo. */
export const metaHolds = (rows: { species: string; heldBy: { species: string; pct: number }[] }[], member: string): HoldTarget[] =>
  rows.map(row => {
    const h = row.heldBy.find(x => x.species === member);
    return { label: row.species, kind: 'mon', band: h ? holdBand(h.pct / 100) : 'ohko' };
  });

/** Il team su ogni bersaglio: il membro che lo regge meglio. */
export const teamHolds = (per: HoldTarget[][]): HoldTarget[] =>
  (per[0] ?? []).map((first, i) => {
    const best = per.map(list => list[i]?.band ?? 'ohko').reduce((a, b) => (ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a), 'ohko' as HoldBand);
    return { label: first.label, kind: first.kind, band: best };
  });

/**
 * La barra: un pezzo per fascia lungo quanto il suo conto (un pezzo a zero non c'è), passando su un pezzo il tooltip
 * DreamDex elenca i bersagli. A destra il conto "12/18": quanti ne regge (meno di metà PS). `alarm` (la riga del team):
 * il conto è verde solo se li regge tutti, rosso se no.
 */
export function HoldBars({ targets, who, of, alarm = false }: { targets: HoldTarget[]; who: string; of: string; alarm?: boolean }) {
  const t = useT();
  const tip = useFloatAnchor<Piece>();
  const key = tip.anchor?.key;
  const total = targets.length;
  const by = (p: Piece) => targets.filter(x => pieceOf(x.band) === p);
  const tag = (p: Piece) => (p === 'held' ? t('hold.held') : HOLD_BANDS[p].tag);
  const n = by('held').length;
  const ratio = total ? n / total : 0;
  const countTone = alarm ? (n < total ? ' bad' : ' full') : n === 0 ? ' zero' : n === total ? ' full' : ratio >= 2 / 3 ? ' good' : ratio >= 1 / 3 ? ' warn' : ' bad';
  const list = (items: HoldTarget[]) => <div className={`kot-list${items[0]?.kind === 'mon' ? ' mons' : ''}`}>{items.map(x => <Target key={x.label} target={{ label: x.label, kind: x.kind, plain: 0, setup: null, once: null }} />)}</div>;
  return (
    <span className="kob-line hb-line">
      <span className="kob-row">
        {PIECES.map(p => {
          const items = by(p);
          if (!items.length) return null;
          return (
            <span key={p} className={`kob hb ${PIECE_CLS[p]}${alarm && p !== 'held' ? ' hb-alarm' : ''}`} style={{ flexGrow: items.length }}
              onMouseEnter={e => tip.open(p, e.currentTarget)} onMouseLeave={tip.close}
              aria-label={`${tag(p)} ${items.length}`}>
              <em aria-hidden="true">{tag(p)}</em>
              <span className="kob-num"><b>{items.length}</b></span>
            </span>
          );
        })}
        {key && (
          <FloatTip rect={tip.anchor!.rect} tone={key === 'held' ? 'var(--good)' : 'var(--bad)'} className="kot">
            <div className="kot-head"><b>{who}</b><span className={`kob labeled hb ${PIECE_CLS[key]}`}><em>{tag(key)}</em><b>{by(key).length}</b></span><small>{of}</small></div>
            {/* "Regge" in due gruppi: meno di un quarto dei PS (4HKO+) e meno di metà (3HKO) */}
            {(key === 'held' ? (['four', 'three'] as const) : [key]).map(b => {
              const items = targets.filter(x => x.band === b);
              return items.length ? <div key={b} className="hb-group"><p className="hb-say"><span className={`hb-dot ${HOLD_BANDS[b].cls}`} />{t(`hold.say.${b}`)}</p>{list(items)}</div> : null;
            })}
          </FloatTip>
        )}
      </span>
      <span className={`kob-count${countTone}`} style={{ '--r': ratio } as CSSProperties} aria-label={t('hold.countAria', { n, total })} title={t('hold.countTitle')}>
        <span className="kob-count-num" aria-hidden="true"><b>{n}</b><small>/{total}</small></span>
        <span className="kob-count-line" aria-hidden="true" />
      </span>
    </span>
  );
}

/** Gli attaccanti dei 18 tipi (Coverage tipi della Difesa): Attacco e Attacco Speciale, in due colonne. */
export function TypeAttackers({ formatId }: { formatId: FormatId }) {
  const t = useT();
  const lang = useLang();
  return (
    <>
      <div className="ftip-head"><b>{t('hold.attackersTitle')}</b></div>
      <div className="gat-cols">
        {[TYPES.slice(0, 9), TYPES.slice(9)].map((part, col) => (
          <table key={col} className="gat-table">
            <thead><tr><th scope="col" /><th scope="col">{t('stat.atk')}</th><th scope="col">{t('stat.spa')}</th></tr></thead>
            <tbody>
              {part.map(type => {
                const a = dummyStats(formatId, type);
                return <tr key={type}><th scope="row"><TypeIcons types={[type]} />{typeName(type, lang)}</th><td>{a.atk}</td><td>{a.spa}</td></tr>;
              })}
            </tbody>
          </table>
        ))}
      </div>
      <p className="ftip-foot">{t('ddetail.attackerTip')}</p>
    </>
  );
}

/**
 * Un colpo peggiore sotto la barra (squadra chiusa): il tipo o la minaccia, quanto toglie, la sua fascia, il colore della
 * pastiglia (il tipo, o il primo tipo della minaccia) e il contenuto del tooltip (lo stesso delle caselle di Coverage).
 */
export interface WorstHit { label: string; kind: 'type' | 'mon'; pct: number | null; band: HoldBand; color?: string; tip?: ReactNode }

/** I tre colpi che fanno più male: prima chi manda KO in un colpo, poi dal danno più alto (a parità, l'ordine dato). */
export function worstOf<T extends WorstHit>(hits: T[], n = 3): T[] {
  const score = (h: WorstHit) => (h.pct === null ? 1000 : h.pct);
  return hits.map((h, i) => ({ h, i })).sort((a, b) => score(b.h) - score(a.h) || a.i - b.i).slice(0, n).map(x => x.h);
}

/**
 * Sotto la barra di Tipi o di Meta, a squadra chiusa: i colpi peggiori come pastiglie, come le mosse dell'Offesa: nel
 * colore del tipo, l'icona del tipo o la sprite della minaccia e il danno ("KO" se lo manda KO in un colpo, colorato
 * dalla fascia); passando sopra si apre il nome e compare il tooltip DreamDex col dettaglio del colpo.
 */
export function WorstHits({ hits }: { hits: WorstHit[] }) {
  const lang = useLang();
  const tip = useFloatAnchor<string>();
  if (!hits.length) return null;
  const open = hits.find(h => h.label === tip.anchor?.key);
  return (
    <span className="mcs wh">
      {hits.map(h => {
        const name = h.kind === 'type' ? typeName(h.label, lang) : h.label;
        return (
          <span key={h.label} className={`mc wh-${h.band}`} style={{ '--c': h.color ?? 'var(--faint)' } as CSSProperties}
            onMouseEnter={e => tip.open(h.label, e.currentTarget)} onMouseLeave={tip.close} aria-label={`${name} ${h.pct === null || h.pct >= 100 ? 'KO' : `${h.pct}%`}`}>
            {h.kind === 'type' ? <img src={typeIconUrl(h.label)} alt="" draggable={false} /> : <span className="wh-mon"><Sprite species={h.label} size={22} /></span>}
            <span className="mc-name">{name}</span>
            <b>{h.pct === null || h.pct >= 100 ? 'KO' : <>{h.pct}<small>%</small></>}</b>
          </span>
        );
      })}
      {open?.tip && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={open.color ?? 'var(--faint)'} className={`tht${open.kind === 'type' ? ' dht' : ''}`}>{open.tip}</FloatTip>
      )}
    </span>
  );
}
