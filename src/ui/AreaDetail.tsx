import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { TeamRating } from '../engine/rating';
import type { WallCell } from '../engine/offense';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { Sprite, TypeChip } from './Sprite';

type Tab = 'general' | 'power' | 'wallbreaking' | 'coverage';
const TABS: Tab[] = ['general', 'power', 'wallbreaking', 'coverage'];
/** Etichetta della soglia di un colpo (0,5 3HKO, 1 2HKO, 1,5 OHKO). */
const STEP_LABEL: Record<number, string> = { 1.5: 'ohko', 1: 'two', 0.5: 'three', 0: 'none' };

/** Casella della tabella dei muri: il danno, e tra parentesi quello dopo il setup quando cambia la soglia. */
function WallValue({ cell }: { cell: WallCell }) {
  const upgraded = cell.setupStep !== null && cell.setupStep > cell.step;
  return (
    <span className={`ad-k ${STEP_LABEL[cell.step] ?? 'none'}${upgraded ? ' setup' : ''}`}>
      {cell.pct}%{upgraded ? ` (${cell.setupPct}%)` : ''}
    </span>
  );
}

/**
 * Dettaglio dell'Offesa: una scheda generale e una per sottostatistica, ognuna con come si calcola e il valore
 * di ogni membro. Stesso guscio del modale "Come funziona il voto", con le schede a sinistra.
 */
