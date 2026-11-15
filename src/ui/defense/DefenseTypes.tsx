import { useState } from 'react';
import { battleName, battleSpecies } from '../../engine/dex';
import type { TeamDefense } from '../../engine/defense';
import type { TypeName } from '../../engine/types';
import { weatherMitigations } from '../../engine/synergy';
import { useLang, useT } from '../../i18n/react';
import { typeName } from '../../i18n/game';
import { mitigationNote } from '../AnalysisTables';
import { EffTag, effClass, effLabel } from '../effTag';
import type { AreaContext } from '../AreaDetail';
import { MemberMon } from './MemberMon';
import { Typed } from '../TypeText';
import { TypeIcons } from '../typeIcons';
import { HOLD_BANDS, HOLD_ORDER } from './holds';

/** Quanti membri reggono del tutto il tipo: 0 rosso, 1 giallo, da 2 verde. */
const countTone = (n: number) => (n === 0 ? 'bad' : n === 1 ? 'warn' : 'good');

/**
 * Coverage tipi della Difesa: un membro per riga (nello stesso punto delle altre schede), i 18 tipi in colonna. In ogni
 * casella il danno di un colpo forte di quel tipo sul lato peggiore (fisico o speciale), colorato per quanto vale
 * (OHKO rosso pieno, 2HKO rosso scuro = niente, 3HKO giallo = metà, 4 o più verde = pieno), con l'etichetta di efficacia
 * in basso a sinistra quando il tipo non è neutro (×4, ×2, ×½, ×¼, 0); il suggerimento dà i due lati. L'interruttore "Solo
 * efficacia" (`ctx.effOnly`) spegne le caselle neutre. Col puntatore la colonna si accende e sotto l'icona compare il tipo.
 * In fondo Regge (chi regge del tutto il lato peggiore); la Copertura del tipo sta nel suggerimento della sua pillola.
 * Sotto la tabella una riga bassa in fondo al pannello: a sinistra la legenda dei colori, poi le note del meteo.
 * I tipi che nessuno regge hanno il filo rosso sotto l'icona.
 */
export function DefenseTypes({ defense, ctx }: { defense: TeamDefense; ctx: AreaContext }) {
  const t = useT();
  const lang = useLang();
  const { team, analysis } = ctx;
  const roomy = !!ctx.roomy;
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const { rows, weak } = defense.coverageTypes;
  const multipliers = new Map(analysis.weakness.map(row => [row.type, row.multipliers]));
  // Il membro del motore per ogni posto del team (i Pokémon sconosciuti non ci sono)
  let next = 0;
  const slots = team.map(set => {
    const name = battleSpecies(set)?.name;
    if (!name || defense.typed[next]?.species !== name) return null;
    return next++;
  });
  /** Classi di una cella della colonna `col`: il puntatore accende riga e colonna. */
  const colClass = (col: number, extra = '') => [extra, hover?.col === col && 'x-col'].filter(Boolean).join(' ') || undefined;
  // Le note del meteo stanno sulla riga della legenda, dopo di lei; se non ci entrano si tagliano coi puntini e il testo intero è nel suggerimento
  const notes = weatherMitigations(team).map(m => mitigationNote(m, lang));

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => setHover(null)}>
          <colgroup><col className="def-col-mon" />{rows.map(row => <col key={row.type} />)}</colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {rows.map((row, i) => {
                const hole = weak.includes(row.type);
                return (
                  <th key={row.type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')}
                    onMouseEnter={() => setHover({ row: -1, col: i })}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(row.type as TypeName, lang)}{hole && ` ${t('analysis.shortfallSerious')}`}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {team.map((set, member) => {
              const s = slots[member];
              const typed = s === null ? null : defense.typed[s];
              return (
                <tr key={member} className={hover?.row === member ? 'x-row' : undefined}>
                  <th scope="row"><MemberMon name={battleName(set)} set={set} stats /></th>
                  {rows.map((row, i) => {
                    const cell = typed?.cells[i];
                    if (!cell) return <td key={row.type} className={colClass(i, `rob-cell ht-cell hold-none${ctx.effOnly ? ' eff-dim' : ''}`)}>—</td>;
                    const band = HOLD_BANDS[cell.band];
                    const tag = effLabel(multipliers.get(row.type as TypeName)?.[member] ?? 1, 'defense');
                    return (
                      <td key={row.type} className={colClass(i, `rob-cell ht-cell ${band.cls}${effClass(tag, 'defense', ctx.effOnly)}`)} onMouseEnter={() => setHover({ row: member, col: i })}
                        title={`${typeName(row.type as TypeName, lang)}: ${band.tag} · ${t('ddetail.sides', { p: cell.physical, s: cell.special })}`}>
                        <span className="hold-pct">{cell.pct}%</span>
                        <span className="visually-hidden"> {band.tag}</span>
                        <EffTag label={tag} side="defense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="ct-sum ct-sum-first">
              <th scope="row">{t('ddetail.heldBy')}</th>
              {rows.map((row, i) => {
                const level = `${t('ddetail.level')} ${row.level}%`;
                return (
                  <td key={row.type} className={colClass(i)}>
                    <span className={`ct-pill ${countTone(row.heldBy.length)}`} title={level}>
                      {row.heldBy.length}<span className="visually-hidden"> · {level}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="rob-legend ht-foot">
        <span className="area-legend" aria-hidden="true"><DefenseTypesLegend /></span>
        {notes.length > 0 && (
          <span className="ht-notes note" title={notes.join('\n')}>
            <Typed text={notes.join(' · ')} />
          </span>
        )}
      </div>
    </div>
  );
}

/** La legenda dei colori di Coverage tipi della Difesa, nella riga in fondo alla tabella: le quattro soglie del colpo. */
function DefenseTypesLegend() {
  const t = useT();
  return (
    <>
      <span>{t('ddetail.holdLegend')}</span>
      {HOLD_ORDER.map(b => <span key={b} className={`hold-chip ${HOLD_BANDS[b].cls}`}>{HOLD_BANDS[b].tag}</span>)}
    </>
  );
}
