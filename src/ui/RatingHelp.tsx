import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Archetype } from '../engine/archetype';
import type { FormatRules } from '../engine/formatRules';
import { ARCHETYPE_WEIGHTS, GRADES, type AreaWeightTable } from '../engine/rating';
import { isGroupKey, LEVEL_KEYS, levelFor, type Level, type LevelKey } from '../engine/roleLevels';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/react';
import { Icon } from './icons';
import { useMediaQuery } from './useMediaQuery';
import { SHEET_QUERY } from './useAnchoredPop';
import { ModalShell } from './ModalShell';
import { useEscape } from './useEscape';
import { tabStep } from './tabStep';

type Topic = 'general' | Archetype;
const ARCHETYPES: Archetype[] = ['hyperOffense', 'bulkyOffense', 'balance', 'semiStall', 'stall'];
const TOPICS: Topic[] = ['general', ...ARCHETYPES];
/** In doppio c'è un tipo di team solo: gli argomenti sono due. */
const DOUBLES_TOPICS: Topic[] = ['general', 'doubles'];
/** Le aree col peso: i Ruoli non ne hanno, contano come malus e bonus (spiegati nel loro modale). */
/** Offesa prima di Difesa, come nel riquadro del voto (scelta dell'utente, 2026-11-13). */
const WEIGHT_AREAS = ['strength', 'defense', 'speed'] as const;
const LEVELS: Exclude<Level, 'ignored' | 'minor'>[] = ['essential', 'important'];

const topicLabel = (topic: Topic): MessageKey => (topic === 'general' ? 'help.general' : `archetype.${topic}`);
/** Etichetta di una voce della tabella dei livelli ("almeno uno Sweeper / un Wallbreaker" sono gruppi). */
const keyLabel = (key: LevelKey): MessageKey => (isGroupKey(key) ? `need.${key}` : `role.${key}`);

/**
 * Come funziona il voto: un piccolo modale con gli argomenti a sinistra (come funziona in generale e un tab per tipo
 * di team) e la spiegazione a destra. Le spiegazioni di ogni area stanno nel suo modale, di bonus e malus nel catalogo.
 */
