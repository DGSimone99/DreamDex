import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { dummyStats, holdBand, type HoldBand } from '../../engine/defense';
import type { FormatId } from '../../engine/format';
import { TYPES, type TypeName } from '../../engine/types';
import { typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, goText, HiddenText, TipGo, useFloatAnchor } from '../FloatTip';
import { KoBadge } from '../KoBadge';
import { countClass } from '../CardsLegend';
import { TipGlyph, TipHead, TipSec } from '../TipHead';
import { tileStyle, TypeIcons, typeIconUrl } from '../typeIcons';
import { PokemonIcon } from '../PokemonName';
import { pieceSize, Target } from '../offense/KoBadges';
import { TypeStatTable, type TypeStatCol } from '../offense/TargetsTip';

/*
 * La barra a pezzi della Generale della Difesa, sorella di quella dell'Offesa (KoBadges): per un membro (o per il team)
 * quanti dei 18 tipi o delle minacce del meta lo mandano KO in un colpo, in due, in tre, in quattro o più. I colori sono
 * un semaforo, come i colori di stato dell'app: verde regge (3HKO+), giallo cade in due colpi (2HKO), rosso in uno (OHKO);
 * i pezzi vanno dal migliore (regge, a sinistra) al peggiore.
 */

/** Un bersaglio (tipo o minaccia del meta) con la fascia del colpo che il membro prende. */
export interface HoldTarget { label: string; kind: 'type' | 'mon'; band: HoldBand }

/** Le fasce dalla migliore. */
const ORDER: HoldBand[] = ['four', 'three', 'two', 'ohko'];
/** I tre pezzi da sinistra: quelli che regge (4HKO+ e 3HKO insieme), poi 2HKO e OHKO. */
export type HoldPiece = 'held' | 'two' | 'ohko';
type Piece = HoldPiece;
const PIECES: Piece[] = ['held', 'two', 'ohko'];
const PIECE_CLS: Record<Piece, string> = { held: 'hb-held', two: 'hb-2', ohko: 'hb-ohko' };
/** Il pezzo della barra di una fascia: 3HKO e 4HKO+ insieme ("3HKO+"), poi 2HKO e OHKO. */
export const pieceOf = (b: HoldBand): Piece => (b === 'four' || b === 'three' ? 'held' : b);
/** L'etichetta del pezzo, nella barra e nel tooltip. */
export const PIECE_TAG: Record<Piece, string> = { held: '3HKO+', two: '2HKO', ohko: 'OHKO' };

/** I 18 tipi per un membro: la fascia del lato peggiore (fisico o speciale). */
export const typeHolds = (cells: { band: HoldBand }[]): HoldTarget[] =>
  cells.map((c, k) => ({ label: TYPES[k], kind: 'type', band: c.band }));

/** Le minacce del meta per un membro: chi non è in `heldBy` lo manda KO in un colpo. */
export const metaHolds = (rows: { species: string; heldBy: { species: string; pct: number; band?: HoldBand }[] }[], member: string): HoldTarget[] =>
  rows.map(row => {
    const h = row.heldBy.find(x => x.species === member);
    return { label: row.species, kind: 'mon', band: h ? h.band ?? holdBand(h.pct / 100) : 'ohko' };
  });

/** Il team su ogni bersaglio: il membro che lo regge meglio. */
export const teamHolds = (per: HoldTarget[][]): HoldTarget[] =>
  (per[0] ?? []).map((first, i) => {
    const best = per.map(list => list[i]?.band ?? 'ohko').reduce((a, b) => (ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a), 'ohko' as HoldBand);
    return { label: first.label, kind: first.kind, band: best };
  });

/**
 * La barra: un pezzo per fascia, misurato come nell'Offesa (pieceSize; un pezzo a zero non c'è), passando su un pezzo il tooltip
 * DreamDex elenca i bersagli. A destra il conto "12/18": quanti ne regge (meno di metà PS). `alarm` (la riga del team):
 * il conto ha i colori dei conti delle carte su ogni schermo (countClass: verde pieno, giallo da 85%, rosso sotto). Il conto di un
 * membro è neutro (il colore del testo): i colori stanno solo sui conti del team.
 */
