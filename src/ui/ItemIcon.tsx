import { Icons } from '@pkmn/img';
import { dex } from '../engine/dex';
import { kitTip } from './MoveTip';

/** Le icone di Showdown sono 24px in un foglio da 384×1152: le scaliamo all'altezza del testo. */
const NATIVE = 24;
const SHEET = { width: 384, height: 1152 };

/**
 * Icona dello strumento (dal foglio di icone di Showdown); niente se lo strumento non esiste. `tip`: passandoci sopra il
 * tooltip dello strumento (dove l'icona sta da sola, senza il nome accanto che lo apre già).
 */
export function ItemIcon({ item, size = 18, tip = false }: { item: string; size?: number; tip?: boolean }) {
  if (!item || !dex.items.get(item).exists) return null;
  const { url, left, top } = Icons.getItem(item);
  const scale = size / NATIVE;
  return (
    <span
      className="item-icon"
      aria-hidden="true"
      {...(tip ? kitTip('item', item) : {})}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${url})`,
        backgroundSize: `${SHEET.width * scale}px ${SHEET.height * scale}px`,
        backgroundPosition: `${left * scale}px ${top * scale}px`,
      }}
    />
  );
}
