import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import { t as translate, type Lang } from '../i18n';
import { typeName } from '../i18n/game';
import type { Core } from '../engine/cores';
import type { FormatRules } from '../engine/formatRules';
import { bonusMalusCatalog, CORE_TRIO_POINTS, type CatalogEntry, type CatalogKey, type Redundancy, type TeamRating } from '../engine/rating';
import { useT } from '../i18n/react';
import { CoreArt } from './dashboard/CoreTriangle';
import { DashCard } from './dashboard/DashCard';
import { FloatTip, HiddenText, useFloatAnchor } from './FloatTip';
import { shortCase } from './bonusMalusShort';
import { Typed } from './TypeText';
import { typeIconUrl } from './typeIcons';
import { useFitCount } from './useFit';

type T = ReturnType<typeof useT>;
// Lo zero senza segno, come sulla scheda e nella scheda del voto
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Famiglia di una voce: decide l'icona dentro la medaglia (una forma sola, l'icona cambia). */
type Family = 'types' | 'roles' | 'hazards' | 'conditions' | 'members' | 'core';
const FAMILY: Record<CatalogKey, Family> = {
  sharedWeak: 'types', sameType: 'types', defenseHole: 'types', unanswered: 'types', weakCovered: 'types', typeVariety: 'types',
  essentialRole: 'roles', importantRole: 'roles', pivotLink: 'roles',
  hazardDuplicate: 'hazards',
  weatherClash: 'conditions', weatherSabotage: 'conditions', unmetCondition: 'conditions', unusedEnabler: 'conditions', conditionUsed: 'conditions', weatherHelp: 'conditions', trickRoomFast: 'conditions',
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

/**
 * Una medaglia della griglia: la voce, il caso concreto e i punti. `short`: il caso corto, senza ripetizioni, da mostrare
 * solo se quello lungo (`details` con " · ") verrebbe tagliato; null se non c'è o non è più corto.
 */
interface ActiveRow { key: string; entry: CatalogEntry; points: number; details: string[]; short: string | null }

/**
 * Le voci dei Ruoli nel catalogo: nella scheda Bonus/Malus non ci sono (hanno i loro punti nella sottoscheda Ruoli, qui
 * sembrerebbero contare due volte); il catalogo della guida le elenca ancora.
 */
const ROLE_KEYS = new Set<CatalogKey>(['essentialRole', 'importantRole']);
const notRole = (item: Redundancy) => !item.catalog || !ROLE_KEYS.has(item.catalog);

/**
 * I totali della scheda Bonus/Malus, senza i punti dei ruoli: bonus, malus (positivo) e netto. Li usano la scheda e il
 * valore della sua sottoscheda grande ("Bonus/Malus +N").
 */
export function bonusMalusTotals(rating: Pick<TeamRating, 'bonus' | 'penalty'>): { bonus: number; malus: number; net: number } {
  const sum = (items: Redundancy[]) => items.filter(notRole).reduce((n, i) => n + i.points, 0);
  const bonus = sum(rating.bonus.items);
  const malus = sum(rating.penalty.items);
  return { bonus, malus, net: bonus - malus };
}

/** Il caso concreto senza il nome della voce davanti ("Core: X, Y, Z…" → "X, Y, Z…"). */
function detailOf(item: Redundancy, name: string): string {
  const prefix = `${name}:`.toLowerCase();
  const text = item.text.toLowerCase().startsWith(prefix) ? item.text.slice(prefix.length).trim().replace(/^./, c => c.toUpperCase()) : item.text;
  // E senza il nome dietro (una voce scritta "X: nome" → "X")
  const at = text.lastIndexOf(': ');
  return at > 0 && text.slice(at + 2).toLowerCase() === name.toLowerCase() ? text.slice(0, at) : text;
}

function activeRows(catalog: CatalogEntry[], kind: CatalogEntry['kind'], items: Redundancy[], lang: Lang): ActiveRow[] {
  // I core a tre stanno nella carta in alto col loro +3: non si ripetono fra le voci (contano nel netto e in "Bonus +N");
  // le voci dei ruoli non ci sono (stanno nella sottoscheda Ruoli)
  return catalog.filter(e => e.kind === kind && e.key !== 'coreTrio' && !ROLE_KEYS.has(e.key)).flatMap(entry => {
    const own = items.filter(i => i.catalog === entry.key && i.points > 0);
    if (!own.length) return [];
    const details = own.map(i => detailOf(i, entry.name));
    return [{ key: entry.key, entry, points: own.reduce((n, i) => n + i.points, 0), details, short: shortCase(entry.key, own, lang, details.join(' · ')) }];
  });
}

/** Tutte le voci attive in una lista sola: prima i malus, poi i bonus, ognuno dal più pesante; a parità l'ordine del catalogo. */
function orderedRows(catalog: CatalogEntry[], rating: TeamRating, lang: Lang): ActiveRow[] {
  const byPoints = (rows: ActiveRow[]) => rows.map((row, i) => ({ row, i })).sort((a, b) => b.row.points - a.row.points || a.i - b.i).map(x => x.row);
  return [...byPoints(activeRows(catalog, 'malus', rating.penalty.items, lang)), ...byPoints(activeRows(catalog, 'bonus', rating.bonus.items, lang))];
}

/** Una voce della riga Bonus/Malus del Riassunto della Panoramica: nome e punti col segno (i core a tre in una voce sola). */
export interface BonusMalusPiece { key: string; name: string; points: number; kind: CatalogEntry['kind'] }

/**
 * La riga Bonus/Malus del Riassunto: il netto (lo stesso della scheda, senza i ruoli) e le voci dalla più pesante (in
 * valore assoluto: "2 core +6", "Rete di sicurezza +1", "Tipi doppioni −1"); i core a tre sono una voce sola coi loro
 * punti insieme; a parità di peso prima i malus, come nella scheda, poi l'ordine del catalogo.
 */
export function bonusMalusLine(rating: TeamRating, lang: Lang): { net: number; pieces: BonusMalusPiece[] } {
  const catalog = bonusMalusCatalog(lang, rating.needs.rules);
  const rows = orderedRows(catalog, rating, lang);
  const cores = rating.bonus.items.filter(i => i.catalog === 'coreTrio').reduce((n, i) => n + i.points, 0);
  const coreCount = Math.round(cores / CORE_TRIO_POINTS);
  const pieces: BonusMalusPiece[] = [
    ...(cores > 0 ? [{ key: 'coreTrio', name: translate(lang, coreCount === 1 ? 'sum.bmCoresOne' : 'sum.bmCoresMany', { n: coreCount }), points: cores, kind: 'bonus' as const }] : []),
    ...rows.map(row => ({ key: row.key, name: row.entry.name, points: row.entry.kind === 'malus' ? -row.points : row.points, kind: row.entry.kind })),
  ];
  // sort è stabile: a parità di peso resta l'ordine della scheda (prima i malus, ognuno dal più pesante)
  const ordered = [...pieces].sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || Number(a.kind === 'bonus') - Number(b.kind === 'bonus'));
  return { net: bonusMalusTotals(rating).net, pieces: ordered };
}

