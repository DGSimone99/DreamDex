import type { ReactElement } from 'react';
import type { TeamDefense } from '../../engine/defense';
import { DefenseGeneral } from './DefenseGeneral';
import { DefenseMeta } from './DefenseMeta';
import { DefenseTypes } from './DefenseTypes';
import { DefenseGuideSection } from './DefenseGuide';
import { DefenseSustain } from './DefenseSustain';
import type { AreaContext, DetailTab, T } from '../AreaDetail';

/** Le schede della Difesa: Generale, Coverage di tipi, Coverage del meta, Sostenibilità. */
export function defenseTabs(defense: TeamDefense, meta: boolean, t: T, ctx: AreaContext): DetailTab[] {
  const coverageMeta = defense.coverageMeta;
  type Key = 'sustain' | 'coverageTypes' | 'coverageMeta';
  const subs: Key[] = coverageMeta ? ['coverageTypes', 'coverageMeta', 'sustain'] : ['coverageTypes', 'sustain'];
  const values: Record<Key, number | null> = {
    sustain: defense.sustain, coverageTypes: defense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const label = (key: Key) => (key === 'sustain' ? t('ddetail.sustain') : t(`detail.${key}`));
  const general = <DefenseGeneral defense={defense} meta={meta} ctx={ctx} />;

  const sustain = <DefenseSustain defense={defense} ctx={ctx} />;

  const coverageTypes = <DefenseTypes defense={defense} ctx={ctx} />;
  const metaTab = coverageMeta && <DefenseMeta defense={defense} ctx={ctx} />;

  const panels: Record<Key, ReactElement | null> = { sustain, coverageTypes, coverageMeta: metaTab };
  // La guida come quella dell'Offesa: Generale, Coverage tipi e Coverage meta hanno le stesse regole, una pagina sola
  // ("Come funziona") che il "?" di tutte e tre apre; la Sostenibilità ha la sua
  const how = <DefenseGuideSection section="general" defense={defense} meta={meta} formatId={ctx.formatId} />;
  const sustainGuide = <DefenseGuideSection section="sustain" defense={defense} meta={meta} formatId={ctx.formatId} />;
  return [
    { key: 'general', label: t('detail.tab.general'), value: defense.value, panel: general, help: how, guideLabel: t('guide.off.section') },
    ...subs.map(key => ({
      key, label: label(key), value: values[key], panel: panels[key]!, effSide: key === 'sustain' ? undefined : 'defense' as const,
      ...(key === 'sustain' ? { help: sustainGuide } : { help: how, guideKey: 'general' }),
    })),
  ];
}
