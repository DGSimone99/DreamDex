import type { ReactElement } from 'react';
import type { TeamDefense } from '../../engine/defense';
import type { Lang } from '../../i18n';
import { typeName } from '../../i18n/game';
import { Sprite, TypeChip } from '../Sprite';
import { DefenseGeneral } from './DefenseGeneral';
import { DefenseGuideSection } from './DefenseGuide';
import type { AreaContext, DetailTab, T } from '../AreaDetail';

/** Soglia di un colpo standard ricevuto, dal valore del colpo (holdStep: OHKO 0 … 4HKO o più 1,5). */
const HOLD_TAGS: Record<number, { cls: string; tag: string }> = {
  0: { cls: 'd-ohko', tag: 'OHKO' }, 0.5: { cls: 'd-two', tag: '2HKO' }, 1: { cls: 'd-three', tag: '3HKO' }, 1.5: { cls: 'd-four', tag: '4HKO+' },
};
export const pct = (x: number) => `${Math.round(100 * x)}%`;

/** Le schede della Difesa: Generale, Robustezza, Sostenibilità, Coverage di tipi e del meta. */
export function defenseTabs(defense: TeamDefense, meta: boolean, t: T, lang: Lang, ctx: AreaContext): DetailTab[] {
  const coverageMeta = defense.coverageMeta;
  const members = defense.members;
  const physical = defense.matrix.filter(row => row.physical);
  const special = defense.matrix.filter(row => !row.physical);
  type Key = 'robustness' | 'sustain' | 'coverageTypes' | 'coverageMeta';
  const subs: Key[] = coverageMeta ? ['robustness', 'sustain', 'coverageTypes', 'coverageMeta'] : ['robustness', 'sustain', 'coverageTypes'];
  const values: Record<Key, number | null> = {
    robustness: defense.robustness, sustain: defense.sustain, coverageTypes: defense.coverageTypes.value, coverageMeta: coverageMeta?.value ?? null,
  };
  const label = (key: Key) => (key === 'robustness' || key === 'sustain' ? t(`ddetail.${key}`) : t(`detail.${key}`));
  const weakLine = defense.coverageTypes.weak.length
    ? t('ddetail.types.weak', { list: defense.coverageTypes.weak.map(type => typeName(type, lang)).join(', ') }) : t('ddetail.types.noWeak');
  const unansweredLine = coverageMeta && (coverageMeta.unanswered.length
    ? t('ddetail.meta.unanswered', { list: coverageMeta.unanswered.join(', ') }) : t('ddetail.meta.allAnswered'));
  const sprites = (names: string[]) => (names.length
    ? names.map((name, i) => (
      <span key={`${name}-${i}`} title={name}><Sprite species={name} size={28} /><span className="visually-hidden">{name}</span></span>
    ))
    : <span className="ad-k none">—</span>);
  const general = <DefenseGeneral defense={defense} meta={meta} ctx={ctx} />;

  const side = (rows: TeamDefense['matrix'], title: string) => (
    <tbody>
      <tr className="ad-group"><th scope="rowgroup" colSpan={members.length + 1}>{title}</th></tr>
      {rows.map(row => (
        <tr key={`${row.species}-${row.physical}`}>
          <th scope="row"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></th>
          {row.cells.map((cell, i) => {
            const hold = HOLD_TAGS[cell.step];
            // La soglia anche in testo: il colore da solo non arriva ai lettori di schermo
            return <td key={i}><span className={`ad-k ${hold.cls}`} title={hold.tag}>{cell.pct}%<span className="visually-hidden"> {hold.tag}</span></span></td>;
          })}
        </tr>
      ))}
    </tbody>
  );
  const robustness = (
    <>
      <h4>{t('ddetail.robustness')}</h4>
      <div className="ad-scroll">
        <table className="ad-t ad-matrix">
          <thead>
            <tr>
              <th scope="col">{t('ddetail.attacker')}</th>
              {members.map((m, i) => (
                <th key={`${m.species}-${i}`} scope="col" aria-label={m.species} title={m.species}><Sprite species={m.species} size={32} /></th>
              ))}
            </tr>
          </thead>
          {side(physical, t('ddetail.side.physical'))}
          {side(special, t('ddetail.side.special'))}
        </table>
      </div>
    </>
  );

  const sustain = (
    <>
      <h4>{t('ddetail.sustain')}</h4>
            <div className="ad-scroll">
  <table className="ad-t">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col" className="left">{t('ddetail.recovery')}</th>
              <th scope="col">Stealth Rock</th>
              <th scope="col">Life Orb</th>
              <th scope="col">{t('ddetail.sustain')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const p = m.sustainParts;
              return (
                <tr key={`${m.species}-${i}`}>
                  <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={32} />{m.species}</span></th>
                  <td className="left">
                    {p.recovery > 0 ? `+${pct(p.recovery)}` : '—'}
                    {p.sources.length > 0 && <small className="ad-src"> {p.sources.join(' + ')}</small>}
                    {p.halved && <small className="ad-halved" title={t('ddetail.halvedTip')}> {t('ddetail.halved')}</small>}
                  </td>
                  <td>{p.rocks > 0 ? `−${pct(p.rocks)}` : '—'}</td>
                  <td>{p.lifeOrb > 0 ? `−${pct(p.lifeOrb)}` : '—'}</td>
                  <td className="total">{m.sustain}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  const coverageTypes = (
    <>
      <h4>{t('detail.coverageTypes')}</h4>
      <p className="ad-holes">{weakLine}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('detail.types')}</th>
            <th scope="col">{t('ddetail.safety')}</th>
            <th scope="col" className="left gap">{t('ddetail.weak')}</th>
            <th scope="col" className="left">{t('ddetail.resist')}</th>
          </tr>
        </thead>
        <tbody>
          {defense.coverageTypes.rows.map(row => (
            <tr key={row.type} className={row.weak.length > row.resist.length ? 'ad-weak' : undefined}>
              <th scope="row"><TypeChip type={row.type} /></th>
              <td>{row.safety}</td>
              <td className="left gap ad-cover">{sprites(row.weak)}</td>
              <td className="left ad-cover">{sprites(row.resist)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const metaTab = coverageMeta && (
    <>
      <h4>{t('detail.coverageMeta')}</h4>
      <p className="ad-holes">{unansweredLine}</p>
      <table className="ad-t">
        <thead>
          <tr>
            <th scope="col">{t('ddetail.threat')}</th>
            <th scope="col">{t('ddetail.held')}</th>
            <th scope="col" className="left">{t('ddetail.heldBy')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Dal più usato: l'ordine dice anche quanto pesa ogni minaccia */}
          {[...coverageMeta.rows].sort((a, b) => b.weight - a.weight).map(row => (
            <tr key={row.species}>
              <th scope="row"><span className="ad-mon"><Sprite species={row.species} size={32} />{row.species}</span></th>
              <td>{row.level}%</td>
              <td className="left ad-cover">
                {row.heldBy.length
                  ? row.heldBy.map((h, i) => {
                    const text = `${h.species}: ${h.move} ${h.pct}%${h.partial ? ` (${t('ddetail.partial')})` : ''}`;
                    return (
                      <span key={`${h.species}-${i}`} className={h.partial ? 'partial' : undefined} title={text}>
                        <Sprite species={h.species} size={28} />
                        {/* Lo sprite da solo non dice niente a un lettore di schermo */}
                        <span className="visually-hidden">{text}</span>
                      </span>
                    );
                  })
                  : <span className="ad-k none">{t('detail.nobody')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const panels: Record<Key, ReactElement | null> = { robustness, sustain, coverageTypes, coverageMeta: metaTab };
  const guide = (section: Parameters<typeof DefenseGuideSection>[0]['section']) => <DefenseGuideSection section={section} defense={defense} meta={meta} />;
  return [
    { key: 'general', label: t('detail.tab.general'), value: defense.value, panel: general, help: guide('general') },
    ...subs.map(key => ({ key, label: label(key), value: values[key], panel: panels[key]!, help: guide(key) })),
  ];
}
