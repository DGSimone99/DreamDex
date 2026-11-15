import { cardRoles } from '../../engine/archetype';
import { battleSpecies } from '../../engine/dex';
import { formatRules } from '../../engine/formatRules';
import type { SubRoleValues } from '../../engine/subRoles';
import { roleLabel } from '../../engine/roles';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { KoBadges, koBands, Target, type KoTarget } from './KoBadges';
import { offenseSlots } from './slots';
import { linkTeamCard } from '../teamLink';
import { useEffect, type CSSProperties } from 'react';

/** Le etichette delle tessere, una volta sola nella testata e allineate sopra di loro: OHKO e 2HKO. */
const KoSub = () => <span className="kob-sub" aria-hidden="true"><i>OHKO</i><i>2HKO</i></span>;

/** I 18 tipi di un membro come bersagli: colpo semplice, dopo una danza, con Tera/Z. */
const typeTargets = (m: MemberOffense): KoTarget[] =>
  m.hits.map(h => ({ label: h.label, kind: 'type', plain: h.plainPct, setup: h.setupPct, once: h.oncePct }));

/**
 * Le minacce del meta per il membro nella casella `slot` (le caselle della Coverage meta seguono il team): colpo semplice
 * e dopo una danza; -1 (membro sconosciuto) conta come niente.
 */
const metaTargets = (offense: TeamOffense, slot: number): KoTarget[] =>
  (offense.coverageMeta?.rows ?? []).map(row => {
    const cell = row.cells?.[slot];
    return { label: row.species, kind: 'mon', plain: Math.max(0, cell?.pct ?? 0), setup: cell?.setupPct ?? null, once: null };
  });

/** Il team su ogni bersaglio: il membro che colpisce più forte (semplice, e col setup se qualcuno ne ha uno). */
const teamTargets = (per: KoTarget[][]): KoTarget[] =>
  (per[0] ?? []).map((first, i) => {
    const plain = Math.max(...per.map(list => list[i]?.plain ?? 0));
    const setups = per.map(list => list[i]?.setup).filter((x): x is number => x !== null && x !== undefined);
    return { label: first.label, kind: first.kind, plain, setup: setups.length ? Math.max(plain, ...setups) : null, once: null };
  });