/** Il nome di un core per la scheda: i tre tipi parati, nell'ordine del giro ("Acqua / Lotta / Psico"). */
const coreTypes = (core: Core, lang: Lang) => core.sides.map(side => typeName(side.type, lang)).join(' / ');

/** Quanti tipi d'attacco almeno uno dei tre regge (la stessa regola di "regge" della Coverage tipi della Difesa). */
function heldCount(core: Core, rows: { heldBy: string[] }[]): number {
  return rows.filter(row => row.heldBy.some(name => core.members.includes(name))).length;
}

type HoldRow = { type: string; heldBy: string[] };

/**
 * "Reggono N/18" nella testata del core: col mouse e col fuoco il tooltip DreamDex coi 18 tipi d'attacco come icone
 * (accese quelle che almeno uno dei tre regge, spente quelle che passano). Per i lettori di schermo la descrizione dice
 * quanti, quali reggono e quali passano.
 */
function HeldTypes({ core, rows, lang, t }: { core: Core; rows: HoldRow[]; lang: Lang; t: T }) {
  const tip = useFloatAnchor<true>();
  const descId = useId();
  const held = rows.filter(row => row.heldBy.some(name => core.members.includes(name)));
  const open = rows.filter(row => !held.includes(row));
  const names = (list: HoldRow[]) => list.map(row => typeName(row.type, lang)).join(', ');
  const count = t('catalogue.cores.held', { n: held.length, total: rows.length });
  const description = [
    held.length ? t('catalogue.cores.heldList', { types: names(held) }) : '',
    open.length ? t('catalogue.cores.through', { types: names(open) }) : '',
  ].filter(Boolean).join('. ');
  return (
    <>
      <span className="bm-core-held" tabIndex={0} aria-describedby={descId} {...tip.bind(true)}>
        {t('catalogue.cores.heldShort', { n: held.length, total: rows.length })}
      </span>
      <HiddenText id={descId}>{`${count}. ${description}`}</HiddenText>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone="var(--good)" className="kot bm-held-tip">
          <div className="kot-head"><b>{count}</b></div>
          <span className="bm-core-types">
            {rows.map(row => <img key={row.type} className={held.includes(row) ? 'on' : 'off'} src={typeIconUrl(row.type)} alt="" draggable={false} />)}
          </span>
          <p className="ftip-foot">{t('catalogue.cores.heldTip')}</p>
        </FloatTip>
      )}
    </>
  );
}

