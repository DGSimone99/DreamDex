import { holdBand, type HoldBand } from '../../engine/defense';
import { battleSpecies, getMove, toID } from '../../engine/dex';
import type { TargetHit } from '../../engine/offense';
import { battleMoveType, moveAttackMultiplier, type TypeName } from '../../engine/types';
import type { TeamSet } from '../../engine/sets';
import { setupBoosts } from '../../engine/setupBoosts';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { MoveLine } from '../dashboard/CoverageTip';
import { HOLD_BANDS } from '../defense/holds';
import { Sprite } from '../Sprite';
import { typeIconUrl } from '../typeIcons';

/** Il badge dei colpi dal danno % (le soglie della Difesa: OHKO, 2HKO, 3HKO, 4HKO+). */
const bandOf = (pct: number): HoldBand => holdBand(pct / 100);
const RANK: Record<HoldBand, number> = { ohko: 3, two: 2, three: 1, four: 0 };
const multLabel = (m: number) => (m >= 4 ? '×4' : m > 1 ? '×2' : m === 0 ? '×0' : m <= 0.25 ? '×¼' : m < 1 ? '×½' : '×1');
const multTone = (m: number) => (m > 1 ? 'se' : m < 1 ? 'nve' : 'neutral');

/** Quanto alza il danno ogni meteo o campo, e su che tipo di mosse (gli altri non alzano il danno di chi attacca). */
const FIELD_BOOST: Record<string, { type: TypeName; mult: number }> = {
  sun: { type: 'Fire', mult: 1.5 }, rain: { type: 'Water', mult: 1.5 },
  electricterrain: { type: 'Electric', mult: 1.3 }, psychicterrain: { type: 'Psychic', mult: 1.3 }, grassyterrain: { type: 'Grass', mult: 1.3 },
};

/** Il colpo di un membro su un bersaglio, quanto serve al tooltip (Coverage tipi: un `TargetHit`; Coverage meta: la casella). */
export type CellHit = Pick<TargetHit, 'move' | 'plainPct' | 'setupPct' | 'oncePct' | 'teamPct' | 'teamVia' | 'teamMove' | 'comboPct' | 'comboMove'>;

/**
 * Una mossa nel tooltip, con lo stesso aspetto in ogni riga: icona e nome nel colore del tipo, categoria e potenza, poi
 * l'efficacia sul bersaglio (×2 verde, ×1 spento, ×½ rosso) e il danno %.
 */
function HitLine({ set, move, defTypes, pct }: { set: TeamSet; move: string | null; defTypes: readonly string[]; pct: number }) {
  const t = useT();
  const raw = move ? moveAttackMultiplier(set, move, defTypes) : null;
  return (
    <span className="tht-move">
      {move ? <MoveLine name={move} type={battleMoveType(set, move)} /> : <span className="tht-none">{t('tht.noMove')}</span>}
      {raw !== null && <span className={`tht-mult ${multTone(raw)}`}>{multLabel(raw)}</span>}
      <b className="tht-pct">{pct}<small>%</small></b>
    </span>
  );
}

/**
 * Il tooltip di una casella di Coverage tipi o Coverage meta dell'Offesa: il bersaglio in testata (icona e nome del tipo,
 * o sprite e nome della minaccia) col badge dei colpi; il membro con la sua mossa migliore (nel colore del tipo, categoria,
 * potenza, efficacia, danno %); in righe a parte, con la stessa forma, dopo la danza, col meteo o il campo di un compagno
 * (triangolo azzurro, anche se cambia solo la mossa) o con Tera/Z, quando salgono di fascia.
 */
