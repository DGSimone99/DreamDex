import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import { getSpecies } from '../engine/dex';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { typeColor } from './Sprite';
import { useMemberTip } from './MemberCard';
import { TypeIcons } from './typeIcons';
import { endSetDrag, hideDragImage, startSetDrag } from './teamDrag';
import { TOUCH_QUERY } from './TouchTips';
import { useMediaQuery } from './useMediaQuery';
import { CandidateMarks, PickButton, Reasons, ResultCell, candidateHandlers, isFavoriteCandidate, isLead, stateClasses, type CandidateProps } from './candidateParts';

/** Quanto il mouse deve restare sulla carta prima che lo sprite esca e parta la GIF (ms): passando sopra la griglia di corsa
 *  non si accende niente e non si scarica nessuna GIF. Il CSS lo riceve da qui (--wake sulla carta) per la luce. */
export const CARD_WAKE_MS = 120;

/** Fuoco da tastiera (non dal clic): jsdom e i browser vecchi senza :focus-visible contano come tastiera. */
const keyboardFocus = (el: Element): boolean => {
  try { return el.matches(':focus-visible'); } catch { return true; }
};

/**
 * Carta "Pedana" (pedana.css): targhetta col +N in alto a sinistra, icone dei tipi in colonna a destra, lo sprite in piedi
 * sulla pedana al centro, nome e motivi sotto; chi esce nella targhetta, dopo il +N. A riposo è spenta, sotto il mouse si
 * accende un po', scelta si accende del tutto e ha la luce dall'alto (beam-on).
 */
export function CandidateCard(props: CandidateProps) {
  const { rank, item, reasons, sprite, usage, out, format, lists, selected, onSelect } = props;
  const lang = useLang();
  // Lo sprite animato solo sulla carta sotto il mouse e sulla selezionata (sempre). Sotto il mouse, dopo CARD_WAKE_MS ms
  // fermi sulla carta, lo sprite esce dalla carta ritagliata (sta sopra la cornice, così la testa sfonda il bordo alto);
  // a riposo resta dentro, sotto targhetta e icone. Col fuoco da tastiera esce subito. Luce e ombra nel CSS
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => stop, []);
  // Solo col mouse: un tocco sul telefono manda anche un "mouse sopra" finto, che lascerebbe la carta sveglia (e la GIF scaricata).
  // Il tipo di puntatore arriva prima del finto mouseenter; senza (browser vecchi, test) conta come mouse
  const pointer = useRef<string | null>(null);
  const enter = () => {
    if (pointer.current && pointer.current !== 'mouse') return;
    stop();
    timer.current = setTimeout(() => { timer.current = null; setHover(true); }, CARD_WAKE_MS);
  };
  const leave = () => { stop(); setHover(false); };
  const popped = hover || focused;
  // Trascinata sul team: al suo posto resta uno spazio vuoto finché non la si lascia
  const [dragOrigin, setDragOrigin] = useState(false);
  // Al clic la luce dall'alto si accende di colpo e si assesta (CSS .beam-flash): solo al clic, non quando la carta è
  // scelta da sola (all'apertura, dalla ricerca)
  const [flash, setFlash] = useState(false);
  // Sulla carta, dopo 0,7 s fermi: la carta del set proposto (strumento, abilità, statistiche, mosse). Su tutta la carta:
  // la sprite non prende il mouse (è decorativa, i clic vanno alla carta)
  // Non sul candidato scelto (il suo dettaglio è già aperto) e si chiude al clic, che lo sceglie
  const memberTip = useMemberTip(700);
  // Schermi touch: niente trascinamento (il dito che scorre la lista prendeva la carta); si tocca e si sceglie
  const touch = useMediaQuery(TOUCH_QUERY);
  const tipHandlers = memberTip.bind(item.set);
  const { close: closeTip } = memberTip;
  useEffect(() => { if (selected) closeTip(); }, [selected, closeTip]);
  const types = getSpecies(item.species)?.types ?? [];
  const typeNames = types.map(type => typeName(type, lang)).join(' / ');
  const resultId = useId();
  const className = ['card', isLead(rank, item) && 'first', selected && 'beam-on', flash && 'beam-flash', dragOrigin && 'drag-origin', stateClasses(props)].filter(Boolean).join(' ');
  return (
    // Bordo inferiore nel colore del tipo primario
    <li className={className} style={{ '--t1': typeColor(types[0] ?? ''), '--t2': typeColor(types[1] ?? types[0] ?? ''), '--wake': `${CARD_WAKE_MS}ms` } as CSSProperties} {...candidateHandlers(props)}
      onPointerEnter={(e: PointerEvent<HTMLLIElement>) => { pointer.current = e.pointerType; }}
      onClickCapture={() => setFlash(true)} onAnimationEnd={e => { if (e.animationName === 'beam-flash') setFlash(false); }}
      // Uscendo dalla carta si chiude anche la carta del set
      onMouseEnter={e => { enter(); if (!selected) tipHandlers.onMouseEnter(e); }}
      onPointerDown={closeTip} onMouseLeave={e => { leave(); memberTip.close(e); }}
      // Trascinata sul team: sopra un membro lo sostituisce, sopra uno slot vuoto lo aggiunge (teamDrag.ts)
      // Mentre la si trascina, segue il mouse la carta del team di questo set (la disegna TeamPanel, non la copia sfumata
      // del browser); al suo posto nella lista resta lo spazio vuoto
      draggable={!touch} onDragStart={e => {
        hideDragImage(e);
        leave(); memberTip.close(); startSetDrag(e, item.set);
        setTimeout(() => setDragOrigin(true), 0);
      }}
      onDragEnd={() => { setDragOrigin(false); endSetDrag(); }}
      onFocus={(e: FocusEvent<HTMLLIElement>) => setFocused(keyboardFocus(e.target))}
      onBlur={(e: FocusEvent<HTMLLIElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}>
      <div className="card-face pedana-face">
        <span className="pedana-stripe" aria-hidden="true" />
        <span className="pedana-beam" aria-hidden="true" />
        <span className="pedana-stage" aria-hidden="true"><span className="pedana-disc" /></span>
        {!popped && <span className="card-sprite" aria-hidden="true">{sprite(selected)}</span>}
        <ResultCell id={resultId} item={item} usage={usage} favorite={isFavoriteCandidate(item.set, lists)} className="tag" out={out} />
        <TypeIcons types={types} className="card-types" hints />
        {/* Le icone sono decorative: i tipi agli screen reader come testo */}
        <span className="visually-hidden">{typeNames}</span>
        <span className="who">
          <span className="name-line">
            {/* Col nome si sente anche il voto (+N), il numero per cui scegliere */}
            <PickButton rank={rank} species={item.species} selected={selected} onSelect={onSelect} onAction={props.onAction} describedBy={resultId} />
            <CandidateMarks item={item} format={format} lists={lists} />
          </span>
          <Reasons reasons={reasons} />
        </span>
      </div>
      {popped && <span className="card-sprite popped" aria-hidden="true">{sprite(true)}</span>}
      {!selected && memberTip.tip}
    </li>
  );
}
