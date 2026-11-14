import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type RefObject } from 'react';
import type { Lang } from '../i18n';
import { typeName } from '../i18n/game';
import type { Core } from '../engine/cores';
import { bonusMalusCatalog, CORE_TRIO_POINTS, type CatalogEntry, type CatalogKey, type Redundancy, type TeamRating } from '../engine/rating';
import { useT } from '../i18n/react';
import { CoreArt } from './dashboard/CoreTriangle';
import { DashCard } from './dashboard/DashCard';
import { Typed } from './TypeText';
import { typeIconUrl } from './typeIcons';

type T = ReturnType<typeof useT>;
// Lo zero senza segno, come sulla scheda e nella scheda del voto
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Famiglia di una voce: decide l'icona dentro la medaglia (una forma sola, l'icona cambia). */
type Family = 'types' | 'roles' | 'hazards' | 'conditions' | 'members' | 'core';
const FAMILY: Record<CatalogKey, Family> = {
  sharedWeak: 'types', sameType: 'types', defenseHole: 'types', weakCovered: 'types', typeVariety: 'types',
  essentialRole: 'roles', importantRole: 'roles', minorRole: 'roles',
  hazardDuplicate: 'hazards',
  weatherClash: 'conditions', unmetCondition: 'conditions', unusedEnabler: 'conditions', conditionUsed: 'conditions', weatherHelp: 'conditions', trickRoomFast: 'conditions',
  weakMember: 'members', lockedStatus: 'members',
  coreTrio: 'core',
};

/** Le icone delle famiglie, a tratto, nello spazio 64×72 della medaglia. */
const ICONS: Record<Family, ReactElement> = {
  // Tre cerchi che si toccano: i tipi
  types: <><circle cx="26" cy="32" r="6" /><circle cx="38" cy="32" r="6" /><circle cx="32" cy="42" r="6" /></>,
  // Una stella: i ruoli
  roles: <path d="M32 23l3.5 8 8.5.8-6.4 5.6 2 8.4L32 41.5 24.4 45.8l2-8.4-6.4-5.6 8.5-.8z" />,
  // Punte sul terreno: gli hazard
  hazards: <path d="M20 46l6-14 6 14 6-14 6 14z" />,
  // Un sole: meteo, campi e Trick Room
  conditions: <><circle cx="32" cy="36" r="6" /><path d="M32 24v-3M32 51v-3M20 36h-3M47 36h-3M23.5 27.5l-2-2M42.5 46.5l-2-2M23.5 44.5l-2 2M42.5 25.5l-2 2" /></>,
  // Una Poké Ball: i singoli membri
  members: <><circle cx="32" cy="36" r="11" /><path d="M21 36h22" /><circle cx="32" cy="36" r="3" /></>,
  // Tre punti a triangolo: il core a tre
  core: <><circle cx="32" cy="25" r="4" /><circle cx="22" cy="44" r="4" /><circle cx="42" cy="44" r="4" /><path d="M30 29l-6 11M34 29l6 11M26 44h12" /></>,
};

