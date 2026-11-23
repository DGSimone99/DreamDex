import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useEditing } from './editing';
import { GRADES, type TeamRating } from '../engine/rating';
import { teamArchetype, type Archetype } from '../engine/archetype';
import type { TeamSet } from '../engine/sets';
import { rolesTally } from '../engine/rolesArea';
import { AlertMark } from './AlertMark';
import { RatingHelp } from './RatingHelp';
import { type DetailArea, signed } from './AreaDetail';
import { Icon } from './icons';
import { useT } from '../i18n/react';
import { EDITOR_TABS_QUERY, useMediaQuery } from './useMediaQuery';
import { ANALYSIS_VIEWS } from './AnalysisTabs';
import type { TabView } from './analysisView';
import { EeveeMoment } from './EeveeMoment';
import { bonusMalusTotals } from './BonusMalusView';

const isDetailArea = (key: string): key is DetailArea => key === 'strength' || key === 'defense' || key === 'speed' || key === 'roles' || key === 'bonusMalus';


/** Voto grande accanto alla fila del team: lettera, punteggio, le tre aree, i Ruoli e Bonus/Malus, che portano alle schede di Analisi. */
/**
 * `onOpen`: le righe delle aree e di Bonus/Malus portano alla scheda di quell'area in Analisi; la riga dei Ruoli a
 * Bonus/Malus, sottoscheda Ruoli.
 * `teamType`: il tipo di team del Riassunto (null finché il team non ha 6 membri: "Incompleto · 5/6" coi `members`; a
 * team completo senza tipo "Misto").
 * `collapsed`: team ridotto: lettera e punteggio diventano un pulsante che apre la tendina "Voto delle aree" con le
 * stesse righe (GradeAreaRows) e il "?"; col team aperto la carta resta com'è.
 * `ruleIssues`: problemi di regole: la lettera diventa grigia e sotto si scrive perché (`formatName`: il formato). `blocked`: il team ha membri ma il voto non si dà (EV oltre 510, specie doppia): il perché.
 */
