import { useEffect } from 'react';
import { dex, getMove } from '../engine/dex';
import { gameName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { CategoryIcon } from './CategoryIcon';
import { describe } from './describe';
import { FloatTip, keyboardFocus, useFloatAnchor } from './FloatTip';
import { ItemIcon } from './ItemIcon';
import { typeColor } from './Sprite';
import { typeIconUrl } from './typeIcons';

/** I bersagli di Showdown raggruppati come li dice il gioco (in singolo "normal", "any" e "adjacentFoe" sono lo stesso). */
type TargetKey = 'single' | 'random' | 'self' | 'foes' | 'adjacent' | 'field' | 'foeSide' | 'allySide' | 'allyTeam' | 'allies' | 'ally' | 'allyOrSelf' | 'scripted';
const TARGET: Record<string, TargetKey> = {
  normal: 'single', any: 'single', adjacentFoe: 'single', randomNormal: 'random',
  self: 'self', allAdjacentFoes: 'foes', allAdjacent: 'adjacent', all: 'field',
  foeSide: 'foeSide', allySide: 'allySide', allyTeam: 'allyTeam', allies: 'allies',
  adjacentAlly: 'ally', adjacentAllyOrSelf: 'allyOrSelf', scripted: 'scripted',
};

/** Il colore della categoria (fisica arancio, speciale azzurro-viola, stato nel testo spento). */
const CAT_CLASS = { Physical: 'physical', Special: 'special', Status: 'status' } as const;

/**
 * Il contenuto del tooltip di una mossa, come la scheda mossa dei giochi: testata nel colore del tipo (icona e nome, la
 * priorità se c'è), tre caselle (categoria, potenza, precisione), il bersaglio su una riga e la descrizione.
 * Mossa sconosciuta (inventata in una hackrom): niente.
 */
export function MoveTipBody({ name }: { name: string }) {
  const t = useT();
  const lang = useLang();
  const move = getMove(name);
  if (!move) return null;
  const accuracy = move.accuracy === true ? null : move.accuracy;
  const desc = describe.move(move.name, lang);
  const target: TargetKey = TARGET[move.target] ?? 'single';
  return (
    <>
      <div className="ftip-head">
        <img src={typeIconUrl(move.type)} alt="" draggable={false} />
        <b>{gameName('move', move.name, lang)}</b>
        {move.priority !== 0 && (
          <span className={`mtip-prio${move.priority < 0 ? ' neg' : ''}`}>{t('moveTip.priority', { n: move.priority > 0 ? `+${move.priority}` : `${move.priority}` })}</span>
        )}
      </div>
      <div className="mtip-stats">
        <span>
          <small>{t('moveTip.category')}</small>
          <b className={`mtip-cat cat-${CAT_CLASS[move.category]}`}><CategoryIcon category={move.category} />{t(`editor.category.${move.category}`)}</b>
        </span>
        <span><small>{t('moveTip.power')}</small><b>{move.basePower > 0 ? move.basePower : '—'}</b></span>
        <span><small>{t('moveTip.accuracy')}</small><b>{accuracy === null ? '—' : accuracy}</b></span>
      </div>
      <div className="mtip-target">
        <small>{t('moveTip.target')}</small>
        <span>{t(`moveTip.target.${target}`)}</span>
      </div>
      {desc && <p className="mtip-desc">{desc}</p>}
    </>
  );
}

/** Il tooltip di una mossa nello stile DreamDex, nel colore del suo tipo. */
export function MoveTip({ name, rect, side = false, layer = false }: { name: string; rect: DOMRect; side?: boolean; layer?: boolean }) {
  const move = getMove(name);
  if (!move) return null;
  return (
    <FloatTip rect={rect} tone={typeColor(move.type)} className="move" side={side} layer={layer}>
      <MoveTipBody name={name} />
    </FloatTip>
  );
}

/** Il tooltip di uno strumento o di un'abilità: testata con l'icona dello strumento e il nome, sotto la descrizione. */
export function KitTipBody({ kind, name }: { kind: 'item' | 'ability'; name: string }) {
  const lang = useLang();
  const desc = describe[kind](name, lang);
  return (
    <>
      <div className="ftip-head">
        {kind === 'item' && <span className="ktip-icon"><ItemIcon item={name} size={24} /></span>}
        <b>{gameName(kind, name, lang)}</b>
      </div>
      {desc && <p className="mtip-desc">{desc}</p>}
    </>
  );
}

/** Uno strumento o un'abilità che esiste (niente tooltip per un nome inventato in una hackrom). */
const known = (kind: 'item' | 'ability', name: string) => (kind === 'item' ? dex.items.get(name).exists : dex.abilities.get(name).exists);

/** Gli attributi che aprono i tooltip della pagina: mossa, strumento, abilità, fumetto di testo. */
const TIP_SELECTOR = '[data-move-tip], [data-item-tip], [data-ability-tip], [data-hint]';
type TipKey = { kind: 'move' | 'item' | 'ability' | 'hint'; name: string; layer: boolean };
const keyOf = (el: Element): TipKey | null => {
  const layer = !!el.closest('[popover]');
  const move = el.getAttribute('data-move-tip');
  if (move) return getMove(move) ? { kind: 'move', name: move, layer } : null;
  const item = el.getAttribute('data-item-tip');
  if (item) return known('item', item) ? { kind: 'item', name: item, layer } : null;
  const ability = el.getAttribute('data-ability-tip');
  if (ability) return known('ability', ability) ? { kind: 'ability', name: ability, layer } : null;
  const hint = el.getAttribute('data-hint');
  // Col dito il fumetto di testo lo apre TouchTips (tenendo premuto), nel foglio dal basso
  if (hint && !document.documentElement.classList.contains('touch-tips')) return { kind: 'hint', name: hint, layer };
  return null;
};

/**
 * I tooltip per tutta l'app: un solo ascoltatore sulla pagina. Ogni elemento con `data-move-tip="<mossa>"` (pillole delle
 * mosse, campi mossa dell'editor), `data-item-tip` / `data-ability-tip` (strumenti e abilità) o `data-hint="<testo>"` (il
 * fumetto dell'app, al posto del tooltip del browser) lo apre passandoci sopra col mouse, o col fuoco da tastiera se
 * l'elemento stesso si raggiunge col Tab. Vince l'elemento più vicino al mouse. Non si apre dentro un altro tooltip, né su
 * un campo col menu aperto; un clic lo chiude. Col dito lo apre TouchTips (tenendo premuto).
 */
export function TipHost() {
  const { anchor, open, close } = useFloatAnchor<TipKey>();
  useEffect(() => {
    let current: Element | null = null;
    const find = (target: EventTarget | null) => (target instanceof Element ? target.closest(TIP_SELECTOR) : null);
    const blocked = (el: Element) => !!el.closest('.ftip') || !!el.querySelector('[aria-expanded="true"]');
    const start = (el: Element) => {
      const key = keyOf(el);
      if (!key || blocked(el)) { close(); return; }
      open(key, el);
    };
    const over = (e: MouseEvent) => {
      const el = find(e.target);
      if (el === current) return;
      current = el;
      if (el) start(el); else close();
    };
    const out = (e: MouseEvent) => {
      if (!current) return;
      const to = e.relatedTarget;
      if (to instanceof Node && current.contains(to)) return;
      current = null;
      close();
    };
    const down = () => { current = null; close(); };
    const focusIn = (e: FocusEvent) => {
      const el = e.target instanceof Element && e.target.matches(TIP_SELECTOR) ? e.target : null;
      if (el && keyboardFocus(el)) { current = el; start(el); }
    };
    const focusOut = (e: FocusEvent) => { if (e.target === current) { current = null; close(); } };
    document.addEventListener('mouseover', over);
    document.addEventListener('mouseout', out);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mouseout', out);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
    };
  }, [open, close]);
  if (!anchor) return null;
  const { kind, name, layer } = anchor.key;
  if (kind === 'move') return <MoveTip name={name} rect={anchor.rect} layer={layer} />;
  if (kind === 'hint') return <FloatTip rect={anchor.rect} tone="var(--line)" className="hint" layer={layer}>{name}</FloatTip>;
  return (
    <FloatTip rect={anchor.rect} tone="var(--accent)" className="move kit" layer={layer}>
      <KitTipBody kind={kind} name={name} />
    </FloatTip>
  );
}

/**
 * Il fumetto dell'app su un elemento (al posto di `title`): `{...hint(testo)}`. Senza testo, niente. `title=""` spegne il
 * tooltip del browser di un contenitore (es. "Trascina…" della carta del team), che altrimenti comparirebbe insieme.
 */
export const hint = (text: string | undefined | null) => (text ? { 'data-hint': text, title: '' } : {});
/** Il tooltip di uno strumento o di un'abilità su un elemento: `{...kitTip('item', nome)}`. Senza nome, niente. */
export const kitTip = (kind: 'item' | 'ability', name: string | undefined | null) =>
  (name ? { ...(kind === 'item' ? { 'data-item-tip': name } : { 'data-ability-tip': name }), title: '' } : {});
