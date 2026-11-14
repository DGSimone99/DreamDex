import { useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { TeamRating } from '../../engine/rating';
import { ESSENTIAL_POINTS, IMPORTANT_POINTS, MINOR_POINTS } from '../../engine/rolesArea';
import type { Level } from '../../engine/roleLevels';
import { useT } from '../../i18n/react';
import { signed, type AreaContext, type T } from '../AreaDetail';
import { Icon } from '../icons';
import { holderReason, keyLabel, RoleMon } from './RoleParts';
import { missingFirst, roleLines, rolePoints, rolesMalusOn, type RoleLine } from './rolesRows';

/** Le tre fasce della sottoscheda, in quest'ordine; le voci che non contano stanno solo nella guida. */
export const BANDS = ['essential', 'important', 'minor'] as const;
type Band = (typeof BANDS)[number];
const LEVEL_POINTS: Record<Band, number> = { essential: ESSENTIAL_POINTS, important: IMPORTANT_POINTS, minor: MINOR_POINTS };

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
 * La sottoscheda Ruoli di Ruoli e Bonus, in una schermata senza filtri. In alto con che tipo di team si giudica, la
 * targhetta coi punti (Essenziali + Importanti + Minori = Ruoli) e il link alla pagina della guida coi ruoli che non
 * contano. Sotto tre fasce, Essenziali, Importanti e Minori (una fascia senza voci per questo tipo di team non c'è), ognuna
 * col suo titolo, la regola e la sua somma, e le voci su due colonne, prima quelle che mancano. Ogni voce: nome, chi la
 * copre (uno solo: icona e nome; di più: solo le icone) e i punti (✓ / −4 / −2 / +1 / 0).
 * Con meno di 6 membri un ruolo che manca non toglie punti (rolesArea): si scrive "manca", non il malus.
 * Mai scorrere: se su uno schermo basso le fasce su due colonne non stanno, le voci vanno su tre (useThreeColumns).
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
  const three = useThreeColumns(frame, `${t('area.roles')}|${lines.map(l => `${l.key}${l.level}${l.missing}${l.by.length}`).join()}`);

  return (
    <div ref={frame} className={`rl-frame rl-general${three ? ' three' : ''}`}>
      <header className="rl-head">
        <p className="rl-judged" title={t(`archetype.${needs.archetype}.note`)}>
          {roles.members.length < 6 ? t('analysis.judgedIncomplete', { archetype }) : t('rdetail.judged', { archetype })}
        </p>
        {/* I punti dei Ruoli su una targhetta inclinata: le fasce sommate danno il totale */}
        <p className="rl-sum" aria-label={t('rdetail.sum')}>
          {bands.map((b, i) => (
            <span key={b.level} className="rl-sum-part">
              {i > 0 && <span className="rl-sum-op" aria-hidden="true">+</span>}
              {t(`rdetail.group.${b.level}`)} <SumMark sum={b.sum} t={t} />
            </span>
          ))}
          <span className="rl-sum-op" aria-hidden="true">=</span>
          <b className={`rl-net ${net > 0 ? 'good' : net < 0 ? 'bad' : 'zero'}`}>{t('area.roles')} {signed(net)}</b>
        </p>
        {ctx.guide && (
          <button type="button" className="rl-more" onClick={() => ctx.guide!('types')}>
            {t('rdetail.ignoredLink')} <span aria-hidden="true">›</span>
          </button>
        )}
      </header>
      <div className="rl-bands">
        {bands.map(b => <RoleBand key={b.level} level={b.level} rows={b.rows} sum={b.sum} full={full} rating={rating} ctx={ctx} />)}
      </div>
    </div>
  );
}

/** Una fascia: barra del titolo (nome, regola, somma) e le voci su due colonne. */
function RoleBand({ level, rows, sum, full, rating, ctx }: { level: Band; rows: RoleLine[]; sum: BandSum; full: boolean; rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const id = useId();
  const rule = level === 'minor' ? t('rdetail.rule.minor', { n: MINOR_POINTS }) : t('rdetail.rule.missing', { n: LEVEL_POINTS[level] });
  return (
    <section className={`rl-band ${level}`} aria-labelledby={id}>
      <h4 className="rl-band-head">
        <span id={id} className="rl-band-title">{t(`rdetail.group.${level}`)}</span>
        <small>{rule}</small>
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

/** Una voce: nome, chi la copre, i punti. */
function RoleRow({ line, full, rating, ctx }: { line: RoleLine; full: boolean; rating: TeamRating; ctx: AreaContext }) {
  const t = useT();
  const pool = t(rating.meta ? 'rdetail.pool.meta' : 'rdetail.pool.tier');
  const { kind, points } = rolePoints(line, full);
  const state = rowState(line.level, line.missing);
  const one = line.by.length === 1;
  return (
    <li className={`rl-row${state ? ` ${state}` : ''}`}>
      <span className="rl-name">{keyLabel(line.key, t)}</span>
      <span className="rl-by">
        {line.by.length === 0
          ? <span className="rl-nobody">{t('rdetail.nobody')}</span>
          : line.by.map(h => <RoleMon key={h.slot} h={h} t={t} named={one} why={holderReason(line.key, h, rating.roles, ctx.team, pool, t)} />)}
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
 * Le voci stanno su due colonne; se così le fasce scorrerebbero (tante voci, schermo basso) su tre. Si prova sul posto
 * prima del disegno (si toglie la classe, si misura, si rimette), e si rifà quando cambia la misura della scheda o
 * arrivano i font. Senza ResizeObserver (test): due colonne.
 */
function useThreeColumns(frame: RefObject<HTMLDivElement | null>, key: string): boolean {
  const [three, setThree] = useState(false);
  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let live = true;
    const solve = () => {
      const list = root.querySelector<HTMLElement>('.rl-bands');
      if (!live || !list) return;
      const had = root.classList.contains('three');
      root.classList.remove('three');
      const over = list.scrollHeight - list.clientHeight > 0;
      root.classList.toggle('three', had);
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
