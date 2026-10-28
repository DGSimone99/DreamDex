import type { ReactElement } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { DefenseGeneral } from './DefenseGeneral';
import { DefenseMeta } from './DefenseMeta';
import { DefenseTypes } from './DefenseTypes';
import { DefenseGuideSection } from './DefenseGuide';
import { DefenseRobustness } from './DefenseRobustness';
import { DefenseSustain } from './DefenseSustain';
import type { AreaContext, DetailTab, T } from '../AreaDetail';

/** Le schede della Difesa: Generale, Coverage di tipi, Robustezza, Sostenibilità, Coverage del meta. */
export function defenseTabs(defense: TeamDefense, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  const coverageMeta = defense.coverageMeta;
  type Key = 'robustness' | 'sustain' | 'coverageTypes' | 'coverageMeta';
  const subs: Key[] = coverageMeta ? ['coverageTypes', 'robustness', 'sustain', 'coverageMeta'] : ['coverageTypes', 'robustness', 'sustain'];
  const values: Record<Key, number | null> = {
    robustness: defense.robustness, sustain: defense.sustain, coverageTypes: defense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const label = (key: Key) => (key === 'robustness' || key === 'sustain' ? t(`ddetail.${key}`) : t(`detail.${key}`));
  const general = <DefenseGeneral defense={defense} meta={meta} ctx={ctx} />;

  const robustness = <DefenseRobustness defense={defense} ctx={ctx} />;
  const sustain = <DefenseSustain defense={defense} />;

  const coverageTypes = <DefenseTypes defense={defense} ctx={ctx} />;
  const metaTab = coverageMeta && <DefenseMeta defense={defense} />;

  const panels: Record<Key, ReactElement | null> = { robustness, sustain, coverageTypes, coverageMeta: metaTab };
  const guide = (section: Parameters<typeof DefenseGuideSection>[0]['section']) => <DefenseGuideSection section={section} defense={defense} meta={meta} />;
  return [
    { key: 'general', label: t('detail.tab.general'), value: defense.value, panel: general, help: guide('general') },
    ...subs.map(key => ({ key, label: label(key), value: values[key], panel: panels[key]!, help: guide(key) })),
  ];
}
