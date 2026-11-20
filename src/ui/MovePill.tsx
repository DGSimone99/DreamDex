import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { getMove } from '../engine/dex';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { typeColor } from './Sprite';
import { CategoryIcon } from './CategoryIcon';
import { typeIconUrl } from './typeIcons';

/** La potenza da mostrare nella coda: le mosse di stato e quelle a potenza variabile hanno "—". */
export const movePower = (name: string): number | null => {
  const power = getMove(name)?.basePower ?? 0;
  return power > 0 ? power : null;
};

/** Il colore della tessera di una mossa (neutro per le mosse sconosciute, es. inventate in una hackrom). */
export const moveTint = (name: string, type?: string | null) => {
  const shown = type ?? getMove(name)?.type;
  return shown ? typeColor(shown) : 'var(--line)';
};

const CATEGORY = { Physical: 'physical', Special: 'special', Status: 'status' } as const;

/**
 * La coda di una mossa: il simbolo piccolo della categoria (fisico, speciale, stato) e il numero (di base la potenza;
 * le mosse di stato hanno solo il simbolo, quelle a potenza variabile "—"). Larga sempre uguale.
 */
export function MoveTail({ name, value, symbol = true, titled = true }: { name: string; value?: ReactNode; symbol?: boolean; titled?: boolean }) {
  const t = useT();
  const category = symbol ? getMove(name)?.category : undefined;
  const tail = value !== undefined ? value : movePower(name);
  // Mossa di stato senza numero: la coda si stringe attorno al simbolo (larga come le altre sembrerebbe vuota)
  const onlySymbol = tail == null && category === 'Status';
  return (
    <span className={`mvp-tail${onlySymbol ? ' st' : ''}`}>
      {/* Il simbolo dice la categoria anche a parole, sotto il mouse (le mosse di stato hanno solo quello); dove c'è il
          tooltip della mossa (`titled` false) lo dice già lui */}
      {category && <span className={`mvp-cat cat-${CATEGORY[category]}`} title={titled ? t(`editor.category.${category}`) : undefined}><CategoryIcon category={category} /></span>}
      {/* Il numero al centro della coda; senza numero (mosse di stato) al centro va il simbolo */}
      {tail != null ? <span className="mvp-num">{tail}</span> : category === 'Status' ? null : <span className="mvp-num mvp-none" aria-hidden="true">—</span>}
    </span>
  );
}

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Nome della mossa (inglese, come nei set). */
  name: string;
  /** Il tipo con cui colpisce davvero, se diverso da quello scritto sulla mossa (Pixilate & co.). */
  type?: string | null;
  /** Il numero nella coda: di base la potenza ("—" senza potenza, niente per le mosse di stato). */
  value?: ReactNode;
  /** `sm`: per le righe fitte (Offesa, tooltip, liste). */
  size?: 'md' | 'sm';
  /** Al posto del nome tradotto (es. un nome inventato o un testo già pronto). */
  label?: ReactNode;
  /** Dopo la coda (es. la freccia di un menu). */
  after?: ReactNode;
  /** `false`: nella coda solo il numero, senza il simbolo della categoria (es. Offesa › Generale). */
  symbol?: boolean;
  /** `false`: senza il tooltip della mossa (MoveTip), per le pillole dentro un altro tooltip o con un tooltip loro. */
  tip?: boolean;
}

/**
 * Una mossa come pillola (passandoci sopra si apre il tooltip della mossa, MoveTipHost; `tip={false}` lo spegne): tessera del tipo a sinistra, nome che sfuma nel nero, e in fondo una coda tagliata in
 * diagonale, più chiara, col simbolo della categoria e il numero (di base la potenza). Angoli alternati: tondi in
 * alto a sinistra e in basso a destra.
 */
export function MovePill({ name, type, value, size = 'md', label, after, symbol = true, tip = true, className, style, ...rest }: Props) {
  const lang = useLang();
  const move = getMove(name);
  const shown = type ?? move?.type;
  const icon = shown ? typeIconUrl(shown) : undefined;
  return (
    <span data-move-tip={tip && move ? move.name : undefined} {...rest} className={`mvp${size === 'sm' ? ' mvp-sm' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--c': moveTint(name, type), ...style } as CSSProperties}>
      <span className="mvp-ic" aria-hidden="true">{icon && <img src={icon} alt="" draggable={false} />}</span>
      <span className="mvp-nm">{label ?? gameName('move', move?.name ?? name, lang)}</span>
      <MoveTail name={name} value={value} symbol={symbol} titled={!tip || !move} />
      {after}
    </span>
  );
}
