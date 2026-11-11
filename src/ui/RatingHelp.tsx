import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Archetype } from '../engine/archetype';
import { ARCHETYPE_WEIGHTS, GRADES, TRICK_ROOM_MAX, type AreaWeightTable } from '../engine/rating';
import { isGroupKey, LEVEL_KEYS, levelOf, rolesTypeOf, type Level, type LevelKey } from '../engine/roleLevels';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS } from '../engine/rolesArea';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';
import { EeveePeek } from './EeveePeek';
import { ModalLock } from './ModalLock';
import { Icon } from './icons';

type Topic = 'general' | Archetype;
const ARCHETYPES: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
const TOPICS: Topic[] = ['general', ...ARCHETYPES];
/** Le aree col peso: i Ruoli non ne hanno, contano come malus e bonus (ROLE_POINTS). */
const WEIGHT_AREAS = ['defense', 'strength', 'speed'] as const;
const ROLE_POINTS = { essential: ESSENTIAL_POINTS, important: IMPORTANT_POINTS, minor: MINOR_POINTS };
const LEVELS: Exclude<Level, 'ignored'>[] = ['essential', 'important', 'minor'];

const topicLabel = (topic: Topic): MessageKey => (topic === 'general' ? 'help.general' : `archetype.${topic}`);
/** Etichetta di una voce della tabella dei livelli ("almeno uno Sweeper / un Wallbreaker" sono gruppi). */
const keyLabel = (key: LevelKey): MessageKey => (isGroupKey(key) ? `need.${key}` : `role.${key}`);

/**
 * Come funziona il voto: un piccolo modale con gli argomenti a sinistra (come funziona in generale e un tab per tipo
 * di team) e la spiegazione a destra. Le spiegazioni di ogni area stanno nel suo modale, di bonus e malus nel catalogo.
 */
