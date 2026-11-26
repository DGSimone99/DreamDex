import { useEffect, useRef, useState } from 'react';
import collar from '../assets/eevee/peek-collar.svg';
import body from '../assets/eevee/peek-body.svg';
import face from '../assets/eevee/peek-face.svg';
import faceBlink from '../assets/eevee/peek-face-blink.svg';
import faceHit from '../assets/eevee/peek-face-hit.svg';
import faceHappy from '../assets/eevee/peek-face-happy.svg';
import faceGiggle from '../assets/eevee/peek-face-giggle.svg';
import earUp from '../assets/eevee/peek-ear-up.svg';
import earSide from '../assets/eevee/peek-ear-side.svg';
import paw from '../assets/eevee/peek-paw.svg';
import tail from '../assets/eevee/peek-tail.svg';
import tailWag from '../assets/eevee/peek-tail-wag.svg';
import { reducedMotion } from './useMediaQuery';

/** Durate delle uscite (blocks.css): saltello della testa in alto, coda che si ritira, faccia di lato che rientra. */
const HOP_MS = 420;
const TAIL_OUT_MS = 200;
const RETREAT_MS = 400;
/** Dopo quanto si fa rivedere: circa 3 s (tra 2,6 e 3,4). */
const BACK_MIN_MS = 2600;
const BACK_SPREAD_MS = 800;
/** Spazio che serve fuori dalla finestra, in larghezze della testa (--peek): coda (ne spunta circa 0,5) e faccia di lato (circa 0,4). */
const TAIL_ROOM = 0.6;
const SIDE_ROOM = 0.5;

type Edge = 'bottom' | 'left' | 'right';
/** Dove sta Eevee: in alto (la testa sul bordo), solo la coda da un lato, o la faccia inclinata oltre un fianco. along: dove lungo il lato, in %. */
type Spot =
  | { kind: 'top' }
  | { kind: 'tail'; edge: Edge; along: number }
  | { kind: 'side'; edge: 'left' | 'right'; along: number };

const sameSpot = (a: Spot, b: Spot) => a.kind === b.kind && (a.kind === 'top' || (b.kind !== 'top' && a.edge === b.edge));

/** Quanto spesso esce ogni posa: la prima volta (dopo il primo clic in alto) faccia 70% e coda 30%, poi in alto 40%, faccia 40%, coda 20%. */
const FIRST_ODDS = { top: 0, side: 70, tail: 30 };
const ODDS = { top: 40, side: 40, tail: 20 };

/**
 * Il prossimo posto, a caso: in alto, la coda da un lato con spazio fino al bordo dello schermo (sotto o sui fianchi), o la
 * faccia di lato su un fianco con spazio (a destra o, specchiata, a sinistra). Prima la posa, secondo le probabilità, poi
 * il lato a caso. Mai lo stesso posto di prima, mai la coda due volte di fila: le pose rimaste si dividono la parte tolta. Senza spazio intorno (telefono) resta in alto.
 */
function pickSpot(marker: HTMLElement | null, last: Spot, first: boolean): Spot {
  const frame = marker?.closest<HTMLElement>('.help-frame');
  const dialog = frame?.querySelector<HTMLElement>('.help-dialog');
  const options: Spot[] = [{ kind: 'top' }];
  if (frame && dialog) {
    const peek = parseFloat(getComputedStyle(frame).getPropertyValue('--peek')) || 155;
    const r = dialog.getBoundingClientRect();
    const room: Record<Edge, number> = { bottom: window.innerHeight - r.bottom, left: r.left, right: window.innerWidth - r.right };
    for (const edge of ['bottom', 'left', 'right'] as Edge[]) {
      // Coda lungo il lato, lontano dagli angoli (in basso tra il 15 e l'80%, sui fianchi tra il 30 e il 75%)
      if (room[edge] >= peek * TAIL_ROOM) options.push({ kind: 'tail', edge, along: edge === 'bottom' ? 15 + Math.random() * 65 : 30 + Math.random() * 45 });
      // Faccia di lato nella parte alta del fianco (tra il 15 e il 45% dell'altezza)
      if (edge !== 'bottom' && room[edge] >= peek * SIDE_ROOM) options.push({ kind: 'side', edge, along: 15 + Math.random() * 30 });
    }
  }
  // Mai lo stesso posto due volte di fila, e mai la coda due volte di fila (nemmeno da un altro lato)
  const fresh = options.filter(o => !sameSpot(o, last) && !(o.kind === 'tail' && last.kind === 'tail'));
  const pool = fresh.length ? fresh : options;
  const odds = first ? FIRST_ODDS : ODDS;
  const kinds = (['top', 'side', 'tail'] as const).filter(k => odds[k] > 0 && pool.some(o => o.kind === k));
  if (!kinds.length) return pool[0];
  const total = kinds.reduce((n, k) => n + odds[k], 0);
  let roll = Math.random() * total;
  const kind = kinds.find(k => (roll -= odds[k]) < 0) ?? kinds[kinds.length - 1];
  const ofKind = pool.filter(o => o.kind === kind);
  return ofKind[Math.floor(Math.random() * ofKind.length)];
}


/**
 * I pezzi della testa (orecchi, collare, faccia e facce che compaiono per un attimo), uguali in ogni posa con la testa.
 * withBody: al posto del solo collare il corpo (collare e zampe), per Eevee di lato: appena si vede la zampetta, e
 * quando si ritira raddrizzandosi sotto la testa non resta il vuoto.
 */
