import type { ReactNode } from 'react';
import logo from '../assets/brand/dreamdex-band-horizontal-app.svg?raw';
import type { Format, FormatId } from '../engine/format';
import { DEX_IDS, dexOf, formatInDex, tiersOf, type DexId } from '../engine/formats';
import { GAME_IDS, gameReady, type GameId } from '../engine/games';
import type { StatsMeta } from '../engine/stats';
import { LANGS, type Lang } from '../i18n';
import { useT } from '../i18n/react';
import { Icon } from './icons';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Props {
  format: Format;
  onFormatChange: (format: Format) => void;
  /** Sceglie il gioco (null = nessuno): il gioco blocca il formato. */
  onGameChange?: (game: GameId | null) => void;
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
 * Barra laterale: il logo, la carta del formato (Pokédex, tier e regole si cambiano tutti dal suo menu), le sezioni come
 * tessere del menu del gioco con una riga di stato, e in fondo lingua, impostazioni e mese dei dati Smogon.
 * Importa/Esporta e Team salvati stanno sopra la squadra (TeamPanel).
 */
export function Rail({ format, onFormatChange, onGameChange = () => {}, meta, lang, onLangChange, tabs, onSettings, onCredits, onFeedback }: Props) {
  const t = useT();
  const dex = dexOf(format.formatId);
  const tiers = tiersOf(dex);
  const tier = tiers.find(x => x.formatId === format.formatId)?.tier ?? '';
  // Le regole in breve, come pastiglie: Meta (o Senza meta), Gen 9 e le avanzate accese
  const pills = [
    t(meta && format.meta ? 'rail.pillMeta' : 'rail.pillNoMeta'),
    t('rail.pillGen', { n: format.genLimit }),
    ...(format.ignoreBans ? [t('rail.pillNoBans')] : []),
    ...(format.allowMultipleMegas ? [t('rail.pillMegas')] : []),
  ];
  const game = format.game;
  // Le opzioni del gioco accese, come pastiglie
  const gamePills = [
    ...(format.allPokedex ? [t('rail.pillAllPokedex')] : []),
    ...(format.legendaries ? [t('rail.pillLegendaries')] : []),
  ];
  return (
    <aside className="rail" aria-label={t('rail.label')}>
      <h1 className="rail-logo">
        <span className="visually-hidden">DreamDex</span>
        {/* Il logo a fascia del kit: le due D nei colori della versione (--accent, --accent-2), la scritta nel colore del testo */}
        <span className="rail-logo-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: logo }} />
      </h1>
      <details className="popover format-card game-card">
        <summary aria-label={t('rail.gameAria', { game: t(game ? `game.${game}` : 'game.none'), summary: gamePills.length ? `, ${gamePills.join(', ')}` : '' })}>
          <span className="format-key">{t('rail.game')} <Icon name="edit" /></span>
          <span className="format-name">{t(game ? `game.${game}` : 'game.none')}</span>
          {gamePills.length > 0 && <span className="format-pills">{gamePills.map(pill => <span key={pill}>{pill}</span>)}</span>}
        </summary>
        <div className="format-menu">
          <p className="format-menu-head">{t('rail.game')}</p>
          <div className="format-menu-body">
            <div className="format-sec">
              <div className="format-dex" role="radiogroup" aria-label={t('rail.game')}>
                {[null, ...GAME_IDS].map(id => {
                  const off = id !== null && !gameReady(id);
                  return (
                    <label key={id ?? 'none'} className={`format-dex-opt${id === game ? ' on' : ''}${off ? ' soon' : ''}`}>
                      <input type="radio" className="visually-hidden" name="game" value={id ?? 'none'} checked={id === game} disabled={off}
                        onChange={() => onGameChange(id)} />
                      <b>{t(id ? `game.${id}` : 'game.none')}</b>
                      <small>{off ? t('top.soon') : t(id ? 'rail.gameNote' : 'rail.noGameNote')}</small>
                    </label>
                  );
                })}
              </div>
            </div>
            {game && (
              <div className="format-sec">
                <p className="rail-label">{t('rail.gameOptions')}</p>
                <label className="format-toggle">
                  <input type="checkbox" className="switch" aria-label={t('top.allPokedex')} checked={format.allPokedex}
                    onChange={e => onFormatChange({ ...format, allPokedex: e.target.checked })} />
                  <b>{t('top.allPokedex')}</b>
                  <small>{t('top.allPokedexNote')}</small>
                </label>
                <label className="format-toggle">
                  <input type="checkbox" className="switch" aria-label={t('top.legendaries')} checked={format.legendaries}
                    onChange={e => onFormatChange({ ...format, legendaries: e.target.checked })} />
                  <b>{t('top.legendaries')}</b>
                  <small>{t('top.legendariesNote')}</small>
                </label>
              </div>
            )}
          </div>
        </div>
      </details>
      {game ? (
        // Col gioco il formato lo decide il gioco: si vede, ma non si cambia
        <div className="format-card locked" aria-label={t('rail.formatAria', { format: `${t(`dex.${dex}`)} ${tier}`.trim(), summary: pills.join(', ') })}>
          <div className="format-summary">
            <span className="format-key">{t('rail.format')}</span>
            {tier && <span className="format-tier">{tier}</span>}
            <span className="format-name">{t(`dex.${dex}`)}</span>
            <span className="format-pills">{pills.map(pill => <span key={pill}>{pill}</span>)}</span>
            <span className="format-lock">{t('rail.formatByGame')}</span>
          </div>
        </div>
      ) : (
      <details className="popover format-card">
        <summary aria-label={t('rail.formatAria', { format: `${t(`dex.${dex}`)} ${tier}`.trim(), summary: pills.join(', ') })}>
          <span className="format-key">{t('rail.format')} <Icon name="edit" /></span>
          {tier && <span className="format-tier">{tier}</span>}
          <span className="format-name">{t(`dex.${dex}`)}</span>
          <span className="format-pills">{pills.map(pill => <span key={pill}>{pill}</span>)}</span>
        </summary>
        <div className="format-menu">
          <p className="format-menu-head">{t('rail.format')}</p>
          <div className="format-menu-body">
            <div className="format-sec">
              <p className="rail-label" id="format-dex-label">{t('top.dex')}</p>
              <div className="format-dex" role="radiogroup" aria-labelledby="format-dex-label">
                {DEX_IDS.map(id => {
                  const soon = tiersOf(id).length === 0;
                  return (
                    <label key={id} className={`format-dex-opt${id === dex ? ' on' : ''}${soon ? ' soon' : ''}`}>
                      <input type="radio" className="visually-hidden" name="format-dex" value={id} checked={id === dex} disabled={soon}
                        onChange={() => {
                          const formatId = formatInDex(id, format.formatId);
                          if (formatId) onFormatChange({ ...format, formatId });
                        }} />
                      <b>{t(`dex.${id}`)}</b>
                      <small>{soon ? t('top.soon') : t(`rail.dexNote.${id}`)}</small>
                    </label>
                  );
                })}
              </div>
            </div>
            {/* Senza limiti ha un solo formato senza nome di tier: niente scelta */}
            {tiers.some(x => x.tier) && (
              <div className="format-sec">
                <p className="rail-label">{t('top.tier')}</p>
                <div className="format-chips" role="radiogroup" aria-label={t('top.tierAria')}>
                  {tiers.map(x => (
                    <label key={x.formatId} className={x.formatId === format.formatId ? 'on' : undefined}>
                      <input type="radio" className="visually-hidden" name="format-tier" value={x.formatId} checked={x.formatId === format.formatId}
                        onChange={() => onFormatChange({ ...format, formatId: x.formatId as FormatId })} />
                      {x.tier}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="format-sec">
              <p className="rail-label">{t('top.genLimitLong')}</p>
              <div className="format-gens" role="radiogroup" aria-label={t('top.genLimitAria')}>
                {GENERATIONS.map(gen => (
                  <label key={gen} className={gen === format.genLimit ? 'on' : gen < format.genLimit ? 'in' : undefined}>
                    <input type="radio" className="visually-hidden" name="format-gen" value={gen} checked={gen === format.genLimit}
                      onChange={() => onFormatChange({ ...format, genLimit: gen })} />
                    {gen}
                  </label>
                ))}
              </div>
            </div>
            <div className="format-sec rating-mode">
              <p className="rail-label" id="rating-mode-label">{t('top.rating')}</p>
              <div role="group" aria-labelledby="rating-mode-label" className="segmented" title={meta ? undefined : t('top.metaUnavailable')}>
                <button type="button" aria-pressed={!!meta && format.meta} disabled={!meta} title={t('top.withMetaTip')}
                  onClick={() => onFormatChange({ ...format, meta: true })}>{t('top.withMeta')}</button>
                <button type="button" aria-pressed={!meta || !format.meta} disabled={!meta} title={t('top.withoutMetaTip')}
                  onClick={() => onFormatChange({ ...format, meta: false })}>{t('top.withoutMeta')}</button>
              </div>
              <p className="format-note">{t('top.ratingNote')}</p>
            </div>
            <div className="format-sec">
              <p className="rail-label">{t('top.advanced')}</p>
              <label className="format-toggle">
                <input type="checkbox" className="switch" aria-label={t('top.ignoreBans')} checked={format.ignoreBans}
                  onChange={e => onFormatChange({ ...format, ignoreBans: e.target.checked })} />
                <b>{t('top.ignoreBans')}</b>
                <small>{t('top.ignoreBansNote')}</small>
              </label>
              <label className="format-toggle">
                <input type="checkbox" className="switch" aria-label={t('top.multipleMegas')} checked={format.allowMultipleMegas}
                  onChange={e => onFormatChange({ ...format, allowMultipleMegas: e.target.checked })} />
                <b>{t('top.multipleMegas')}</b>
                <small>{t('top.multipleMegasNote')}</small>
              </label>
            </div>
          </div>
        </div>
      </details>
      )}
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
