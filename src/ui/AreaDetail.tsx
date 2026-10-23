import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TeamRating } from '../engine/rating';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { Sprite } from './Sprite';

/** Quanti difensori si nominano nella riga di spiegazione (gli altri si contano). */
const NAMED_DEFENDERS = 4;
const SUBS = ['power', 'wallbreaking', 'setup'] as const;

/**
 * Dettaglio di un'area del voto: le sottostatistiche e il punteggio di ogni membro su ognuna.
 * Stesso guscio del modale "Come funziona il voto"; per ora c'è solo l'Offesa.
 */
export function AreaDetail({ rating, area, onClose }: { rating: TeamRating; area: 'strength'; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  const offense = rating.offense;
  const value = rating.areas.find(a => a.key === area)?.value ?? null;

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const named = offense.defenders.slice(0, NAMED_DEFENDERS).join(', ');
  const rest = offense.defenders.length - NAMED_DEFENDERS;
  const list = rest > 0 ? t('detail.more', { list: named, n: rest }) : named;
  const setters = offense.members.filter(m => m.setup !== null).map(m => m.species);
  const team = { power: offense.power, wallbreaking: offense.wallbreaking, setup: offense.setup };

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-dialog area-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head area-head">
          <h3 id={titleId}>{t(`area.${area}`)} <strong>{value ?? 'n/d'}</strong></h3>
          <button ref={close} type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="area-body">
          <p className="area-lead">{t(rating.meta ? 'detail.lead.meta' : 'detail.lead.tier', { n: offense.defenders.length, list })}</p>
          <dl className="area-subs">
            {SUBS.map(sub => {
              const score = team[sub];
              const tip = t(`detail.${sub}.tip` as MessageKey);
              const note = sub === 'setup' ? (setters.length ? t('detail.setup.who', { list: setters.join(', ') }) : t('detail.setup.none')) : null;
              return (
                <div key={sub} className="area-sub">
                  <dt>{t(`detail.${sub}` as MessageKey)}</dt>
                  <dd>
                    <meter min={0} max={100} value={score ?? 0} aria-hidden="true" />
                    <strong>{score ?? '—'}</strong>
                    <span>{note ? `${tip} · ${note}` : tip}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="area-table-wrap">
            <table className="area-table">
              <thead>
                <tr>
                  <th scope="col">{t('detail.member')}</th>
                  {SUBS.map(sub => <th key={sub} scope="col">{t(`detail.${sub}` as MessageKey)}</th>)}
                  <th scope="col">{t(`area.${area}`)}</th>
                </tr>
              </thead>
              <tbody>
                {offense.members.map((m, i) => (
                  <tr key={`${m.species}-${i}`}>
                    <th scope="row"><span className="area-mon"><Sprite species={m.species} size={40} />{m.species}</span></th>
                    <td>{m.power}</td>
                    <td>{m.wallbreaking}</td>
                    <td className={m.setup === null ? 'none' : undefined}>{m.setup ?? '—'}</td>
                    <td className="total">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