function headPieces(onClick?: (e: React.MouseEvent) => void, withBody = false) {
  return (
    <div className="peek-head" onClick={onClick}>
      <img className="peek-ear up" src={earUp} alt="" draggable={false} />
      <img className="peek-ear side" src={earSide} alt="" draggable={false} />
      <img className="peek-collar" src={withBody ? body : collar} alt="" draggable={false} />
      <img className="peek-face" src={face} alt="" draggable={false} />
      <img className="peek-blink" src={faceBlink} alt="" draggable={false} />
      <img className="peek-happy" src={faceHappy} alt="" draggable={false} />
      <img className="peek-hit" src={faceHit} alt="" draggable={false} />
      <img className="peek-giggle" src={faceGiggle} alt="" draggable={false} />
    </div>
  );
}

/**
 * Eevee che sbircia da dietro una finestra (le guide "Come funziona": il voto, le aree, le schede, i tipi di team).
 * Nascosto ai lettori di schermo: è solo un gioco per chi usa il mouse o il dito. Tutto fermo se il sistema chiede meno movimento.
 * - All'apertura è sempre in alto: testa e coda dietro il bordo alto, le zampette davanti sul bordo. Arriva e va via
 *   sorridendo a bocca aperta; da fermo respira, sbatte le palpebre, muove orecchie e coda.
 * - Nascondino: qualunque Eevee clicchi fa la sua uscita (la finestra resta aperta) e dopo circa 3 s si rivede in un posto a
 *   caso, mai lo stesso di prima (e mai la coda due volte di fila): in alto, solo la coda da un lato con spazio, o la faccia inclinata oltre un fianco
 *   (destra o sinistra). La prima volta faccia 70% e coda 30%, poi in alto 40%, faccia 40%, coda 20% (FIRST_ODDS, ODDS).
 *   · in alto, cliccato: come colpito fa un saltello (occhi a > <, bocca a O, orecchie dritte) e ricade dietro il bordo;
 *   · la coda scodinzola piegandosi davvero (peek-tail-wag.svg: il disegno deformato in più pose); cliccata, si ritira di scatto;
 *   · la faccia di lato (la stessa testa, col corpo nascosto dietro): cliccata ride (occhi a > <, bocca aperta) e rientra raddrizzandosi.
 * La testa è in pezzi sovrapposti, con lo stesso riquadro: i due orecchi dietro (ognuno ruota dalla sua base, nascosta dalla faccia),
 * il collare di pelo sotto il mento (più lungo della testa: da fermo resta dietro la finestra, si vede nel saltello), la faccia davanti,
 * e sopra le facce che compaiono per un attimo: occhi chiusi (battito di ciglia), bocca aperta rosa (sorriso, entrando e uscendo),
 * occhi a > < e bocca a O (colpito), occhi a > < e bocca aperta (di lato, ride).
 * Va dentro un `.help-frame.with-peek`, accanto alla finestra; le misure sono in blocks.css (.eevee-peek, .eevee-tail-peek).
 * Disegni: testa, corpo e coda dalle illustrazioni Dream World di Eevee (dreamworld.svg), zampe e facce nuove disegnate nello stesso stile.
 */
export function EeveePeek() {
  const [spot, setSpot] = useState<Spot>({ kind: 'top' });
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  // Ogni ritorno rimonta Eevee, così l'entrata riparte da capo
  const [visit, setVisit] = useState(0);
  const marker = useRef<HTMLSpanElement>(null);
  // Quante volte è già riapparso (la prima ha probabilità sue)
  const returns = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(id => window.clearTimeout(id)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  /** Clic su Eevee (dove sta ora): uscita, poi sparito, poi di nuovo altrove. */
  const leave = (outMs: number) => (e: React.MouseEvent) => {
    // Il clic resta qui: sullo sfondo chiuderebbe la finestra
    e.stopPropagation();
    if (leaving || gone) return;
    const ms = reducedMotion() ? 0 : outMs;
    setLeaving(true);
    later(() => { setGone(true); setLeaving(false); }, ms);
    later(() => {
      const first = returns.current === 0;
      returns.current += 1;
      setSpot(prev => pickSpot(marker.current, prev, first));
      setVisit(v => v + 1);
      setGone(false);
    }, ms + BACK_MIN_MS + Math.random() * BACK_SPREAD_MS);
  };

  let eevee: React.ReactNode = null;
  if (gone) eevee = null;
  else if (spot.kind === 'tail') {
    eevee = (
      <div key={visit} className={`eevee-tail-peek at-${spot.edge}${leaving ? ' found' : ''}`} style={{ '--along': `${spot.along}%` } as React.CSSProperties} aria-hidden="true">
        <img src={reducedMotion() ? tail : tailWag} alt="" draggable={false} onClick={leave(TAIL_OUT_MS)} />
      </div>
    );
  } else if (spot.kind === 'side') {
    eevee = (
      <div key={visit} className={`eevee-peek at-side at-${spot.edge}${leaving ? ' retreat' : ''}`} style={{ '--along': `${spot.along}%` } as React.CSSProperties} aria-hidden="true">
        {headPieces(leave(RETREAT_MS), true)}
      </div>
    );
  } else {
    eevee = (
      <div key={visit} className={leaving ? 'eevee-peek hop' : 'eevee-peek'} aria-hidden="true">
        <img className="peek-tail" src={tail} alt="" draggable={false} />
        {headPieces(leave(HOP_MS))}
        <img className="peek-paw left" src={paw} alt="" draggable={false} />
        <img className="peek-paw right" src={paw} alt="" draggable={false} />
      </div>
    );
  }
  // Il segnaposto resta sempre: serve a trovare la finestra per scegliere dove riapparire
  return <><span ref={marker} hidden />{eevee}</>;
}
