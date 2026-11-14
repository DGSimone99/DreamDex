import { useState } from 'react';
import { useT } from '../i18n/react';

/**
 * L'etichetta di efficacia delle caselle di Coverage tipi e Coverage meta, in basso a sinistra (il triangolino del setup
 * sta in alto a destra). Offesa: ×2 o ×4 se il membro ha almeno una mossa superefficace sul bersaglio, anche debole.
 * Difesa: tutto quello che non è neutro (×4, ×2, ×½, ×¼, 0 = immune).
 */
export type EffSide = 'offense' | 'defense';

export function effLabel(mult: number | null | undefined, side: EffSide): string | null {
  if (mult === null || mult === undefined) return null;
  if (mult >= 4) return '×4';
  if (mult > 1) return '×2';
  if (side === 'offense') return null;
  if (mult === 0) return '0';
  if (mult <= 0.25) return '×¼';
  if (mult < 1) return '×½';
  return null;
}

/**
 * Classi della casella per l'interruttore ("Solo superefficaci" / "Solo efficacia"): restano accese le caselle con
 * l'etichetta (nell'Offesa i superefficaci, nella Difesa tutto quello che non è neutro), le altre si spengono.
 */
export const effClass = (label: string | null, _side: EffSide, only: boolean | undefined) =>
  (label ? ' has-eff' : '') + (only && !label ? ' eff-dim' : '');

/** L'etichetta nella casella (nascosta ai lettori di schermo) e il suo testo per esteso per loro. */
export function EffTag({ label, side }: { label: string | null; side: EffSide }) {
  const t = useT();
  if (!label) return null;
  const spoken = side === 'offense' ? t('eff.se', { m: label })
    : label === '0' ? t('eff.immune')
    : label === '×2' || label === '×4' ? t('eff.weak', { m: label })
    : t('eff.resist', { m: label });
  return (
    <>
      <span className="eff-tag" aria-hidden="true">{label}</span>
      <span className="visually-hidden"> {spoken}</span>
    </>
  );
}

/** La colonna sotto il puntatore: si accende tutta e sotto l'intestazione compare il nome (tipo o Pokémon). */
export function useColumnHover() {
  const [col, setCol] = useState<number | null>(null);
  return {
    col,
    /** Sulla tabella: uscendo si spegne. */
    table: { onMouseLeave: () => setCol(null) },
    /** Su ogni casella e intestazione della colonna `i`. */
    enter: (i: number) => ({ onMouseEnter: () => setCol(i) }),
    /** Classe della colonna accesa. */
    cls: (i: number, extra = '') => [extra, col === i && 'x-col'].filter(Boolean).join(' ') || undefined,
  };
}

/** Il nome sotto l'icona dell'intestazione: sopra le righe (assoluto), non sposta niente. Solo per gli occhi: l'intestazione ha già il suo nome. */
export const ColName = ({ name }: { name: string }) => <span className="col-name" aria-hidden="true">{name}</span>;

/** L'interruttore della riga dei problemi: lascia accese solo le caselle con l'etichetta (superefficaci nell'Offesa, non neutre nella Difesa). */
export function EffSwitch({ side, on, onChange }: { side: EffSide; on: boolean; onChange: (on: boolean) => void }) {
  const t = useT();
  return (
    <button type="button" role="switch" aria-checked={on} className={`eff-switch${on ? ' on' : ''}`}
      title={t(`eff.only.${side}.title`)} onClick={() => onChange(!on)}>
      <span className="eff-switch-track" aria-hidden="true"><span className="eff-switch-knob" /></span>
      {t(`eff.only.${side}`)}
    </button>
  );
}
