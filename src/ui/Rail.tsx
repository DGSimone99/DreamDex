import type { ReactNode } from 'react';
import logo from '../assets/brand/dreamdex-band-horizontal-app.svg?raw';
import type { Format, FormatId } from '../engine/format';
import { DEX_IDS, dexOf, formatInDex, tiersOf, type DexId } from '../engine/formats';
import type { StatsMeta } from '../engine/stats';
import { LANGS, type Lang } from '../i18n';
import { useT } from '../i18n/react';
import { Icon } from './icons';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const USAGE_THRESHOLDS = [0, 0.005, 0.01, 0.02, 0.05];

interface Props {
  format: Format;
  onFormatChange: (format: Format) => void;
  meta: StatsMeta | null;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  /** Le sezioni (Tabs verticali, a tessere con lo stato). */
  tabs: ReactNode;
  /** Apre le impostazioni; senza, il pulsante non c'è. */
  onSettings?: () => void;
}

/** Il mese delle statistiche ("2026-09") scritto per esteso nella lingua scelta: "settembre 2026". */
function monthLabel(month: string, lang: Lang): string {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m) return month;
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(year, m - 1, 1));
}

/**
 * Barra laterale: il logo, la carta del formato (Pokédex, tier e regole si cambiano tutti dal suo menu), le sezioni come
 * tessere del menu del gioco con una riga di stato, e in fondo lingua, impostazioni e mese dei dati Smogon.
 * Importa/Esporta e Team salvati stanno sopra la squadra (TeamPanel).
 */
export function Rail({ format, onFormatChange, meta, lang, onLangChange, tabs, onSettings }: Props) {
  const t = useT();
  const dex = dexOf(format.formatId);
  const tiers = tiersOf(dex);
  const tier = tiers.find(x => x.formatId === format.formatId)?.tier ?? '';
  const advanced = [format.ignoreBans, format.allowMultipleMegas].filter(Boolean).length;
  const summary = [
    t(meta && format.meta ? 'rail.rulesMeta' : 'rail.rulesNoMeta'),
    t('rail.rulesGen', { n: format.genLimit }),
    ...(advanced ? [t('top.advancedCount', { n: advanced })] : []),
  ].join(' · ');
  return (
    <aside className="rail" aria-label={t('rail.label')}>
      <h1 className="rail-logo">
        <span className="visually-hidden">DreamDex</span>
        {/* Il logo a fascia del kit: le due D nei colori della versione (--accent, --accent-2), la scritta nel colore del testo */}
        <span className="rail-logo-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
      </h1>
      <details className="popover format-card">
        <summary aria-label={t('rail.formatAria', { format: `${t(`dex.${dex}`)} ${tier}`.trim(), summary })}>
          <span className="format-key">{t('rail.format')}</span>
          <span className="format-name">{t(`dex.${dex}`)} {tier && <b>{tier}</b>}</span>
          <span className="format-rules">{summary}</span>
          <Icon name="edit" />
        </summary>
        <div className="format-menu">
          <label className="rail-field">
            <span className="rail-label">{t('top.dex')}</span>
            <select
              aria-label={t('top.dex')}
              value={dex}
              onChange={e => {
                const formatId = formatInDex(e.target.value as DexId, format.formatId);
                if (formatId) onFormatChange({ ...format, formatId });
              }}
            >
              {DEX_IDS.map(id => (
                <option key={id} value={id} disabled={tiersOf(id).length === 0}>
                  {t(`dex.${id}`)}{tiersOf(id).length === 0 ? ` (${t('top.soon')})` : ''}
                </option>
              ))}
            </select>
          </label>
          {/* Senza limiti ha un solo formato senza nome di tier: niente menu */}
          {tiers.some(x => x.tier) && (
            <label className="rail-field">
              <span className="rail-label">{t('top.tier')}</span>
              <select
                aria-label={t('top.tierAria')}
                value={format.formatId}
                onChange={e => onFormatChange({ ...format, formatId: e.target.value as FormatId })}
              >
                {tiers.map(x => <option key={x.formatId} value={x.formatId}>{x.tier}</option>)}
              </select>
            </label>
          )}
          <div className="rules">
            <label>
              {t('top.genLimit')}{' '}
              <select
                aria-label={t('top.genLimitAria')}
                value={String(format.genLimit)}
                onChange={e => onFormatChange({ ...format, genLimit: Number(e.target.value) })}
              >
                {GENERATIONS.map(gen => <option key={gen} value={gen}>{gen}</option>)}
              </select>
            </label>
            <div className="rating-mode">
              <span id="rating-mode-label">{t('top.rating')}</span>
              <div role="group" aria-labelledby="rating-mode-label" className="segmented" title={meta ? undefined : t('top.metaUnavailable')}>
                <button type="button" aria-pressed={!!meta && format.meta} disabled={!meta} title={t('top.withMetaTip')}
                  onClick={() => onFormatChange({ ...format, meta: true })}>{t('top.withMeta')}</button>
                <button type="button" aria-pressed={!meta || !format.meta} disabled={!meta} title={t('top.withoutMetaTip')}
                  onClick={() => onFormatChange({ ...format, meta: false })}>{t('top.withoutMeta')}</button>
              </div>
            </div>
            <p className="rail-label">{advanced ? t('top.advancedCount', { n: advanced }) : t('top.advanced')}</p>
            <label>
              <input type="checkbox" aria-label={t('top.ignoreBans')} checked={format.ignoreBans}
                onChange={e => onFormatChange({ ...format, ignoreBans: e.target.checked })} />{' '}
              {t('top.ignoreBans')}
            </label>
            <label>
              <input type="checkbox" aria-label={t('top.multipleMegas')} checked={format.allowMultipleMegas}
                onChange={e => onFormatChange({ ...format, allowMultipleMegas: e.target.checked })} />{' '}
              {t('top.multipleMegas')}
            </label>
            <label>
              {t('top.minUsageLong')}{' '}
              <select aria-label={t('top.minUsageAria')} value={String(format.minUsage)}
                onChange={e => onFormatChange({ ...format, minUsage: Number(e.target.value) })}>
                {USAGE_THRESHOLDS.map(value => (
                  <option key={value} value={value}>{value === 0 ? t('top.usageAll') : `${value * 100}%`}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </details>
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
          {meta ? t('top.stats', { month: monthLabel(meta.month, lang), cutoff: meta.cutoff }) : t('top.statsMissing')}
        </p>
      </div>
    </aside>
  );
}
