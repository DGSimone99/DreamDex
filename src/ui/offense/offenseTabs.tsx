import type { ReactElement } from 'react';
import { stepBucket, type CoverageDetail, type TeamOffense, type WallCell } from '../../engine/offense';
import type { TeamRating } from '../../engine/rating';
import type { Lang } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang } from '../../i18n/react';
import { Sprite, TypeChip } from '../Sprite';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { OffenseGeneral } from './OffenseGeneral';
import { OffenseTypes } from './OffenseTypes';
import { OffenseGuideSection, type OffenseSection } from './OffenseGuide';

/** Casella della tabella dei muri: il danno, e tra parentesi quello dopo il setup quando cambia la soglia. */
function WallValue({ cell }: { cell: WallCell }) {
  const bucket = stepBucket(cell.step);
  const upgraded = cell.setupStep !== null && stepBucket(cell.setupStep) !== bucket;
  return (
    <span className={`ad-k ${bucket}${upgraded ? ' setup' : ''}`}>
      {cell.pct}%{upgraded ? ` (${cell.setupPct}%)` : ''}
    </span>
  );
}

/** I buchi di una Coverage, in una riga. */
const holesOf = (detail: CoverageDetail, t: T, lang: Lang) =>
  (detail.holes.length ? t('detail.coverage.holes', { list: detail.holes.map(h => typeName(h, lang)).join(', ') }) : t('detail.coverage.noHoles'));

// Pannelli provvisori: le tabelle di prima senza le spiegazioni (ora nella guida); i compiti 4-7 li sostituiscono uno a uno.

/** Potenza (provvisorio). */
function OffensePower({ offense, t }: { offense: TeamOffense; t: T }) {
  return (
    <table className="ad-t">
      <thead>
        <tr>
          <th scope="col">{t('detail.member')}</th>
          <th scope="col" aria-hidden="true" />
          <th scope="col">{t('detail.power')}</th>
          <th scope="col" className="left">{t('detail.bestMove')}</th>
        </tr>
      </thead>
      <tbody>
        {[...offense.members].sort((a, b) => b.power - a.power).map((m, i) => (
          <tr key={`${m.species}-${i}`}>
            <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
            <td><meter min={0} max={100} value={m.power} aria-hidden="true" /></td>
            <td className="total">{m.power}</td>
            <td className="left">{m.bestMove ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Wallbreaking (provvisorio). */
function OffenseWallbreaking({ offense, t }: { offense: TeamOffense; t: T }) {
  return (
    <div className="ad-scroll">
      <table className="ad-t ad-matrix">
        <thead>
          <tr>
            <th scope="col">{t('detail.wall')}</th>
            {offense.members.map((m, i) => (
              <th key={`${m.species}-${i}`} scope="col" aria-label={m.species} title={m.species}><Sprite species={m.species} size={32} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offense.walls.map(wall => (
            <tr key={wall.species}>
              <th scope="row"><span className="ad-mon"><Sprite species={wall.species} size={32} />{wall.species}</span></th>
              {wall.cells.map((cell, i) => <td key={i}><WallValue cell={cell} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Coverage di tipi o del meta (provvisorio): i bersagli con chi li copre. */
function OffenseCoverage({ kind, detail, t }: { kind: 'coverageTypes' | 'coverageMeta'; detail: CoverageDetail; t: T }) {
  const lang = useLang();
  return (
    <>
      <p className="ad-holes">{holesOf(detail, t, lang)}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.types')}</th>
            {kind === 'coverageMeta' && <th scope="col" className="left">{t('detail.member')}</th>}
            <th scope="col">{t('detail.level')}</th>
            <th scope="col" className="left">{t('detail.coveredBy')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Dal più usato: l'ordine dice anche quanto pesa ogni bersaglio */}
          {[...detail.rows].sort((a, b) => b.weight - a.weight).map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label.split('/').map(type => <TypeChip key={type} type={type} />)}</th>
              {kind === 'coverageMeta' && <td className="left"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></td>}
              <td>{row.level}%</td>
              <td className="left ad-cover">
                {row.coveredBy.length
                  ? row.coveredBy.map((c, i) => (
                    <span key={`${c.species}-${i}`} className={c.partial ? 'partial' : undefined}
                      title={`${c.species}: ${c.move} ${c.pct}%${c.partial ? ` (${t('detail.partial')})` : ''}`}>
                      <Sprite species={c.species} size={28} />
                      {/* Lo sprite da solo non dice niente a un lettore di schermo */}
                      <span className="visually-hidden">{`${c.species}: ${c.move} ${c.pct}%${c.partial ? ` (${t('detail.partial')})` : ''}`}</span>
                    </span>
                  ))
                  : <span className="ad-k none">{t('detail.nobody')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Le schede dell'Offesa, nell'ordine della Difesa: Generale, Coverage tipi, Potenza, Wallbreaking, Coverage meta. */
export function offenseTabs(rating: TeamRating, t: T, ctx: AreaContext): DetailTab[] {
  const offense = rating.offense;
  const meta = !!rating.meta;
  const coverageMeta = offense.coverageMeta;
  const value = rating.areas.find(a => a.key === 'strength')?.value ?? null;
  const guide = (section: OffenseSection) => <OffenseGuideSection section={section} offense={offense} meta={meta} />;

  const tabs: { key: OffenseSection; label: string; value: number | null; panel: ReactElement }[] = [
    { key: 'general', label: t('detail.tab.general'), value, panel: <OffenseGeneral offense={offense} meta={meta} ctx={ctx} /> },
    { key: 'coverageTypes', label: t('detail.coverageTypes'), value: offense.coverageTypes.value, panel: <OffenseTypes offense={offense} ctx={ctx} /> },
    { key: 'power', label: t('detail.power'), value: offense.power, panel: <OffensePower offense={offense} t={t} /> },
    { key: 'wallbreaking', label: t('detail.wallbreaking'), value: offense.wallbreaking, panel: <OffenseWallbreaking offense={offense} t={t} /> },
    // La Coverage del meta c'è solo col meta: senza, una scheda in meno
    ...(coverageMeta ? [{ key: 'coverageMeta' as const, label: t('detail.coverageMeta'), value: coverageMeta.value, panel: <OffenseCoverage kind="coverageMeta" detail={coverageMeta} t={t} /> }] : []),
  ];
  return tabs.map(tab => ({ ...tab, help: guide(tab.key) }));
}
