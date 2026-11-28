import { battleSpecies } from '../../engine/dex';
import { signed } from '../../i18n';
import { DEFAULT_FORMAT } from '../../engine/format';
import type { MemberOffense, MemberShare, TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import { familyAt, type AreaContext } from '../AreaDetail';
import { MemberMon } from '../defense/MemberMon';
import { KoBadges, koBands, type KoTarget } from './KoBadges';
import { offenseSlots } from './slots';
import { Ask, averageCols, BarHead, MetaTargets, metaText, TypeAverages, typeStatText } from './TargetsTip';
import { MoveChips, moveShares } from './MoveChips';
import { linkTeamCard } from '../teamLink';
import { useEffect, useId, useState } from 'react';
import { FLIP_TABLES_QUERY, useMediaQuery } from '../useMediaQuery';
import { gradeFor } from '../../engine/rating';
import { AnalysisSheet } from '../AnalysisSheet';
import { Sprite } from '../Sprite';
import { CardsLegend } from '../CardsLegend';
import { FloatTip, HiddenText, useFloatAnchor } from '../FloatTip';
import { signTone, TIP_NEUTRAL, TipHead, TipRow, TipRows, TipSec } from '../TipHead';
import { useRoving } from '../useRoving';
import { AreaHero } from '../AreaHero';
import { PedanaCard } from '../PedanaCard';

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
 * Quanto porta un membro all'Offesa del team: solo il numero ("+29", i punti dei membri sommati fanno l'Offesa del team),
 * col suo tooltip DreamDex col mouse e col fuoco: raggiungibile con le frecce (data-nav, nel gruppo della tabella), il
 * testo è anche il nome per lo screen reader. Il tooltip ha la forma di quello della Difesa: la sprite del membro, il
 * totale, sotto i pezzi (Coverage tipi, Coverage meta) uno per riga.
 */
