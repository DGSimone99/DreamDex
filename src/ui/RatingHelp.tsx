import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Archetype } from '../engine/archetype';
import { ARCHETYPE_WEIGHTS, META_FLOOR, META_MAX_PENALTY, META_STEP, type AreaKey } from '../engine/rating';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';
import { Icon } from './icons';

type Topic = 'general' | AreaKey | 'bonus';
const TOPICS: Topic[] = ['general', 'defense', 'strength', 'bulk', 'roles', 'speed', 'meta', 'bonus'];
/** Paragrafi di ogni argomento (chiavi help.<argomento>.<n>). */
const PARAGRAPHS: Partial<Record<Topic, number>> = { general: 3, defense: 2, strength: 3, bulk: 2, roles: 3, speed: 2, meta: 3, bonus: 3 };
const ARCHETYPES: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
const WEIGHT_AREAS = ['defense', 'strength', 'bulk', 'roles', 'speed'] as const;
/** Punti del saldo difensivo, per la tabella della Coverage difensiva. */
const DEFENSE_POINTS: [string, string][] = [['help.defense.immune', '+2'], ['×¼', '+1,5'], ['×½', '+1'], ['help.defense.neutral', '0'], ['×2', '−1'], ['×4', '−2']];

const topicLabel = (topic: Topic): MessageKey =>
  topic === 'general' ? 'help.general' : topic === 'bonus' ? 'help.bonus' : `area.${topic}` as MessageKey;

/**
 * Come funziona il voto: un piccolo modale con gli argomenti a sinistra (come funziona in generale, ogni area,
 * bonus e penalità) e la spiegazione a destra. Le spiegazioni stanno qui, i tooltip mostrano solo i dati.
 */
export function RatingHelp({ teamType, trickRoom }: { teamType: Archetype; trickRoom: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>('general');
  const button = useRef<HTMLButtonElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    tabs.current[TOPICS.indexOf(topic)]?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // Il focus va all'argomento solo all'apertura
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }
  // Frecce su/giù tra gli argomenti, come una lista di schede verticale
  const onTabKey = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + TOPICS.length) % TOPICS.length;
    setTopic(TOPICS[next]);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <button ref={button} type="button" className="help-button" aria-label={t('help.button')} title={t('help.button')}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <Icon name="help" />
      </button>
      {/* Nel body della pagina: sopra tutto, senza ereditare gli stili del pannello in cui sta il "?" */}
      {open && createPortal(
        <div className="help-backdrop" onClick={close}>
          <div className="help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
            <header className="help-head">
              <h3 id={titleId}>{t('help.title')}</h3>
              <button type="button" className="help-close" aria-label={t('help.close')} onClick={close}><Icon name="close" /></button>
            </header>
            <div className="help-body">
              <nav className="help-nav" role="tablist" aria-orientation="vertical" aria-label={t('help.nav')}>
                {TOPICS.map((item, i) => (
                  <button key={item} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`help-tab-${item}`}
                    aria-selected={item === topic} aria-controls="help-panel" tabIndex={item === topic ? 0 : -1}
                    onClick={() => setTopic(item)} onKeyDown={e => onTabKey(e, i)}>
                    {t(topicLabel(item))}
                  </button>
                ))}
              </nav>
              <section className="help-panel" id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${topic}`}>
                <h4>{t(topicLabel(topic))}</h4>
                {Array.from({ length: PARAGRAPHS[topic] ?? 0 }, (_, i) => (
                  <p key={i}>{t(`help.${topic}.${i + 1}` as MessageKey, { floor: META_FLOOR, step: META_STEP, max: META_MAX_PENALTY })}</p>
                ))}
                {topic === 'general' && (
                  <>
                    <p className="help-yours">{t('help.general.yours', { type: t(`archetype.${teamType}`) })}{trickRoom ? ` · ${t('help.general.trickRoom')}` : ''}</p>
                    <div className="help-table-wrap">
                      <table className="help-weights">
                        <thead>
                          <tr><th scope="col">{t('help.general.type')}</th>{WEIGHT_AREAS.map(area => <th key={area} scope="col">{t(`area.${area}`)}</th>)}</tr>
                        </thead>
                        <tbody>
                          {ARCHETYPES.map(arch => (
                            <tr key={arch} className={arch === teamType ? 'current' : undefined} aria-current={arch === teamType || undefined}>
                              <th scope="row">{t(`archetype.${arch}`)}</th>
                              {WEIGHT_AREAS.map(area => <td key={area}>{ARCHETYPE_WEIGHTS[arch][area]}%</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {topic === 'defense' && (
                  <ul className="help-points">
                    {DEFENSE_POINTS.map(([label, points]) => (
                      <li key={label}><span>{label.startsWith('help.') ? t(label as MessageKey) : label}</span><strong>{points}</strong></li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