export function HoldBars({ targets, who, mon, of, alarm = false, onPick, pickPlace }: {
  targets: HoldTarget[]; who: string;
  /** Il membro: la sua sprite in testata ai tooltip (la riga del team ha lo scudo). */
  mon?: string; of: string; alarm?: boolean;
  /** Clic su un pezzo: apre Coverage tipi o meta con quei bersagli accesi (come nell'Offesa). */
  onPick?: (piece: Piece) => void;
  /** Dove porta il clic su un pezzo (il nome della sottoscheda, es. "Coverage meta"): il piede TipGo del tooltip e la descrizione. */
  pickPlace?: string;
}) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<Piece>();
  const key = tip.anchor?.key;
  const id = useId();
  // Sul conto "12/18" che cosa conta (prima era solo il title del browser): tooltip col mouse e col fuoco
  const countTip = useFloatAnchor<true>();
  // Per lo screen reader i bersagli del pezzo (quelli del tooltip), nella descrizione
  const names = (items: HoldTarget[]) => items.map(x => (x.kind === 'type' ? typeName(x.label as TypeName, lang) : x.label)).join(', ');
  // Dove porta il clic: in fondo al tooltip e alla descrizione di ogni pezzo
  const go = onPick && pickPlace ? goText(t, pickPlace) : '';
  const total = targets.length;
  const by = (p: Piece) => targets.filter(x => pieceOf(x.band) === p);
  const tag = (p: Piece) => PIECE_TAG[p];
  const n = by('held').length;
  const ratio = total ? n / total : 0;
  // In testata il membro con la sua sprite (un tooltip su un Pokémon), la riga del team con lo scudo
  const lead = mon ? { sprite: mon } : { lead: <TipGlyph icon="shield" /> };
  const countTone = alarm ? ` ${countClass(n, total)}` : '';
  const list = (items: HoldTarget[]) => <div className={`kot-list${items[0]?.kind === 'mon' ? ' mons' : ''}`}>{items.map(x => <Target key={x.label} target={{ label: x.label, kind: x.kind, plain: 0, setup: null, once: null }} />)}</div>;
  return (
    <span className="kob-line hb-line">
      <span className="kob-row">
        {PIECES.map(p => {
          const items = by(p);
          if (!items.length) return null;
          return (
            <span key={p} className={`kob hb ${PIECE_CLS[p]}${alarm && p !== 'held' ? ' hb-alarm' : ''}${onPick ? ' pick' : ''}`} style={pieceSize(items.length)}
              data-nav="" {...tip.bind(p)} aria-describedby={`${id}-${p}`}
              {...(onPick ? { role: 'button', onClick: () => { tip.close(); onPick(p); }, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tip.close(); onPick(p); } } } : { role: 'img' })}
              aria-label={`${tag(p)} ${items.length}`}>
              <em aria-hidden="true">{tag(p)}</em>
              <span className="kob-num"><b>{items.length}</b></span>
              <HiddenText id={`${id}-${p}`}>{go ? `${names(items)}. ${go}` : names(items)}</HiddenText>
            </span>
          );
        })}
        {key && (
          <FloatTip rect={tip.anchor!.rect} tone={key === 'held' ? 'var(--good)' : key === 'two' ? 'var(--warn)' : 'var(--bad)'} className="kot">
            <TipHead {...lead} title={who} sub={<><KoBadge side="def" band={key} />{t(`hold.say.${key}`)}</>}
              num={<>{by(key).length}<small>/{total}</small></>} qualifier={of} />
            {/* "Regge" in due gruppi: meno di un quarto dei PS (4HKO+) e meno di metà (3HKO). I pallini hanno i colori delle
                caselle di Coverage (verde, verde chiaro, giallo, rosso); quello del 2HKO un filo più pieno, se no è piccolo e spento */}
            {(key === 'held' ? (['four', 'three'] as const) : [key]).map(b => {
              const items = targets.filter(x => x.band === b);
              // La frase della fascia sta già sotto il titolo: qui solo per i due gruppi di "Regge" (4HKO+ e 3HKO)
              return items.length ? <TipSec key={b} className="hb-group" label={key === 'held' ? <><KoBadge side="def" band={b} />{t(`hold.say.${b}`)}</> : undefined}>{list(items)}</TipSec> : null;
            })}
            {go && <TipGo place={pickPlace!} />}
          </FloatTip>
        )}
      </span>
      <span className={`kob-count${countTone}`} style={{ '--r': ratio } as CSSProperties} data-nav="" role="img" {...countTip.bind(true)}
        aria-label={t('hold.countAria', { n, total })} aria-describedby={`${id}-count`}>
        <span className="kob-count-num" aria-hidden="true"><b>{n}</b><small>/{total}</small></span>
        <span className="kob-count-line" aria-hidden="true" />
        <HiddenText id={`${id}-count`}>{t('hold.countTitle')}</HiddenText>
      </span>
      {countTip.anchor && (
        <FloatTip rect={countTip.anchor.rect} tone="var(--accent)" className="kot small">
          <TipHead {...lead} title={who} sub={t('hold.countSub')} num={<>{n}<small>/{total}</small></>} qualifier={of} />
        </FloatTip>
      )}
    </span>
  );
}