/** I core del voto dal primo (quello che regge più tipi) all'ultimo, coi tipi che reggono; a parità l'ordine del voto. */
function rankedCores(rating: TeamRating): { core: Core; held: number }[] {
  const rows = rating.defense?.coverageTypes?.rows ?? [];
  return (rating.cores ?? []).map(core => ({ core, held: heldCount(core, rows) })).sort((a, b) => b.held - a.held);
}

/** Il contenuto della guida: tutte le voci di un tipo (bonus o malus) con quando scattano e quanto valgono. */
export function CatalogueList({ lang, kind, rules }: { lang: Lang; kind: CatalogEntry['kind']; rules?: FormatRules }) {
  return (
    <ul className="bm-cat">
      {bonusMalusCatalog(lang, rules).filter(entry => entry.kind === kind).map(entry => (
        <li key={entry.key}>
          <Medal entry={entry} />
          <span className="bm-cat-tx"><b>{entry.name}</b><span>{entry.when}</span></span>
          <span className={`bm-cat-pts ${kind}`}>{entry.points}</span>
        </li>
      ))}
    </ul>
  );
}

/** Il posto di un core che manca: un triangolo tratteggiato con tre piedistalli vuoti. Decorativo. */
function GhostTriangle() {
  return (
    <svg className="bm-cores-ghost" viewBox="0 0 150 128" aria-hidden="true" focusable="false">
      <path d="M75 30 30 96h90z" />
      {[[75, 26], [24, 98], [126, 98]].map(([x, y]) => (
        <g key={`${x}-${y}`}><ellipse cx={x} cy={y + 12} rx="17" ry="5" /><circle cx={x} cy={y - 4} r="12" /></g>
      ))}
    </svg>
  );
}

/**
 * Un core della carta: aperto ha tutto, chiuso solo il triangolo, il suo nome e i suoi punti. Con due core affiancati
 * sono aperti tutti e due; solo se la carta è troppo stretta per due vanno a fisarmonica (allora ognuno è un pulsante).
 * I tipi che regge non sono nella carta: "Reggono N/18" nella testata apre il loro tooltip.
 */
function CoreCard({ core, open, rows, toggle, onOpen, lang, t }: {
  core: Core; open: boolean; rows: HoldRow[]; toggle: boolean; onOpen: () => void; lang: Lang; t: T;
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
        <h5>{title}{rows.length > 0 && <HeldTypes core={core} rows={rows} lang={lang} t={t} />}<span className="bm-core-pts">+{CORE_TRIO_POINTS}</span></h5>
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
      </div>
    </li>
  );
}

/**
 * Due posti affiancati (due core aperti, o il core e il posto del secondo), se la carta è larga abbastanza (la misura
 * minima per due la dice il CSS in --pair-min, perché cambia coi triangoli più piccoli degli schermi bassi) e se
 * affiancati il testo sta nell'altezza della carta (nomi lunghi che vanno a capo su uno schermo basso); altrimenti due
 * core vanno a fisarmonica e un core solo prende tutta la carta. `key`: i core del team (con altri core si riprova).
 * Senza ResizeObserver (test): non affiancati.
 */
