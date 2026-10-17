import type { ReactNode } from 'react';
import type { Format, FormatId } from '../engine/format';
import { formatOptions } from '../engine/formats';
import type { StatsMeta } from '../engine/stats';
import { LANGS, type Lang } from '../i18n';
import { useT } from '../i18n/react';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const USAGE_THRESHOLDS = [0, 0.005, 0.01, 0.02, 0.05];

interface Props {
  format: Format;
  onFormatChange: (format: Format) => void;
  meta: StatsMeta | null;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  children?: ReactNode;
}

export function TopBar({ format, onFormatChange, meta, lang, onLangChange, children }: Props) {
  const t = useT();
  return (
    <header className="topbar">
      <h1>Dream<span>Dex</span></h1>
      <label>
        {t('top.format')}{' '}
        <select
          aria-label={t('top.format')}
          value={format.formatId}
          onChange={e => onFormatChange({ ...format, formatId: e.target.value as FormatId })}
        >
          {formatOptions(lang).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
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
      <label>
        {t('top.minUsage')}{' '}
        <select
          aria-label={t('top.minUsageAria')}
          value={String(format.minUsage)}
          onChange={e => onFormatChange({ ...format, minUsage: Number(e.target.value) })}
        >
          {USAGE_THRESHOLDS.map(value => (
            <option key={value} value={value}>{value === 0 ? t('top.usageAll') : `${value * 100}%`}</option>
          ))}
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
      <AdvancedOptions format={format} onFormatChange={onFormatChange} />
      {children}
      <div role="group" aria-label={t('lang.label')} className="segmented lang-switch">
        {LANGS.map(code => (
          <button key={code} type="button" aria-pressed={lang === code} onClick={() => onLangChange(code)}>
            {t(`lang.${code}`)}
          </button>
        ))}
      </div>
      <span className="meta">
        {meta ? t('top.stats', { month: meta.month, cutoff: meta.cutoff }) : t('top.statsMissing')}
      </span>
    </header>
  );
}

/** Varianti di regole sopra il formato: Ignora ban, Più Mega ammesse (in futuro Doubles). */
function AdvancedOptions({ format, onFormatChange }: { format: Format; onFormatChange: (format: Format) => void }) {
  const t = useT();
  const active = [format.ignoreBans, format.allowMultipleMegas].filter(Boolean).length;
  return (
    <details className="popover advanced">
      <summary>{active ? t('top.advancedCount', { n: active }) : t('top.advanced')}</summary>
      <div>
        <label>
          <input
            type="checkbox"
            aria-label={t('top.ignoreBans')}
            checked={format.ignoreBans}
            onChange={e => onFormatChange({ ...format, ignoreBans: e.target.checked })}
          />{' '}
          {t('top.ignoreBans')}
        </label>
        <label>
          <input
            type="checkbox"
            aria-label={t('top.multipleMegas')}
            checked={format.allowMultipleMegas}
            onChange={e => onFormatChange({ ...format, allowMultipleMegas: e.target.checked })}
          />{' '}
          {t('top.multipleMegas')}
        </label>
      </div>
    </details>
  );
}
