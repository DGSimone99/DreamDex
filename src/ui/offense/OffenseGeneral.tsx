import type { ReactNode } from 'react';
import { battleSpecies } from '../../engine/dex';
import { stepBucket, type TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar, tone } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { Icon } from '../icons';
import { PokemonIcon } from '../PokemonName';
import { TypeIcons } from '../typeIcons';
import { offenseSlots } from './slots';

/** Quanti tipi scoperti si mostrano come chip nella tessera dei tipi; gli altri vanno in "+N". */
const UNCOVERED_CHIPS = 3;
/** Quanti bersagli senza colpo si mostrano come icone nella tessera del meta. */
const NO_HIT_ICONS = 6;

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`): i membri come righe con Potenza,
 * Wallbreaking, Coverage e Offesa, sotto una tessera per sottostatistica (un clic apre la sottoscheda).
 * Le righe seguono il team; chi il motore ha scartato (nessun attacco) resta con "—".
 */
export function OffenseGeneral({ offense, meta, ctx }: { offense: TeamOffense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { coverageMeta, members, attackers } = offense;
  const slots = offenseSlots(ctx.team, members);
  const cap = (text: string, extra?: ReactNode) => <span className="def-cap"><em>{text}</em>{extra}</span>;

  // Tipi scoperti
  const holes = offense.coverageTypes.holes;
  const hiddenTypes = holes.slice(UNCOVERED_CHIPS).map(h => typeName(h, lang)).join(', ');

  // Potenza: quanti attaccanti per stile, in barre sulla taglia della squadra
  const size = Math.max(1, ctx.team.length);
  const meter = (label: string, count: number, kind: 'phys' | 'spec' | 'mixed') => (
    <span className="def-meter">
      <span className="def-meter-top"><em>{label}</em><b className={kind}>{count}</b></span>
      <span className={`def-mini ${kind}`} aria-hidden="true"><i style={{ width: `${Math.min(100, (100 * count) / size)}%` }} /></span>
    </span>
  );

  // Wallbreaking: muri che almeno un membro manda KO in uno o due colpi
  const broken = offense.walls.filter(w => w.cells.some(c => ['ohko', 'two'].includes(stepBucket(c.step)))).length;

  // Coverage meta: i bersagli che nessuno colpisce, con la specie che li rappresenta
  const noHit = coverageMeta ? coverageMeta.rows.filter(r => coverageMeta.holes.includes(r.label)) : [];

  const tiles: { key: string; label: string; value: number; fact: ReactNode }[] = [
    {
      key: 'coverageTypes', label: t('detail.coverageTypes'), value: offense.coverageTypes.value,
      fact: <>
        {cap(t('odetail.tile.uncovered'), <b>{holes.length}/18</b>)}
        {holes.length
          ? <span className="def-visual">
            {holes.slice(0, UNCOVERED_CHIPS).map(type => (
              <span key={type} className="def-chip serious"><TypeIcons types={[type]} />{typeName(type, lang)}</span>
            ))}
            {hiddenTypes && <span className="def-more" title={hiddenTypes}>+{holes.length - UNCOVERED_CHIPS}<span className="visually-hidden"> {hiddenTypes}</span></span>}
          </span>
          : <span className="def-visual def-none"><Icon name="check" />{t('odetail.types.none')}</span>}
      </>,
    },
    {
      key: 'power', label: t('detail.power'), value: offense.power,
      fact: <span className="def-visual def-meters">
        {meter(t('odetail.physical'), attackers.physical, 'phys')}{meter(t('odetail.special'), attackers.special, 'spec')}{meter(t('odetail.mixed'), attackers.mixed, 'mixed')}
      </span>,
    },
    {
      key: 'wallbreaking', label: t('detail.wallbreaking'), value: offense.wallbreaking,
      fact: <>
        {cap(t('odetail.tile.setup'), <b>{t('odetail.tile.broken', { n: broken, total: offense.walls.length })}</b>)}
        {offense.setters.length
          ? <span className="def-visual">
            {offense.setters.map(s => (
              <span key={`${s.species}-${s.move}`} className="def-open-mon" title={`${s.species} (${s.move})`}>
                <PokemonIcon name={s.species} /><span className="visually-hidden">{s.species} ({s.move})</span>
              </span>
            ))}
          </span>
          : <span className="def-visual def-faint">{t('odetail.tile.noSetup')}</span>}
      </>,
    },
  ];
  if (meta && coverageMeta) {
    tiles.push({
      key: 'coverageMeta', label: t('detail.coverageMeta'), value: coverageMeta.value,
      fact: <>
        {cap(t('odetail.tile.noHit'), noHit.length ? <b>{noHit.length}/{coverageMeta.rows.length}</b> : undefined)}
        {noHit.length
          ? <span className="def-visual">
            {noHit.slice(0, NO_HIT_ICONS).map(r => (
              <span key={r.label} className="def-open-mon plain" title={r.species}><PokemonIcon name={r.species} /><span className="visually-hidden">{r.species}</span></span>
            ))}
            {noHit.length > NO_HIT_ICONS && <span className="def-more" title={noHit.slice(NO_HIT_ICONS).map(r => r.species).join(', ')}>+{noHit.length - NO_HIT_ICONS}</span>}
          </span>
          : <span className="def-visual def-none"><Icon name="check" />{t('odetail.meta.allHit')}</span>}
      </>,
    });
  }

  return (
    <div className="def-frame def-general">
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" /><col /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('detail.power')}</th>
              <th scope="col">{t('detail.wallbreaking')}</th>
              <th scope="col">{t('detail.coverage')}</th>
              <th scope="col">{t('area.strength')}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const m = slots[slot] === null ? null : members[slots[slot]!];
              return (
                <tr key={`${name}-${slot}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {m
                    ? <>
                      <td><Bar value={m.power} /></td>
                      <td>
                        <Bar value={m.wallbreaking} />
                        {/* Quanto aggiunge il setup al Wallbreaking del membro */}
                        {m.wallbreakingGain > 0 && <small className="ad-gain" title={t('detail.withSetup', { move: m.setupMove ?? '' })}> (+{m.wallbreakingGain})</small>}
                      </td>
                      <td><Bar value={m.covered} unit="%" /></td>
                      <td>
                        <Bar value={m.value} total />
                        {/* Tera o mossa Z: una volta a partita, un quarto del guadagno entra nel voto */}
                        {m.oneUseGain > 0 && m.oneUse && (
                          <small className="ad-once" title={m.oneUse.kind === 'tera' ? t('detail.withTera', { type: m.oneUse.name }) : t('detail.withZ', { item: m.oneUse.name })}> (+{m.oneUseGain})</small>
                        )}
                      </td>
                    </>
                    : <><td>—</td><td>—</td><td>—</td><td>—</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="def-sum def-tiles">
        {tiles.map(tile => (
          <button key={tile.key} type="button" className={`def-tile ${tone(tile.value)}`} onClick={() => ctx.open?.(tile.key)}>
            <span className="def-tile-head"><span>{tile.label}</span><b>{tile.value}</b></span>
            <span className="def-tile-fact">{tile.fact}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
