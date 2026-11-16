import { useState } from 'react';
import { HELD_LEVEL } from '../../engine/coach';
import { dummyStats, holdBand, type HoldBand } from '../../engine/defense';
import { DEFAULT_FORMAT } from '../../engine/format';
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
import { TypeIcons, typeIconUrl } from '../typeIcons';
import { FloatTip, useFloatAnchor } from '../FloatTip';
import { Sprite, typeColor } from '../Sprite';
import { useMemberTip } from '../MemberCard';
import { TypeStatsTip } from '../TypeStatsTip';
import { HOLD_BANDS, HOLD_ORDER } from './holds';

/** Colore della riga Copertura, come nell'Offesa: rosso a 0, giallo sotto il livello retto (HELD_LEVEL), verde da lì. */
const levelTone = (level: number) => (level === 0 ? 'bad' : level < HELD_LEVEL ? 'warn' : 'good');
/** Il membro regge il colpo (3HKO o meglio): solo allora può essere "il migliore" del tipo. */
const holds = (band: HoldBand) => band === 'three' || band === 'four';
/** La soglia di un danno in % (le stesse della Difesa). */
const holdBandOf = (pct: number) => holdBand(pct / 100);

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
  // Il tooltip DreamDex: sulla casella (slot >= 0) il colpo sui due lati, sul tipo in testata (slot -1) l'attaccante
  const tip = useFloatAnchor<{ slot: number; col: number }>();
  const card = useMemberTip(400, undefined, true);
  const formatId = ctx.formatId ?? DEFAULT_FORMAT.formatId;
  const attackerLabel = (type: string) => { const a = dummyStats(formatId, type); return `${t('stat.atk')} ${a.atk}, ${t('stat.spa')} ${a.spa}`; };
  // Chi regge meglio ogni tipo (danno più basso), solo se lo regge davvero (3HKO o meglio)
  const best = rows.map((_, i) => {
    let top: { slot: number; pct: number } | null = null;
    team.forEach((__, slot) => {
      const cell = slots[slot] === null ? null : defense.typed[slots[slot]!].cells[i];
      if (cell && holds(cell.band) && cell.pct < (top?.pct ?? Infinity)) top = { slot, pct: cell.pct };
    });
    return top as { slot: number; pct: number } | null;
  });
  const anchor = tip.anchor?.key ?? null;
  const openCell = anchor && anchor.slot >= 0 && slots[anchor.slot] !== null ? defense.typed[slots[anchor.slot]!].cells[anchor.col] : null;
  const openType = anchor ? rows[anchor.col].type : null;

  return (
    <div className={`def-frame def-types${roomy ? ' roomy' : ''}`}>
      <div className="ad-scroll">
        <table className="def-grid spaced ct-table" onMouseLeave={() => { setHover(null); tip.close(); }}>
          <colgroup><col className="def-col-mon" />{rows.map(row => <col key={row.type} />)}</colgroup>
          <thead>
            <tr>
              <th scope="col" className="def-mon-h">{t('detail.member')}</th>
              {rows.map((row, i) => {
                const hole = weak.includes(row.type);
                return (
                  <th key={row.type} scope="col" className={colClass(i, hole ? 'sev-serious' : '')}
                    onMouseEnter={e => { setHover({ row: -1, col: i }); tip.open({ slot: -1, col: i }, e.currentTarget); }} onMouseLeave={tip.close}>
                    <TypeIcons types={[row.type]} />
                    <span className="ct-flag" aria-hidden="true" />
                    <span className="visually-hidden">{typeName(row.type as TypeName, lang)}{hole && ` ${t('analysis.shortfallSerious')}`}{` · ${attackerLabel(row.type)}`}</span>
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
                  <th scope="row" onMouseEnter={() => { setHover({ row: member, col: -1 }); tip.close(); }}><MemberMon name={battleName(set)} set={set} stats /></th>
                  {rows.map((row, i) => {
                    const cell = typed?.cells[i];
                    if (!cell) return <td key={row.type} className={colClass(i, `rob-cell ht-cell hold-none${ctx.effOnly ? ' eff-dim' : ''}`)}>—</td>;
                    const band = HOLD_BANDS[cell.band];
                    const tag = effLabel(multipliers.get(row.type as TypeName)?.[member] ?? 1, 'defense');
                    return (
                      <td key={row.type} className={colClass(i, `rob-cell ht-cell ${band.cls}${effClass(tag, 'defense', ctx.effOnly)}`)}
                        onMouseEnter={e => { setHover({ row: member, col: i }); tip.open({ slot: member, col: i }, e.currentTarget); }} onMouseLeave={tip.close}>
                        <span className="ct-num">{cell.pct}<i>%</i></span>
                        <span className="visually-hidden"> {band.tag} · {t('ddetail.sides', { p: cell.physical, s: cell.special })}</span>
                        <EffTag label={tag} side="defense" />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* In fondo, come nell'Offesa: la Copertura di ogni tipo e chi lo regge meglio */}
            <tr className="ct-sum ct-sum-first">
              <th scope="row" onMouseEnter={() => setHover(null)}>{t('ddetail.level')}</th>
              {rows.map((row, i) => (
                <td key={row.type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}>
                  <span className={`ct-pill ${levelTone(row.level)}`}>{row.level}%</span>
                </td>
              ))}
            </tr>
            <tr className="ct-sum ct-best">
              <th scope="row" onMouseEnter={() => setHover(null)}>{t('odetail.types.best')}</th>
              {rows.map((row, i) => {
                const top = best[i];
                const who = top === null ? null : battleName(team[top.slot]);
                return (
                  <td key={row.type} className={colClass(i)} onMouseEnter={() => setHover({ row: -1, col: i })}>
                    {who
                      ? <span className="ct-best-mon" {...card.bind(team[top!.slot])}><Sprite species={who} size={34} /><span className="visually-hidden">{who}</span></span>
                      : <span className="ct-best-none" aria-label={t('analysis.shortfallSerious')}>—</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {card.tip}
      {tip.anchor && openType && anchor!.slot < 0 && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(openType)} className="tst">
          <TypeStatsTip type={openType} foot={t('ddetail.attackerTip')}
            stats={[[t('stat.atk'), dummyStats(formatId, openType).atk], [t('stat.spa'), dummyStats(formatId, openType).spa]]} />
        </FloatTip>
      )}
      {tip.anchor && openType && openCell && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(openType)} className="tht dht">
          <DefenseHitTip type={openType} species={battleName(team[anchor!.slot])} cell={openCell}
            mult={effLabel(multipliers.get(openType as TypeName)?.[anchor!.slot] ?? 1, 'defense')} />
        </FloatTip>
      )}
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

/**
 * Il tooltip di una casella: il tipo in testata col badge dei colpi (e l'efficacia sul membro se non è neutra), il
 * membro, e il colpo forte di quel tipo sui due lati (fisico e speciale), ognuno col suo badge.
 */
export function DefenseHitTip({ type, species, cell, mult }: { type: string; species: string; cell: { pct: number; physical: number; special: number; band: HoldBand }; mult: string | null }) {
  const t = useT();
  const lang = useLang();
  const side = (label: string, pct: number) => {
    const band = holdBandOf(pct);
    return (
      <span className="tht-move">
        <span className="dht-side">{label}</span>
        <span className={`ftip-ko def ${band}`}>{HOLD_BANDS[band].tag}</span>
        <b className="tht-pct">{pct}<small>%</small></b>
      </span>
    );
  };
  return (
    <>
      <div className="ftip-head">
        <img src={typeIconUrl(type)} alt="" draggable={false} />
        <b>{typeName(type as TypeName, lang)}</b>
        {mult && <span className="tht-mult">{mult}</span>}
        <span className={`ftip-ko def ${cell.band} tht-band`}>{HOLD_BANDS[cell.band].tag}</span>
      </div>
      <div className="tht-body">
        <Sprite species={species} size={48} />
        <span className="tht-text">
          <span className="tht-name">{species}</span>
          {side(t('tip.physical'), cell.physical)}
          {side(t('tip.special'), cell.special)}
        </span>
      </div>
    </>
  );
}

/** La legenda dei colori di Coverage tipi della Difesa, in alto a destra come nell'Offesa: le quattro soglie del colpo. */
function DefenseTypesLegend() {
  return (
    <>
      {HOLD_ORDER.map(b => <span key={b} className="area-legend-swatch"><i className={HOLD_BANDS[b].cls} />{HOLD_BANDS[b].tag}</span>)}
    </>
  );
}
