/**
 * Il testo a vista di un elemento: il suo textContent senza gli elementi `hidden` (le descrizioni nascoste per i lettori
 * di schermo che stanno accanto al loro pulsante, come quella del "?" in testata).
 */
export function visibleText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[hidden]').forEach(x => x.remove());
  return copy.textContent ?? '';
}
