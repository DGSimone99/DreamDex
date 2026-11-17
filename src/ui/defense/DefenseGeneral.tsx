import { useId, type ReactNode } from 'react';
import { type SustainParts, type TeamDefense } from '../../engine/defense';
import { defenseShares, type DefenseShare } from '../../engine/defenseShares';
import { FloatTip, HiddenText, useFloatAnchor } from '../FloatTip';
import { useLang, useT } from '../../i18n/react';
import { anyGameName } from '../../i18n/game';
import type { Lang } from '../../i18n';
import { familyAt, type AreaContext } from '../AreaDetail';
import { MemberMon, setOf } from './MemberMon';
import { TYPES } from '../../engine/types';
import { HoldBars, type HoldPiece, metaHolds, teamHolds, typeHolds, TypeAttackers, WorstHits, worstOf } from './HoldBars';
import { Ask, BarHead, MetaTargets } from '../offense/TargetsTip';
import { DEFAULT_FORMAT } from '../../engine/format';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { typeColor } from '../Sprite';
import { effLabel } from '../effTag';
import { DefenseHitTip } from './DefenseTypes';
import { ThreatHitTip } from './DefenseMeta';
import { useRoving } from '../useRoving';

/** Il colore di un valore (le barre della Velocità): buono da 80, medio da 50, scarso sotto. */
export const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/** Un numero con segno: "+47", "−25", "0" (il meno tipografico). */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * Il nome di una fonte di recupero o di perdita nella lingua scelta: mosse, abilità e strumenti coi nomi ufficiali
 * ("Recover" → "Ripresa"); più fonti unite da " + " e "Rapid Spin (Great Tusk)" col nome del Pokémon che resta inglese.
 */
export const sourceName = (source: string, lang: Lang): string => source.split(' + ').map(part => {
  const owner = /^(.*) \(([^()]*)\)$/.exec(part);
  return owner ? `${anyGameName(owner[1], lang)} (${owner[2]})` : anyGameName(part, lang);
}).join(' + ');

/** PS su 100, senza il segno del %: "6" per il 6% dei PS. */
const hp = (x: number) => Math.round(100 * x);

/**
 * Il recupero e le perdite di un membro in parole e numeri semplici (PS su 100, niente %): una riga per quello che
 * recupera e con che cosa, una per Stealth Rock (con chi la dimezza) e una per ogni strumento o mossa che costa PS.
 */
function useSustainWords() {
  const t = useT();
  const lang = useLang();
  const name = (source: string) => sourceName(source, lang);
  return (parts: SustainParts): { text: string; tone: 'gain' | 'loss' | 'none' }[] => {
    const out: { text: string; tone: 'gain' | 'loss' | 'none' }[] = [];
    if (parts.recovery > 0) {
      const from = parts.sources.map(name).join(' + ');
      out.push({ tone: 'gain', text: t(parts.halved ? 'ddetail.share.gainHalved' : 'ddetail.share.gain', { n: hp(parts.recovery), from }) });
    }
    if (parts.rocks > 0) {
      // "(dimezzata: Defog (Corviknight) toglie gli hazard)", con la minuscola dentro la frase
      const note = parts.rocksHalvedBy ? t('ddetail.sus.rocksHalved', { by: name(parts.rocksHalvedBy) }) : '';
      const halved = note ? ` (${note.charAt(0).toLocaleLowerCase()}${note.slice(1)})` : '';
      out.push({ tone: 'loss', text: `${t('ddetail.share.loss', { n: hp(parts.rocks), from: name('Stealth Rock') })}${halved}` });
    }
    // Le altre perdite fonte per fonte (Life Orb, Flame Orb, le mosse che costano PS); senza dettaglio, in una riga sola
    const losses = parts.losses.filter(l => hp(l.loss) > 0);
    if (losses.length) for (const l of losses) out.push({ tone: 'loss', text: t('ddetail.share.loss', { n: hp(l.loss), from: name(l.source) }) });
    else if (parts.itemLoss > 0) out.push({ tone: 'loss', text: t('ddetail.share.loss', { n: hp(parts.itemLoss), from: parts.itemLossFrom ? name(parts.itemLossFrom) : t('ddetail.sus.orb') }) });
    if (!out.length) out.push({ tone: 'none', text: t('ddetail.share.flat') });
    return out;
  };
}

/**
 * Il tooltip di quanto porta un membro alla Difesa: i tre pezzi, Coverage tipi, Coverage meta e Recupero, e sotto in
 * parole quanto recupera e quanto perde (PS su 100).
 */
