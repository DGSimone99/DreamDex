import type { TeamAnalysis } from '../engine/analysis';
import { needLabel, ownersOf } from '../engine/needs';
import { LEVEL_KEYS, type Level } from '../engine/roleLevels';
import type { TeamSet } from '../engine/sets';
import type { WeatherMitigation } from '../engine/synergy';
import { t, type Lang } from '../i18n';
import { anyGameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { TypeChip } from './Sprite';
import { MoveName } from './TypeText';

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

/** Coverage offensiva: per ogni tipo chi lo colpisce superefficace e con cosa; prima i tipi scoperti. */
export function OffenseTable({ analysis }: { analysis: TeamAnalysis }) {
  const tr = useT();
  const uncovered = analysis.coverage.filter(row => row.hitters.length === 0);
  const rows = [...uncovered, ...analysis.coverage.filter(row => row.hitters.length > 0)];
  return (
    <section className="analysis-table" aria-label={tr('analysis.coverage')}>
      <h4>{tr('analysis.coverage')}<span className="summary-info">{tr('analysis.coverageSummary', { n: 18 - uncovered.length })}</span></h4>
      <ul className="type-rows">
        {rows.map(row => (
          <li key={row.type} className={row.hitters.length ? '' : 'bad'}>
            <TypeChip type={row.type} />
            {row.hitters.length
              ? <span>{row.hitters.map((h, i) => <span key={i} className="hitter">{h.member} <small><MoveName move={h.move} /></small></span>)}</span>
              : <span className="missing">{tr('analysis.noSuperEffective')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** I bisogni del team per livello (essenziali, importanti, minori, non richiesti), con chi li copre e le note. */
export function NeedsTable({ team, analysis, levels = ['essential', 'important', 'minor', 'ignored'] }: { team: TeamSet[]; analysis: TeamAnalysis; levels?: Level[] }) {
  const tr = useT();
  const lang = useLang();
  const { needs } = analysis;
  const titles: Record<Level, string> = { essential: tr('analysis.essential'), important: tr('analysis.important'), minor: tr('analysis.minor'), ignored: tr('analysis.notRequired') };
  const groups = levels
    .map(level => ({ level, title: titles[level], rows: LEVEL_KEYS.filter(need => needs.levels[need] === level).map(need => ({ need, owners: ownersOf(team, needs, need) })) }))
    .filter(group => group.rows.length > 0);
  const essentialRows = groups.find(group => group.level === 'essential')?.rows ?? [];
  const archetype = tr(`archetype.${needs.archetype}`);
  return (
    <section className="analysis-table" aria-label={tr('analysis.rolesTable')}>
      <h4>{tr('analysis.rolesTable')}<span className="summary-info">{tr('analysis.rolesSummary', { archetype, n: essentialRows.filter(r => r.owners.length > 0).length, total: essentialRows.length })}</span></h4>
      <p className="note" title={tr(`archetype.${needs.archetype}.note`)}>
        {team.length < 6 ? tr('analysis.judgedIncomplete', { archetype }) : tr('analysis.judgedAs', { archetype })}
      </p>
      {groups.map(group => (
        <div key={group.title} className="role-group">
          <h5>{group.title}</h5>
          <ul className="role-rows">
            {group.rows.map(({ need, owners }) => {
              // Manca un essenziale: rosso. Un importante mancante: avviso tenue (pesa nel voto). Minore mancante o voce ignorata: grigio
              const essential = group.level === 'essential';
              const important = group.level === 'important';
              const state = owners.length ? (group.level !== 'ignored' ? '' : 'soft') : essential ? 'bad' : important ? 'warn' : 'soft';
              return (
                <li key={need} className={state}>
                  {owners.length ? <Icon name="check" /> : essential ? <Icon name="close" /> : <span aria-hidden="true" />}
                  <span className="role">{needLabel(need, lang)}</span>
                  <span className="owners">
                    {owners.length
                      ? owners.map(name => <span key={name} className="owner">{name}</span>)
                      : essential ? tr('analysis.missing') : important ? tr('analysis.notCovered') : group.level !== 'ignored' ? '—' : tr('analysis.notRequiredValue')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {needs.needStyle && <p>{tr('analysis.unbalanced', { style: tr(`analysis.style.${needs.needStyle}`) })}</p>}
    </section>
  );
}