/** Medaglia esagonale con l'icona della famiglia; il malus è rosso e incrinato. Decorativa. */
export function Medal({ entry, className = '', style }: { entry: Pick<CatalogEntry, 'key' | 'kind'>; className?: string; style?: CSSProperties }) {
  // Gradienti propri per ogni medaglia (gli id vanno dentro url(#…): senza i due punti di useId)
  const id = useId().replace(/[^\w-]/g, '');
  return (
    <svg className={`bm-medal ${entry.kind}${className ? ` ${className}` : ''}`} style={style} viewBox="0 0 64 72" aria-hidden="true" focusable="false">
      <defs>
        {/* Bordo di metallo: chiaro in alto, scuro in basso, nel colore della voce */}
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="bm-stop-light" />
          <stop offset="0.5" className="bm-stop-tone" />
          <stop offset="1" className="bm-stop-dark" />
        </linearGradient>
        {/* Smusso interno: al contrario del bordo (la faccia sembra incassata) */}
        <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="bm-stop-dark" />
          <stop offset="1" className="bm-stop-light" />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.5" cy="0.32" r="0.75">
          <stop offset="0" className="bm-stop-face" />
          <stop offset="1" className="bm-stop-bg" />
        </radialGradient>
      </defs>
      <path className="bm-medal-hex" d="M32 3 59 18v36L32 69 5 54V18z" fill={`url(#${id}-face)`} stroke={`url(#${id}-rim)`} />
      <path className="bm-medal-inner" d="M32 10 53 22v28L32 62 11 50V22z" stroke={`url(#${id}-bevel)`} />
      <path className="bm-medal-shine" d="M32 5 57 19 32 31 7 19z" />
      <g className="bm-medal-icon">{ICONS[FAMILY[entry.key]]}</g>
      {entry.kind === 'malus' && <path className="bm-medal-crack" d="M40 8l-5 12 4 6-6 9 3 7-5 10" />}
    </svg>
  );
}

/** Una riga della lista: la voce, il caso concreto e i punti (il core a tre ha una riga per trio). */
interface ActiveRow { key: string; entry: CatalogEntry; points: number; details: string[] }

/** Il caso concreto senza il nome della voce davanti ("Core a tre: X, Y, Z…" → "X, Y, Z…"). */
function detailOf(item: Redundancy, name: string): string {
  const prefix = `${name}:`.toLowerCase();
  const text = item.text.toLowerCase().startsWith(prefix) ? item.text.slice(prefix.length).trim().replace(/^./, c => c.toUpperCase()) : item.text;
  // E senza il nome dietro ("Pivot: ruolo minore coperto" → "Pivot")
  const at = text.lastIndexOf(': ');
  return at > 0 && text.slice(at + 2).toLowerCase() === name.toLowerCase() ? text.slice(0, at) : text;
}

function activeRows(catalog: CatalogEntry[], kind: CatalogEntry['kind'], items: Redundancy[]): ActiveRow[] {
  // I core a tre stanno nel riquadro in alto col loro +3: non si ripetono fra le voci (contano nel netto e nelle barre)
  return catalog.filter(e => e.kind === kind && e.key !== 'coreTrio').flatMap(entry => {
    const own = items.filter(i => i.catalog === entry.key && i.points > 0);
    if (!own.length) return [];
    return [{ key: entry.key, entry, points: own.reduce((n, i) => n + i.points, 0), details: own.map(i => detailOf(i, entry.name)) }];
  });
}

/** Il nome di un core per la scheda: i tre tipi parati, nell'ordine del giro ("Acqua / Lotta / Psico"). */
const coreTypes = (core: Core, lang: Lang) => core.sides.map(side => typeName(side.type, lang)).join(' / ');

/** Quanti tipi d'attacco almeno uno dei tre regge (la stessa regola di "regge" della Coverage tipi della Difesa). */
function heldCount(core: Core, rows: { heldBy: string[] }[]): number {
  return rows.filter(row => row.heldBy.some(name => core.members.includes(name))).length;
}

/** I core del voto dal primo (quello che regge più tipi) all'ultimo, coi tipi che reggono; a parità l'ordine del voto. */
function rankedCores(rating: TeamRating): { core: Core; held: number }[] {
  const rows = rating.defense?.coverageTypes?.rows ?? [];
  return (rating.cores ?? []).map(core => ({ core, held: heldCount(core, rows) })).sort((a, b) => b.held - a.held);
}

/** Il contenuto della guida: tutte le voci di un tipo (bonus o malus) con quando scattano e quanto valgono. */
export function CatalogueList({ lang, kind }: { lang: Lang; kind: CatalogEntry['kind'] }) {
  return (
    <ul className="bm-cat">
      {bonusMalusCatalog(lang).filter(entry => entry.kind === kind).map(entry => (
        <li key={entry.key}>
          <Medal entry={entry} />
          <span className="bm-cat-tx"><b>{entry.name}</b><span>{entry.when}</span></span>
          <span className={`bm-cat-pts ${kind}`}>{entry.points}</span>
        </li>
      ))}
    </ul>
  );
}