export function AreaDetail({ rating, area, onClose }: { rating: TeamRating; area: 'strength'; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const [tab, setTab] = useState<Tab>('general');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const close = useRef(onClose);
  close.current = onClose;
  const offense = rating.offense;
  const value = rating.areas.find(a => a.key === area)?.value ?? null;
  const meta = !!rating.meta;

  // Focus sulla prima scheda solo all'apertura: un nuovo render dell'app non deve spostarlo
  useEffect(() => {
    tabs.current[0]?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Frecce su/giù fra le schede, come nel modale d'aiuto
  const onTabKey = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    setTab(TABS[next]);
    tabs.current[next]?.focus();
  };

  const values: Record<Tab, number | null> = { general: value, power: offense.power, wallbreaking: offense.wallbreaking, coverage: offense.coverage };
  const tabLabel = (key: Tab) => (key === 'general' ? t('detail.tab.general') : t(`detail.${key}`));
  const setters = offense.setters.map(s => `${s.species} (${s.move})`).join(', ');
  const holes = offense.holes.length ? t('detail.coverage.holes', { list: offense.holes.join(', ') }) : t('detail.coverage.noHoles');

  const general = (
    <>
      <h4>{t('detail.general.title')}</h4>
      <p>{t(meta ? 'detail.general.lead.meta' : 'detail.general.lead.tier', { walls: offense.defenders.length })}</p>
      <dl className="ad-subs">
        {(['power', 'wallbreaking', 'coverage'] as const).map(sub => (
          <div key={sub} className="ad-sub">
            <dt>{t(`detail.${sub}`)}</dt>
            <dd>
              <meter min={0} max={100} value={values[sub] ?? 0} aria-hidden="true" />
              <strong>{values[sub]}</strong>
              <span>
                {t(`detail.general.${sub}`)}
                {sub === 'wallbreaking' && ` · ${setters ? t('detail.setters', { list: setters }) : t('detail.setup.none')}`}
                {sub === 'coverage' && ` · ${holes}`}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.member')}</th>
            <th scope="col">{t('detail.power')}</th>
            <th scope="col">{t('detail.wallbreaking')}</th>
            <th scope="col">{t('detail.coverage')}</th>
            <th scope="col">{t(`area.${area}`)}</th>
          </tr>
        </thead>
        <tbody>
          {offense.members.map((m, i) => (
            <tr key={`${m.species}-${i}`}>
              <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={40} />{m.species}</span></th>
              <td>{m.power}</td>
              <td>
                {m.wallbreaking}
                {m.wallbreakingGain > 0 && <small className="ad-gain" title={t('detail.withSetup', { move: m.setupMove ?? '' })}> (+{m.wallbreakingGain})</small>}
              </td>
              <td>{m.covered}%</td>
              <td className="total">{m.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const power = (
    <>
      <h4>{t('detail.power')}</h4>
      <div className="ad-how">
        <p>{t('detail.power.how1', { targets: meta ? t('detail.targets.meta', { n: offense.coverageRows.length }) : t('detail.targets.tier') })}</p>
        <p>{t('detail.power.how2')}</p>
        <p>{offense.referenceAttackers.length ? t('detail.power.how3.meta', { list: offense.referenceAttackers.join(', ') }) : t('detail.power.how3.fixed')}</p>
      </div>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.member')}</th>
            <th scope="col" aria-hidden="true" />
            <th scope="col">{t('detail.power')}</th>
            <th scope="col" className="left">{t('detail.bestMove')}</th>
          </tr>
        </thead>
        <tbody>
          {[...offense.members].sort((a, b) => b.power - a.power).map((m, i) => (
            <tr key={`${m.species}-${i}`}>
              <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
              <td><meter min={0} max={100} value={m.power} aria-hidden="true" /></td>
              <td className="total">{m.power}</td>
              <td className="left">{m.bestMove ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const wallbreaking = (
    <>
      <h4>{t('detail.wallbreaking')}</h4>
      <div className="ad-how">
        <p>{t(offense.metaDefenders ? 'detail.wall.how1.meta' : 'detail.wall.how1.tier', { n: offense.defenders.length })}</p>
        <p>{t('detail.wall.how2')}</p>
        <p>{setters ? t('detail.wall.how3', { list: setters }) : t('detail.setup.none')}</p>
      </div>
      <div className="ad-scroll">
        <table className="ad-t ad-matrix">
          <thead>
            <tr>
              <th scope="col">{t('detail.wall')}</th>
              {offense.members.map((m, i) => (
                <th key={`${m.species}-${i}`} scope="col" aria-label={m.species} title={m.species}><Sprite species={m.species} size={32} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offense.walls.map(wall => (
              <tr key={wall.species}>
                <th scope="row"><span className="ad-mon"><Sprite species={wall.species} size={32} />{wall.species}</span></th>
                {wall.cells.map((cell, i) => <td key={i}><WallValue cell={cell} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ad-legend">{t('detail.legend')}</p>
    </>
  );

  const coverage = (
    <>
      <h4>{t('detail.coverage')}</h4>
      <div className="ad-how">
        <p>{t(meta ? 'detail.coverage.how1.meta' : 'detail.coverage.how1.tier', { n: offense.coverageRows.length })}</p>
        <p>{t('detail.coverage.how2')}</p>
      </div>
      <p className="ad-holes">{holes}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.types')}</th>
            {meta && <th scope="col" className="left">{t('detail.member')}</th>}
            <th scope="col">{t('detail.level')}</th>
            <th scope="col" className="left">{t('detail.coveredBy')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Dal più usato: l'ordine dice anche quanto pesa ogni bersaglio */}
          {[...offense.coverageRows].sort((a, b) => b.weight - a.weight).map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label.split('/').map(type => <TypeChip key={type} type={type} />)}</th>
              {meta && <td className="left"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></td>}
              <td>{row.level}%</td>
              <td className="left ad-cover">
                {row.coveredBy.length
                  ? row.coveredBy.map((c, i) => (
                    <span key={`${c.species}-${i}`} title={`${c.species}: ${c.move} ${c.pct}%`}><Sprite species={c.species} size={28} /></span>
                  ))
                  : <span className="ad-k none">{t('detail.nobody')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const panels: Record<Tab, ReactElement> = { general, power, wallbreaking, coverage };

  return createPortal(
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-dialog ad-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
        <header className="help-head ad-head">
          <h3 id={titleId}>{t(`area.${area}`)} <strong>{value ?? 'n/d'}</strong></h3>
          <button type="button" className="help-close" aria-label={t('help.close')} onClick={onClose}><Icon name="close" /></button>
        </header>
        <div className="ad-body">
          <nav className="ad-nav" role="tablist" aria-orientation="vertical" aria-label={t(`area.${area}`)}>
            {TABS.map((key, i) => (
              <button key={key} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`ad-tab-${key}`}
                aria-selected={key === tab} aria-controls="ad-panel" tabIndex={key === tab ? 0 : -1}
                onClick={() => setTab(key)} onKeyDown={e => onTabKey(e, i)}>
                {tabLabel(key)}<b>{values[key]}</b>
              </button>
            ))}
          </nav>
          <section className="ad-panel" id="ad-panel" role="tabpanel" aria-labelledby={`ad-tab-${tab}`}>
            {panels[tab]}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