function usePairFits(row: RefObject<HTMLUListElement | null>, on: boolean, key: string): boolean {
  const [wide, setWide] = useState(false);
  const [tall, setTall] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !on || typeof ResizeObserver === 'undefined') { setWide(false); return; }
    let last = -1;
    const check = () => {
      const need = parseFloat(getComputedStyle(el).getPropertyValue('--pair-min')) || Infinity;
      const width = Math.round(el.getBoundingClientRect().width);
      // Cambiata la misura della carta: si riprova anche ad affiancarli
      if (width !== last && last >= 0) setTall(null);
      last = width;
      setWide(width >= need);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [row, on]);
  const pair = on && wide && tall !== key;
  // Affiancati: se un testo esce dal fondo del suo core, per questi core si torna come prima
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !pair) return;
    const over = [...el.querySelectorAll<HTMLElement>('.bm-core')].some(core => {
      const body = core.querySelector<HTMLElement>('.bm-core-body');
      return !!body && body.getBoundingClientRect().bottom > core.getBoundingClientRect().bottom + 0.5;
    });
    if (over) setTall(key);
  });
  return pair;
}

/**
 * I core a tre in una carta come quelle della Panoramica, sempre della stessa misura (0, 1 o 2 core: la pagina non salta
 * cambiando team). Nella barra del titolo la medaglia del core (accesa con almeno un core, spenta senza) e a destra
 * quanti sono e quanto valgono. Due core affiancati, aperti tutti e due (prima quello che regge più tipi; a fisarmonica
 * solo se la carta è troppo stretta per due); un core solo e accanto, dove starebbe il secondo, il triangolo tratteggiato
 * con quanto varrebbe un altro core; nessuno: il triangolo tratteggiato e come averne uno, al centro.
 */
function CoreColumn({ rating, lang, t }: { rating: TeamRating; lang: Lang; t: T }) {
  const rows = rating.defense?.coverageTypes?.rows ?? [];
  // Per primo (e aperto all'inizio) il core che regge più tipi; l'ordine poi resta quello
  const cores = rankedCores(rating).map(r => r.core);
  // L'aperto si ricorda per membri: cambiando team torna quello che regge più tipi
  const [picked, setPicked] = useState<string | null>(null);
  const keyOf = (core: Core) => core.members.join('/');
  const found = cores.findIndex(core => keyOf(core) === picked);
  const openIndex = found >= 0 ? found : 0;
  const two = cores.length > 1;
  const row = useRef<HTMLUListElement>(null);
  const pair = usePairFits(row, cores.length > 0, cores.map(keyOf).join('|'));
  // La medaglia grande del core, appuntata sulla barra del titolo: accesa con almeno un core, spenta senza
  const icon = <Medal entry={{ key: 'coreTrio', kind: 'bonus' }} className={`bm-head-medal${cores.length ? '' : ' off'}`} />;
  // Il conto nel titolo ("2 Core") e i punti dentro la stessa targhetta, attaccata alla medaglia
  const title = cores.length === 0 ? t('catalogue.cores.title') : t(cores.length === 1 ? 'catalogue.cores.titleOne' : 'catalogue.cores.titleMany', { n: cores.length });
  const extra = cores.length ? <>{' '}<b className="bm-plate-pts">+{cores.length * CORE_TRIO_POINTS}</b></> : undefined;
  return (
    <DashCard title={title} titleExtra={extra} icon={icon} level="h4" className={`bm-cores${cores.length ? '' : ' none'}`}>
      {cores.length === 0 ? (
        <div className="bm-cores-none">
          <GhostTriangle />
          <p><b>{t('catalogue.cores.none')}</b>{t('catalogue.cores.how')}</p>
        </div>
      ) : (
        <ul ref={row} className={`bm-core-row${two ? ' two' : ''}${pair ? ' pair' : ''}`}>
          {cores.map((core, i) => (
            <CoreCard key={keyOf(core)} core={core} open={pair || i === openIndex} rows={rows} toggle={two && !pair}
              onOpen={() => setPicked(keyOf(core))} lang={lang} t={t} />
          ))}
          {/* Un core solo: dove con due starebbe il secondo, il suo posto vuoto e quanto varrebbe (solo se c'è posto) */}
          {!two && pair && (
            <li className="bm-core-ghost">
              <GhostTriangle />
              <p><b>{t('catalogue.cores.second', { n: CORE_TRIO_POINTS })}</b>{t('catalogue.cores.secondHow')}</p>
            </li>
          )}
        </ul>
      )}
    </DashCard>
  );
}