export function GradeBadge({ rating: computed, grading = false, ruleIssues = [], illegalCount = 0, illegalNames = [], formatName = '', blocked = null, incomplete = false, members = 0, teamType = null, collapsed = false, onOpen }: { rating: TeamRating | null; /** Il voto si sta calcolando (all'apertura del sito, subito dopo il primo disegno). */ grading?: boolean; collapsed?: boolean; teamType?: Archetype | null; ruleIssues?: string[]; illegalCount?: number; illegalNames?: string[]; formatName?: string; blocked?: 'ev' | 'species' | null; incomplete?: boolean; members?: number; onOpen?: (area: DetailArea) => void }) {
  const t = useT();
  // Voto bloccato (EV oltre il massimo, specie sconosciuta): si sa subito dal team, mentre il voto nuovo arriva un attimo
  // dopo. Nel frattempo il voto vecchio non si mostra, se no per un istante comparirebbe con l'avviso delle regole sotto
  // e la carta si allungherebbe
  const rating = blocked ? null : computed;
  // Voto quando si è aperto il membro nell'editor: il badge mostra di quanto è cambiato
  const editing = useEditing();
  const [since, setSince] = useState<number | null>(null);
  const overall = rating?.overall ?? null;
  const delta = rating && since !== null ? rating.overall - since : 0;
  // Chiudendo l'editor, di quanto è cambiato il voto resta a vista un attimo (sale, poi sparisce): il risultato del lavoro.
  // Se è cambiata anche la lettera, la lettera fa un piccolo salto. `lastEdit` è il voto di partenza e il cambio
  // dell'ultimo giro nell'editor (letto al render, prima che `since` si azzeri)
  const lastEdit = useRef<{ from: number; delta: number } | null>(null);
  if (editing !== null && since !== null && rating) lastEdit.current = { from: since, delta };
  const [flash, setFlash] = useState<{ from: number; delta: number; letter: boolean; key: number } | null>(null);
  useEffect(() => {
    setSince(editing === null ? null : overall);
    const last = lastEdit.current;
    lastEdit.current = null;
    if (editing !== null) { setFlash(null); return; }
    if (!last || last.delta === 0 || overall === null) return;
    const letterOf = (v: number) => GRADES.find(g => v >= g.min)?.grade;
    setFlash({ ...last, letter: letterOf(last.from) !== letterOf(overall), key: Date.now() });
    const id = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(id);
  }, [editing]);
  // Il cambio da mostrare: quello in corso mentre modifichi, o quello appena chiuso
  const shown = editing !== null ? delta : flash?.delta ?? 0;
  const deltaChip = (where: string) => rating && shown !== 0 && (
    <span key={flash?.key ?? 'live'} className={`grade-delta ${where} ${shown > 0 ? 'up' : 'down'}${editing === null ? ' flash' : ''}`} aria-hidden="true">
      {t('rating.since', { from: since ?? flash?.from ?? 0, delta: `${shown > 0 ? '+' : '−'}${Math.abs(shown)}` })}
    </span>
  );
  // Team ridotto: la tendina delle aree sotto lettera e punteggio
  const [popOpen, setPopOpen] = useState(false);
  const popId = useId();
  const popButton = useRef<HTMLButtonElement>(null);
  const withPop = collapsed && !!rating;
  // Il team si riapre (o il voto sparisce): la tendina si chiude, alla prossima riduzione riparte chiusa
  useEffect(() => { if (!withPop) setPopOpen(false); }, [withPop]);
  const closePop = (refocus: boolean) => { setPopOpen(false); if (refocus) popButton.current?.focus(); };
  // Telefono e tablet, team aperto: di base solo la prima riga (lettera, punteggio, giudizio e tipo di team); toccando la
  // targa compaiono le righe delle aree sotto, come sul computer
  const small = useMediaQuery(EDITOR_TABS_QUERY);
  const foldable = small && !collapsed && !!rating;
  const [areasOpen, setAreasOpen] = useState(false);
  const areasId = useId();
  // Regole infrante: lettera, punteggio e giudizio in grigio finché il team non è legale (il voto si calcola uguale), e sotto
  // il perché (in quale formato e quanti membri; chi e il motivo nel tooltip). Niente triangolo sul voto
  const broken = ruleIssues.length > 0;
  // Nella carta (stretta) la scritta corta; il formato è nel tooltip e nella frase per i lettori di schermo
  const notLegal = broken ? t('rating.notLegalIn', { format: formatName, n: Math.max(1, illegalCount) }) : '';
  // Il tipo di team come nel Riassunto: senza tipo "Incompleto · 5/6" finché mancano membri, a team completo "Misto"
  const pending = members < 6;
  const typeLabel = teamType ? t(`archetype.${teamType}`) : pending ? t('sum.archBuilding', { n: members }) : t('sum.archMixed');
  const typeNote = t(teamType ? `archetype.${teamType}.note` : pending ? 'sum.archBuildingNote' : 'sum.archMixedNote');
  const who = illegalNames.length ? t('rating.notLegalWho', { list: illegalNames.join(', ') }) : '';
  // Lettera e punteggio (e il resto del disegno): nella carta così, col team ridotto dentro il pulsante della tendina
  const face = (
    <>
    {/* Per i lettori di schermo una frase sola; il disegno qui sotto è solo visivo */}
    <span className="visually-hidden">
      {rating ? t('rating.badgeSr', { grade: rating.grade, overall: rating.overall, label: rating.label }) + (broken ? `, ${notLegal}${illegalNames.length ? ` (${illegalNames.join(', ')})` : ''}: ${ruleIssues.join('; ')}` : '') + (rating.notes.length ? `, ${t('rating.provisional')}` : '') + `, ${typeLabel}` : `${t('rating.badgeHead')}: ${t(grading ? 'rating.calculating' : 'rating.noGrade')}`}
    </span>
    <span className="grade-visual" aria-hidden="true">
    <span className="grade-head">{t('rating.badgeHead')}</span>
    {rating && <span className="letter">{rating.grade}</span>}
    {!rating && !blocked && !grading && <EeveeMoment pose="wave" />}
    <span className="overall">{rating ? `${rating.overall} / 100` : t(grading ? 'rating.calculating' : 'rating.noGrade')}{withPop && deltaChip('in-strip')}</span>
    <span className="label">{rating ? rating.label : grading ? '' : t(blocked === 'ev' ? 'rating.evBlocked' : blocked === 'species' ? 'rating.speciesBlocked' : 'rating.addPokemon')}
      {/* Il tipo di team sulla riga del giudizio, come testo semplice (non una targa): la carta non diventa più alta */}
      {rating && <span className="grade-type" title={typeNote}>{typeLabel}</span>}
    </span>
    </span>
    </>
  );
  return (
    <div className={`grade-badge${rating ? ` grade-${rating.grade}` : ' none'}${grading ? ' grading' : ''}${broken ? ' rules-broken' : ''}${flash?.letter ? ' letter-changed' : ''}${foldable ? ` foldable${areasOpen ? ' areas-open' : ''}` : ''}`}
      // Tutta la targa apre e chiude le righe (tranne i suoi pulsanti: aiuto, regole, le righe stesse)
      onClick={foldable ? e => { if (!(e.target as Element).closest('button, a, [role="button"]')) setAreasOpen(o => !o); } : undefined}>
      {withPop ? (
        // Team ridotto: lettera e punteggio aprono la tendina con le righe delle aree (stessa frase per i lettori di schermo)
        <button ref={popButton} type="button" className="grade-pop-toggle" aria-haspopup="dialog" aria-expanded={popOpen}
          aria-controls={popOpen ? popId : undefined} onClick={() => setPopOpen(o => !o)}
          onKeyDown={e => { if (e.key === 'Escape' && popOpen) { e.preventDefault(); e.stopPropagation(); closePop(true); } }}>
          {face}
          {/* Le tre aree sempre visibili anche col team ridotto (mentre modifichi un membro): barrette senza scritte, nel
              colore della lettera che varrebbero da sole; i numeri e il resto nella tendina */}
          <GradeMini rating={rating} />
          <span className="grade-pop-caret" aria-hidden="true"><Icon name="next" /></span>
        </button>
      ) : face}
      {/* Testa: l'aiuto sul voto e il triangolo delle regole, fuori dal disegno perché si usano */}
      {(rating || blocked) && (
        <span className="grade-tools">
          {/* Di quanto è cambiato il voto da quando si è aperto l'editor: la prima della fila, così non va mai sotto i segni */}
          {deltaChip('in-card')}
          {/* In giallo il voto provvisorio (membro senza mosse, specie, mossa o strumento sconosciuti); le regole sono la
              scritta sotto il giudizio (senza voto, quando il voto è bloccato, restano qui in rosso) */}
          {/* Regole infrante: il triangolo rosso col perché (in quale formato, chi, il motivo); niente scritta sotto il
              giudizio, che allungava la carta. Col voto c'è anche il grigio */}
          {(ruleIssues.length > 0 || !!rating?.notes.length) && <AlertMark floating alerts={[
            ...(!rating && ruleIssues.length ? [{ level: 'danger' as const, text: t('rating.rulesBroken') }, ...ruleIssues.map(text => ({ level: 'danger' as const, text }))] : []),
            ...(rating && broken ? [{ level: 'danger' as const, text: notLegal }, ...(who ? [{ level: 'danger' as const, text: who }] : []), ...ruleIssues.map(text => ({ level: 'danger' as const, text }))] : []),
            ...(rating?.notes.length ? [{ level: 'warn' as const, text: t('rating.provisional') }] : []),
            ...(rating?.notes ?? []).map(text => ({ level: 'warn' as const, text })),
          ]} />}
          {/* Col team ridotto il "?" sta nella tendina delle aree */}
          {rating && !withPop && <RatingHelp incomplete={incomplete} teamType={rating.teamType} trickRoom={rating.trickRoom} meta={rating.offense.coverageMeta !== null} weights={rating.weightTable} typeRule={rating.needs.rules.typeRule} />}
          {/* Telefono e tablet: la freccetta che apre e chiude le righe delle aree, ultima della fila (per la tastiera e i
              lettori di schermo; toccare la targa fa lo stesso) */}
          {foldable && (
            <button type="button" className="grade-fold" aria-expanded={areasOpen} aria-controls={areasId}
              aria-label={t(areasOpen ? 'rating.areasHide' : 'rating.areasShow')} onClick={() => setAreasOpen(o => !o)}>
              <Icon name="down" />
            </button>
          )}
        </span>
      )}
      {/* Le tre aree, i Ruoli e Bonus/Malus: ogni riga porta alla sua scheda in Analisi (col team ridotto, nella tendina) */}
      {rating && !collapsed && (!foldable || areasOpen) && <span id={foldable ? areasId : undefined} className="grade-areas-wrap"><GradeAreaRows rating={rating} onOpen={onOpen} /></span>}
      {withPop && popOpen && (
        <GradePopover id={popId} button={popButton} onClose={closePop}
          help={<RatingHelp incomplete={incomplete} teamType={rating.teamType} trickRoom={rating.trickRoom} meta={rating.offense.coverageMeta !== null} weights={rating.weightTable} typeRule={rating.needs.rules.typeRule} />}>
          <GradeAreaRows rating={rating} onOpen={area => { onOpen?.(area); closePop(true); }} />
        </GradePopover>
      )}
      {/* Per i lettori di schermo, alla chiusura dell'editor: da quanto a quanto è passato il voto */}
      <span className="visually-hidden grade-change-sr" aria-live="polite">
        {flash && rating ? t('rating.changedSr', { from: flash.from, to: rating.overall, grade: rating.grade }) : ''}
      </span>
    </div>
  );
}