/** Un core della colonna di sinistra: aperto ha tutto, chiuso solo il triangolo coi suoi punti (con due core è un pulsante). */
function CoreCard({ core, open, held, total, toggle, onOpen, lang, t }: {
  core: Core; open: boolean; held: number; total: number; toggle: boolean; onOpen: () => void; lang: Lang; t: T;
}) {
  const title = coreTypes(core, lang);
  const art = <><CoreArt core={core} sprite={48} /><span className="bm-core-peek" aria-hidden="true">{title}</span><span className="bm-core-mini" aria-hidden="true">+{CORE_TRIO_POINTS}</span></>;
  return (
    <li className={`bm-core${open ? ' open' : ' shut'}`}>
      {toggle ? (
        <button type="button" className="bm-core-art" aria-expanded={open} aria-label={t('catalogue.cores.name', { title })}
          tabIndex={open ? -1 : 0} onClick={onOpen}>{art}</button>
      ) : <span className="bm-core-art">{art}</span>}
      <div className="bm-core-body" inert={!open}>
        <h5>{title}<span className="bm-core-pts">+{CORE_TRIO_POINTS}</span></h5>
        <ul className="bm-core-lines">
          {core.sides.map(side => {
            const line = t('catalogue.cores.parry', { name: side.from, to: side.to, type: typeName(side.type, lang) });
            return (
              <li key={side.from}>
                <img src={typeIconUrl(side.type)} alt="" draggable={false} />
                <span>{line.startsWith(side.from) ? <><b>{side.from}</b>{line.slice(side.from.length)}</> : line}</span>
              </li>
            );
          })}
        </ul>
        {total > 0 && <span className="bm-core-chip" title={t('catalogue.cores.heldTip')}>{t('catalogue.cores.held', { n: held, total })}</span>}
      </div>
    </li>
  );
}

/**
 * I core a tre in una carta come quelle della Panoramica, sempre della stessa misura (0, 1 o 2 core: la pagina non salta
 * cambiando team). Nella barra del titolo la medaglia del core (accesa con almeno un core, spenta senza) e a destra
 * quanti sono e quanto valgono. Due core a fisarmonica (aperto quello che regge più tipi), uno aperto, nessuno: due righe
 * su come averne uno, al centro.
 */
function CoreColumn({ rating, lang, t }: { rating: TeamRating; lang: Lang; t: T }) {
  const rows = rating.defense?.coverageTypes?.rows ?? [];
  // Per primo (e aperto all'inizio) il core che regge più tipi; l'ordine poi resta quello
  const ranked = rankedCores(rating);
  const cores = ranked.map(r => r.core);
  const held = ranked.map(r => r.held);
  // L'aperto si ricorda per membri: cambiando team torna quello che regge più tipi
  const [picked, setPicked] = useState<string | null>(null);
  const keyOf = (core: Core) => core.members.join('/');
  const found = cores.findIndex(core => keyOf(core) === picked);
  const openIndex = found >= 0 ? found : 0;
  const two = cores.length > 1;
  // La medaglia grande del core, appuntata sulla barra del titolo: accesa con almeno un core, spenta senza
  const icon = <Medal entry={{ key: 'coreTrio', kind: 'bonus' }} className={`bm-head-medal${cores.length ? '' : ' off'}`} />;
  const meta = cores.length ? <>{cores.length} · <b className="good">+{cores.length * CORE_TRIO_POINTS}</b></> : undefined;
  return (
    <DashCard title={t('catalogue.cores.title')} icon={icon} meta={meta} level="h4" className={`bm-cores${cores.length ? '' : ' none'}`}>
      {cores.length === 0 ? (
        <div className="bm-cores-none">
          <p><b>{t('catalogue.cores.none')}</b>{t('catalogue.cores.how')}</p>
        </div>
      ) : (
        <ul className={`bm-core-row${two ? ' two' : ''}`}>
          {cores.map((core, i) => (
            <CoreCard key={keyOf(core)} core={core} open={i === openIndex} held={held[i]} total={rows.length} toggle={two}
              onOpen={() => setPicked(keyOf(core))} lang={lang} t={t} />
          ))}
        </ul>
      )}
    </DashCard>
  );
}

