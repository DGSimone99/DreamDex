import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { ModalLock } from './ModalLock';
import { EeveePeek } from './EeveePeek';

/** Una fonte: nome (col link) e cosa ci dà. */
interface Source { name: string; url: string; what: string }

/**
 * Crediti e note legali: progetto di fan non ufficiale, marchi Pokémon, da dove arrivano dati, sprite e grafica,
 * le librerie. I nomi delle fonti non si traducono; cosa danno sì.
 */
export function CreditsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const data: Source[] = [
    { name: 'Smogon', url: 'https://www.smogon.com/stats/', what: t('credits.smogon') },
    { name: 'Pokémon Showdown', url: 'https://pokemonshowdown.com', what: t('credits.showdown') },
    { name: 'PokeAPI', url: 'https://pokeapi.co', what: t('credits.pokeapi') },
    { name: 'data.pkmn.cc', url: 'https://data.pkmn.cc', what: t('credits.pkmnData') },
    { name: 'Serebii', url: 'https://www.serebii.net/scarletviolet/exclusives.shtml', what: t('credits.serebii') },
  ];
  const libs: Source[] = [
    { name: '@pkmn', url: 'https://github.com/pkmn/ps', what: t('credits.pkmnLibs') },
    { name: '@smogon/calc', url: 'https://github.com/smogon/damage-calc', what: t('credits.calc') },
  ];
  const list = (sources: Source[]) => (
    <dl className="credits-list">
      {sources.map(s => (
        <div key={s.name}>
          <dt><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></dt>
          <dd>{s.what}</dd>
        </div>
      ))}
    </dl>
  );

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <ModalLock />
      {/* Eevee sbircia da dietro la finestra, come nelle guide */}
      <div className="help-frame with-peek">
      <EeveePeek />
      <div className="help-dialog credits-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head">
          <h3 id={titleId}>{t('credits.title')}</h3>
          <button ref={close} type="button" className="help-close" aria-label={t('settings.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="credits-body">
          <p className="credits-lead">{t('credits.fan')}</p>
          <p className="credits-legal">{t('credits.trademark')}</p>
          {/* Tre colonne affiancate: tutto in vista senza scorrere, anche sui portatili bassi */}
          <div className="credits-cols">
            <section><h4>{t('credits.data')}</h4>{list(data)}</section>
            <section>
              <h4>{t('credits.art')}</h4>
              <dl className="credits-list">
                <div><dt>{t('credits.sprites')}</dt><dd>{t('credits.spritesWhat')}</dd></div>
                <div><dt>{t('credits.typeIcons')}</dt><dd>{t('credits.typeIconsWhat')}</dd></div>
                <div><dt><a href="https://x.com/dreamworldsvg" target="_blank" rel="noreferrer">Eevee · dreamworld.svg</a></dt><dd>{t('credits.eevee')}</dd></div>
                <div><dt>{t('credits.logos')}</dt><dd>{t('credits.logosWhat')}</dd></div>
              </dl>
            </section>
            <section><h4>{t('credits.libs')}</h4>{list(libs)}</section>
          </div>
          <p className="note">{t('credits.thanks')}</p>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
