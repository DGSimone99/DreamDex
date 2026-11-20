import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { TeamRating } from '../../engine/rating';
import type { Level } from '../../engine/roleLevels';
import { useT } from '../../i18n/react';
import { signed, type AreaContext, type T } from '../AreaDetail';
import { Icon } from '../icons';
import { holderReason, keyLabel, RoleMon } from './RoleParts';
import { missingFirst, roleLines, rolePoints, rolesMalusOn, type RoleLine } from './rolesRows';

/** Le tre fasce della sottoscheda, in quest'ordine; le voci che non contano stanno solo nella guida. */
export const BANDS = ['essential', 'important', 'minor'] as const;
type Band = (typeof BANDS)[number];

/** Il segno di una fascia: ✓ se non manca niente, −N di malus, "N mancano" senza malus (meno di 6), +N / 0 dei minori. */
interface BandSum { kind: 'ok' | 'malus' | 'missing' | 'bonus' | 'zero'; points: number; missing: number }
function bandSum(level: Band, lines: RoleLine[], full: boolean): BandSum {
  const missing = lines.filter(l => l.missing).length;
  const points = lines.reduce((n, l) => n + rolePoints(l, full).points, 0);
  if (level === 'minor') return { kind: points > 0 ? 'bonus' : 'zero', points, missing };
  return { kind: missing === 0 ? 'ok' : full ? 'malus' : 'missing', points, missing };
}

/** Il segno di una fascia scritto: spunta, punti col segno o quanti mancano (per lo screen reader a parole). */
function SumMark({ sum, t }: { sum: BandSum; t: T }) {
  if (sum.kind === 'ok') return <b className="rl-mark ok"><Icon name="check" /><span className="visually-hidden">{t('rdetail.noneMissing')}</span></b>;
  if (sum.kind === 'missing') return <b className="rl-mark missing" title={t('rdetail.noMalusYet')}>{t(sum.missing === 1 ? 'rating.rolesMissingOne' : 'rating.rolesMissing', { n: sum.missing })}</b>;
  return <b className={`rl-mark ${sum.kind}`}>{signed(sum.points)}</b>;
}

/**
 * La sottoscheda Ruoli di Ruoli e Bonus, in una schermata senza filtri. In alto il tipo di team con cui si giudica (sulla
 * sua targa, come nella carta del voto; "team incompleto" accanto se mancano membri), i punti dei Ruoli e il link "Tabella dei
 * ruoli" alla pagina della guida Ruoli per tipo di team. Sotto tre fasce, Essenziali, Importanti e Minori (una fascia senza voci per
 * questo tipo di team non c'è), ognuna col suo titolo e il suo valore, e le voci su due colonne, prima quelle che mancano. Ogni voce: nome, chi la
 * copre (uno solo: icona e nome; di più: solo le icone) e i punti (✓ / −4 / −2 / +1 / 0).
 * Con meno di 6 membri un ruolo che manca non toglie punti (rolesArea): si scrive "manca", non il malus.
 * Una griglia sola per tutte le fasce: colonne uguali, e dentro ogni voce le stesse piste (nome largo quanto il nome più
 * lungo di tutte le fasce, chi la copre, punti a larghezza fissa), così nomi, icone e punti stanno in colonna dappertutto.
 * Le righe si allungano fino a riempire il pannello (con un tetto), come la tabella dei ruoli in Panoramica.
 * Mai scorrere: se su uno schermo basso le fasce su due colonne non stanno, le voci vanno su tre (useRolesLayout).
 */
