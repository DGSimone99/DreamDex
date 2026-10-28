import type { ReactNode } from 'react';
import { weaknessSeverity } from '../../engine/coach';
import type { TeamDefense } from '../../engine/defense';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Sprite } from '../Sprite';
import { TypeIcons } from '../typeIcons';

/** Il colore della tessera dal valore: buono da 80, medio da 50, scarso sotto. */
const tone = (value: number) => (value >= 80 ? 'good' : value >= 50 ? 'warn' : 'bad');

/** Una barra con il numero accanto (0-100). */
function Bar({ value, total }: { value: number; total?: boolean }) {
  return (
    <span className="def-cell">
      <span className={`def-bar${total ? ' total' : ''}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
      <span className="def-num">{value}</span>
    </span>
  );
}

/**
 * La scheda Generale della Difesa: una tessera per sottostatistica (valore e il fatto più importante, un clic apre la
 * sottoscheda) e sotto i membri con Fisica / Speciale / Sostenibilità / Difesa come barre.
 */
export function DefenseGeneral({ defense, meta, ctx }: { defense: TeamDefense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { coverageMeta, members } = defense;
  const recoverers = members.filter(m => m.sustainParts.recovery > 0).length;

  // Tipi scoperti, i gravi per primi
  const exposed = ctx.analysis.weakness
    .map(row => ({ type: row.type, severity: weaknessSeverity(row) }))
    .filter(row => row.severity !== null)
    .sort((a, b) => Number(b.severity === 'serious') - Number(a.severity === 'serious'));

  const tiles: { key: string; label: string; value: number; fact: ReactNode }[] = [
    {
      key: 'robustness', label: t('ddetail.robustness'), value: defense.robustness,
      fact: t('ddetail.tile.robustness', { physical: defense.physical, special: defense.special }),
    },
    {
      key: 'sustain', label: t('ddetail.sustain'), value: defense.sustain,
      fact: recoverers === 1 ? t('ddetail.tile.recoveryOne', { m: members.length }) : t('ddetail.tile.recovery', { n: recoverers, m: members.length }),
    },
    {
      key: 'coverageTypes', label: t('detail.coverageTypes'), value: defense.coverageTypes.value,
      fact: exposed.length
        ? <><em>{t('ddetail.tile.exposed')}</em>{exposed.map(row => (
          <span key={row.type} className="def-exposed"><TypeIcons types={[row.type]} />{typeName(row.type, lang)}</span>
        ))}</>
        : t('ddetail.types.noWeak'),
    },
  ];
  if (meta && coverageMeta) {
    tiles.push({
      key: 'coverageMeta', label: t('detail.coverageMeta'), value: coverageMeta.value,
      fact: coverageMeta.unanswered.length
        ? t('ddetail.tile.unanswered', { n: coverageMeta.unanswered.length, total: coverageMeta.rows.length })
        : t('ddetail.meta.allAnswered'),
    });
  }

  return (
    <>
      <div className="def-tiles">
        {tiles.map(tile => (
          <button key={tile.key} type="button" className={`def-tile ${tone(tile.value)}`} aria-label={`${tile.label} ${tile.value}`}
            onClick={() => ctx.open?.(tile.key)}>
            <span className="def-tile-head"><span>{tile.label}</span><b>{tile.value}</b></span>
            <span className="def-tile-fact">{tile.fact}</span>
          </button>
        ))}
      </div>
      <div className="ad-scroll">
        <table className="def-members">
          <thead>
            <tr>
              <th scope="col">{t('detail.member')}</th>
              <th scope="col">{t('ddetail.physical')}</th>
              <th scope="col">{t('ddetail.special')}</th>
              <th scope="col">{t('ddetail.sustain')}</th>
              <th scope="col">{t('area.defense')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={`${m.species}-${i}`}>
                <th scope="row"><span className="ad-mon"><Sprite species={m.species} size={30} />{m.species}</span></th>
                <td><Bar value={m.physical} /></td>
                <td><Bar value={m.special} /></td>
                <td><Bar value={m.sustain} /></td>
                <td>
                  <Bar value={m.value} total />
                  {/* Quanto aggiunge il setup difensivo (metà del guadagno entra nel voto) */}
                  {m.setupGain > 0 && m.setupMove && <small className="ad-gain" title={t('ddetail.withSetup', { move: m.setupMove })}> (+{m.setupGain})</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
