import { useMemo } from 'react';
import type { EngineData } from '../engine/data';
import { memberSheet, type MemberSheetRow } from '../engine/memberSheet';
import { battleName, getSpecies } from '../engine/dex';
import { roleLabel } from '../engine/roles';
import { measuredSubRoles, rolesList, type SubRole } from '../engine/subRoles';
import type { TeamSet } from '../engine/sets';
import { formatPercent } from '../i18n';
import { gameName, typeName } from '../i18n/game';
import { useLang, useT } from '../i18n/react';
import { Icon } from './icons';
import { Sprite, TypeChip } from './Sprite';

/** Barra sottile 0–100 (una sola tinta: un valore basso non è un difetto, dipende dal ruolo). */
function Meter({ value }: { value: number }) {
  return <span className="sheet-meter" aria-hidden="true"><span style={{ width: `${Math.round(100 * value)}%` }} /></span>;
}

/** I profili dei membri (statistiche reali del set e voto nel ruolo), calcolati una volta per team. */
function useSheet(team: TeamSet[], data: EngineData) {
  const rows = useMemo(() => memberSheet(team, data), [team, data]);
  // Sotto-ruoli misurati di ogni membro, per nome in battaglia: gli stessi del voto e delle carte (stessa cache)
  const subRoles = useMemo(() => new Map<string, SubRole[]>(team.map(set => [battleName(set), rolesList(measuredSubRoles(set, team, data))])), [team, data]);
  return { rows, subRoles };
}

/**
 * Riga dei membri in fondo alla Panoramica: una scheda compatta per membro (sprite, nome, ruolo, voto nel ruolo)
 * e "posto libero" per gli slot vuoti; cliccando si apre il profilo di quel membro.
 */
