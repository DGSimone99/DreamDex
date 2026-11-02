import type { WeatherMitigation } from '../engine/synergy';
import { t, type Lang } from '../i18n';
import { anyGameName, typeName } from '../i18n/game';

const MULTIPLIER_LABELS: Record<string, string> = { '4': '×4', '2': '×2', '1': '', '0.5': '×½', '0.25': '×¼', '0': '×0' };
export const formatMultiplier = (m: number) => MULTIPLIER_LABELS[String(m)] ?? `×${m}`;
/** "Col sole (Ninetales, Drought): Water ×2 → ×1 per Ninetales, Great Tusk · il meteo non è sempre attivo" */
export function mitigationNote(m: WeatherMitigation, lang: Lang): string {
  const groups = new Map<string, string[]>();
  for (const x of m.members) {
    const key = `${formatMultiplier(x.from)} → ${formatMultiplier(x.to) || '×1'}`;
    groups.set(key, [...(groups.get(key) ?? []), x.species]);
  }
  const changes = [...groups].map(([change, names]) =>
    t(lang, 'analysis.mitigationFor', { type: typeName(m.type, lang), change, list: names.join(', ') })).join('; ');
  const [setter, via = ''] = m.source.replace(/\)$/, '').split(' (');
  const source = via ? `${setter}, ${anyGameName(via, lang)}` : setter;
  return t(lang, 'analysis.mitigation', { condition: t(lang, `analysis.mitigation.${m.condition as 'sun' | 'rain' | 'grassyterrain' | 'mistyterrain'}`), source, changes });
}

