import { useId, useState, type ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import { FloatTip, keyboardFocus, useFloatAnchor } from '../FloatTip';
import { GRID_CELLS, useRoving } from '../useRoving';
import { useMemberTip } from '../MemberCard';
import { typeColor } from '../Sprite';
import { PokemonIcon } from '../PokemonName';
import { offenseSlots } from './slots';
import { NARROW_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { TypeHitTip } from './TypeHitTip';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { MetaCount, MetaFrame, MetaOrderSwitch, type MetaOrder } from '../MetaFrame';
import { byThreat, byUsage } from '../../engine/overviewDashboard';
import { EffTag, effClass, effLabel, useColumnHover } from '../effTag';
import { FocusNote, inBand, koBandOf } from './KoBadges';

type Row = NonNullable<TeamOffense['coverageMeta']>['rows'][number];
type Bucket = 'ohko' | 'two' | 'three' | 'none';

/** Soglia di una casella dal danno %: OHKO da 100, 2HKO da 50, 3HKO da 34 (come la Coverage: un terzo dei PS). */
const bucket = (pct: number): Bucket => (pct >= 100 ? 'ohko' : pct >= 50 ? 'two' : pct >= 34 ? 'three' : 'none');
const TAG: Record<Bucket, string> = { ohko: 'OHKO', two: '2HKO', three: '3HKO', none: '' };
const KO_ORDER: Bucket[] = ['ohko', 'two', 'three'];
/** I PS che restano al bersaglio dopo il colpo, coi colori del gioco: verde oltre metà, giallo fino a 1/5, rosso sotto. */
export function HpLeft({ pct }: { pct: number }) {
  const t = useT();
  const left = Math.max(0, 100 - pct);
  const tone = left > 50 ? 'good' : left > 20 ? 'warn' : 'bad';
  return (
    <span className="cm-hp" aria-hidden="true" data-hp={t('common.hpBar')}>
      <span className="cm-hp-bar"><i className={tone} style={{ width: `${left}%` }} /></span>
    </span>
  );
}

/** Quanti membri lo mandano KO in due colpi col colpo semplice (Lo coprono, il numero della riga Team Coverage). */
const coveredCount = (row: Row) => (row.cells ?? []).filter(c => c.pct >= 50).length;
/** Quanti membri lo mandano KO in due colpi: 0 rosso, 1 giallo, da 2 verde. */
const coverTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

/**
 * Coverage meta dell'Offesa: i membri in riga (nello stesso punto delle altre schede), i Pokémon del meta in colonna,
 * 8 per pagina nell'ordine scelto sulla riga della legenda: Minaccia (prima chi nessuno manda KO in due colpi, poi chi uno
 * solo, poi gli altri, dentro il più usato: la regola della Panoramica) o Uso (il più usato). In ogni casella il danno % del colpo semplice (senza
 * Tera, Z e setup) colorato per soglia, con "setup N%" quando la danza cambia soglia; in fondo "Lo coprono" conta chi
 * lo manda KO in due colpi. Le pagine ("‹ 1/5 ›") stanno nella casella in alto a sinistra, al posto di "Pokémon";
 * in alto a destra la legenda dei colori, in fondo la riga Team Coverage (Lo coprono, la barra del team cliccabile). Sulla casella il tooltip DreamDex (minaccia, colpi, mossa, setup);
 * sulla sprite in testata la carta del Pokémon col suo set più usato.
 * In alto a sinistra ×2 (o ×4) se è superefficace la mossa che fa il danno della casella (il triangolino del setup sta in
 * alto a destra, quello del meteo del team in basso a destra); "Solo superefficaci" (`ctx.effOnly`) spegne le altre caselle.
 * Col puntatore la colonna si accende.
 */
export function OffenseMeta({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const hover = useColumnHover();
  const phone = useMediaQuery(NARROW_TABLES_QUERY);
  const tip = useFloatAnchor<{ species: string; m: number }>();
  const card = useMemberTip(400, undefined, true);
  // Tastiera: la griglia è un posto solo nel giro del Tab, le frecce vanno di casella in casella (col fuoco la colonna e il tooltip)
  const nav = useRoving<HTMLTableElement>(GRID_CELLS);
  const slots = offenseSlots(ctx.team, offense.members);
  const memberAt = (m: number): MemberOffense | null => (slots[m] === null ? null : offense.members[slots[m]!]);
  const onceName = (member: MemberOffense) => (member.oneUse
    ? member.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(member.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', member.oneUse.name, lang) })
    : null);
  // Aperta da una tessera della Generale: la riga del membro e le minacce di quella fascia accese, e prima nell'ordine
  // (così stanno nella prima pagina); il resto spento
  const focus = ctx.focus?.kind === 'meta' ? ctx.focus : null;
  const lit = (row: Row) => !!focus && inBand(Math.max(0, row.cells?.[focus.slot]?.pct ?? 0), focus.band);
  // Aperta da una minaccia della Panoramica: la sua colonna per prima (prima pagina) e accesa, le altre spente
  const threat = ctx.focus?.kind === 'threat' && ctx.focus.side === 'offense' ? ctx.focus.species : null;
  // Ordine scelto: Minaccia (prima chi nessuno manda KO in due colpi, poi chi uno solo, come la Panoramica) o Uso
  const [order, setOrder] = useState<MetaOrder>('threat');
  const all = offense.coverageMeta?.rows ?? [];
  const sorted = order === 'usage' ? byUsage(all) : byThreat(all, coveredCount);
  const rows = focus ? [...sorted.filter(lit), ...sorted.filter(r => !lit(r))]
    : threat ? [...sorted.filter(r => r.species === threat), ...sorted.filter(r => r.species !== threat)] : sorted;
  const covered = rows.filter(r => r.level > 0).length;
  // Per i lettori di schermo, prima della tabella: chi nessuno manda KO in due colpi (di tutte le pagine)
  const summaryId = useId();
  const open = sorted.filter(r => coveredCount(r) === 0).map(r => r.species);
  const only3 = rows.filter(r => r.level === 0 && (r.cells ?? []).some(c => c.pct >= 34)).length;
  const summary = (
    <>
      <span>{t('odetail.cm.targets', { n: rows.length })}</span>
      <MetaCount n={covered} tone="good" label={t('odetail.cm.covered')} />
      <MetaCount n={only3} tone="warn" label={t('odetail.cm.only3')} />
      <MetaCount n={rows.length - covered - only3} tone="bad" label={t('odetail.cm.uncovered')} />
    </>
  );

  const cell = (row: Row, m: number, k0: number) => {
    const c = row.cells?.[m];
    if (!c || c.pct < 0) return <td key={`${row.species}-${m}`} className={hover.cls(k0, `rob-cell ko-none${ctx.effOnly ? ' eff-dim' : ''}${focus || threat ? ' kf-dim' : ''}`)} {...hover.enter(k0)}>—</td>;
    const tag = effLabel(c.mult, 'offense');
    const k = bucket(c.pct);
    // Il triangolo del setup, come in Coverage tipi e nella Generale: solo se la danza fa salire di fascia fino al 2HKO o all'OHKO
    const rank = (pct: number | null) => (pct === null ? 0 : pct >= 100 ? 2 : pct >= 50 ? 1 : 0);
    const up = c.setupPct !== null && rank(c.setupPct) > rank(c.pct);
    // Il triangolo azzurro: il meteo o il campo di un compagno lo fa salire di fascia
    const teamUp = c.teamPct !== null && rank(c.teamPct) > rank(c.pct);
    // Solo coi due insieme (setup e meteo del team): tutti e due i triangoli, il tooltip dice che servono entrambi
    const bothUp = !up && !teamUp && c.comboPct !== null && rank(c.comboPct) > rank(c.pct);
    return (
      <td key={`${row.species}-${m}`} className={hover.cls(k0, `rob-cell ko-${k}${up || bothUp ? ' has-setup' : ''}${teamUp || bothUp ? ' has-team' : ''}${effClass(tag, 'offense', ctx.effOnly)}${focus ? (m === focus.slot && lit(row) ? ' kf-hit' : ' kf-dim') : threat ? (row.species === threat ? ' kf-hit' : ' kf-dim') : ''}`)}
        onMouseEnter={e => { hover.enter(k0).onMouseEnter(); tip.open({ species: row.species, m }, e.currentTarget); }} onMouseLeave={tip.close}
        onFocus={e => { hover.enter(k0).onFocus(); tip.focus({ species: row.species, m }).onFocus(e); }} onBlur={tip.close}>
        {/* In un colpo: il timbro KO al posto del numero; altrimenti il danno e sotto la barra dei PS che restano */}
        {k === 'ohko'
          ? <span className="cm-ko" aria-hidden="true">KO</span>
          : <><span className="wall-pct ct-num">{c.pct}<i>%</i></span><HpLeft pct={c.pct} /></>}
        {k === 'ohko' && <span className="visually-hidden">{c.pct}%</span>}
        {TAG[k] && <span className="visually-hidden"> {TAG[k]}</span>}
        {up && <span className="visually-hidden"> setup {c.setupPct}%</span>}
        <EffTag label={tag} side="offense" />
      </td>
    );
  };

  // Il tooltip della casella sotto il puntatore: la minaccia, i colpi, la mossa del membro e il setup
  const tipCell = (shown: Row[]) => {
    if (!tip.anchor) return null;
    const { species, m } = tip.anchor.key;
    const row = shown.find(r => r.species === species);
    const c = row?.cells?.[m];
    const member = memberAt(m);
    if (!row || !c || c.pct < 0 || !member) return null;
    const types = battleSpecies(row.set)?.types ?? [];
    return (
      <FloatTip rect={tip.anchor.rect} tone={typeColor((types[0] as string | undefined) ?? '')} className="tht">
        <TypeHitTip species={member.species} set={ctx.team[m]} target={species} hit={{ move: c.move, plainPct: c.pct, setupPct: c.setupPct, oncePct: null, teamPct: c.teamPct, teamVia: c.teamVia, teamMove: c.teamMove, comboPct: c.comboPct, comboMove: c.comboMove, plainRange: c.range, setupRange: c.setupRange, teamRange: c.teamRange, comboRange: c.comboRange }} setupMove={member.setupMove} onceName={onceName(member)} />
      </FloatTip>
    );
  };

  const body = (shown: Row[], pager: ReactNode) => (
    <div className={`def-frame off-frame def-walls cm-matrix${ctx.roomy ? ' roomy' : ''}${phone ? ' ct-flip' : ''}`}>
      <div className="ad-scroll">
        <p id={summaryId} hidden>{open.length ? t('sr.cm.offense', { list: open.join(', ') }) : t('sr.cm.offenseNone')}</p>
        {phone ? (
          // Telefono: la tabella girata, le minacce in riga (icona e filo di Lo coprono) e i membri in colonna, così sta in
          // larghezza senza scorrere di lato; le pagine sopra la tabella, in fondo a ogni riga quanti la coprono. Nelle caselle
          // il danno o il timbro KO (la barra dei PS è nel tooltip).
          <>
            <div className="cm-flip-pager">{pager}</div>
            <table ref={nav.ref} aria-label={`${t('area.strength')}: ${t('detail.coverageMeta')}`} aria-describedby={summaryId} className="def-grid spaced ct-table ct-flip-table"
              onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hover.clear(); }}>
              <thead>
                <tr>
                  <th scope="col" className="def-mon-h"><span className="visually-hidden">{t('flip.target')}</span></th>
                  {ctx.team.map((set, m) => {
                    const name = battleSpecies(set)?.name ?? set.species;
                    return (
                      <th key={`${name}-${m}`} scope="col" className={`ct-mon-h${focus && m === focus.slot ? ' kf-col' : ''}`}>
                        <span className="ct-mon-box" {...card.bind(set)}><PokemonIcon name={name} /></span>
                        <span className="visually-hidden">{name}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, k) => {
                  const n = coveredCount(r);
                  return (
                    <tr key={r.species}>
                      <th scope="row" aria-label={r.species} className={hover.cls(k, 'wall-h ct-type-h')} {...hover.enter(k)}>
                        <span className="def-box cm-head-mon" {...card.bind(r.set)}><PokemonIcon name={r.species} /></span>
                        <span className={`cm-flag ${coverTone(n)}`} aria-hidden="true" />
                      </th>
                      {ctx.team.map((_, m) => cell(r, m, k))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
        <table ref={nav.ref} aria-label={`${t('area.strength')}: ${t('detail.coverageMeta')}`} aria-describedby={summaryId} className="def-grid spaced ct-table"
          onMouseLeave={e => { hover.table.onMouseLeave(); tip.close(e); }} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hover.clear(); }}>
          <colgroup>
            <col className="def-col-mon" />
            {shown.map(r => <col key={r.species} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h cm-pager-h">{pager}</th>
              {shown.map((r, k) => {
                const n = coveredCount(r);
                return (
                  <th key={r.species} scope="col" aria-label={r.species} className={hover.cls(k, 'wall-h')} {...hover.enter(k)}
                    onFocus={e => { hover.enter(k).onFocus(); if (keyboardFocus(e.currentTarget)) card.bind(r.set).onFocus(e); }} onBlur={card.bind(r.set).onBlur}>
                    {/* Sulla sprite la carta del Pokémon col suo set più usato; sotto un filo col colore di Lo coprono */}
                    <span className="def-box cm-head-mon" {...card.bind(r.set)}><PokemonIcon name={r.species} /></span>
                    <span className={`cm-flag ${coverTone(n)}`} aria-hidden="true" />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, m) => {
              const name = battleSpecies(set)?.name ?? set.species;
              return (
                <tr key={`${name}-${m}`} className={focus ? (m === focus.slot ? 'kf-row' : 'kf-off') : undefined}>
                  <th scope="row" onMouseEnter={() => { hover.table.onMouseLeave(); tip.close(); }} onFocus={hover.clear}><MemberMon name={name} set={set} stats="offense" /></th>
                  {shown.map((r, k) => cell(r, m, k))}
                </tr>
              );
            })}
            {/* Riempie lo spazio che resta: la riga Team Coverage sta sempre in fondo, come nella Generale */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={shown.length + 1} /></tr>
          </tbody>
          {/* In fondo la riga Team Coverage, come nella Generale e allo stesso posto: nelle colonne quanti membri le coprono */}
          <tfoot>
            <tr className="og-total cm-total">
              <th scope="row" onMouseEnter={hover.table.onMouseLeave} onFocus={hover.clear}>
                <span className="og-plate">{t('odetail.gen.total')}</span>
                <span className="visually-hidden">{t('odetail.cm.coveredBy')}</span>
              </th>
              {shown.map((r, k) => {
                const n = coveredCount(r);
                return <td key={r.species} className={hover.cls(k)} {...hover.enter(k)}><span className={`ct-pill ${coverTone(n)}`}>{n}<span className="visually-hidden"> {t('odetail.cm.coveredBy')}</span></span></td>;
              })}
            </tr>
          </tfoot>
        </table>
        )}
      </div>
      {tipCell(shown)}
      {card.tip}
      <div className="rob-legend cm-foot"><MetaOrderSwitch order={order} onChange={setOrder} />{focus
        ? <FocusNote name={battleSpecies(ctx.team[focus.slot])?.name ?? ctx.team[focus.slot]?.species ?? ''} band={focus.band} onClear={ctx.clearFocus} />
        : threat ? <FocusNote name={threat} band="two" text={t('kob.focusThreat', { name: threat })} onClear={ctx.clearFocus} />
        : <span className="area-legend" aria-hidden="true"><OffenseMetaLegend /></span>}</div>
    </div>
  );

  return <MetaFrame rows={rows} summary={summary} body={body} resetKey={order}
    labels={{ pages: t('odetail.cm.pages'), prev: t('odetail.cm.prev'), next: t('odetail.cm.next'), page: (from, to) => t('odetail.cm.page', { from, to }) }} />;
}

/** La legenda dei colori di Coverage meta dell'Offesa, in alto a destra: le soglie e il segno del setup. */
function OffenseMetaLegend() {
  const t = useT();
  return (
    <>
      <span className="cm-ko small">KO</span>
      {KO_ORDER.filter(b => b !== 'ohko').map(b => <span key={b} className={`hold-chip ko-${b}`}>{TAG[b]}</span>)}
      <span className="wall-legend-setup"><i className="wall-tick" />{t('odetail.wall.legendSetup')}</span>
      <span className="wall-legend-setup"><i className="kob-tri team" />{t('kob.legendTeam')}</span>

    </>
  );
}
