import type { ReactNode } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { useLang, useT } from '../../i18n/react';

type Section = 'general' | 'robustness' | 'sustain' | 'coverageTypes' | 'coverageMeta';
type Key = Parameters<ReturnType<typeof useT>>[0];

/** Righe termine / regola della guida. */
function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="guide-rows">
      {rows.map(([term, rule], i) => <div key={i}><dt>{term}</dt><dd>{rule}</dd></div>)}
    </dl>
  );
}

/** Pillole di punti o valori: etichetta, numero e una nota. */
function Points({ items }: { items: { label: ReactNode; value?: ReactNode; note?: string }[] }) {
  return (
    <ul className="guide-points">
      {items.map((item, i) => (
        <li key={i}>{item.label}{item.value !== undefined && <b>{item.value}</b>}{item.note && <small>{item.note}</small>}</li>
      ))}
    </ul>
  );
}

/** Il contenuto della guida alla Difesa per una sezione: schematico, con in fondo i valori del tuo team. */
/** `exposed`: quanti tipi scoperti (gli stessi della tessera Generale e della tabella: `weaknessSeverity`). */
export function DefenseGuideSection({ section, defense, meta, exposed }: { section: Section; defense: TeamDefense; meta: boolean; exposed: number }) {
  const t = useT();
  const lang = useLang();
  // Decimali alla maniera della lingua (0,5 in italiano, 0.5 in inglese)
  const dec = (text: string) => (lang === 'it' ? text : text.replace(',', '.'));
  const g = (key: string, params?: Record<string, string | number>) => t(`guide.def.${key}` as Key, params);
  const metaRows = defense.coverageMeta?.rows.length ?? 0;
  const physicalCount = defense.matrix.filter(row => row.physical).length;
  const team = (items: [string, ReactNode][]) => (
    <>
      <h5>{g('team')}</h5>
      <Points items={items.map(([label, value]) => ({ label, value }))} />
    </>
  );

  if (section === 'general') {
    return (
      <>
        <h5>{g('what')}</h5>
        <Rows rows={[
          [t('detail.coverageTypes'), g('what.types')],
          [t('ddetail.robustness'), g('what.robustness')],
          [t('ddetail.sustain'), g('what.sustain')],
          ...(meta ? [[t('detail.coverageMeta'), g('what.meta', { n: metaRows })] as [string, string]] : []),
        ]} />
        <h5>{g('weights')}</h5>
        <Rows rows={[[t('area.defense'), g(meta ? 'weights.meta' : 'weights.tier')]]} />
        {team([
          [t('area.defense'), defense.value],
          [t('detail.coverageTypes'), defense.coverageTypes.value],
          [t('ddetail.robustness'), defense.robustness],
          [t('ddetail.sustain'), defense.sustain],
          ...(defense.coverageMeta ? [[t('detail.coverageMeta'), defense.coverageMeta.value] as [string, number]] : []),
        ])}
      </>
    );
  }

  if (section === 'robustness') {
    return (
      <>
        <h5>{g('rob.test')}</h5>
        <Rows rows={[
          [g('rob.attackers'), g('rob.attackers.rule', { n: physicalCount })],
          [g('rob.hit'), g('rob.hit.rule')],
          [g('rob.count'), g('rob.count.rule')],
        ]} />
        <h5>{g('rob.points')}</h5>
        <p className="guide-note">{g('rob.damage')}</p>
        <Points items={[
          { label: <span className="hold-chip hold-ohko">OHKO</span>, value: 0, note: g('rob.ohko') },
          { label: <span className="hold-chip hold-2">2HKO</span>, value: dec('0,5'), note: g('rob.two') },
          { label: <span className="hold-chip hold-3">3HKO</span>, value: 1, note: g('rob.three') },
          { label: <span className="hold-chip hold-4">4HKO+</span>, value: dec('1,5'), note: g('rob.four') },
        ]} />
        <h5>{g('rob.toteam')}</h5>
        <Rows rows={[
          [g('rob.scale'), g('rob.scale.rule')],
          [g('rob.weights'), g('rob.weights.rule')],
          [t('ddetail.robustness'), g('rob.total')],
        ]} />
        {team([
          [t('ddetail.physical'), defense.physical],
          [t('ddetail.special'), defense.special],
          [t('ddetail.robustness'), defense.robustness],
        ])}
      </>
    );
  }

  if (section === 'sustain') {
    return (
      <>
        <h5>{g('sus.count')}</h5>
        <Rows rows={[
          [g('sus.lead'), g('sus.lead.rule')],
          [g('sus.recovery'), g('sus.recovery.rule')],
          [g('sus.ability'), g('sus.ability.rule')],
          [g('sus.rocks'), g('sus.rocks.rule')],
          [g('sus.orb'), g('sus.orb.rule')],
        ]} />
        <h5>{g('sus.tovote')}</h5>
        <Rows rows={[
          [g('sus.half'), g('sus.half.rule')],
          [g('sus.scale'), g('sus.scale.rule')],
        ]} />
        {team([
          [t('ddetail.sustain'), defense.sustain],
          [g('sus.members'), `${defense.members.filter(m => m.sustainParts.recovery > 0).length}/${defense.members.length}`],
        ])}
      </>
    );
  }

  if (section === 'coverageTypes') {
    return (
      <>
        <h5>{g('types.per')}</h5>
        <Rows rows={[[g('types.balance'), g('types.balance.rule')]]} />
        <Points items={[
          { label: g('types.immune'), value: '+2' }, { label: '×¼', value: dec('+1,5') }, { label: '×½', value: '+1' },
          { label: g('types.neutral'), value: '0' }, { label: '×2', value: '−1' }, { label: '×4', value: '−2' },
        ]} />
        <h5>{g('types.tosafety')}</h5>
        <Rows rows={[
          [g('types.zero'), g('types.zero.rule')],
          [g('types.safe'), g('types.safe.rule')],
          [g('types.open'), g('types.open.rule')],
          [g('types.average'), g('types.average.rule')],
          ...(meta ? [[g('types.split'), g('types.split.rule')] as [string, string]] : []),
        ]} />
        {team([
          [t('detail.coverageTypes'), defense.coverageTypes.value],
          [g('types.exposed'), exposed],
        ])}
      </>
    );
  }

  return (
    <>
      <h5>{g('meta.test')}</h5>
      <Rows rows={[
        [g('meta.threats'), g('meta.threats.rule', { n: metaRows })],
        [g('meta.hit'), g('meta.hit.rule')],
        [g('meta.holds'), g('meta.holds.rule')],
      ]} />
      <h5>{g('meta.toteam')}</h5>
      <Points items={[
        { label: g('meta.one'), value: '70%' }, { label: g('meta.two'), value: '90%' }, { label: g('meta.three'), value: '100%' },
      ]} />
      <Rows rows={[[g('types.split'), g('types.split.rule')]]} />
      {team([
        [t('detail.coverageMeta'), defense.coverageMeta?.value ?? 0],
        [g('meta.unanswered'), defense.coverageMeta?.unanswered.length ?? 0],
      ])}
    </>
  );
}