/** `weights`: la tabella dei pesi del formato del team (rating.weightTable); senza, quella di sempre. */
export function RatingHelp({ teamType, trickRoom, meta = true, weights = ARCHETYPE_WEIGHTS, typeRule }: { teamType: Archetype; trickRoom: boolean; meta?: boolean; weights?: AreaWeightTable; typeRule?: 'walls' | 'recoverySpeed' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // Si apre sempre su come funziona in generale; il tipo del team ha la sua scritta "il tuo team" nella lista a sinistra
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
        onClick={e => { e.preventDefault(); e.stopPropagation(); setTopic('general'); setOpen(true); }}>
        <Icon name="help" />
      </button>
      {/* Nel body della pagina: sopra tutto, senza ereditare gli stili del pannello in cui sta il "?" */}
      {open && createPortal(
        <div className="help-backdrop" onClick={close}>
          <ModalLock />
          {/* Eevee sbircia da dietro la finestra: testa e coda dietro, zampe davanti (EeveePeek) */}
          <div className="help-frame with-peek">
          <EeveePeek />
          <div className="help-dialog rating-help" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={e => e.stopPropagation()}>
            <header className="help-head">
              <h3 id={titleId}>{t('help.title')}</h3>
              <button type="button" className="help-close" aria-label={t('help.close')} onClick={close}><Icon name="close" /></button>
            </header>
            <div className="help-body">
              <nav className="help-nav" role="tablist" aria-orientation="vertical" aria-label={t('help.nav')}>
                {TOPICS.map((item, i) => (
                  <button key={item} ref={el => { tabs.current[i] = el; }} type="button" role="tab" id={`help-tab-${item}`}
                    aria-selected={item === topic} aria-current={item === teamType || undefined} aria-controls="help-panel" tabIndex={item === topic ? 0 : -1}
                    title={item === teamType ? t('help.general.yours', { type: t(`archetype.${item}`) }) : undefined}
                    onClick={() => setTopic(item)} onKeyDown={e => onTabKey(e, i)}>
                    {t(topicLabel(item))}
                    {/* Il tipo del team: una scritta che si legge (il nome della scheda resta il tipo, aria-current lo dice ai lettori) */}
                    {item === teamType && <small className="help-yours-tag" aria-hidden="true">{t('help.yourTeam')}</small>}
                  </button>
                ))}
              </nav>
              <section className="help-panel" id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${topic}`}>
                <h4>{t(topicLabel(topic))}</h4>
                {topic === 'general' ? <GeneralTopic teamType={teamType} trickRoom={trickRoom} meta={meta} weights={weights} /> : <TypeTopic type={topic} current={topic === teamType} trickRoom={trickRoom} weights={weights} typeRule={typeRule} />}
              </section>
            </div>
          </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Come funziona in generale: la formula del voto, le lettere dalle soglie e i pesi di tutti i tipi. */
function GeneralTopic({ teamType, trickRoom, meta, weights }: { teamType: Archetype; trickRoom: boolean; meta: boolean; weights: AreaWeightTable }) {
  const t = useT();
  const letters = Object.fromEntries(GRADES.filter(g => g.grade !== 'D').map(g => [g.grade, g.min]));
  return (
    <>
      <p>{t('help.general.1')}</p>
      <p>{t('help.general.letters', letters)}</p>
      <p>{t('help.general.2')}</p>
      <p>{t(meta ? 'help.general.3' : 'help.general.3.noMeta')}</p>
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
                {WEIGHT_AREAS.map(area => <td key={area}><WeightBar weight={weights[arch][area]} max={tableMax(weights)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help-roles-note">{t('help.general.rolesNote', ROLE_POINTS)}</p>
    </>
  );
}

/** Il peso più alto della tabella: la sua barra è piena, le altre in proporzione. */
const tableMax = (weights: AreaWeightTable) => Math.max(1, ...ARCHETYPES.flatMap(arch => WEIGHT_AREAS.map(area => weights[arch][area])));
/**
 * Il peso di un'area come barra, senza numeri: segue i pesi veri del formato e del tipo di team (in National Dex OU i suoi,
 * NATDEX_OU_WEIGHTS), in proporzione al peso più alto della tabella. Ai lettori di schermo una parola: molto dalla metà
 * del voto in su, abbastanza da un quarto, poco sotto.
 */
function WeightBar({ weight, max }: { weight: number; max: number }) {
  const t = useT();
  const word = weight <= 0 ? 'help.weight.none' : weight >= 50 ? 'help.weight.high' : weight >= 25 ? 'help.weight.mid' : 'help.weight.low';
  return (
    <span className="help-wbar">
      <i style={{ width: `${(100 * Math.max(0, weight)) / max}%` }} />
      <span className="visually-hidden">{t(word)}</span>
    </span>
  );
}

/** Un tipo di team: come vince, i pesi delle aree e le voci dei Ruoli per livello, letti dalle tabelle del motore. */
function TypeTopic({ type, current, trickRoom, weights, typeRule }: { type: Archetype; current: boolean; trickRoom: boolean; weights: AreaWeightTable; typeRule?: 'walls' | 'recoverySpeed' }) {
  const t = useT();
  return (
    <>
      <p className="help-note">{t(`archetype.${type}.note`)}</p>
      <p>{t(`help.type.${type}`)}</p>
      {type === 'balance' && <p>{t('help.type.balance.incomplete')}</p>}
      <p>{t('help.type.trickRoom', { max: TRICK_ROOM_MAX })}</p>
      {current && <p className="help-yours">{t('help.general.yours', { type: t(`archetype.${type}`) })}{trickRoom ? ` · ${t('help.general.trickRoom')}` : ''}</p>}
      <h5>{t('help.type.weights')}</h5>
      <dl className="help-weights-row">
        {WEIGHT_AREAS.map(area => {
          const inactive = weights[type][area] === 0;
          return (
            <div key={area} className={inactive ? 'inactive' : undefined}>
              <dt>{t(`area.${area}`)}</dt>
              <dd><WeightBar weight={weights[type][area]} max={tableMax(weights)} /></dd>
              {inactive && <dd className="help-inactive-note">{t('rating.notCounted')}</dd>}
            </div>
          );
        })}
      </dl>
      <h5>{t('area.roles')}</h5>
      <p>{t('help.type.levels', ROLE_POINTS)}</p>
      {rolesTypeOf(type, typeRule) !== type && <p className="help-note">{t('help.type.stallAsSemi')}</p>}
      {LEVELS.map(level => {
        const keys = LEVEL_KEYS.filter(key => levelOf(rolesTypeOf(type, typeRule), key) === level);
        if (keys.length === 0) return null;
        return (
          <div key={level} className="help-levels">
            <h6>{t(`rdetail.group.${level}`)}</h6>
            <ul className="help-points">{keys.map(key => <li key={key}><span>{t(keyLabel(key))}</span></li>)}</ul>
          </div>
        );
      })}
    </>
  );
}
