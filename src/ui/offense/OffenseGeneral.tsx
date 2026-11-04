import { battleSpecies } from '../../engine/dex';
import type { TeamOffense } from '../../engine/offense';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { offenseSlots } from './slots';

/**
 * La scheda Generale dell'Offesa, nella stessa cornice della Difesa (`def-frame`): i membri come righe con una colonna per
 * voce del voto (il valore sui tipi col "+N" di setup e Tera/Z, la Coverage meta) e l'Offesa del membro coi pesi della squadra.
 * Le righe seguono il team; chi il motore ha scartato resta con "—".
 */
export function OffenseGeneral({ offense, meta, ctx }: { offense: TeamOffense; meta: boolean; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { members } = offense;
  const slots = offenseSlots(ctx.team, members);
  // La colonna dei tipi riserva il posto del "+N" se almeno un membro ce l'ha (barre lunghe uguali)
  const reserve = members.some(m => m.setupGain > 0 || (m.oneUseGain > 0 && !!m.oneUse));

  return (
    <div className="def-frame off-frame def-general off-general">
      <div className="ad-scroll">
        <table className="def-grid def-members">
          <colgroup><col className="def-col-mon" /><col />{meta && <col />}<col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('detail.coverageTypes')}</th>
              {meta && <th scope="col">{t('detail.coverageMeta')}</th>}
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
                      <td>
                        {/* Quanto aggiungono setup (un terzo) e Tera o mossa Z (un quarto) al valore del membro sui tipi */}
                        <Bar value={m.value - m.setupGain - m.oneUseGain} extra={m.setupGain} extraTitle={m.setupMove ? t('detail.setupExtra', { move: gameName('move', m.setupMove, lang), n: m.setupGain }) : undefined} reserve={reserve} gain={(m.setupGain > 0 || (m.oneUseGain > 0 && m.oneUse)) && <>
                          {m.setupGain > 0 && <small className="ad-gain" title={t('detail.withSetup', { move: gameName('move', m.setupMove ?? '', lang) })}> (+{m.setupGain})</small>}
                          {m.oneUseGain > 0 && m.oneUse && (
                            <small className="ad-once" title={m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })}> (+{m.oneUseGain})</small>
                          )}
                        </>} />
                      </td>
                      {meta && <td><Bar value={m.coverMeta ?? 0} unit="%" /></td>}
                      {/* Quanto il membro porta all'Offesa, coi pesi della squadra */}
                      <td><Bar value={m.total} total /></td>
                    </>
                    : <><td>—</td>{meta && <td>—</td>}<td>—</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