/**
 * Telefono, in fondo alla barra delle schede di Analisi (dove non c'è la Panoramica): il voto del team sempre a vista,
 * lettera nel colore del voto e punteggio (grigio col team fuori regola). Toccandolo si apre la tendina "Voto delle aree"
 * del team ridotto: le righe delle aree (ognuna apre la sua scheda) e il "?" del voto.
 */
export function TabsGrade({ rating, team = [], broken = false, incomplete = false, onOpen }: { rating: TeamRating;
  /** Il team: in cima alla tendina chi è (tipo di team, core, meteo), che sul telefono senza Panoramica non si vede altrove. */
  team?: TeamSet[];
  broken?: boolean; incomplete?: boolean; onOpen: (area: DetailArea) => void }) {
  const t = useT();
  // "Balance · 2 core · Pioggia": il tipo solo col team completo (prima sarebbe provvisorio), i core che il voto conta, gli stili
  const found = team.length ? teamArchetype(team, rating.needs.rules) : null;
  const identity = [
    ...(found && team.length >= 6 ? [t(`archetype.${found.archetype}`)] : []),
    ...(rating.cores.length ? [t(rating.cores.length === 1 ? 'rating.popCoresOne' : 'rating.popCoresMany', { n: rating.cores.length })] : []),
    ...(found?.styles ?? []).map(style => t(`teamStyle.${style}`)),
  ].join(' · ');
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = (refocus: boolean) => { setOpen(false); if (refocus) button.current?.focus(); };
  return (
    <div className={`analysis-grade grade-${rating.grade}${broken ? ' rules-broken' : ''}`}>
      <button ref={button} type="button" className="analysis-grade-toggle" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={t('rating.badgeSr', { grade: rating.grade, overall: rating.overall, label: rating.label })} onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(true); } }}>
        <span className="analysis-grade-letter" aria-hidden="true">{rating.grade}</span>
        <span className="analysis-grade-overall" aria-hidden="true">{rating.overall}</span>
      </button>
      {open && (
        <GradePopover id={id} button={button} onClose={close}
          help={<RatingHelp incomplete={incomplete} teamType={rating.teamType} trickRoom={rating.trickRoom} meta={rating.offense.coverageMeta !== null} weights={rating.weightTable} typeRule={rating.needs.rules.typeRule} />}>
          {identity && <p className="grade-pop-id">{identity}</p>}
          <GradeAreaRows rating={rating} onOpen={area => { onOpen(area); close(false); }} />
        </GradePopover>
      )}
    </div>
  );
}