/**
 * Le barre di quanto tolgono i malus e aggiungono i bonus, sulla stessa scala (la più lunga è la più grande delle due,
 * almeno 10 punti: 1–2 punti restano corti). Decorative: i numeri sono già scritti sopra.
 */
function Bars({ bonus, malus, t }: { bonus: number; malus: number; t: T }) {
  const scale = Math.max(10, malus, bonus);
  return (
    <div className="bm-bars" aria-hidden="true">
      {([['malus', malus], ['bonus', bonus]] as const).map(([kind, total]) => (
        <div key={kind} className={`bm-bar ${kind}`}>
          <span>{t(`catalogue.${kind}`)}</span>
          {/* A zero la barra resta vuota (niente tacca) */}
          <span className="bm-track">{total > 0 && <span style={{ width: `${(100 * total) / scale}%` }} />}</span>
          <b className={total === 0 ? 'zero' : undefined}>{signed(kind === 'malus' ? -total : total)}</b>
        </div>
      ))}
    </div>
  );
}

/** Come stanno le voci, dalla più larga alla più fitta: colonne e carte compatte (nome e punti in una riga). */
interface Density { cols: number; compact: boolean }
const densities = (n: number): Density[] => [
  ...(n <= 4 ? [{ cols: 2, compact: false }] : []),
  { cols: 3, compact: false }, { cols: 4, compact: false }, { cols: 3, compact: true }, { cols: 4, compact: true },
];

/**
 * Il posto delle voci, senza mai scorrere: si provano in ordine le sistemazioni (con le barre e le carte larghe; senza
 * barre; poi carte più fitte: più colonne, poi compatte) e si tiene la prima in cui le voci stanno. Si provano tutte
 * insieme sul posto, prima del disegno (si cambiano le classi, si misura, si rimettono), così non c'è sfarfallio né
 * rimbalzo; si rifà quando cambiano le voci, la misura della scheda o arrivano i font. Con una voce aperta per intero
 * resta tutto com'è (allora la zona può scorrere). Senza ResizeObserver (test): barre e carte larghe.
 */
function useFitEntries(bm: RefObject<HTMLDivElement | null>, key: string, frozen: boolean, count: number) {
  const options = densities(count);
  const [fit, setFit] = useState({ bars: true, level: 0 });
  const solve = useRef<() => void>(() => {});
  solve.current = () => {
    const root = bm.current;
    if (!root || frozen) return;
    const area = root.querySelector<HTMLElement>('.bm-entries');
    const list = area?.querySelector<HTMLElement>('.bm-list');
    const tries = [{ bars: true, level: 0 }, ...options.map((_, level) => ({ bars: false, level }))];
    let chosen = tries[0];
    if (area) {
      const had = { noBars: root.classList.contains('no-bars'), compact: area.classList.contains('compact'), cols: list?.style.getPropertyValue('--cols') ?? '' };
      chosen = tries[tries.length - 1];
      const fits = (attempt: { bars: boolean; level: number }) => {
        const d = options[attempt.level];
        root.classList.toggle('no-bars', !attempt.bars);
        area.classList.toggle('compact', d.compact);
        list?.style.setProperty('--cols', String(d.cols));
        return area.scrollHeight - area.clientHeight <= 0;
      };
      for (const attempt of tries) {
        if (fits(attempt)) { chosen = attempt; break; }
      }
      // Se alla fine le barre non rubano posto (la carta dei core è più alta), restano
      if (!chosen.bars && fits({ bars: true, level: chosen.level })) chosen = { bars: true, level: chosen.level };
      root.classList.toggle('no-bars', had.noBars);
      area.classList.toggle('compact', had.compact);
      list?.style.setProperty('--cols', had.cols);
    }
    setFit(old => (old.bars === chosen.bars && old.level === chosen.level ? old : chosen));
  };
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    solve.current();
  }, [key, frozen, count]);
  useLayoutEffect(() => {
    const root = bm.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let live = true;
    // Si rifà quando cambia la misura della scheda o di una voce (font e icone che arrivano dopo, testo che va a capo);
    // le prove tornano sempre alla stessa scelta, quindi dopo un giro si ferma
    const observer = new ResizeObserver(() => solve.current());
    observer.observe(root);
    root.querySelectorAll('.bm-row, .bm-grade').forEach(el => observer.observe(el));
    document.fonts?.ready.then(() => { if (live) solve.current(); });
    return () => { live = false; observer.disconnect(); };
  }, [bm, key]);
  return { bars: fit.bars, density: options[Math.min(fit.level, options.length - 1)] };
}