export function TypeHitTip({ species, set, type, target, hit, setupMove, onceName }: { species: string; set: TeamSet; type?: string; target?: string; hit: CellHit; setupMove: string | null; onceName: string | null }) {
  const t = useT();
  const lang = useLang();
  const band = bandOf(hit.plainPct);
  const defTypes = type ? [type] : (battleSpecies({ species: target ?? '', item: '' })?.types ?? []);
  const num = (x: number) => x.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 2 });
  // L'effetto, piccolo accanto al nome: "Att ×2" per la danza (gli stadi di Attacco / Attacco Speciale), "Fuoco ×1,5" per il meteo
  const boosts = setupBoosts(set)?.boosts ?? {};
  const setupEffect = (['atk', 'spa'] as const).filter(k => (boosts[k] ?? 0) > 0).map(k => `${t(`stat.${k}`)} ×${num((2 + boosts[k]!) / 2)}`).join(' · ');
  const teamEffect = (hit.teamVia ?? []).map(v => FIELD_BOOST[v.condition]).filter(Boolean).map(b => `${typeName(b.type, lang)} ×${num(b.mult)}`).join(' · ');
  const extra = (pct: number | null, label: string | null, kind: 'setup' | 'once' | 'team' | 'combo', move: string | null, always = false) => {
    if (pct === null || !label) return null;
    const up = bandOf(pct);
    const effect = kind === 'setup' ? setupEffect : kind === 'team' ? teamEffect : kind === 'combo' ? [setupEffect, teamEffect].filter(Boolean).join(' · ') : '';
    return RANK[up] > RANK[band] || always ? { label, effect, band: up, kind, move, pct } : null;
  };
  // Col meteo o il campo del team: "Sole · Ninetales" (più condizioni insieme col "+"); se cambia la mossa migliore la riga
  // c'è anche senza salire di fascia, col nome della mossa
  const teamMoveChanged = !!hit.teamMove && !!hit.move && toID(hit.teamMove) !== toID(hit.move);
  const teamLabel = hit.teamVia?.length ? hit.teamVia.map(s => `${t(`conditionName.${s.condition}`)} · ${s.species}`).join(' + ') : null;
  const setupName = setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : null;
  const top = (pct: number | null) => (pct === null ? -1 : RANK[bandOf(pct)]);
  const comboUp = !!setupName && !!teamLabel && top(hit.comboPct) > Math.max(top(hit.plainPct), top(hit.setupPct), top(hit.teamPct));
  const extras = [
    extra(hit.setupPct, setupName, 'setup', hit.move),
    extra(hit.teamPct, teamLabel, 'team', hit.teamMove ?? hit.move, teamMoveChanged),
    // Danza e meteo del team insieme: solo se arrivano più in alto di ognuno dei due da solo
    comboUp ? extra(hit.comboPct, `${setupName} + ${teamLabel}`, 'combo', hit.comboMove ?? hit.move) : null,
    extra(hit.oncePct, onceName, 'once', hit.move),
  ].filter((x): x is { label: string; effect: string; band: HoldBand; kind: 'setup' | 'once' | 'team' | 'combo'; move: string | null; pct: number } => !!x);
  return (
    <>
      <div className={`ftip-head${target ? ' tht-target' : ''}`}>
        {type ? <img src={typeIconUrl(type)} alt="" draggable={false} /> : <Sprite species={target ?? ''} size={40} />}
        <b>{type ? typeName(type as TypeName, lang) : target}</b>
        <span className={`ftip-ko off ${band} tht-band`}>{HOLD_BANDS[band].tag}</span>
      </div>
      <div className="tht-body">
        <Sprite species={species} size={48} />
        <span className="tht-text">
          <span className="tht-name">{species}</span>
          <HitLine set={set} move={hit.move} defTypes={defTypes} pct={hit.plainPct} />
        </span>
      </div>
      {extras.map(x => (
        <div key={x.label} className="tht-extra">
          <span className="tht-extra-h">{(x.kind === 'setup' || x.kind === 'combo') && <i className="kob-tri" aria-hidden="true" />}{(x.kind === 'team' || x.kind === 'combo') && <i className="kob-tri team" aria-hidden="true" />}{x.label}{x.effect && <small className="tht-eff">{x.effect}</small>}<span className={`ftip-ko off ${x.band}`}>{HOLD_BANDS[x.band].tag}</span></span>
          <HitLine set={set} move={x.move} defTypes={defTypes} pct={x.pct} />
        </div>
      ))}
    </>
  );
}