export function RolesGeneral({ rating, ctx }: { rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const { roles, needs } = rating;
  const full = rolesMalusOn(roles);
  const lines = roleLines(rating);
  const bands = BANDS.map(level => {
    const rows = lines.filter(l => l.level === level);
    return { level, rows: missingFirst(rows), sum: bandSum(level, rows, full) };
  }).filter(b => b.rows.length > 0);
  const net = roles.bonuses.reduce((n, b) => n + b.points, 0) - roles.failures.reduce((n, f) => n + f.points, 0);
  const archetype = t(`archetype.${needs.archetype}`);
  const frame = useRef<HTMLDivElement>(null);
  const three = useRolesLayout(frame, `${t('area.roles')}|${lines.map(l => `${l.key}${l.level}${l.missing}${l.by.length}`).join()}`);

  return (
    <div ref={frame} className={`rl-frame rl-general${three ? ' three' : ''}`}>
      <header className="rl-head">
        {/* Il tipo di team come titolo, sulla targa obliqua della carta del voto; poi i punti dei Ruoli */}
        <p className="rl-title">
          <span className="rl-type" title={t(`archetype.${needs.archetype}.note`)}><span>{archetype}</span></span>
          {roles.members.length < 6 && <small className="rl-incomplete">{t('rdetail.incomplete')}</small>}
        </p>
        <p className={`rl-net ${net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}`}>{t('area.roles')} <b>{signed(net)}</b></p>
        {ctx.guide && (
          <button type="button" className="rl-more" onClick={() => ctx.guide!('types')}>
            {t('rdetail.rolesTableLink')} <span aria-hidden="true">›</span>
          </button>
        )}
      </header>
      <div className="rl-bands">
        {bands.map(b => <RoleBand key={b.level} level={b.level} rows={b.rows} sum={b.sum} full={full} rating={rating} ctx={ctx} />)}
      </div>
    </div>
  );
}

/**
 * Una fascia: il titolo (segno nel colore del livello, nome, valore della fascia) e le voci su due colonne.
 * `--n2` / `--n3` = righe della fascia su due o tre colonne: lo spazio libero si divide in parti uguali per riga
 * (flex-grow) fino al tetto.
 */
function RoleBand({ level, rows, sum, full, rating, ctx }: { level: Band; rows: RoleLine[]; sum: BandSum; full: boolean; rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const id = useId();
  return (
    <section className={`rl-band ${level}`} aria-labelledby={id} style={{ '--n2': Math.ceil(rows.length / 2), '--n3': Math.ceil(rows.length / 3) } as CSSProperties}>
      <h4 className="rl-band-head">
        <span id={id} className="rl-band-title">{t(`rdetail.group.${level}`)}</span>
        <SumMark sum={sum} t={t} />
      </h4>
      <ul className="rl-rows">
        {rows.map(l => <RoleRow key={l.key} line={l} full={full} rating={rating} ctx={ctx} />)}
      </ul>
    </section>
  );
}

/** Lo stato di una riga per il colore: essenziale che manca rossa, importante gialla, minore scoperto spento. */
const rowState = (level: Level, missing: boolean) => (!missing ? '' : level === 'essential' ? 'bad' : level === 'important' ? 'warn' : 'off');

/**
 * Una voce: nome, chi la copre, i punti. Una voce che manca dice "Nessuno". Solo il DoT si somma: se lo coprono più
 * membri insieme il tooltip della riga lo dice ("Insieme: Toxapex (Scald), …"); se la somma non basta, chi contribuisce
 * sta nel tooltip ("in parte: …"). Niente percentuali.
 */
function RoleRow({ line, full, rating, ctx }: { line: RoleLine; full: boolean; rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const { kind, points } = rolePoints(line, full);
  const state = rowState(line.level, line.missing);
  const one = line.by.length === 1 && !line.together;
  const list = line.by.map(h => (h.source && h.source !== 'set' ? `${h.species} (${h.source})` : h.species)).join(', ');
  const partly = line.missing && line.by.length > 0 ? t('rdetail.partly', { list }) : undefined;
  const together = line.together ? t('rdetail.together', { list }) : undefined;
  return (
    <li className={`rl-row${state ? ` ${state}` : ''}`} title={partly ?? together}>
      <span className="rl-name">{keyLabel(line.key, t)}</span>
      <span className="rl-by">
        {line.missing || line.by.length === 0
          ? <span className="rl-nobody">{t('rdetail.nobody')}{partly && <span className="visually-hidden">; {partly}</span>}</span>
          : line.by.map(h => <RoleMon key={h.slot} h={h} t={t} named={one} why={holderReason(line.key, h, rating.roles, ctx.team, t)} />)}
          {together && <span className="visually-hidden">; {together}</span>}
      </span>
      <span className={`rl-pts ${kind}`} title={kind === 'malus' ? t('rdetail.missingTip', { n: -points }) : kind === 'missing' ? t('rdetail.noMalusYet') : undefined}>
        {kind === 'ok' && <><Icon name="check" /><span className="visually-hidden">{t('rdetail.pts.covered')}</span></>}
        {kind === 'malus' && <><span className="visually-hidden">{t('rdetail.pts.missing')} </span>{signed(points)}</>}
        {kind === 'missing' && t('rdetail.pts.missing')}
        {kind === 'bonus' && <><span className="visually-hidden">{t('rdetail.pts.covered')} </span>{signed(points)}</>}
        {kind === 'zero' && <><span className="visually-hidden">{t('rdetail.pts.notCovered')} </span>0</>}
      </span>
    </li>
  );
}

/**
 * La misura delle voci, provata sul posto prima del disegno e rifatta quando cambia la misura della scheda o arrivano i
 * font. Le voci stanno su due colonne; se così le fasce scorrerebbero (tante voci, schermo basso) su tre. In ogni caso la
 * pista dei nomi (`--rl-name`) è larga quanto il nome più lungo di tutte le fasce, così le colonne si allineano tra le
 * fasce. Senza ResizeObserver (test): due colonne, la larghezza di riserva del CSS.
 */
function useRolesLayout(frame: RefObject<HTMLDivElement | null>, key: string): boolean {
  const [three, setThree] = useState(false);
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let live = true;
    // Il nome si stringe sul suo testo (justify-self: start): scrollWidth è la sua larghezza piena anche se la pista è stretta
    const fitNames = () => {
      const widest = Math.max(0, ...[...root.querySelectorAll<HTMLElement>('.rl-name')].map(n => n.scrollWidth));
      if (widest > 0) root.style.setProperty('--rl-name', `${Math.ceil(widest) + 1}px`);
    };
    const solve = () => {
      const list = root.querySelector<HTMLElement>('.rl-bands');
      if (!live || !list) return;
      root.classList.remove('three');
      fitNames();
      const over = list.scrollHeight - list.clientHeight > 0;
      if (over) { root.classList.add('three'); fitNames(); }
      setThree(over);
    };
    solve();
    const observer = new ResizeObserver(solve);
    observer.observe(root);
    document.fonts?.ready.then(solve);
    return () => { live = false; observer.disconnect(); };
  }, [frame, key]);
  return three;
}