/**
 * Una voce: medaglia, nome, caso concreto per intero (va a capo quanto serve) e punti. Solo nelle carte compatte (team con
 * tantissime voci su schermi bassi) il caso non si vede: un pulsante steso sulla carta lo apre e lo richiude.
 */
function Entry({ row, index, open, compact, onToggle, t }: { row: ActiveRow; index: number; open: boolean; compact: boolean; onToggle: () => void; t: T }) {
  const { entry, points, details } = row;
  const long = compact || open;
  return (
    <li className={`bm-row ${entry.kind}${open ? ' open' : ''}${long ? ' long' : ''}`}>
      {/* Le medaglie entrano una dopo l'altra (--i: il ritardo) quando si apre la scheda */}
      <Medal entry={entry} style={{ '--i': index } as CSSProperties} />
      <span className="bm-row-tx">
        <b>{entry.name}</b>
        <span className="bm-row-case">
          {details.map((detail, i) => <span key={i}>{i > 0 && ' · '}<Typed text={detail} /></span>)}
        </span>
        {long && (
          <button type="button" className="bm-row-toggle" aria-expanded={open} aria-label={t('catalogue.showAll', { name: entry.name })} onClick={onToggle}>
            <span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
        )}
      </span>
      <span className="bm-row-pts">{signed(entry.kind === 'malus' ? -points : points)}</span>
    </li>
  );
}

/**
 * La scheda Bonus/Malus. In alto: a sinistra la carta dei core a tre (sempre della stessa misura), a destra il netto sul
 * voto con bonus e malus in tutto (core compresi), le barre (solo se c'è posto) e il link al catalogo con tutte le voci
 * possibili (la guida della scheda). Sotto, due schede, Bonus e Malus (prima i bonus se ce ne sono), e le voci della scheda
 * scelta a tutta larghezza, ognuna con la sua medaglia.
 */
