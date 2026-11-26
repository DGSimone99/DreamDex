import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { hint } from './MoveTip';
import type { Archetype } from '../engine/archetype';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { useClickAway } from './useClickAway';

/**
 * Tipo di team sopra i candidati: una casella come le altre della barra (nome piccolo e scelta) che apre una
 * tendina con i tipi in ordine da attacco a difesa, ognuno con la spiegazione breve. Esc o un clic
 * fuori la chiudono. È un'impostazione, non un filtro (niente chip, Azzera non lo tocca).
 */
export function TeamTypePicker({ types, value, onChange }: {
  types: Archetype[];
  value: Archetype | null;
  onChange: (value: Archetype | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Sotto la casella c'è poco spazio (barra in basso sul tablet): la tendina si apre verso l'alto
  const [up, setUp] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useClickAway(target => !!box.current?.contains(target), () => setOpen(false), { active: open, event: 'mousedown' });
  useEffect(() => {
    if (open) box.current?.querySelector<HTMLButtonElement>('.tt-menu [aria-selected="true"]')?.focus();
  }, [open]);
  const pick = (next: Archetype | null) => { onChange(next); setOpen(false); trigger.current?.focus(); };
  const name = value ? t(`archetype.${value}`) : t('suggest.anyType');
  const rows: (Archetype | null)[] = [null, ...types];
  // Frecce su e giù per passare da una riga all'altra
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('.tt-menu [role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  return (
    <div className="team-type" ref={box}
      onKeyDown={e => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} type="button" className={`tt-trigger${open ? ' open' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${t('suggest.teamType')}: ${name}`} aria-description={value ? t(`archetype.${value}.note`) : t('suggest.anyTypeNote')}
        {...hint(open ? null : value ? t(`archetype.${value}.note`) : t('suggest.anyTypeNote'))}
        onClick={() => {
          if (!open) {
            const r = trigger.current?.getBoundingClientRect();
            const bottomBar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-h')) || 0;
            setUp(!!r && window.innerHeight - bottomBar - r.bottom < 380 && r.top > 380);
          }
          setOpen(o => !o);
        }}>
        <span className="tt-label" aria-hidden="true">{t('suggest.teamTypeShort')}</span>
        <span className="tt-name">{name}</span>
        <b className="tt-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className={`tt-menu${up ? ' up' : ''}`} role="listbox" aria-label={t('suggest.teamType')} onKeyDown={move}>
          {rows.map(row => (
            <button key={row ?? 'any'} type="button" role="option" aria-selected={row === value} className="tt-option" onClick={() => pick(row)}>
              <span className="tt-option-text">
                <strong>{row ? t(`archetype.${row}`) : t('suggest.anyType')}</strong>
                <small>{row ? t(`archetype.${row}.note`) : t('suggest.anyTypeRow')}</small>
              </span>
              {row === value && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