/** I punti di una voce col segno: i malus in negativo. */
const pointsOf = (row: ActiveRow) => signed(row.entry.kind === 'malus' ? -row.points : row.points);

/**
 * Il caso lungo verrebbe tagliato? Si disegna il lungo e, prima del disegno, se sborda (`ref`: la riga del caso, larga
 * quanto la medaglia, qualunque testo abbia) si passa al corto, ricordando quanto è largo il lungo. Quando la riga cambia
 * larghezza: col corto si resta corti finché il lungo non ci starebbe, altrimenti si rimisura il lungo (si confronta
 * sempre con la larghezza del lungo, non con quella del testo mostrato: niente avanti e indietro). Da capo quando cambia
 * `key` (il testo, la lingua) e quando arrivano i caratteri.
 */
function useShortIfCut(ref: RefObject<HTMLElement | null>, hasShort: boolean, key: string): boolean {
  const [cut, setCut] = useState({ key, short: false, longWidth: 0 });
  if (cut.key !== key) setCut({ key, short: false, longWidth: 0 });
  const short = hasShort && cut.key === key && cut.short;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !hasShort || short || cut.key !== key || !el.clientWidth) return;
    if (el.scrollWidth > el.clientWidth + 1) setCut({ key, short: true, longWidth: el.scrollWidth });
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasShort || typeof ResizeObserver === 'undefined') return;
    let last = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (!width || width === last) return;
      last = width;
      setCut(c => (c.short && width + 1 < c.longWidth ? c : { ...c, short: false, longWidth: 0 }));
    });
    observer.observe(el);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) setCut(c => (c.short ? { ...c, short: false, longWidth: 0 } : c)); });
    return () => { alive = false; observer.disconnect(); };
  }, [ref, hasShort]);

  return short;
}

/**
 * Una medaglia: medaglia, nome, il caso concreto su una riga e i punti. Il caso è quello lungo quando sta; se verrebbe
 * tagliato, quello corto senza ripetizioni (useShortIfCut); se non sta neanche il corto, i puntini. Col mouse e col fuoco
 * il tooltip DreamDex ha sempre il caso lungo, e anche i lettori di schermo leggono sempre il lungo.
 */
function Entry({ row, index }: { row: ActiveRow; index: number }) {
  const { entry, details } = row;
  const tip = useFloatAnchor<true>();
  const caseRef = useRef<HTMLSpanElement>(null);
  const long = details.join(' · ');
  const short = useShortIfCut(caseRef, !!row.short, `${long}|${row.short ?? ''}`) && row.short;
  return (
    <li className={`bm-row ${entry.kind}`} tabIndex={0} {...tip.bind(true)}>
      {/* Le medaglie entrano una dopo l'altra (--i: il ritardo) quando si apre la scheda */}
      <Medal entry={entry} style={{ '--i': index } as CSSProperties} />
      <span className="bm-row-tx">
        <b>{entry.name}</b>
        {/* Sempre la stessa riga (la osserva useShortIfCut), col corto o col lungo dentro; col corto il lungo resta per i lettori di schermo */}
        <span ref={caseRef} className={`bm-row-case${short ? ' short' : ''}`} aria-hidden={short ? true : undefined}>
          {short ? <Typed text={short} /> : details.map((detail, i) => <span key={i}>{i > 0 && ' · '}<Typed text={detail} /></span>)}
        </span>
        {short && <span className="visually-hidden">{long}</span>}
      </span>
      <span className="bm-row-pts">{pointsOf(row)}</span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={entry.kind === 'malus' ? 'var(--bad)' : 'var(--good)'} className="kot bm-row-tip">
          <div className="kot-head"><b>{entry.name}</b><em className={`bm-tip-pts ${entry.kind}`}>{pointsOf(row)}</em></div>
          {details.map((detail, i) => <p key={i} className="kot-none"><Typed text={detail} /></p>)}
        </FloatTip>
      )}
    </li>
  );
}

/**
 * L'ultima casella quando le medaglie non stanno tutte: "+N altre", tratteggiata; le voci nascoste (nome, punti e caso)
 * nel tooltip DreamDex col mouse e col fuoco, e nel testo per i lettori di schermo.
 */