/** Le colonne degli attaccanti dei 18 tipi (Att e AttSp): la tabella del "?" e la sua descrizione. */
export const attackerCols = (formatId: FormatId, t: ReturnType<typeof useT>): TypeStatCol[] => [
  { label: t('stat.atk'), value: type => dummyStats(formatId, type).atk },
  { label: t('stat.spa'), value: type => dummyStats(formatId, type).spa },
];

/**
 * Gli attaccanti dei 18 tipi (Coverage tipi della Difesa): Attacco e Attacco Speciale nella tabella dei 18 tipi; la nota
 * è la riga sotto il titolo (l'unico piede è "Clic: apri la guida" quando il "?" apre la guida).
 */
export function TypeAttackers({ formatId }: { formatId: FormatId }) {
  const t = useT();
  return (
    <>
      <TipHead lead={<TipGlyph icon="shield" />} title={t('hold.attackersTitle')} sub={t('ddetail.attackerTableTip')} />
      <TipSec>
        <TypeStatTable cols={attackerCols(formatId, t)} />
      </TipSec>
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
  // Raggiungibili con le frecce (data-nav, nel gruppo della tabella della Generale): col fuoco il tooltip
  const open = hits.find(h => h.label === tip.anchor?.key);
  return (
    <span className="mcs wh">
      {hits.map(h => {
        const name = h.kind === 'type' ? typeName(h.label, lang) : h.label;
        return (
          <span key={h.label} className={`mc wh-${h.band}`} style={{ '--c': h.color ?? 'var(--faint)' } as CSSProperties}
            data-nav="" role="img" {...tip.bind(h.label)} aria-label={`${name} ${h.pct === null || h.pct >= 100 ? 'KO' : `${h.pct}%`}`}>
            {h.kind === 'type' ? <img className="ti-sq" style={tileStyle(h.label)} src={typeIconUrl(h.label)} alt="" draggable={false} /> : <span className="wh-mon"><PokemonIcon name={h.label} /></span>}
            <span className="mc-name">{name}</span>
            <b>{h.pct === null || h.pct >= 100 ? 'KO' : <>{h.pct}<small>%</small></>}</b>
          </span>
        );
      })}
      {open?.tip && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={open.color ?? 'var(--faint)'} className={`tip-w-m tht${open.kind === 'type' ? ' dht' : ''}`}>{open.tip}</FloatTip>
      )}
    </span>
  );
}
