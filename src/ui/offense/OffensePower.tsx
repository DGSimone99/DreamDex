import type { CSSProperties } from 'react';
import { battleSpecies, getMove } from '../../engine/dex';
import { POWER_FULL, type TeamOffense } from '../../engine/offense';
import { TYPE_COLORS } from '../Sprite';
import { useLang, useT } from '../../i18n/react';
import { gameName, typeName } from '../../i18n/game';
import type { AreaContext } from '../AreaDetail';
import { Bar } from '../defense/DefenseGeneral';
import { MemberMon } from '../defense/MemberMon';
import { PokemonIcon } from '../PokemonName';
import { MoveName, hexToRgb, luminance } from '../TypeText';
import { offenseSlots } from './slots';

/** Testo scuro o chiaro, quello con più contrasto sul colore del tipo (sempre ≥ 4,5). */
function inkOn(hex: string): string {
  const l = luminance(hexToRgb(hex));
  return (l + 0.05) / (luminance([17, 17, 17]) + 0.05) >= 1.05 / (l + 0.05) ? '#111111' : '#ffffff';
}

/** Il fondo del chip di una mossa: il colore del suo tipo, col testo che ci si legge meglio. */
function chipStyle(move: string): CSSProperties | undefined {
  const type = getMove(move)?.type as keyof typeof TYPE_COLORS | undefined;
  const color = type && TYPE_COLORS[type];
  return color ? { background: color, color: inkOn(color) } : undefined;
}

/**
 * La scheda Potenza dell'Offesa, nella stessa cornice delle altre schede con i membri (`def-frame`): barra lunga col voto,
 * il +N di Tera o mossa Z, la mossa di setup col suo +N, e il colpo migliore nel colore del suo tipo. Righe in ordine di squadra; sotto, il riferimento del 100.
 */
export function OffensePower({ offense, ctx }: { offense: TeamOffense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const slots = offenseSlots(ctx.team, offense.members);
  const refs = offense.referenceAttackers;

  return (
    <div className="def-frame off-frame def-power">
      <div className="ad-scroll">
        <table className="def-grid def-members pw-table">
          <colgroup><col className="def-col-mon" /><col /><col className="pw-col-setup" /><col className="pw-col-move" /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              <th scope="col">{t('detail.power')}</th>
              <th scope="col">{t('detail.setupCol')}</th>
              <th scope="col">{t('detail.bestMove')}</th>
            </tr>
          </thead>
          <tbody>
            {ctx.team.map((set, slot) => {
              const name = battleSpecies(set)?.name ?? set.species;
              const m = slots[slot] === null ? null : offense.members[slots[slot]!];

              return (
                <tr key={`${name}-${slot}`}>
                  <th scope="row"><MemberMon name={name} set={set} stats="offense" /></th>
                  {m
                    ? <>
                      <td className="pw-bar">
                        <Bar value={m.power} />
                        {/* Tera o mossa Z: un quarto del guadagno entra nel voto */}
                        {m.oneUseGain > 0 && m.oneUse && (
                          <small className="ad-once" title={m.oneUse.kind === 'tera' ? t('detail.withTera', { type: typeName(m.oneUse.name, lang) }) : t('detail.withZ', { item: gameName('item', m.oneUse.name, lang) })}> (+{m.oneUseGain})</small>
                        )}
                      </td>
                      <td className="pw-setup">
                        {/* La mossa di setup e la metà del guadagno che entra nel voto */}
                        {m.setupMove
                          ? <>
                            <span className="pw-move" style={chipStyle(m.setupMove)}><MoveName move={m.setupMove} plain /></span>
                            {m.setupGain > 0 && <small className="ad-gain" title={t('detail.withSetup', { move: gameName('move', m.setupMove, lang) })}> (+{m.setupGain})</small>}
                          </>
                          : '—'}
                      </td>
                      <td>{m.bestMove ? <span className="pw-move" style={chipStyle(m.bestMove)}><MoveName move={m.bestMove} plain /></span> : '—'}</td>
                    </>
                    : <><td>—</td><td className="pw-setup">—</td><td>—</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pw-ref">
        <span>{refs.length ? t('odetail.power.ref') : t('odetail.power.refFixed', { pct: Math.round(100 * POWER_FULL) })}</span>
        {refs.map(species => <span key={species} className="def-open-mon plain" title={species}><PokemonIcon name={species} /><span className="visually-hidden">{species}</span></span>)}
      </p>
    </div>
  );
}
