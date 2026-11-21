import { useCallback, useState, type ReactNode } from 'react';
import logo from '../assets/brand/dreamdex-band-horizontal-app.svg?raw';
import { FAMILIES, type Family, type FormatChoice, type FormatMemory } from '../engine/formatChoice';
import { GAME_IDS, gameReady } from '../engine/games';
import type { StatsMeta } from '../engine/stats';
import { LANGS, type Lang } from '../i18n';
import { useT } from '../i18n/react';
import { FormatDialog } from './FormatDialog';
import { choiceName, choiceSummary } from './formatName';
import { Icon } from './icons';

/** L'icona di ogni famiglia. */
const FAMILY_ICON = { competitive: 'trophy', game: 'gamepad', free: 'unlock' } as const;

interface Props {
  /** Il formato scelto (una delle tre famiglie). */
  choice: FormatChoice;
  /** L'ultima scelta di ogni famiglia. */
  memory: FormatMemory;
  onPick: (choice: FormatChoice) => void;
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
export function Rail({ choice, memory, onPick, meta, lang, onLangChange, tabs, onSettings, onCredits, onFeedback }: Props) {
  const t = useT();
  // La finestra del formato e la famiglia su cui si apre (aprirla non cambia il formato)
  const [open, setOpen] = useState<Family | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const name = choiceName(choice, t);
  const summary = choiceSummary(choice, t);
  return (
    <aside className="rail" aria-label={t('rail.label')}>
      <h1 className="rail-logo">
        <span className="visually-hidden">DreamDex</span>
        {/* Il logo a fascia del kit: le due D nei colori della versione (--accent, --accent-2), la scritta nel colore del testo */}
        <span className="rail-logo-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
      </h1>
      <div className="rail-format" role="group" aria-label={t('rail.format')}>
        {/* La famiglia attiva come linguetta col nome; le altre due solo icona (il nome nel fumetto): stanno nella barra stretta */}
        <div className="rail-families">
          {FAMILIES.map(f => {
            const active = choice.family === f;
            // Giochi senza i Pokédex dei giochi: spenta (nella finestra non si potrebbe scegliere nessun gioco)
            const off = f === 'game' && !GAME_IDS.some(gameReady);
            return (
              <button key={f} type="button" className="rail-family" aria-current={active ? 'true' : undefined} disabled={off}
                aria-label={t(`family.${f}`)} data-hint={active ? undefined : t(`family.${f}`)} onClick={() => setOpen(f)}>
                <Icon name={FAMILY_ICON[f]} />
                {active && <span>{t(`family.${f}`)}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="rail-format-main" onClick={() => setOpen(choice.family)}
          aria-label={t('rail.formatAria', { format: name, summary: summary.join(', ') })}>
          <span className="rail-format-name">{name}</span>
          <span className="rail-format-summary">{summary.map(part => <span key={part}>{part}</span>)}</span>
          <Icon name="edit" />
        </button>
      </div>
      {open && <FormatDialog choice={choice} memory={memory} family={open} onPick={onPick} onClose={close} />}
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
            <button type="button" className="rail-settings" aria-label={t('settings.open')} title={t('settings.open')} onClick={onSettings}>
              <Icon name="gear" />
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
