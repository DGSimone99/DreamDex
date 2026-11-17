import { battleSpecies } from '../../engine/dex';
import { DEFAULT_FORMAT } from '../../engine/format';
import type { MemberOffense, TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { KoBadges, koBands, type KoTarget } from './KoBadges';
import { offenseSlots } from './slots';
import { Ask, BarHead, MetaTargets, TypeAverages } from './TargetsTip';
import { MoveChips, moveShares } from './MoveChips';
import { linkTeamCard } from '../teamLink';
import { useEffect, type ReactNode } from 'react';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { useRoving } from '../useRoving';

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

/**
 * Quanto porta un membro: la barra (0-100, come quella del team sotto) ha in tenue l'Offesa del team divisa nei pezzi dei
 * membri, uno dopo l'altro nell'ordine delle righe; il pezzo del membro è acceso, al suo posto. Il numero: i suoi punti.
 */
function Share({ points, from, team }: { points: number; from: number; team: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <span className="def-cell">
      <span className="def-bar og-share-bar" aria-hidden="true">
        <i className="og-share-team" style={{ width: `${clamp(team)}%` }} />
        <i className="og-share-own" style={{ left: `${clamp(from)}%`, width: `${clamp(Math.min(points, 100 - from))}%` }} />
      </span>
      <span className="def-num total og-share-num">+{points}</span>
    </span>
  );
}

/**
 * Quanto porta un membro, col suo tooltip (prima era il title del browser, solo col mouse): raggiungibile con le frecce
 * (data-nav, nel gruppo della tabella), il testo è anche il nome per lo screen reader.
 */
function ShareTip({ text, children }: { text: string; children: ReactNode }) {
  const tip = useFloatAnchor<true>();
  return (
    <span className="og-stack og-share" data-nav="" role="img" aria-label={text} {...tip.bind(true)}>
      {children}
      {tip.anchor && <FloatTip rect={tip.anchor.rect} tone="var(--accent)" className="kot"><p className="kot-none">{text}</p></FloatTip>}
    </span>
  );
}

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`). Per ogni membro: quante minacce del meta
 * e quanti dei 18 tipi manda KO in un colpo e in due (badge OHKO e 2HKO, col colpo semplice; il setup come "▴+N" a
 * parte; il 3HKO non conta), passando su un badge i bersagli nel tooltip; poi quanto porta all'Offesa del team ("+18",
 * la barra è la sua fetta). In fondo,
 * sempre allo stesso posto, la riga Team Coverage: per ogni bersaglio il membro migliore, gli scoperti in rosso, e la
 * barra dell'Offesa del team senza il numero (il voto sta nella testata dell'area).
 */
export function OffenseGeneral({ offense, meta, ctx }: { offense: TeamOffense; meta: boolean; ctx: AreaContext }) {
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
  // Tutti i pezzi della tabella (barre dei colpi, mosse, quanto porta) sono un posto solo nel giro del Tab, poi le frecce
  const nav = useRoving<HTMLTableElement>();
  // Uscendo dalla scheda nessuna carta resta accesa
  useEffect(() => () => linkTeamCard(null), []);
  // Dove comincia il pezzo di ogni membro nella barra del team: i punti delle righe sopra
  const shareFrom = ctx.team.map((_, slot) => ctx.team.slice(0, slot).reduce((sum, __, k) => sum + (slots[k] === null ? 0 : shares[slots[k]!].points), 0));
  // A squadra chiusa, sotto le barre: quanto lavora ogni mossa d'attacco (la mossa migliore su ogni bersaglio KO in due colpi)
  const metaRows = offense.coverageMeta?.rows ?? [];
  // Le minacce del meta dalla più usata, per il "?" sulla testata Meta
  const metaSpecies = [...metaRows].sort((x, y) => y.weight - x.weight).map(r => r.species);
  const typeMoves = (m: MemberOffense, slot: number) => moveShares(ctx.team[slot].moves, typeTargets(m), x => m.hits.find(h => h.label === x.label)?.move);
  const metaMoves = (slot: number) => {
    const who = battleSpecies(ctx.team[slot])?.name ?? ctx.team[slot].species;
    const best = new Map(metaRows.map(row => [row.species, row.coveredBy.find(c => c.species === who && !c.partial)?.move]));
    return moveShares(ctx.team[slot].moves, metaTargets(offense, slot), x => best.get(x.label));
  };
  // Le fasce di ogni membro, una volta sola
  const metaBands = ctx.team.map((_, slot) => (slots[slot] === null ? null : koBands(metaTargets(offense, slot))));
  const typeBands = ctx.team.map((_, slot) => (slots[slot] === null ? null : koBands(typeTargets(members[slots[slot]!]))));


  return (
    <div className={`def-frame off-frame def-general off-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table ref={nav.ref} className="def-grid def-members" aria-label={`${t('area.strength')}: ${t('detail.tab.general')}`} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {/* Accanto alle testate il "?" coi bersagli, come nella guida: il Pokémon medio dei 18 tipi, le minacce del meta */}
              <th scope="col"><BarHead icon="sword" word={t('kob.headTypes')} /><Ask label={t('guide.off.targets.typesTitle')}><TypeAverages formatId={ctx.formatId ?? DEFAULT_FORMAT.formatId} /></Ask></th>
              {meta && <th scope="col"><BarHead icon="sword" word={t('kob.headMeta')} /><Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })}><MetaTargets species={metaSpecies} /></Ask></th>}
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
                <tr key={`${name}-${slot}`} onMouseEnter={() => linkTeamCard(slot)} onMouseLeave={() => linkTeamCard(null)}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {m && s
                    ? <>
                      <td><KoBadges bands={typeBands[slot]!} who={name} of={ofTypes} total={18} setupMove={m.setupMove} onceName={onceName(m)}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('types', { kind: 'types', slot, band }))} />
                        {roomy && <MoveChips shares={typeMoves(m, slot)} of={ofTypes} />}</td>
                      {meta && <td><KoBadges bands={metaBands[slot]!} who={name} of={ofMeta} total={nMeta} setupMove={m.setupMove}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('coverageMeta', { kind: 'meta', slot, band }))} />
                        {roomy && <MoveChips shares={metaMoves(slot)} of={ofMeta} />}</td>}
                      <td>
                        {/* Quanto porta al team: i punti dei membri sommati fanno l'Offesa del team */}
                        <ShareTip text={t('odetail.gen.shareTitle', { n: s.points })}><Share points={s.points} from={shareFrom[slot]} team={offense.value} /></ShareTip>
                      </td>
                    </>
                    : <><td>—</td>{meta && <td>—</td>}<td>—</td></>}
                </tr>
              );
            })}
            {/* Riempie lo spazio che resta: la riga del team sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={meta ? 4 : 3} /></tr>
          </tbody>
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{teamName}</span></th>
              <td><KoBadges bands={koBands(teamTypes)} who={teamName} of={ofTypes} total={18} alarm /></td>
              {meta && <td><KoBadges bands={koBands(teamMeta)} who={teamName} of={ofMeta} total={nMeta} alarm /></td>}
              <td><Bar value={offense.value} total bare /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Nella riga bassa solo il segno del setup (il resto lo dicono i tooltip delle tessere) */}
      <div className="rob-legend og-legend" aria-hidden="true">
        <span><i className="kob-tri" />{t('kob.legendSetupShort')}</span>
      </div>
    </div>
  );
}