function ShareTip({ who, share, words, meta }: { who: string; share: DefenseShare; words: { text: string; tone: string }[]; meta: boolean }) {
  const t = useT();
  return (
    <>
      <div className="ftip-head"><b>{who}</b><span className={`dsh-total${share.points < 0 ? ' neg' : ''}`}>{signed(share.points)}</span></div>
      <div className="dsh-rows">
        <span className="dsh-row"><i className="dsh-sw cover" />{t('detail.coverageTypes')}<b>{signed(share.types)}</b></span>
        {meta && <span className="dsh-row"><i className="dsh-sw cover" />{t('detail.coverageMeta')}<b>{signed(share.meta)}</b></span>}
        <span className="dsh-row"><i className={`dsh-sw ${share.sustain < 0 ? 'loss' : 'gain'}`} />{t('ddetail.sustain')}<b>{signed(share.sustain)}</b></span>
        {words.map((w, k) => <span key={k} className={`dsh-line ${w.tone}`}>{w.text}</span>)}
      </div>
    </>
  );
}

/**
 * Quanto porta un membro alla Difesa del team, come nell'Offesa: solo il numero ("+12", in rosso se toglie), i punti dei
 * membri sommati fanno la Difesa del team. Raggiungibile con le frecce (data-nav, nel gruppo della tabella): col mouse e
 * col fuoco il tooltip coi pezzi e il recupero; lo screen reader ha le stesse cose nella descrizione.
 */
function DefShare({ share, tip, label, describe }: { share: DefenseShare; tip: ReactNode; label: string; describe: string }) {
  const float = useFloatAnchor<true>();
  const id = useId();
  return (
    <span className="og-share dsh" data-nav="" role="img" aria-label={label} aria-describedby={id} {...float.bind(true)}>
      <span className={`def-num total og-share-num${share.points < 0 ? ' neg' : ''}`}>{signed(share.points)}</span>
      <HiddenText id={id}>{describe}</HiddenText>
      {float.anchor && <FloatTip rect={float.anchor.rect} tone="var(--accent)" className="dsh-tip">{tip}</FloatTip>}
    </span>
  );
}

