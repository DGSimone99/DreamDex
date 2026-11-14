import type { ReactElement } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { DefenseGeneral } from './DefenseGeneral';
import { DefenseMeta, DefenseMetaLegend } from './DefenseMeta';
import { DefenseTypes, DefenseTypesLegend } from './DefenseTypes';
import { DefenseGuideSection } from './DefenseGuide';
import { DefenseSustain } from './DefenseSustain';
import type { AreaContext, DetailTab, T } from '../AreaDetail';

/** Le schede della Difesa: Generale, Coverage di tipi, Sostenibilità, Coverage del meta. */
export function defenseTabs(defense: TeamDefense, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  const coverageMeta = defense.coverageMeta;
  type Key = 'sustain' | 'coverageTypes' | 'coverageMeta';
  const subs: Key[] = coverageMeta ? ['coverageTypes', 'sustain', 'coverageMeta'] : ['coverageTypes', 'sustain'];
  const values: Record<Key, number | null> = {
    sustain: defense.sustain, coverageTypes: defense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const label = (key: Key) => (key === 'sustain' ? t('ddetail.sustain') : t(`detail.${key}`));
  const general = <DefenseGeneral defense={defense} meta={meta} ctx={ctx} />;

  const sustain = <DefenseSustain defense={defense} ctx={ctx} />;

  const coverageTypes = <DefenseTypes defense={defense} ctx={ctx} />;
  const metaTab = coverageMeta && <DefenseMeta defense={defense} ctx={ctx} />;

  const panels: Record<Key, ReactElement | null> = { sustain, coverageTypes, coverageMeta: metaTab };
  const legends: Partial<Record<Key, ReactElement>> = { coverageTypes: <DefenseTypesLegend />, coverageMeta: <DefenseMetaLegend /> };
  const guide = (section: Parameters<typeof DefenseGuideSection>[0]['section']) => <DefenseGuideSection section={section} defense={defense} meta={meta} formatId={ctx.formatId} />;
  return [
    { key: 'general', label: t('detail.tab.general'), value: defense.value, panel: general, help: guide('general') },
    ...subs.map(key => ({ key, label: label(key), value: values[key], panel: panels[key]!, help: guide(key), legend: legends[key] })),
  ];
}
