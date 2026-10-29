import type { ReactElement } from 'react';
import type { CoverageDetail } from '../../engine/offense';
import type { TeamRating } from '../../engine/rating';
import type { Lang } from '../../i18n';
import { typeName } from '../../i18n/game';
import { useLang } from '../../i18n/react';
import { Sprite, TypeChip } from '../Sprite';
import type { AreaContext, DetailTab, T } from '../AreaDetail';
import { OffenseGeneral } from './OffenseGeneral';
import { OffensePower } from './OffensePower';
import { OffenseWalls } from './OffenseWalls';
import { OffenseTypes } from './OffenseTypes';
import { OffenseGuideSection, type OffenseSection } from './OffenseGuide';

/** I buchi di una Coverage, in una riga. */
const holesOf = (detail: CoverageDetail, t: T, lang: Lang) =>
  (detail.holes.length ? t('detail.coverage.holes', { list: detail.holes.map(h => typeName(h, lang)).join(', ') }) : t('detail.coverage.noHoles'));

// Pannello provvisorio: la tabella di prima senza le spiegazioni (ora nella guida); un compito successivo la sostituisce.

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
    { key: 'power', label: t('detail.power'), value: offense.power, panel: <OffensePower offense={offense} ctx={ctx} /> },
    { key: 'wallbreaking', label: t('detail.wallbreaking'), value: offense.wallbreaking, panel: <OffenseWalls offense={offense} ctx={ctx} /> },
    // La Coverage del meta c'è solo col meta: senza, una scheda in meno
    ...(coverageMeta ? [{ key: 'coverageMeta' as const, label: t('detail.coverageMeta'), value: coverageMeta.value, panel: <OffenseCoverage kind="coverageMeta" detail={coverageMeta} t={t} /> }] : []),
  ];
  return tabs.map(tab => ({ ...tab, help: guide(tab.key) }));
}