export function BonusMalusView({ rating, lang, t, onCatalogue }: { rating: TeamRating; lang: Lang; t: T; onCatalogue?: () => void }) {
  const catalog = bonusMalusCatalog(lang);
  const groups = (['bonus', 'malus'] as const)
    .map(kind => ({ kind, rows: activeRows(catalog, kind, kind === 'bonus' ? rating.bonus.items : rating.penalty.items) }));
  const any = groups.some(g => g.rows.length > 0);
  const net = rating.bonus.total - rating.penalty.total;
  const nothing = rating.bonus.total === 0 && rating.penalty.total === 0;
  const head = useId();
  const tabsId = useId();
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // La scheda scelta (null: i bonus se ce ne sono, altrimenti i malus) e la voce aperta per intero (una alla volta)
  const [picked, setPicked] = useState<'bonus' | 'malus' | null>(null);
  const kind = picked ?? (groups[0].rows.length ? 'bonus' : 'malus');
  const current = groups.find(g => g.kind === kind)!;
  const [open, setOpen] = useState<string | null>(null);
  const key = `${lang}|${kind}|${current.rows.map(r => `${r.key}:${r.details.join('|')}`).join(',')}|${rating.cores?.length ?? 0}`;
  const { bars, density } = useFitEntries(root, key, open !== null, current.rows.length);
  const hasCores = (rating.cores?.length ?? 0) > 0;
  const label = (k: 'bonus' | 'malus') => (k === 'bonus' && hasCores ? t('catalogue.otherBonus') : t(`catalogue.${k}`));
  const pick = (k: 'bonus' | 'malus') => { setPicked(k); setOpen(null); };
  // Frecce, Home e End fra le due schede
  const onKey = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + 2) % 2;
    pick(groups[next].kind);
    tabRefs.current[next]?.focus();
  };
  return (
    <div className={`bm${any ? '' : ' empty'}${open ? ' expanded' : ''}${bars ? '' : ' no-bars'}`} ref={root}>
      <section className="bm-grade" aria-labelledby={head}>
        <div className="bm-sum">
          <h4 id={head} className="bm-label">{t('catalogue.onGrade')}</h4>
          {/* Il risultato della scheda su una sua targhetta inclinata, nel colore del segno */}
          <p className={`bm-net ${net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}`}><span>{signed(net)}</span></p>
          {nothing ? <p className="bm-parts">{t('catalogue.none')}</p> : (
            <p className="bm-parts">
              <span>{t('catalogue.bonus')} <b className={rating.bonus.total ? 'good' : undefined}>{signed(rating.bonus.total)}</b></span>
              <span>{t('catalogue.malus')} <b className={rating.penalty.total ? 'bad' : undefined}>{signed(-rating.penalty.total)}</b></span>
            </p>
          )}
        </div>
        {/* Sempre nella pagina; senza posto le nasconde la classe no-bars (così si possono provare le due sistemazioni) */}
        <Bars bonus={rating.bonus.total} malus={rating.penalty.total} t={t} />
        {onCatalogue && <button type="button" className="bm-more" onClick={onCatalogue}>{t('catalogue.all')} <span aria-hidden="true">›</span></button>}
      </section>
      <CoreColumn rating={rating} lang={lang} t={t} />
      {any && (
        <div className="bm-entries-wrap">
          <div className="bm-tabs" role="tablist" aria-label={t('catalogue.entries')}>
            {groups.map((g, i) => {
              const total = g.rows.reduce((n, r) => n + r.points, 0);
              return (
                <button key={g.kind} ref={el => { tabRefs.current[i] = el; }} type="button" role="tab" id={`${tabsId}-${g.kind}`}
                  className={`bm-tab ${g.kind}${g.rows.length ? '' : ' none'}`} aria-selected={g.kind === kind} aria-controls={`${tabsId}-panel`}
                  tabIndex={g.kind === kind ? 0 : -1} onClick={() => pick(g.kind)} onKeyDown={e => onKey(e, i)}>
                  <span>{label(g.kind)}</span>
                  <i className="bm-tab-count">{g.rows.length}</i>
                  <b>{signed(g.kind === 'malus' ? -total : total)}</b>
                </button>
              );
            })}
          </div>
          <div className={`bm-entries${density.compact ? ' compact' : ''}`} role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${kind}`}>
            {current.rows.length === 0 ? (
              <p className="bm-entries-none">{t(kind === 'bonus' ? 'catalogue.noBonus' : 'catalogue.noMalus')}</p>
            ) : (
              <ul className="bm-list" style={{ '--cols': density.cols } as CSSProperties}>
                {current.rows.map((row, i) => (
                  <Entry key={row.key} row={row} index={i} open={open === row.key} compact={density.compact} t={t}
                    onToggle={() => setOpen(o => (o === row.key ? null : row.key))} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
