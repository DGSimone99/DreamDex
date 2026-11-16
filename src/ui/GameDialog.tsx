import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Format } from '../engine/format';
import { GAME_IDS, gameReady, type GameId } from '../engine/games';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';

/** I loghi di ogni gioco, una versione per lato (file in public/games, © Nintendo / The Pokémon Company). */
const LOGOS: Record<GameId, { file: string; version: 'scarlet' | 'violet' }[]> = {
  sv: [{ file: 'sv-scarlet.png', version: 'scarlet' }, { file: 'sv-violet.png', version: 'violet' }],
};

/** Il logo di una versione; se il file non c'è, il nome scritto nel colore della versione. */
function VersionLogo({ file, version }: { file: string; version: 'scarlet' | 'violet' }) {
  const t = useT();
  const [missing, setMissing] = useState(false);
  if (missing) return <span className={`game-logo-text ${version}`}>{t(`game.version.${version}`)}</span>;
  return <img className="game-logo" src={`${import.meta.env.BASE_URL}games/${file}`} alt={t(`game.logoAlt.${version}`)} onError={() => setMissing(true)} />;
}

/**
 * Scelta del gioco: i giochi come tessere coi loghi (più "Nessun gioco"); scelto un gioco, sotto le sue opzioni.
 * Il gioco si applica subito; si chiude con ×, Esc o cliccando fuori.
 */
export function GameDialog({ format, onGameChange, onFormatChange, onClose }: {
  format: Format;
  onGameChange: (game: GameId | null) => void;
  onFormatChange: (format: Format) => void;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const game = format.game;
  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <ModalLock />
      <div className="help-dialog game-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={titleId}>{t('game.choose')}</h3>
          <button type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="game-body">
          <div className="game-tiles" role="radiogroup" aria-label={t('rail.game')}>
            {[null, ...GAME_IDS].map((id, i) => {
              const off = id !== null && !gameReady(id);
              return (
                <label key={id ?? 'none'} className={`game-tile${id === game ? ' on' : ''}${off ? ' off' : ''}${id ? ` game-${id}` : ' none'}`}>
                  <input ref={i === 0 ? first : undefined} type="radio" className="visually-hidden" name="game" value={id ?? 'none'}
                    checked={id === game} disabled={off} aria-label={t(id ? `game.${id}` : 'game.none')} onChange={() => onGameChange(id)} />
                  <span className="game-art" aria-hidden={id ? undefined : true}>
                    {id ? LOGOS[id].map(logo => <VersionLogo key={logo.file} {...logo} />) : <Icon name="ban" />}
                  </span>
                  <span className="game-caption">
                    <b>{t(id ? `game.${id}` : 'game.none')}</b>
                    <small>{off ? t('top.soon') : t(id ? `game.note.${id}` : 'rail.noGameNote')}</small>
                  </span>
                </label>
              );
            })}
          </div>
          {game && (
            <div className="game-options">
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
          <p className="note">{t('game.logosCredit')}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
