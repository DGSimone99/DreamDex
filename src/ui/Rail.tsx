import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import logo from '../assets/brand/dreamdex-band-horizontal-app.svg?raw';
import type { Family, FormatChoice, FormatMemory } from '../engine/formatChoice';
import type { TeamSet } from '../engine/sets';
import type { StatsMeta } from '../engine/stats';
import { LANGS, type Lang } from '../i18n';
import { useT } from '../i18n/react';
import { FormatDialog } from './FormatDialog';
import { choiceName, choiceSummary } from './formatName';
import { hint } from './MoveTip';
import { Icon } from './icons';

/** L'icona di ogni famiglia. */
const FAMILY_ICON = { competitive: 'trophy', game: 'gamepad', free: 'unlock' } as const;

interface Props {
  /** Il formato scelto (una delle tre famiglie). */
  choice: FormatChoice;
  /** L'ultima scelta di ogni famiglia. */
  memory: FormatMemory;
  onPick: (choice: FormatChoice) => void;
  /** Il team, per l'avviso dei membri non ammessi nella finestra del formato. */
  team?: TeamSet[];
  meta: StatsMeta | null;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Le sezioni (Tabs verticali, a tessere con lo stato). */
  tabs: ReactNode;
  /** Apre le impostazioni; senza, il pulsante non c'è. */
  onSettings?: () => void;
  /** Apre Crediti e note legali. */
  onCredits?: () => void;
  /** Apre Segnala o suggerisci. */
  onFeedback?: () => void;
}

/** Il mese delle statistiche ("2026-09") in numeri, uguale in ogni lingua: "09/2026" (sta su una riga). */
function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  if (!year || !m) return month;
  return `${m.padStart(2, '0')}/${year}`;
}

/**
 * Barra laterale: il logo, la fascia del formato (le tre famiglie, il nome in grande e un riassunto; ogni parte apre la
 * finestra Scegli il formato), le sezioni come tessere con una riga di stato, e in fondo lingua, impostazioni e mese dei dati.
 * Importa/Esporta e Team salvati stanno sopra la squadra (TeamPanel).
 */
export function Rail({ choice, memory, onPick, team, meta, lang, onLangChange, tabs, onSettings, onCredits, onFeedback }: Props) {
  const t = useT();
  // La finestra del formato e la famiglia su cui si apre (aprirla non cambia il formato)
  const [open, setOpen] = useState<Family | null>(null);
  const plate = useRef<HTMLButtonElement>(null);
  // Chiusa la finestra (in qualunque modo, anche aperta col tasto F), la tastiera torna sulla targa del formato; dopo un
  // attimo, quando la pagina non è più bloccata («inert», tolto da ModalLock): prima il browser ignorerebbe il fuoco
  const close = useCallback(() => {
    setOpen(null);
    setTimeout(() => plate.current?.focus(), 0);
  }, []);
  // «F» (fuori da un campo di testo, senza finestre o menu aperti, senza Ctrl/Alt/Cmd) apre la finestra del formato
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'f' && e.key !== 'F') || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.isComposing) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.isContentEditable || target.closest('input, textarea, select, [role="combobox"], [role="textbox"], [contenteditable]'))) return;
      // Finestre o menu aperti (non la copia ferma che fa l'animazione di chiusura, nascosta ai lettori di schermo)
      const blocking = document.querySelectorAll('[aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], details[open], dialog[open]');
      if ([...blocking].some(el => !el.closest('[aria-hidden="true"]'))) return;
      e.preventDefault();
      setOpen(choice.family);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choice.family]);
  const name = choiceName(choice, t);
  const summary = choiceSummary(choice, t);
  const family = t(`family.${choice.family}`);
  return (
    <aside className="rail" aria-label={t('rail.label')}>
      <h1 className="rail-logo">
        <span className="visually-hidden">DreamDex</span>
        {/* Il logo a fascia del kit: le due D nei colori della versione (--accent, --accent-2), la scritta nel colore del testo */}
        <span className="rail-logo-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
      </h1>
      {/* Il formato come targa azzurra a tutta larghezza (icona della famiglia, nome, freccina) e sotto una riga scura col
          riassunto e la famiglia; il clic apre la finestra Scegli il formato sulla famiglia attiva */}
      <button ref={plate} type="button" className="rail-format" onClick={() => setOpen(choice.family)} aria-keyshortcuts="F" data-hint={t('rail.formatKey')}
        aria-label={t('rail.formatAria', { format: name, summary: [family, ...summary].join(', ') })}>
        <span className="rail-format-plate">
          <Icon name={FAMILY_ICON[choice.family]} />
          <span className="rail-format-name">{name}</span>
          <Icon name="next" />
        </span>
        <span className="rail-format-sub">
          <span className="rail-format-summary">{summary.map(part => <span key={part}>{part}</span>)}</span>
          <span className="rail-format-family">{family}</span>
        </span>
      </button>
      {open && <FormatDialog choice={choice} memory={memory} family={open} team={team} onPick={onPick} onClose={close} />}
      <div className="rail-sections">{tabs}</div>
      <div className="rail-foot">
        <div className="rail-foot-row">
          <div role="group" aria-label={t('lang.label')} className="segmented lang-switch">
            {LANGS.map(code => (
              <button key={code} type="button" aria-pressed={lang === code} onClick={() => onLangChange(code)}>
                {t(`lang.${code}`)}
              </button>
            ))}
          </div>
          {onSettings && (
            <button type="button" className="rail-settings" aria-label={t('settings.open')} {...hint(t('settings.open'))} onClick={onSettings}>
              <Icon name="gear" />
              <span className="rail-settings-text" aria-hidden="true">{t('settings.open')}</span>
            </button>
          )}
        </div>
        <p className="meta">
          {meta ? t('top.statsMonth', { month: monthLabel(meta.month) }) : t('top.statsMissing')}
        </p>
        {(onFeedback || onCredits) && (
          <p className="rail-links">
            {onFeedback && <button type="button" className="rail-credits" onClick={onFeedback}>{t('feedback.open')}</button>}
            {onCredits && <button type="button" className="rail-credits" onClick={onCredits}>{t('credits.open')}</button>}
          </p>
        )}
      </div>
    </aside>
  );
}