function ShareTip({ who, share, meta }: { who: string; share: MemberShare; meta: boolean }) {
  const t = useT();
  const tip = useFloatAnchor<true>();
  const text = t('odetail.gen.shareTitle', { n: share.points });
  const id = useId();
  const parts = [
    `${t('detail.coverageTypes')} ${signed(share.parts.types)}`,
    meta ? `${t('detail.coverageMeta')} ${signed(share.parts.meta)}` : '',
  ].filter(Boolean).join(', ');
  return (
    <span className="og-share" data-nav="" role="img" aria-label={text} aria-describedby={id} {...tip.bind(true)}>
      <span className="def-num total og-share-num">+{share.points}</span>
      <HiddenText id={id}>{`${t('odetail.gen.shareNote')}. ${parts}`}</HiddenText>
      {tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={TIP_NEUTRAL} className="tip-w-s dsh-tip">
          <TipHead sprite={who} title={who} sub={t('odetail.gen.shareSub')} num={<span className={signTone(share.points)}>{signed(share.points)}</span>} />
          <TipSec>
            <TipRows className="dsh-rows">
              <TipRow className="dsh-row" lead={<i className="dsh-sw cover" />} title={t('detail.coverageTypes')} value={signed(share.parts.types)} tone={signTone(share.parts.types)} />
              {meta && <TipRow className="dsh-row" lead={<i className="dsh-sw cover" />} title={t('detail.coverageMeta')} value={signed(share.parts.meta)} tone={signTone(share.parts.meta)} />}
            </TipRows>
          </TipSec>
        </FloatTip>
      )}
    </span>
  );
}

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`). Per ogni membro: quante minacce del meta
 * e quanti dei 18 tipi manda KO in un colpo e in due (badge OHKO e 2HKO, col colpo semplice; il setup come "▴+N" a
 * parte; il 3HKO non conta), passando su un badge i bersagli nel tooltip; poi quanto porta all'Offesa del team, solo il
 * numero ("+18"). In fondo, sempre allo stesso posto, la riga Team Coverage: per ogni bersaglio il membro migliore, gli
 * scoperti in rosso; nell'ultima colonna niente (il voto sta nella testata dell'area).
 */
export function OffenseGeneral({ offense, meta, ctx, value = null }: { offense: TeamOffense; meta: boolean; ctx: AreaContext; /** Il voto dell'Offesa (la lettera nella riga del team delle carte). */ value?: number | null }) {
  const t = useT();
  const lang = useLang();
  const roomy = !!ctx.roomy;
  // Telefono e tablet (sotto i 1100 px): i membri come carte Pedana (due per riga sul telefono, tre sul tablet), con la riga del team in cima (OffenseCards)
  const cards = useMediaQuery(FLIP_TABLES_QUERY);
  const [sheet, setSheet] = useState<number | null>(null);
  // Il "?" delle testate apre la guida dell'Offesa (una pagina sola per le tre schede, la sezione "types")
  const openGuide = ctx.guide && (() => ctx.guide!('types'));
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
  // Tutti i pezzi della tabella (barre dei colpi, mosse, il numero di quanto porta) sono un posto solo nel giro del Tab, poi le frecce
  const nav = useRoving<HTMLTableElement>();
  // Uscendo dalla scheda nessuna carta resta accesa
  useEffect(() => () => linkTeamCard(null), []);
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

  if (cards) {
    const grade = value === null ? null : gradeFor(value, lang);
    // Nelle carte le barre sono basse (20 px): solo da guardare, la carta si apre toccandola; nel foglio, alte, portano alla sottoscheda
    const typeRow = (slot: number, m: MemberOffense, name: string, pick = false) => <KoBadges bands={typeBands[slot]!} who={name} mon={name} of={ofTypes} total={18} setupMove={m.setupMove} onceName={onceName(m)}
      onPick={pick && ctx.openFocus ? (band => { setSheet(null); ctx.openFocus!('types', { kind: 'types', slot, band }); }) : undefined} pickPlace={t('detail.coverageTypes')} />;
    const metaRow = (slot: number, m: MemberOffense, name: string, pick = false) => <KoBadges bands={metaBands[slot]!} who={name} mon={name} of={ofMeta} total={nMeta} setupMove={m.setupMove}
      onPick={pick && ctx.openFocus ? (band => { setSheet(null); ctx.openFocus!('coverageMeta', { kind: 'meta', slot, band }); }) : undefined} pickPlace={t('detail.coverageMeta')} />;
    const open = sheet === null ? null : (() => {
      const set = ctx.team[sheet];
      const index = slots[sheet];
      if (!set || index === null) return null;
      return { set, slot: sheet, name: battleSpecies(set)?.name ?? set.species, m: members[index], s: shares[index] };
    })();
    return (
      <div className="off-frame off-general og-cards-frame">
        {/* La riga del team in cima: la risposta prima dei dettagli */}
        <AreaHero label={teamName} grade={grade}>
          <div className="og-card-row"><span className="og-card-label">{t('kob.headTypes')}</span><KoBadges bands={koBands(teamTypes)} who={teamName} of={ofTypes} total={18} alarm /></div>
          {meta && <div className="og-card-row"><span className="og-card-label">{t('kob.headMeta')}</span><KoBadges bands={koBands(teamMeta)} who={teamName} of={ofMeta} total={nMeta} alarm /></div>}
        </AreaHero>
        <CardsLegend pieces={[['ohko', 'OHKO'], ['two', '2HKO'], ['rest', t('odetail.cards.noKo')]]} setup={t('kob.legendSetupShort')} />
        <ul className="og-cards" aria-label={t('detail.member')}>
          {ctx.team.map((set, slot) => {
            const species = battleSpecies(set);
            const name = species?.name ?? set.species;
            const index = slots[slot];
            const m = index === null ? null : members[index];
            const s = index === null ? null : shares[index];
            const quiet = familyAt(ctx, slot) === 'wall';
            const types = species?.types ?? [];
            return (
              // La carta si apre toccando la parte alta (sprite e nome): sotto, le barre portano alle loro schede
              <PedanaCard key={`${name}-${slot}`} className={quiet ? 'wall' : undefined} types={types} name={name} species={set.species} item={set.item}
                disabled={!m} openLabel={t('odetail.cards.open', { name })} onOpen={() => setSheet(slot)}
                tag={(
                  <span className={`og-card-tag${s && s.points === 0 ? ' zero' : ''}`}>
                    {s ? <ShareTip who={name} share={s} meta={!!offense.coverageMeta} /> : '—'}
                    {quiet && <small>· {t('sdetail.wall')}</small>}
                  </span>
                )}>
                {m && <div className="og-card-row"><span className="og-card-label">{t('kob.headTypes')}</span>{typeRow(slot, m, name)}</div>}
                {m && meta && <div className="og-card-row"><span className="og-card-label">{t('kob.headMeta')}</span>{metaRow(slot, m, name)}</div>}
              </PedanaCard>
            );
          })}
        </ul>
        {open && (
          <AnalysisSheet title={open.name} lead={<Sprite species={open.set.species} item={open.set.item} size={56} />} onClose={() => setSheet(null)}
            sub={t('odetail.gen.shareTitle', { n: open.s.points })} className="og-sheet">
            <section className="og-sheet-sec">
              <h4>{t('detail.coverageTypes')}</h4>
              {typeRow(open.slot, open.m, open.name, true)}
              <p className="og-sheet-cap">{t('kob.movesCaption')}</p>
              <MoveChips shares={typeMoves(open.m, open.slot)} of={ofTypes} total={18} />
            </section>
            {meta && (
              <section className="og-sheet-sec">
                <h4>{t('detail.coverageMeta')}</h4>
                {metaRow(open.slot, open.m, open.name, true)}
                <p className="og-sheet-cap">{t('kob.movesCaption')}</p>
                <MoveChips shares={metaMoves(open.slot)} of={ofMeta} total={nMeta} />
              </section>
            )}
          </AnalysisSheet>
        )}
      </div>
    );
  }

  return (
    <div className={`def-frame off-frame def-general off-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table ref={nav.ref} className="def-grid def-members" aria-label={`${t('area.strength')}: ${t('detail.tab.general')}`} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {/* Accanto alle testate il "?" coi bersagli, come nella guida: il Pokémon medio dei 18 tipi, le minacce del meta */}
              <th scope="col"><BarHead icon="sword" word={t('kob.headTypes')} /><Ask label={t('guide.off.targets.typesTitle')} guide={openGuide} describe={typeStatText(averageCols(ctx.formatId ?? DEFAULT_FORMAT.formatId, t), lang)}><TypeAverages formatId={ctx.formatId ?? DEFAULT_FORMAT.formatId} /></Ask></th>
              {meta && <th scope="col"><BarHead icon="sword" word={t('kob.headMeta')} /><Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })} guide={openGuide} describe={metaText(t('guide.off.targets.metaTitle', { n: metaSpecies.length }), metaSpecies)}><MetaTargets species={metaSpecies} /></Ask></th>}
              {/* Il +N di ogni membro: quanti punti porta al voto dell'Offesa (la piccola riga sopra lo dice) */}
              <th scope="col" className="og-share-col">{t('area.strength')} <small className="og-share-unit">{t('odetail.gen.shareUnit')}</small></th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const index = slots[slot];
              const m = index === null ? null : members[index];
              const s = index === null ? null : shares[index];
              // Un muro: "· muro" accanto alle statistiche (colpire poco non è il suo lavoro)
              const quiet = familyAt(ctx, slot) === 'wall';
              return (
                // Passando sulla riga si accende anche la carta del membro nel team in alto
                <tr key={`${name}-${slot}`} onMouseEnter={() => linkTeamCard(slot)} onMouseLeave={() => linkTeamCard(null)}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense">{quiet ? <span className="role-note">· {t('sdetail.wall')}</span> : undefined}</MemberMon></th>
                  {m && s
                    ? <>
                      <td><KoBadges bands={typeBands[slot]!} who={name} mon={name} of={ofTypes} total={18} setupMove={m.setupMove} onceName={onceName(m)}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('types', { kind: 'types', slot, band }))} pickPlace={t('detail.coverageTypes')} />
                        {roomy && <MoveChips shares={typeMoves(m, slot)} of={ofTypes} total={18} />}</td>
                      {meta && <td><KoBadges bands={metaBands[slot]!} who={name} mon={name} of={ofMeta} total={nMeta} setupMove={m.setupMove}
                        onPick={ctx.openFocus && (band => ctx.openFocus!('coverageMeta', { kind: 'meta', slot, band }))} pickPlace={t('detail.coverageMeta')} />
                        {roomy && <MoveChips shares={metaMoves(slot)} of={ofMeta} total={nMeta} />}</td>}
                      <td>
                        {/* Quanto porta al team: i punti dei membri sommati fanno l'Offesa del team */}
                        <ShareTip who={name} share={s} meta={!!offense.coverageMeta} />
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
              {/* Nell'ultima colonna niente: il voto dell'Offesa sta nella testata dell'area */}
              <td />
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
