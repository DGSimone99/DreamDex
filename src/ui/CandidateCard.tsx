import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';
import { getSpecies } from '../engine/dex';
import { typeName } from '../i18n/game';
import { useLang } from '../i18n/react';
import { typeColor } from './Sprite';
import { useMemberTip } from './MemberCard';
import { TypeIcons } from './typeIcons';
import { endSetDrag, startSetDrag } from './teamDrag';
import { CandidateMarks, PickButton, Reasons, ResultCell, candidateHandlers, isFavoriteCandidate, isLead, stateClasses, type CandidateProps } from './candidateParts';

/** Quanto il mouse deve restare sulla carta prima che lo sprite esca e parta la GIF (ms): passando sopra la griglia di corsa
 *  non si accende niente e non si scarica nessuna GIF. Il CSS lo riceve da qui (--wake sulla carta) per la luce. */
export const CARD_WAKE_MS = 120;

/** Fuoco da tastiera (non dal clic): jsdom e i browser vecchi senza :focus-visible contano come tastiera. */
const keyboardFocus = (el: Element): boolean => {
  try { return el.matches(':focus-visible'); } catch { return true; }
};

/**
 * Stile "Carte": una casella a forma di carta Masters. Targhetta col +N in alto a sinistra (#1 su magenta),
 * icone dei tipi in colonna a destra, sprite in alto al centro, nome e motivi in basso; chi esce nella targhetta, dopo il +N.
 * La carta ritagliata è `.card-face`: la sua cornice (anche selezionata) segue l'angolo tagliato.
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
  // Sulla carta, dopo 0,7 s fermi: la carta del set proposto (strumento, abilità, statistiche, mosse). Su tutta la carta:
  // la sprite non prende il mouse (è decorativa, i clic vanno alla carta)
  // Non sul candidato scelto (il suo dettaglio è già aperto) e si chiude al clic, che lo sceglie
  const memberTip = useMemberTip(700);
  const tipHandlers = memberTip.bind(item.set);
  const { close: closeTip } = memberTip;
  useEffect(() => { if (selected) closeTip(); }, [selected, closeTip]);
  const types = getSpecies(item.species)?.types ?? [];
  const typeNames = types.map(type => typeName(type, lang)).join(' / ');
  const className = ['card', isLead(rank, item) && 'first', stateClasses(props)].filter(Boolean).join(' ');
  return (
    // Bordo inferiore nel colore del tipo primario
    <li className={className} style={{ '--t1': typeColor(types[0] ?? ''), '--wake': `${CARD_WAKE_MS}ms` } as CSSProperties} {...candidateHandlers(props)}
      onPointerEnter={(e: PointerEvent<HTMLLIElement>) => { pointer.current = e.pointerType; }}
      // Uscendo dalla carta si chiude anche la carta del set
      onMouseEnter={e => { enter(); if (!selected) tipHandlers.onMouseEnter(e); }}
      onPointerDown={closeTip} onMouseLeave={() => { leave(); memberTip.close(); }}
      // Trascinata sul team: sopra un membro lo sostituisce, sopra uno slot vuoto lo aggiunge (teamDrag.ts)
      draggable onDragStart={e => { leave(); memberTip.close(); startSetDrag(e, item.set); }} onDragEnd={endSetDrag}
      onFocus={(e: FocusEvent<HTMLLIElement>) => setFocused(keyboardFocus(e.target))}
      onBlur={(e: FocusEvent<HTMLLIElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}>
      <div className="card-face">
        {!popped && <span className="card-sprite" aria-hidden="true">{sprite(selected)}</span>}
        <ResultCell item={item} usage={usage} favorite={isFavoriteCandidate(item.set, lists)} className="tag" out={out} />
        <TypeIcons types={types} className="card-types" title={typeNames} />
        {/* Le icone sono decorative: i tipi agli screen reader come testo */}
        <span className="visually-hidden">{typeNames}</span>
        <span className="who">
          <span className="name-line">
            <PickButton rank={rank} species={item.species} selected={selected} onSelect={onSelect} />
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