export function MemberCards({ team, data, onOpen, onAdd }: { team: TeamSet[]; data: EngineData; onOpen: (index: number) => void; onAdd?: () => void }) {
  const t = useT();
  const { rows } = useSheet(team, data);
  return (
    <section className="member-cards" aria-label={t('analysis.members')}>
      <h3 className="overview-head"><span className="box-head">{t('analysis.members')}</span></h3>
      <ul>
        {Array.from({ length: 6 }, (_, i) => {
          const row = rows[i];
          if (!row) {
            return (
              <li key={i}>
                <button type="button" className="member-card empty" onClick={onAdd} aria-label={t('analysis.freeSlotAdd')}>{t('analysis.freeSlot')}</button>
              </li>
            );
          }
          return (
            <li key={row.species}>
              <button type="button" className="member-card" onClick={() => onOpen(i)}
                aria-label={t('analysis.openMember', { name: row.species, role: t(`sheet.role.${row.role}`), grade: row.grade })}>
                <Sprite species={row.species} item={row.item} size={40} />
                <span className="who"><strong>{row.species}</strong><small>{t(`sheet.role.${row.role}`)}</small></span>
                <b className="grade" title={t('sheet.gradeTip')}>{row.grade}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Il profilo di un membro alla volta, al posto della Panoramica: frecce per gli altri membri e ritorno. */
export function MemberProfile({ team, data, index, onIndex, onBack }: {
  team: TeamSet[];
  data: EngineData;
  index: number;
  onIndex: (index: number) => void;
  onBack: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const { rows, subRoles } = useSheet(team, data);
  const row: MemberSheetRow | undefined = rows[index];
  if (!row) return null;
  const prev = rows[(index - 1 + rows.length) % rows.length];
  const next = rows[(index + 1) % rows.length];
  const types = (list: string[]) => list.map(type => typeName(type, lang)).join(', ');
  const pct = (x: number) => formatPercent(lang, x, 0);
  const attackLabel = row.attack.kind === 'physical' ? t('sheet.atk') : row.attack.kind === 'special' ? t('sheet.spa') : row.attack.kind === 'mixed' ? t('sheet.mixed') : '—';
  const roles = subRoles.get(row.species) ?? [];
  return (
    <section className="member-profile" aria-label={row.species}>
      <nav className="member-nav">
        <button type="button" onClick={onBack} aria-label={t('analysis.backToOverview')}><Icon name="prev" /> {t('analysis.view.overview')}</button>
        {rows.length > 1 && (
          <span className="member-steps">
            <button type="button" onClick={() => onIndex((index - 1 + rows.length) % rows.length)} aria-label={t('analysis.prevMember', { name: prev.species })}><Icon name="prev" /></button>
            <span>{index + 1} / {rows.length}</span>
            <button type="button" onClick={() => onIndex((index + 1) % rows.length)} aria-label={t('analysis.nextMember', { name: next.species })}><Icon name="next" /></button>
          </span>
        )}
      </nav>
      <header className="member-hero">
        <span className="detail-sprite member-sprite"><Sprite species={row.species} item={row.item} size={96} animated /></span>
        <div>
          <h3>{row.species}</h3>
          <span className="types">{(getSpecies(row.species)?.types ?? []).map(type => <TypeChip key={type} type={type} />)}</span>
          <small>{row.item ? gameName('item', row.item, lang) : '—'}</small>
        </div>
        <div className="member-grade" title={t('sheet.gradeTip')}>
          <strong>{row.grade}</strong>
          <span>{t('sheet.grade')} · {t(`sheet.role.${row.role}`)}</span>
        </div>
      </header>
      <dl className="member-stats">
        <div>
          <dt>{t('sheet.roles')}</dt>
          <dd className="tags">{roles.length ? roles.map(role => <span key={role} className="sheet-tag">{roleLabel(role, lang)}</span>) : '—'}</dd>
        </div>
        <div title={row.speed.vsMeta ? t('sheet.speedTipMeta', { pct: pct(row.speed.share) }) : t('sheet.speedTipFree', { pct: pct(row.speed.share) })}>
          <dt>{t('sheet.speed')}</dt>
          <dd><strong>{row.speed.value}</strong> <small>{row.speed.vsMeta ? t('sheet.outspeeds', { pct: pct(row.speed.share) }) : t('sheet.fasterThan', { pct: pct(row.speed.share) })}</small><Meter value={row.speed.share} /></dd>
        </div>
        <div title={t('sheet.attackTip', { pct: pct(row.attack.share) })}>
          <dt>{t('sheet.attack')}</dt>
          <dd><strong>{row.attack.value || '—'}</strong> <small>{[attackLabel, row.attack.boostItem && gameName('item', row.attack.boostItem, lang),
            row.attack.boostAbility && gameName('ability', row.attack.boostAbility, lang)].filter(Boolean).join(' · ')}</small><Meter value={row.attack.share} /></dd>
        </div>
        <div title={row.coverage.length ? t('sheet.coverageTip', { types: types(row.coverage) }) : undefined}>
          <dt>{t('sheet.coverage')}</dt>
          <dd><strong>{row.coverage.length}/18</strong> <small>{t('sheet.types')}</small><Meter value={Math.min(1, row.coverage.length / 9)} /></dd>
        </div>
        <div title={t('sheet.bulkTip', { pct: pct(row.bulk.share) })}>
          <dt>{t('sheet.bulk')}</dt>
          <dd><strong>{t('sheet.hp', { n: row.bulk.hp })}</strong> <small>{t('sheet.defs', { def: row.bulk.def, spd: row.bulk.spd })}</small><Meter value={row.bulk.share} /></dd>
        </div>
        <div>
          <dt>{t('sheet.typing')}</dt>
          <dd className="typing">
            <span className="good">{t('sheet.resists', { n: row.typing.resist.length })}</span>
            {row.typing.immune.length > 0 && <span className="good"> · {t('sheet.immune', { types: types(row.typing.immune) })}</span>}
            {row.typing.weak.length > 0 && <span className="bad"> · {t('sheet.weak', { types: row.typing.weak.map(w => `${typeName(w.type, lang)}${w.double ? ' ×4' : ''}`).join(', ') })}</span>}
          </dd>
        </div>
        <div>
          <dt>{t('sheet.support')}</dt>
          <dd className="tags">{row.support.length ? row.support.map(tag => <span key={tag} className="sheet-tag">{t(`sheet.tag.${tag}`)}</span>) : '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
