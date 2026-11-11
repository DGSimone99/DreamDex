import head from '../assets/eevee/peek-head.svg';
import paw from '../assets/eevee/peek-paw.svg';
import tail from '../assets/eevee/peek-tail.svg';

/**
 * Eevee che sbircia da dietro una finestra (le guide "Come funziona": il voto, le aree, le schede, i tipi di team): testa e coda dietro il bordo alto,
 * le zampette davanti, appoggiate sul bordo. Solo decorazione: niente clic, nascosto ai lettori di schermo.
 * Va dentro un `.help-frame.with-peek`, accanto alla finestra; le misure sono in blocks.css (.eevee-peek).
 * Disegni: testa e coda dalle illustrazioni Dream World di Eevee (dreamworld.svg), zampe disegnate nello stesso stile.
 */
export function EeveePeek() {
  return (
    <div className="eevee-peek" aria-hidden="true">
      <img className="peek-tail" src={tail} alt="" draggable={false} />
      <img className="peek-head" src={head} alt="" draggable={false} />
      <img className="peek-paw left" src={paw} alt="" draggable={false} />
      <img className="peek-paw right" src={paw} alt="" draggable={false} />
    </div>
  );
}