/** `weights`: la tabella dei pesi del formato del team (rating.weightTable); senza, quella di sempre. */
/** `incomplete`: meno di sei membri, il tipo non è ancora deciso ("in analisi"): nessuna scheda è segnata come il tuo team. */
export function RatingHelp({ teamType: judgedAs, weights: realWeights = ARCHETYPE_WEIGHTS, typeRule, incomplete = false }: { teamType: Archetype; trickRoom?: boolean; incomplete?: boolean; meta?: boolean; weights?: AreaWeightTable; typeRule?: FormatRules['typeRule'] }) {
  const t = useT();
  // Col team incompleto il tipo è ancora "in analisi": nessuna scheda è "il tuo team"
  const doubles = typeRule === 'oneType';
  // In doppio il tipo è sempre Doppio, anche a team incompleto
  const teamType: Archetype | null = incomplete && !doubles ? null : judgedAs;
  const topics = doubles ? DOUBLES_TOPICS : TOPICS;
  const weights = shownWeights(realWeights);
  const [open, setOpen] = useState(false);
  // Si apre sempre su come funziona in generale; il tipo del team ha la sua scritta "il tuo team" nella lista a sinistra
  const [topic, setTopic] = useState<Topic>('general');
  const button = useRef<HTMLButtonElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const titleId = useId();
  // Telefono: prima il tipo del tuo team, poi una lista (come funziona, gli altri tipi) che apre la sua pagina con Indietro
  const phone = useMediaQuery(SHEET_QUERY);
  const [page, setPage] = useState<Topic | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!phone) tabs.current[topics.indexOf(topic)]?.focus();
    // Il focus va all'argomento solo all'apertura
  }, [open]);
  useEscape(close, { active: open });

  function close() {
    setOpen(false);
    button.current?.focus();
  }
  // Frecce su/giù tra gli argomenti, come una lista di schede verticale
  const onTabKey = (e: KeyboardEvent, index: number) => {
    const next = tabStep(e.key, index, topics.length, { horizontal: false, vertical: true, homeEnd: false });
    if (next === null) return;
    e.preventDefault();
    setTopic(topics[next]);
    tabs.current[next]?.focus();
  };

  return (
    <>
      <button ref={button} type="button" className="help-button" aria-label={t('help.button')} title={t('help.button')}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setTopic('general'); setPage(null); setOpen(true); }}>
        <Icon name="help" />
      </button>
      {/* Nel body della pagina: sopra tutto, senza ereditare gli stili del pannello in cui sta il "?" */}
      {open && (
        // Eevee sbircia da dietro la finestra: testa e coda dietro, zampe davanti (EeveePeek)
        <ModalShell className="rating-help" titleId={titleId} title={t('help.title')} closeLabel={t('help.close')} onClose={close} peek>
            {phone ? (
              // Una chiave per pagina: aprendone una (o tornando) si riparte dall'alto
              <div className="help-body help-phone" key={page ?? 'home'}>
                {page ? (
                  <section className={`help-panel${page === 'general' ? ' help-general' : ''}`} aria-labelledby={`${titleId}-page`}>
                    {/* Indietro sulla riga del titolo, dalla parte opposta: non prende spazio in altezza */}
                    <div className="help-page-head">
                      <h4 id={`${titleId}-page`}>{t(topicLabel(page))}</h4>
                      <button type="button" className="help-back" onClick={() => setPage(null)}><Icon name="prev" />{t('help.back')}</button>
                    </div>
                    {page === 'general' ? <GeneralTopic teamType={teamType} weights={weights} doubles={doubles} /> : <TypeTopic type={page} weights={weights} typeRule={typeRule} />}
                  </section>
                ) : (
                  <>
                    {/* Si apre su come funziona il voto (senza la tabella dei pesi: ogni tipo ha i suoi nella sua pagina) */}
                    <section className="help-panel help-general" aria-labelledby={`${titleId}-general`}>
                      <h4 id={`${titleId}-general`}>{t('help.general')}</h4>
                      <GeneralTopic teamType={teamType} weights={weights} doubles={doubles} table={false} />
                    </section>
                    {/* Sotto, i tipi di team: il tuo per primo, contornato d'azzurro; ognuno apre la sua pagina */}
                    <h5 className="help-list-title">{t('help.general.type')}</h5>
                    <nav className="help-list" aria-label={t('help.nav')}>
                      {(doubles ? (['doubles'] as Archetype[]) : [...ARCHETYPES]).sort((a, b) => Number(b === teamType) - Number(a === teamType)).map(item => (
                        <button key={item} type="button" className={item === teamType ? 'yours' : undefined} aria-current={item === teamType || undefined} onClick={() => setPage(item)}>
                          <span>
                            <span className="help-list-name">{t(topicLabel(item))}{item === teamType && <em className="help-yours-tag">{t('help.yourTeam')}</em>}</span>
                            <small>{t(`archetype.${item}.note`)}</small>
                          </span>
                          <Icon name="next" />
                        </button>
                      ))}
                    </nav>
                  </>
                )}
              </div>
            ) : (
            <div className="help-body">
              <nav className="help-nav" role="tablist" aria-orientation="vertical" aria-label={t('help.nav')}>
                {topics.map((item, i) => (
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
              <section className={`help-panel${topic === 'general' ? ' help-general' : ''}`} id="help-panel" role="tabpanel" aria-labelledby={`help-tab-${topic}`}>
                <h4>{t(topicLabel(topic))}</h4>
                {topic === 'general' ? <GeneralTopic teamType={teamType} weights={weights} doubles={doubles} /> : <TypeTopic type={topic} weights={weights} typeRule={typeRule} />}
              </section>
            </div>
            )}
        </ModalShell>
      )}
    </>
  );
}

/** Come funziona in generale: la formula del voto, le lettere dalle soglie e i pesi di tutti i tipi. */
function GeneralTopic({ teamType, weights, doubles, table = true }: { teamType: Archetype | null; weights: AreaWeightTable; doubles: boolean; table?: boolean }) {
  const t = useT();
  // In doppio la tabella ha la sola riga del tipo unico
  const types: Archetype[] = doubles ? ['doubles'] : ARCHETYPES;
  const letters = Object.fromEntries(GRADES.filter(g => g.grade !== 'D').map(g => [g.grade, g.min]));
  return (
    <>
      {/* Le lettere per prime, grandi e nel colore della carta del voto; ai lettori di schermo la frase intera */}
      <ul className="help-grades" aria-label={t('help.general.letters', letters)}>
        {GRADES.map(g => (
          <li key={g.grade} className={`grade-${g.grade}`} aria-hidden="true">
            <strong>{g.grade}</strong>
            <span>{g.grade === 'D' ? `< ${letters.C}` : `${g.min}+`}</span>
          </li>
        ))}
      </ul>
      <p>{t('help.general.1')}</p>
      <p>{t(doubles ? 'help.general.2.doubles' : 'help.general.2')}</p>
      {/* Trick Room solo qui, in Come funziona, non nelle schede dei tipi (scelta dell'utente, confermata 2026-11-13) */}
      <p>{t('help.type.trickRoom')}</p>
      {table && (
      <div className="help-table-wrap">
        <table className="help-weights">
          <thead>
            <tr><th scope="col">{t('help.general.type')}</th>{WEIGHT_AREAS.map(area => <th key={area} scope="col">{t(`area.${area}`)}</th>)}</tr>
          </thead>
          <tbody>
            {types.map(arch => (
              <tr key={arch} className={arch === teamType ? 'current' : undefined} aria-current={arch === teamType || undefined}>
                <th scope="row">{t(`archetype.${arch}`)}</th>
                {WEIGHT_AREAS.map(area => <td key={area} data-label={t(`area.${area}`)}><WeightBar weight={shareOf(weights, arch, area)} step={stepOf(weights, arch, area)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}

/**
 * I pesi come li mostra la guida: quelli veri, tranne il Semi-stall quando pesa come lo Stall (National Dex OU). Lì la
 * guida gli dà un gradino di Offesa in più e uno di Difesa in meno dello Stall, così l'Offesa scende un passo alla volta
 * da Hyper Offense a Stall (scelta dell'utente, 2026-11-11). Solo a vista: il voto usa i pesi veri.
 */
const shownWeights = (weights: AreaWeightTable): AreaWeightTable => {
  const { semiStall, stall } = weights;
  if (semiStall.defense < stall.defense) return weights;
  return { ...weights, semiStall: { ...semiStall, defense: stall.defense - 5, strength: stall.strength + 5 } };
};

/**
 * La barra in sesti, a scala fissa (scelta dell'utente, 2026-11-11): il Balance a metà (3/6) in tutte le aree, e da lì
 * un gradino per tipo di team. Difesa sale verso lo Stall (1 → 5), Offesa e Velocità scendono (5 → 1). Solo a vista:
 * il voto usa i pesi veri; un'area che non conta (peso 0) resta vuota.
 */
const LADDER: Record<(typeof WEIGHT_AREAS)[number], Record<Archetype, number>> = {
  defense: { hyperOffense: 1, bulkyOffense: 2, balance: 3, semiStall: 4, stall: 5, doubles: 3 },
  strength: { hyperOffense: 5, bulkyOffense: 4, balance: 3, semiStall: 2, stall: 1, doubles: 3 },
  speed: { hyperOffense: 5, bulkyOffense: 4, balance: 3, semiStall: 2, stall: 1, doubles: 3 },
};
const stepOf = (weights: AreaWeightTable, arch: Archetype, area: (typeof WEIGHT_AREAS)[number]): number =>
  weights[arch][area] <= 0 ? 0 : LADDER[area][arch] / 6;
/** Il peso dell'area su 100 (le righe del singolo sommano già 100, quella del doppio 1). */
const shareOf = (weights: AreaWeightTable, arch: Archetype, area: (typeof WEIGHT_AREAS)[number]): number => {
  const total = WEIGHT_AREAS.reduce((sum, a) => sum + weights[arch][a], 0);
  return total > 0 ? (100 * weights[arch][area]) / total : 0;
};
/** Il peso di un'area come barra in sesti, senza numeri (stepOf); la parola dal peso vero solo per i lettori di schermo (scelta dell'utente, 2026-11-13). */
function WeightBar({ weight, step }: { weight: number; step: number }) {
  const t = useT();
  const word = weight <= 0 ? 'help.weight.none' : weight >= 50 ? 'help.weight.high' : weight >= 25 ? 'help.weight.mid' : 'help.weight.low';
  return (
    <span className="help-wbar">
      <i style={{ width: `${(100 * step).toFixed(2)}%` }} />
      <span className="visually-hidden">{t(word)}</span>
    </span>
  );
}

/** Un tipo di team: come vince, i pesi delle aree e le voci dei Ruoli per livello, letti dalle tabelle del motore. */
function TypeTopic({ type, weights, typeRule }: { type: Archetype; weights: AreaWeightTable; typeRule?: FormatRules['typeRule'] }) {
  const t = useT();
  return (
    <>
      <p className="help-note">{t(`archetype.${type}.note`)}</p>
      <p>{t(`help.type.${type}`)}</p>
      <h5>{t('help.type.weights')}</h5>
      <dl className="help-weights-row">
        {WEIGHT_AREAS.map(area => {
          const inactive = weights[type][area] === 0;
          return (
            <div key={area} className={inactive ? 'inactive' : undefined}>
              <dt>{t(`area.${area}`)}</dt>
              <dd><WeightBar weight={shareOf(weights, type, area)} step={stepOf(weights, type, area)} /></dd>
              {inactive && <dd className="help-inactive-note">{t('rating.notCounted')}</dd>}
            </div>
          );
        })}
      </dl>
      <h5>{t('area.roles')}</h5>
      {LEVELS.map(level => {
        const keys = LEVEL_KEYS.filter(key => levelFor(type, key, typeRule) === level);
        if (keys.length === 0) return null;
        return (
          <div key={level} className="help-levels">
            <h6>{t(`rdetail.group.${level}`)}</h6>
            <ul className={`help-points ${level}`}>{keys.map(key => <li key={key} title={t(`roleBrief.${key}`)}>{t(keyLabel(key))}</li>)}</ul>
          </div>
        );
      })}
    </>
  );
}