/** "Scoperti N" in rosso nella riga del team: i bersagli che nessuno manda KO in due colpi, col tooltip che li elenca. */
function Uncovered({ targets, of }: { targets: KoTarget[]; of: string }) {
  const t = useT();
  const tip = useFloatAnchor<true>();
  const open = targets.filter(x => x.plain < 50);
  if (!open.length) return <span className="kob-ok">{t('kob.allCovered')}</span>;
  return (
    <span className="kob labeled bad" onMouseEnter={e => tip.open(true, e.currentTarget)} onMouseLeave={tip.close}>
      <em>{t('kob.uncovered')}</em><b>{open.length}</b>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone="var(--bad)" className="kot">
          <div className="kot-head"><b>{t('kob.uncoveredTitle')}</b><small>{of}</small></div>
          <div className={`kot-list${open[0].kind === 'mon' ? ' mons' : ''}`}>
            {open.map(x => <Target key={x.label} target={x} />)}
          </div>
        </FloatTip>
      )}
    </span>
  );
}

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`). Per ogni membro: quante minacce del meta
 * e quanti dei 18 tipi manda KO in un colpo e in due (badge OHKO e 2HKO, col colpo semplice; il setup come "▴+N" a
 * parte; il 3HKO non conta), passando su un badge i bersagli nel tooltip; poi il voto del membro da solo. In fondo,
 * sempre allo stesso posto, la riga Team Coverage: per ogni bersaglio il membro migliore, gli scoperti in rosso.
 */
export function OffenseGeneral({ offense, meta, ctx, roleValues = {} }: { offense: TeamOffense; meta: boolean; ctx: AreaContext; roleValues?: Record<string, SubRoleValues> }) {
  const t = useT();
  const lang = useLang();
  const roomy = !!ctx.roomy;
  const { members, shares } = offense;
  const slots = offenseSlots(ctx.team, members);
  const nMeta = offense.coverageMeta?.rows.length ?? 0;
  const ofMeta = t('kob.ofMeta', { n: nMeta });
  const ofTypes = t('kob.ofTypes');
  const onceName = (m: MemberOffense) => (m.oneUse
    ? m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })
    : null);
  const known = ctx.team.map((_, slot) => slots[slot]).filter((i): i is number => i !== null);
  const teamTypes = teamTargets(known.map(i => typeTargets(members[i])));
  const teamMeta = teamTargets(ctx.team.map((_, slot) => slot).filter(slot => slots[slot] !== null).map(slot => metaTargets(offense, slot)));
  const teamName = t('odetail.gen.total');
  // Uscendo dalla scheda nessuna carta resta accesa
  useEffect(() => () => linkTeamCard(null), []);
  // Le fasce di ogni membro, una volta sola: servono alle tessere e alla stella del migliore di ogni colonna
  const metaBands = ctx.team.map((_, slot) => (slots[slot] === null ? null : koBands(metaTargets(offense, slot))));
  const typeBands = ctx.team.map((_, slot) => (slots[slot] === null ? null : koBands(typeTargets(members[slots[slot]!]))));
  const bestOf = (all: (ReturnType<typeof koBands> | null)[]) => {
    const top = (b: 'ohko' | 'two') => Math.max(0, ...all.map(x => x?.plain[b].length ?? 0));
    const [ohko, two] = [top('ohko'), top('two')];
    return (x: ReturnType<typeof koBands> | null) => ({ ohko: !!x && ohko > 0 && x.plain.ohko.length === ohko, two: !!x && two > 0 && x.plain.two.length === two });
  };
  const bestMeta = bestOf(metaBands);
  const bestTypes = bestOf(typeBands);
  // Il ruolo principale della carta del team (stessi valori dei Ruoli del voto), sotto il nome
  const rules = formatRules(ctx.formatId ?? 'ou');
  const roleOf = (set: (typeof ctx.team)[number], name: string) => {
    const role = cardRoles(set, rules, roleValues[name])[0];
    return role === undefined ? undefined : role === 'weather' ? t('card.weather') : roleLabel(role, lang);
  };

  return (
    <div className={`def-frame off-frame def-general off-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" />{meta && <col />}<col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {meta && <th scope="col">{t('kob.headMeta', { n: nMeta })}<KoSub /></th>}
              <th scope="col">{t('kob.headTypes')}<KoSub /></th>
              <th scope="col">{t('area.strength')}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const index = slots[slot];
              const m = index === null ? null : members[index];
              const s = index === null ? null : shares[index];
              return (
                // Passando sulla riga si accende anche la carta del membro nel team in alto
                <tr key={`${name}-${slot}`} style={{ '--i': slot } as CSSProperties} onMouseEnter={() => linkTeamCard(slot)} onMouseLeave={() => linkTeamCard(null)}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" role={roleOf(set, name)} /></th>
                  {m && s
                    ? <>
                      {meta && <td><KoBadges bands={metaBands[slot]!} who={name} of={ofMeta} total={nMeta} setupMove={m.setupMove} best={bestMeta(metaBands[slot])}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('coverageMeta', { kind: 'meta', slot, band }))} /></td>}
                      <td><KoBadges bands={typeBands[slot]!} who={name} of={ofTypes} total={18} setupMove={m.setupMove} onceName={onceName(m)} best={bestTypes(typeBands[slot])}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('types', { kind: 'types', slot, band }))} /></td>
                      <td>
                        <span className="og-stack og-own" title={m.coverMeta === null ? t('odetail.gen.ownTitleNoMeta', { n: m.total }) : t('odetail.gen.ownTitle', { types: m.value, meta: m.coverMeta, n: m.total })}><Bar value={m.total} total /></span>
                        {roomy && <span className="og-detail">{t('odetail.gen.points')} <b className="og-points" title={t('odetail.gen.pointsTitle', { n: s.points })}>+{s.points}</b></span>}
                      </td>
                    </>
                    : <>{meta && <td>—</td>}<td>—</td><td>—</td></>}
                </tr>
              );
            })}
            {/* Riempie lo spazio che resta: la riga del team sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={meta ? 4 : 3} /></tr>
          </tbody>
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{teamName}</span></th>
              {meta && <td><span className="kob-team"><KoBadges bands={koBands(teamMeta)} who={teamName} of={ofMeta} total={nMeta} /><Uncovered targets={teamMeta} of={ofMeta} /></span></td>}
              <td><span className="kob-team"><KoBadges bands={koBands(teamTypes)} who={teamName} of={ofTypes} total={18} /><Uncovered targets={teamTypes} of={ofTypes} /></span></td>
              <td><Bar value={offense.value} total /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* La legenda nella riga bassa, come nelle altre schede: il triangolo del setup, l'intensità del verde, il clic */}
      <div className="rob-legend og-legend" aria-hidden="true">
        <span><i className="kob-tri" />{t('kob.legendSetup')}</span>
        <span><i className="og-lg-k" />{t('kob.legendIntensity')}</span>
        <span className="og-lg-click">{t('kob.legendClick')}</span>
      </div>
    </div>
  );
}