export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const { members } = defense;
  const roomy = !!ctx.roomy;
  // Quanto porta ogni membro alla Difesa del team (sommati fanno la Difesa del team), e in parole il suo recupero
  const shares = defenseShares(defense);
  const sustainWords = useSustainWords();
  const hasMeta = !!defense.coverageMeta;
  // Per lo screen reader le stesse cose del tooltip, in una frase
  const describe = (share: DefenseShare, words: { text: string }[]) => [
    `${t('detail.coverageTypes')} ${signed(share.types)}`,
    hasMeta ? `${t('detail.coverageMeta')} ${signed(share.meta)}` : '',
    `${t('ddetail.sustain')} ${signed(share.sustain)}`,
  ].filter(Boolean).join(', ') + '. ' + words.map(w => w.text).join('. ');

  // Le barre a pezzi di Tipi e Meta: le fasce di ogni membro, e del team (il membro che regge meglio ogni bersaglio)
  const metaRows = defense.coverageMeta?.rows ?? [];
  const typeBars = members.map((_, i) => typeHolds(defense.typed[i]?.cells ?? []));
  const metaBars = members.map(m => metaHolds(metaRows, m.species));
  const metaSpecies = [...metaRows].sort((x, y) => y.weight - x.weight).map(r => r.species);
  const ofTypes = t('kob.ofTypes');
  const ofMeta = t('kob.ofMeta', { n: metaRows.length });
  const teamName = t('odetail.gen.total');
  // Tutti i pezzi della tabella (barre, colpi peggiori, quanto porta) sono un posto solo nel giro del Tab, poi le frecce
  const nav = useRoving<HTMLTableElement>();

  // Squadra chiusa: sotto le barre i tre colpi che fanno più male (tipi: il lato peggiore; meta: chi lo manda KO in un
  // colpo prima, dalla minaccia più usata, poi dal danno più alto), col tooltip delle caselle di Coverage tipi e meta
  const slotOf = (i: number) => ctx.team.findIndex(set => battleName(set) === members[i].species);
  // Il conto di un attaccante resta neutro: reggere poco non è un difetto per lui (la riga del team no)
  const quiet = (i: number) => familyAt(ctx, slotOf(i)) === 'attack';
  // Clic su un pezzo di Tipi o Meta: apre la sottoscheda con la riga del membro e quei bersagli accesi, come nell'Offesa
  const pick = (key: string, kind: 'dtypes' | 'dmeta', i: number) => (ctx.openFocus
    ? (band: HoldPiece) => ctx.openFocus!(key, { kind, slot: slotOf(i), band })
    : undefined);
  const multipliers = new Map(ctx.analysis.weakness.map(row => [row.type, row.multipliers]));
  const worstTypes = (i: number) => worstOf((defense.typed[i]?.cells ?? []).map((c, k) => ({ label: TYPES[k], kind: 'type' as const, pct: c.pct, band: c.band, cell: c })))
    .map(h => ({ ...h, color: typeColor(h.label),
      tip: <DefenseHitTip type={h.label} species={members[i].species} cell={h.cell} mult={effLabel(multipliers.get(h.label as TypeName)?.[slotOf(i)] ?? 1, 'defense')} /> }));
  const byUse = [...metaRows].sort((x, y) => y.weight - x.weight);
  const worstMeta = (i: number) => worstOf(byUse.map(row => {
    const h = row.heldBy.find(x => x.species === members[i].species);
    return { label: row.species, kind: 'mon' as const, pct: h ? h.pct : null, band: h ? h.band : 'ohko' as const, row, h };
  })).map(x => ({ ...x, color: typeColor((battleSpecies(x.row.set)?.types[0] as string | undefined) ?? ''),
    tip: <ThreatHitTip row={x.row} name={members[i].species} hit={x.h ?? 'ko'} mult={effLabel(x.row.mults?.[i], 'defense')} koMove={x.row.hits?.[i]?.move} /> }));


  return (
    <div className={`def-frame def-general${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table ref={nav.ref} className="def-grid def-members" aria-label={`${t('area.defense')}: ${t('detail.tab.general')}`} onKeyDown={nav.onKeyDown} onFocus={nav.onFocus}>
          {/* Come l'Offesa: i nomi in una colonna, poi Tipi e Meta larghi uguali e l'ultima stretta col solo "+N" (quanto
              porta), così Tipi e Meta stanno nello stesso posto nelle due Generali */}
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col"><BarHead icon="shield" word={t('kob.headTypes')} /><Ask label={t('hold.attackersTitle')}><TypeAttackers formatId={ctx.formatId ?? DEFAULT_FORMAT.formatId} /></Ask></th>
              {meta && <th scope="col"><BarHead icon="shield" word={t('kob.headMeta')} /><Ask label={t('guide.off.targets.metaTitle', { n: metaSpecies.length })}><MetaTargets species={metaSpecies} /></Ask></th>}
              <th scope="col">{t('area.defense')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row">
                  <MemberMon name={m.species} set={setOf(ctx.team, m.species)} stats />
                </th>
                {/* Quanti colpi di tipo regge (i due lati nel suggerimento) e quante minacce del meta */}
                <td><HoldBars targets={typeBars[i]} who={m.species} of={ofTypes} quiet={quiet(i)} onPick={pick('coverageTypes', 'dtypes', i)} />{roomy && <WorstHits hits={worstTypes(i)} />}</td>
                {meta && <td><HoldBars targets={metaBars[i]} who={m.species} of={ofMeta} quiet={quiet(i)} onPick={pick('coverageMeta', 'dmeta', i)} />{roomy && <WorstHits hits={worstMeta(i)} />}</td>}
                <td>
                  {/* Quanto porta alla Difesa del team, solo il numero: i pezzi e il recupero nel tooltip */}
                  {(() => {
                    const words = sustainWords(m.sustainParts);
                    return <DefShare share={shares[i]} label={t('ddetail.shareTitle', { n: signed(shares[i].points) })} describe={describe(shares[i], words)}
                      tip={<ShareTip who={m.species} share={shares[i]} words={words} meta={hasMeta} />} />;
                  })()}
                </td>
              </tr>
            ))}
            {/* Riempie lo spazio che resta: la riga Team Coverage sta sempre in fondo, con 1 o con 6 membri */}
            <tr className="og-fill" aria-hidden="true"><td colSpan={3 + (meta ? 1 : 0)} /></tr>
          </tbody>
          {/* In fondo la squadra intera, come la riga Team Coverage dell'Offesa: per ogni bersaglio il membro che lo regge meglio; nella colonna Difesa niente */}
          <tfoot>
            <tr className="og-total">
              <th scope="row"><span className="og-plate">{t('odetail.gen.total')}</span></th>
              <td><HoldBars targets={teamHolds(typeBars)} who={teamName} of={ofTypes} alarm /></td>
              {meta && <td><HoldBars targets={teamHolds(metaBars)} who={teamName} of={ofMeta} alarm /></td>}
              {/* Nella colonna Difesa niente: il voto della Difesa sta nella testata dell'area */}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
