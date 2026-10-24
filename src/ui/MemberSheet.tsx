import { useMemo } from 'react';
import type { EngineData } from '../engine/data';
import { memberSheet, type MemberSheetRow } from '../engine/memberSheet';
import { battleName } from '../engine/dex';
import { roleLabel, roleShortLabel } from '../engine/roles';
import { measuredSubRoles, rolesList, type SubRole } from '../engine/subRoles';
import type { TeamSet } from '../engine/sets';
import { formatPercent } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Sprite } from './Sprite';

/** Barra sottile 0–100 (una sola tinta: un valore basso non è un difetto, dipende dal ruolo). */
function Meter({ value }: { value: number }) {
  return <span className="sheet-meter" aria-hidden="true"><span style={{ width: `${Math.round(100 * value)}%` }} /></span>;
}

/**
 * Scheda dei membri: profilo di ogni Pokémon del team con le statistiche reali del set (EV, natura, strumento, abilità)
 * e un voto nel suo ruolo. Solo informativo: il voto del team non lo usa.
 */
export function MemberSheet({ team, data }: { team: TeamSet[]; data: EngineData }) {
  const t = useT();
  const lang = useLang();
  const rows = useMemo(() => memberSheet(team, data), [team, data]);
  // Sotto-ruoli misurati di ogni membro, per nome in battaglia: gli stessi del voto e delle carte (stessa cache)
  const subRoles = useMemo(() => new Map<string, SubRole[]>(team.map(set => [battleName(set), rolesList(measuredSubRoles(set, team, data))])), [team, data]);
  if (!rows.length) return null;
  const types = (list: string[]) => list.map(type => typeName(type, lang)).join(', ');
  const pct = (x: number) => formatPercent(lang, x, 0);
  const attackLabel = (row: MemberSheetRow) =>
    row.attack.kind === 'physical' ? t('sheet.atk') : row.attack.kind === 'special' ? t('sheet.spa') : row.attack.kind === 'mixed' ? t('sheet.mixed') : '—';
  return (
    <details className="block member-sheet" aria-label={t('sheet.title')}>
      <summary><span>{t('sheet.title')}</span><span className="summary-info">{t('sheet.summary')}</span></summary>
      <div className="sheet-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('sheet.pokemon')}</th>
              <th title={t('sheet.gradeTip')}>{t('sheet.grade')}</th>
              <th>{t('sheet.roles')}</th>
              <th>{t('sheet.speed')}</th>
              <th>{t('sheet.attack')}</th>
              <th>{t('sheet.coverage')}</th>
              <th>{t('sheet.bulk')}</th>
              <th>{t('sheet.typing')}</th>
              <th>{t('sheet.support')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.species}>
                <td>
                  <div className="who">
                    <Sprite species={row.species} item={row.item} size={40} />
                    <span><strong>{row.species}</strong><small>{row.item ? gameName('item', row.item, lang) : '—'}</small></span>
                  </div>
                </td>
                <td className="grade-cell" title={t('sheet.gradeTip')}>
                  <strong>{row.grade}</strong><small>{t(`sheet.role.${row.role}`)}</small>
                </td>
                <td className="tags">
                  {subRoles.get(row.species)?.length
                    ? subRoles.get(row.species)!.map(role => <span key={role} className="sheet-tag" title={roleLabel(role, lang)}>{roleShortLabel(role, lang)}</span>)
                    : <span className="muted">—</span>}
                </td>
                <td title={row.speed.vsMeta ? t('sheet.speedTipMeta', { pct: pct(row.speed.share) }) : t('sheet.speedTipFree', { pct: pct(row.speed.share) })}>
                  <strong>{row.speed.value}</strong>
                  <small>{row.speed.vsMeta ? t('sheet.outspeeds', { pct: pct(row.speed.share) }) : t('sheet.fasterThan', { pct: pct(row.speed.share) })}</small>
                  <Meter value={row.speed.share} />
                </td>
                <td title={t('sheet.attackTip', { pct: pct(row.attack.share) })}>
                  <strong>{row.attack.value || '—'}</strong>
                  <small>{[attackLabel(row), row.attack.boostItem && gameName('item', row.attack.boostItem, lang),
                    row.attack.boostAbility && gameName('ability', row.attack.boostAbility, lang)].filter(Boolean).join(' · ')}</small>
                  <Meter value={row.attack.share} />
                </td>
                <td title={row.coverage.length ? t('sheet.coverageTip', { types: types(row.coverage) }) : undefined}>
                  <strong>{row.coverage.length}/18</strong>
                  <small>{t('sheet.types')}</small>
                  <Meter value={Math.min(1, row.coverage.length / 9)} />
                </td>
                <td title={t('sheet.bulkTip', { pct: pct(row.bulk.share) })}>
                  <strong>{t('sheet.hp', { n: row.bulk.hp })}</strong>
                  <small>{t('sheet.defs', { def: row.bulk.def, spd: row.bulk.spd })}</small>
                  <Meter value={row.bulk.share} />
                </td>
                <td className="typing">
                  <span className="good">{t('sheet.resists', { n: row.typing.resist.length })}</span>
                  {row.typing.immune.length > 0 && <span className="good"> · {t('sheet.immune', { types: types(row.typing.immune) })}</span>}
                  {row.typing.weak.length > 0 && (
                    <span className="bad"> · {t('sheet.weak', { types: row.typing.weak.map(w => `${typeName(w.type, lang)}${w.double ? ' ×4' : ''}`).join(', ') })}</span>
                  )}
                </td>
                <td className="tags">
                  {row.support.length
                    ? row.support.map(tag => <span key={tag} className="sheet-tag">{t(`sheet.tag.${tag}`)}</span>)
                    : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