function MoreEntries({ hidden, t }: { hidden: ActiveRow[]; t: T }) {
  const tip = useFloatAnchor<true>();
  const line = (row: ActiveRow) => `${row.entry.name} ${pointsOf(row)}: ${row.details.join(' · ')}`;
  return (
    <li className="bm-more-cell" tabIndex={0} {...tip.bind(true)}>
      <span aria-hidden="true">{t('catalogue.more', { n: hidden.length })}</span>
      <span className="visually-hidden">{t('catalogue.moreSr', { n: hidden.length })} {hidden.map(line).join('; ')}</span>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={hidden.some(row => row.entry.kind === 'malus') ? 'var(--bad)' : 'var(--good)'} className="kot bm-row-tip">
          {hidden.map(row => (
            <p key={row.key} className="kot-none bm-more-line">
              <b>{row.entry.name}</b> <em className={`bm-tip-pts ${row.entry.kind}`}>{pointsOf(row)}</em>
              <span><Typed text={row.details.join(' · ')} /></span>
            </p>
          ))}
        </FloatTip>
      )}
    </li>
  );
}

/**
 * La scheda Bonus/Malus. In alto: a sinistra la carta dei core a tre (sempre della stessa misura), a destra il netto sul
 * voto, bonus e malus in tutto (core compresi) e il link al catalogo con tutte le voci possibili (la guida della scheda).
 * Sotto, a tutta larghezza, tutte le altre voci come medaglie (prima i malus, poi i bonus, ognuno dal più pesante), tre
 * per riga (due se la scheda è stretta); se non stanno tutte nell'altezza, l'ultima casella è "+N altre" (useFitCount:
 * mai una barra di scorrimento). I ruoli non ci sono, né fra le voci né nei totali (bonusMalusTotals): hanno i loro punti
 * nella sottoscheda Ruoli.
 */
export function BonusMalusView({ rating, lang, t, onCatalogue }: { rating: TeamRating; lang: Lang; t: T; onCatalogue?: () => void }) {
  const rows = orderedRows(bonusMalusCatalog(lang, rating.needs.rules), rating, lang);
  const totals = bonusMalusTotals(rating);
  const net = totals.net;
  const nothing = totals.bonus === 0 && totals.malus === 0;
  const head = useId();
  const othersHead = useId();
  const list = useRef<HTMLUListElement>(null);
  const key = `${lang}|${rows.map(r => `${r.key}:${r.points}:${r.details.join('|')}`).join(',')}|${rating.cores?.length ?? 0}`;
  // Quante medaglie stanno: se non tutte, una casella va a "+N altre" (la conta useFitCount, togliendone una alla volta)
  const fit = useFitCount(list, rows.length, key);
  const shown = fit < rows.length ? rows.slice(0, Math.max(0, fit)) : rows;
  const hidden = rows.slice(shown.length);
  return (
    <div className={`bm${rows.length ? '' : ' empty'}`}>
      <section className="bm-grade" aria-labelledby={head}>
        <h4 id={head} className="bm-label">{t('catalogue.onGrade')}</h4>
        {/* Il risultato della scheda su una sua targhetta inclinata, nel colore del segno (rosso se toglie punti) */}
        <p className={`bm-net ${net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}`}><span>{signed(net)}</span></p>
        {nothing ? <p className="bm-parts">{t('catalogue.none')}</p> : (
          <p className="bm-parts">
            <span>{t('catalogue.bonus')} <b className={totals.bonus ? 'good' : undefined}>{signed(totals.bonus)}</b></span>
            <span aria-hidden="true">·</span>
            <span>{t('catalogue.malus')} <b className={totals.malus ? 'bad' : undefined}>{signed(-totals.malus)}</b></span>
          </p>
        )}
        {onCatalogue && <button type="button" className="bm-more" onClick={onCatalogue}>{t('catalogue.all')} <span aria-hidden="true">›</span></button>}
      </section>
      <CoreColumn rating={rating} lang={lang} t={t} />
      {rows.length > 0 && (
        <section className="bm-others" aria-labelledby={othersHead}>
          <h4 id={othersHead} className="bm-label">{t('catalogue.others')}</h4>
          <ul ref={list} className="bm-list">
            {shown.map((row, i) => <Entry key={row.key} row={row} index={i} />)}
            {hidden.length > 0 && <MoreEntries hidden={hidden} t={t} />}
          </ul>
        </section>
      )}
    </div>
  );
}