/** Le tre aree (Offesa, Difesa, Velocità) come barrette impilate, per il voto del team ridotto. Solo disegno. */
function GradeMini({ rating }: { rating: TeamRating }) {
  const t = useT();
  const areas = [...rating.areas].sort((a, b) => ANALYSIS_VIEWS.indexOf(a.key as TabView) - ANALYSIS_VIEWS.indexOf(b.key as TabView));
  return (
    <span className="grade-mini" aria-hidden="true">
      {areas.map(area => (
        <span key={area.key} className={`grade-mini-row band-${GRADES.find(g => (area.value ?? 0) >= g.min)!.grade}${area.inactive ? ' inactive' : ''}`}>
          <span className="grade-mini-label">{t(`area.${area.key}Short` as 'area.strengthShort')}</span>
          <span className="meter"><span style={{ width: `${area.value ?? 0}%` }} /></span>
          <b>{area.value ?? '—'}</b>
        </span>
      ))}
    </span>
  );
}

/**
 * Le righe delle aree della carta del voto: le tre aree con barra e numero, i Ruoli "8/8 +2" e Bonus/Malus "+6"; ogni
 * riga chiama `onOpen` con la sua area. Le stesse righe nella carta grande e nella tendina del team ridotto.
 */
export function GradeAreaRows({ rating, onOpen }: { rating: TeamRating; onOpen?: (area: DetailArea) => void }) {
  const t = useT();
  return (
    <span className="grade-areas">
      {[...rating.areas].sort((a, b) => ANALYSIS_VIEWS.indexOf(a.key as TabView) - ANALYSIS_VIEWS.indexOf(b.key as TabView)).map(area => {
        const note = area.inactive ? ` · ${t('rating.notCounted')}` : '';
        return (
          // Ogni barra nel colore della lettera che varrebbe da sola: si vede subito l'area debole
          <button key={area.key} type="button"
            className={`grade-area band-${GRADES.find(g => (area.value ?? 0) >= g.min)!.grade}${area.inactive ? ' inactive' : ''}`}
            aria-label={`${t('rating.openArea', { area: area.label, value: area.value ?? '—' })}${note}`}
            title={area.inactive ? t('rating.notCounted') : undefined}
            onClick={() => isDetailArea(area.key) && onOpen?.(area.key)}>
            <span>{area.label}</span>
            <span className="meter"><span style={{ width: `${area.value ?? 0}%` }} /></span>
            <b>{area.value ?? '—'}</b>
            <Icon name="next" />
          </button>
        );
      })}
      {/* Ruoli: una lista, non un'area col peso; senza barra, lo stesso conteggio di Panoramica, Coaching e sottoscheda
          (rolesTally): essenziali e importanti coperte sul totale, nel colore del livello peggiore che manca, poi i punti
          dei Ruoli sul voto (+N / −N / 0). Un minore scoperto non è un difetto, quindi non entra nel totale */}
      {rating.roles.total > 0 && (() => {
        const { covered, total, missing, missingEssential, points } = rolesTally(rating.roles);
        const state = missing > 1 ? t('rating.rolesMissing', { n: missing }) : missing === 1 ? t('rating.rolesMissingOne') : '';
        const tone = missingEssential > 0 ? 'bad' : missing > 0 ? 'warn' : '';
        return (
          <button type="button" className={`grade-area grade-roles${points > 0 ? ' pos' : points < 0 ? ' neg' : ''}`}
            aria-label={t('rating.openArea', { area: t('area.roles'), value: [`${covered}/${total}`, state, t('rating.rolesPoints', { value: signed(points) })].filter(Boolean).join(', ') })}
            onClick={() => onOpen?.('roles')}>
            <span>{t('area.roles')}</span>
            <span className="grade-roles-val"><em className={`grade-roles-count ${tone}`}>{covered}/{total}</em><b>{signed(points)}</b></span>
            <Icon name="next" />
          </button>
        );
      })()}
      {/* Ultima riga: netto di bonus e malus senza i ruoli (come la scheda Bonus/Malus), senza barra */}
      {(() => {
        const { net } = bonusMalusTotals(rating);
        const value = net === 0 ? '±0' : signed(net);
        return (
          <button type="button" className={`grade-area grade-bm${net > 0 ? ' pos' : net < 0 ? ' neg' : ''}`}
            aria-label={t('rating.openBonusMalus', { value })}
            onClick={() => onOpen?.('bonusMalus')}>
            <span>{t('area.bonusMalus')}</span>
            <b>{value}</b>
            <Icon name="next" />
          </button>
        );
      })()}
    </span>
  );
}

