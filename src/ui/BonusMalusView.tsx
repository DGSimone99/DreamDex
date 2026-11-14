import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import type { Lang } from '../i18n';
import { typeName } from '../i18n/game';
import type { Core } from '../engine/cores';
import { bonusMalusCatalog, CORE_TRIO_POINTS, type CatalogEntry, type CatalogKey, type Redundancy, type TeamRating } from '../engine/rating';
import { useT } from '../i18n/react';
import { CoreArt } from './dashboard/CoreTriangle';
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

function activeRows(catalog: CatalogEntry[], kind: CatalogEntry['kind'], items: Redundancy[], cores: Core[] = [], rank: (core: Core) => number = () => 0): ActiveRow[] {
  return catalog.filter(e => e.kind === kind).flatMap(entry => {
    const own = items.filter(i => i.catalog === entry.key && i.points > 0);
    if (!own.length) return [];
    // Ogni trio è una medaglia a sé: si vede quale trio vale i suoi punti
    // Ogni trio è una medaglia a sé, coi soli nomi dei tre (i core sono nello stesso ordine del bonus), nell'ordine
    // della colonna dei core (prima quello che regge più tipi)
    if (entry.key === 'coreTrio') {
      return own.map((item, i) => ({ item, core: cores[i], i }))
        .sort((a, b) => (a.core && b.core ? rank(a.core) - rank(b.core) : 0))
        .map(({ item, core, i }) => ({ key: `${entry.key}:${i}`, entry, points: item.points, details: [core?.members.join(', ') ?? detailOf(item, entry.name)] }));
    }
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

/** La colonna dei core a tre: due a fisarmonica (aperto quello che regge più tipi), uno aperto, nessuno con due righe su come averlo. */
function CoreColumn({ rating, lang, t }: { rating: TeamRating; lang: Lang; t: T }) {
  const head = useId();
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
  if (!cores.length) {
    return (
      <section className="bm-cores" aria-labelledby={head}>
        <h4 id={head} className="bm-label">{t('catalogue.cores.one')}</h4>
        <div className="bm-cores-none">
          <Medal entry={{ key: 'coreTrio', kind: 'bonus' }} className="off" />
          <p><b>{t('catalogue.cores.none')}</b>{t('catalogue.cores.how')}</p>
        </div>
      </section>
    );
  }
  const two = cores.length > 1;
  return (
    <section className="bm-cores" aria-labelledby={head}>
      <h4 id={head} className="bm-label">{t(two ? 'catalogue.cores.two' : 'catalogue.cores.one')}</h4>
      <ul className={`bm-core-row${two ? ' two' : ''}`}>
        {cores.map((core, i) => (
          <CoreCard key={keyOf(core)} core={core} open={i === openIndex} held={held[i]} total={rows.length} toggle={two}
            onOpen={() => setPicked(keyOf(core))} lang={lang} t={t} />
        ))}
      </ul>
      {two && <p className="bm-hint">{t('catalogue.cores.hint')}</p>}
    </section>
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

/**
 * Le barre solo se c'è posto: con le barre la riga in alto può crescere e togliere spazio alle voci. Se le voci non
 * stanno più si nascondono; tornano quando lo spazio libero sotto le voci basta a riprenderle (misura prima del disegno,
 * niente sfarfallio). Senza ResizeObserver (test) restano.
 */
function useRoomForBars(bm: RefObject<HTMLDivElement | null>, key: string): boolean {
  const [shown, setShown] = useState(true);
  // Quanto in più chiedono le barre alla colonna di destra (misurato l'ultima volta che si vedevano)
  const need = useRef(0);
  useLayoutEffect(() => {
    const root = bm.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const list = root.querySelector<HTMLElement>('.bm-list');
      const grade = root.querySelector<HTMLElement>('.bm-grade');
      const bars = root.querySelector<HTMLElement>('.bm-bars');
      if (!grade) return;
      // Telefono: la pagina scorre, la lista non ha un'altezza sua: le barre restano
      const spare = list ? list.clientHeight - list.scrollHeight : root.clientHeight - root.scrollHeight;
      const top = root.querySelector<HTMLElement>('.bm-cores');
      if (bars) {
        need.current = bars.getBoundingClientRect().height + parseFloat(getComputedStyle(bars).marginTop || '0');
        if (spare < -1) setShown(false);
      } else {
        // Le barre allungano la riga in alto solo per quanto la colonna di destra supera quella dei core
        const row = Math.max(grade.getBoundingClientRect().height, top?.getBoundingClientRect().height ?? 0);
        const grow = Math.max(0, grade.getBoundingClientRect().height + need.current - row);
        if (spare >= grow + 2) setShown(true);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(root);
    return () => observer.disconnect();
  }, [bm, key, shown]);
  return shown;
}

/**
 * La scheda Bonus/Malus. In alto: a sinistra i core a tre che il voto conta, disegnati a triangolo; a destra il netto sul
 * voto con bonus e malus in tutto, le barre (solo se c'è posto) e il link al catalogo con tutte le voci possibili (la
 * guida della scheda). Sotto, a tutta larghezza, le voci che valgono adesso in tre colonne, ognuna con la sua medaglia
 * (icona della famiglia; il malus rosso e incrinato), il caso concreto e i punti.
 */
export function BonusMalusView({ rating, lang, t, onCatalogue }: { rating: TeamRating; lang: Lang; t: T; onCatalogue?: () => void }) {
  const catalog = bonusMalusCatalog(lang);
  const order = rankedCores(rating).map(r => r.core);
  const rows = [...activeRows(catalog, 'bonus', rating.bonus.items, rating.cores, core => order.indexOf(core)), ...activeRows(catalog, 'malus', rating.penalty.items)];
  const net = rating.bonus.total - rating.penalty.total;
  const head = useId();
  const root = useRef<HTMLDivElement>(null);
  const bars = useRoomForBars(root, `${lang}|${rows.map(r => `${r.key}:${r.details.join('|')}`).join(',')}|${rating.cores?.length ?? 0}`);
  return (
    <div className={`bm${rows.length ? '' : ' empty'}`} ref={root}>
      <section className="bm-grade" aria-labelledby={head}>
        <div className="bm-sum">
          <h4 id={head} className="bm-label">{t('catalogue.onGrade')}</h4>
          {/* Il risultato della scheda su una sua targhetta inclinata, nel colore del segno */}
          <p className={`bm-net ${net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}`}><span>{signed(net)}</span></p>
          {rows.length === 0 ? <p className="bm-parts">{t('catalogue.none')}</p> : (
            <p className="bm-parts">
              <span>{t('catalogue.bonus')} <b className={rating.bonus.total ? 'good' : undefined}>{signed(rating.bonus.total)}</b></span>
              <span>{t('catalogue.malus')} <b className={rating.penalty.total ? 'bad' : undefined}>{signed(-rating.penalty.total)}</b></span>
            </p>
          )}
        </div>
        {bars && <Bars bonus={rating.bonus.total} malus={rating.penalty.total} t={t} />}
        {onCatalogue && <button type="button" className="bm-more" onClick={onCatalogue}>{t('catalogue.all')} <span aria-hidden="true">›</span></button>}
      </section>
      <CoreColumn rating={rating} lang={lang} t={t} />
      {rows.length > 0 && (
        <ul className="bm-list" aria-labelledby={head}>
          {rows.map(({ key, entry, points, details }, i) => (
            <li key={key} className={`bm-row ${entry.kind}`}>
              {/* Le medaglie entrano una dopo l'altra (--i: il ritardo) quando si apre la scheda */}
              <Medal entry={entry} style={{ '--i': i } as CSSProperties} />
              <span className="bm-row-tx">
                <b>{entry.name}</b>
                <span title={details.join(' · ')}>{details.map((detail, i) => <span key={i}>{i > 0 && ' · '}{entry.key === 'coreTrio' ? detail : <Typed text={detail} />}</span>)}</span>
              </span>
              <span className="bm-row-pts">{signed(entry.kind === 'malus' ? -points : points)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
