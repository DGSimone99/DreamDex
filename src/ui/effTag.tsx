import { useState } from 'react';
import { useT } from '../i18n/react';

/**
 * L'etichetta di efficacia delle caselle di Coverage tipi e Coverage meta, in basso a sinistra (il triangolino del setup
 * sta in alto a destra). Offesa: ×2 o ×4 se il membro ha almeno una mossa superefficace sul bersaglio, anche debole.
 * Difesa: tutto quello che non è neutro (×4, ×2, ×½, ×¼, 0 = immune).
 */
export type EffSide = 'offense' | 'defense';

/**
 * L'efficacia a parole nelle righe dei tooltip, accanto alla mossa, sempre nello stesso posto: Difesa (il membro
 * colpito) "debole ×2", "resiste ×½", "immune"; Offesa (la mossa sul bersaglio) "superefficace ×2", "poco efficace ×½",
 * "nessun effetto". Neutro (×1) o sconosciuto: niente.
 */
export function effWord(t: ReturnType<typeof useT>, mult: number | null | undefined, side: EffSide): string | null {
  if (mult === null || mult === undefined || mult === 1) return null;
  const m = mult >= 4 ? '×4' : mult > 1 ? '×2' : mult <= 0.25 ? '×¼' : '×½';
  if (side === 'defense') return mult === 0 ? t('eff.immune') : mult > 1 ? t('eff.weak', { m }) : t('eff.resist', { m });
  return mult === 0 ? t('eff.none') : mult > 1 ? t('eff.se', { m }) : t('eff.nve', { m });
}

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
    /** Su ogni casella e intestazione della colonna `i` (anche col fuoco: le frecce della griglia). */
    enter: (i: number) => ({ onMouseEnter: () => setCol(i), onFocus: () => setCol(i) }),
    /** Spegne la colonna (il fuoco esce dalla griglia). */
    clear: () => setCol(null),
    /** Classe della colonna accesa. */
    cls: (i: number, extra = '') => [extra, col === i && 'x-col'].filter(Boolean).join(' ') || undefined,
  };
}

/** Il nome sotto l'icona dell'intestazione: sopra le righe (assoluto), non sposta niente. Solo per gli occhi: l'intestazione ha già il suo nome. */
export const ColName = ({ name }: { name: string }) => <span className="col-name" aria-hidden="true">{name}</span>;

/**
 * L'interruttore dell'efficacia, in alto nel pannello di Coverage tipi e meta: lascia accese solo le
 * caselle con l'etichetta (superefficaci nell'Offesa, non neutre nella Difesa).
 */
export function EffSwitch({ side, on, onChange }: { side: EffSide; on: boolean; onChange: (on: boolean) => void }) {
  const t = useT();
  return <PanelSwitch on={on} onChange={onChange} label={t(`eff.only.${side}`)} title={t(`eff.only.${side}.title`)} />;
}

/**
 * L'interruttore in alto a sinistra nel pannello, sulla riga della legenda (`.panel-switch`): quello dell'efficacia e,
 * nella Velocità, quello di Trick Room (`tone="room"`: acceso in viola, il colore della stanza).
 */
export function PanelSwitch({ on, onChange, label, title, tone }: { on: boolean; onChange: (on: boolean) => void; label: string; title?: string; tone?: 'room' }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`eff-switch${tone ? ` ${tone}` : ''}${on ? ' on' : ''}`}
      title={title} onClick={() => onChange(!on)}>
      <span className="eff-switch-track" aria-hidden="true"><span className="eff-switch-knob" /></span>
      {label}
    </button>
  );
}