/**
 * La tendina "Voto delle aree" del team ridotto, sotto il voto e allineata a destra: il titolo col "?" e le righe delle
 * aree. Si apre col focus sulla prima riga; frecce su/giù, Home e Fine fra le righe; Esc chiude e torna al voto; un clic
 * fuori o il focus che esce la chiudono. La finestra del "?" sta nel body (portale): i suoi clic e tasti non la chiudono.
 */
function GradePopover({ id, button, onClose, help, children }: {
  id: string; button: RefObject<HTMLButtonElement | null>; onClose: (refocus: boolean) => void; help: ReactNode; children: ReactNode;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = `${id}-title`;
  const rows = () => [...(ref.current?.querySelectorAll<HTMLElement>('button.grade-area') ?? [])];
  useLayoutEffect(() => { rows()[0]?.focus(); }, []);
  // Dentro la tendina, sul voto o nella finestra del "?" (portale nel body): non è fuori
  const inside = (node: EventTarget | null) => node instanceof Node && (!!ref.current?.contains(node) || !!button.current?.contains(node)
    || (node instanceof Element && !!node.closest('.help-backdrop')));
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!inside(e.target)) onClose(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // I tasti della finestra del "?" risalgono qui dal portale: sono suoi
    if (!ref.current?.contains(e.target as Node)) return;
    const list = rows();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at < 0 ? list.length - 1 : at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); }
  };
  return (
    <div ref={ref} id={id} className="grade-pop" role="dialog" aria-labelledby={titleId} onKeyDown={onKey}
      onBlur={e => { if (e.relatedTarget && !inside(e.relatedTarget)) onClose(false); }}>
      <div className="grade-pop-head">
        <p id={titleId} className="grade-pop-title">{t('rating.areasPop')}</p>
        {help}
      </div>
      {children}
    </div>
  );
}
