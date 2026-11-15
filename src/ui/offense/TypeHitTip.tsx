import { holdBand, type HoldBand } from '../../engine/defense';
import { battleSpecies, getMove } from '../../engine/dex';
import type { TargetHit } from '../../engine/offense';
import { effectiveness, type TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { MoveLine } from '../dashboard/CoverageTip';
import { HOLD_BANDS } from '../defense/holds';
import { Sprite } from '../Sprite';
import { typeIconUrl } from '../typeIcons';

/** Il badge dei colpi dal danno % (le soglie della Difesa: OHKO, 2HKO, 3HKO, 4HKO+). */
const bandOf = (pct: number): HoldBand => holdBand(pct / 100);
const RANK: Record<HoldBand, number> = { ohko: 3, two: 2, three: 1, four: 0 };
const multLabel = (m: number) => (m >= 4 ? '×4' : m > 1 ? '×2' : m === 0 ? '×0' : m <= 0.25 ? '×¼' : m < 1 ? '×½' : null);

/** Il colpo di un membro su un bersaglio, quanto serve al tooltip (Coverage tipi: un `TargetHit`; Coverage meta: la casella). */
export type CellHit = Pick<TargetHit, 'move' | 'plainPct' | 'setupPct' | 'oncePct' | 'teamPct' | 'teamVia'>;

/**
 * Il tooltip di una casella di Coverage tipi o Coverage meta dell'Offesa: il bersaglio in testata (icona e nome del tipo,
 * o sprite e nome della minaccia) col badge dei colpi (niente %);
 * il membro con la sua mossa migliore (nel colore del tipo, categoria, potenza, efficacia); in righe a parte quanti colpi
 * dopo la danza, col meteo o il campo di un compagno (triangolo azzurro) o con Tera/Z, solo se salgono di fascia.
 */
export function TypeHitTip({ species, type, target, hit, setupMove, onceName }: { species: string; type?: string; target?: string; hit: CellHit; setupMove: string | null; onceName: string | null }) {
  const t = useT();
  const lang = useLang();
  const band = bandOf(hit.plainPct);
  const move = hit.move ? getMove(hit.move) : null;
  const defTypes = type ? [type] : (battleSpecies({ species: target ?? '', item: '' })?.types ?? []);
  const mult = move ? multLabel(effectiveness(move.type as TypeName, defTypes)) : null;
  const extra = (pct: number | null, label: string | null, kind: 'setup' | 'once' | 'team') => {
    if (pct === null || !label) return null;
    const up = bandOf(pct);
    return RANK[up] > RANK[band] ? { label, band: up, kind } : null;
  };
  // Col meteo o il campo del team: "Sole · Ninetales" (più condizioni insieme col "+")
  const teamLabel = hit.teamVia?.length ? hit.teamVia.map(s => `${t(`conditionName.${s.condition}`)} · ${s.species}`).join(' + ') : null;
  const extras = [
    extra(hit.setupPct, setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : null, 'setup'),
    extra(hit.teamPct, teamLabel, 'team'),
    extra(hit.oncePct, onceName, 'once'),
  ].filter((x): x is { label: string; band: HoldBand; kind: 'setup' | 'once' | 'team' } => !!x);
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
          {hit.move
            ? <span className="tht-move"><MoveLine name={hit.move} />{mult && <span className="tht-mult">{mult}</span>}</span>
            : <span className="tht-none">{t('tht.noMove')}</span>}
        </span>
      </div>
      {extras.map(x => (
        <p key={x.label} className="tht-extra">{x.kind !== 'once' && <i className={`kob-tri${x.kind === 'team' ? ' team' : ''}`} aria-hidden="true" />}{x.label}<span className={`ftip-ko off ${x.band}`}>{HOLD_BANDS[x.band].tag}</span></p>
      ))}
    </>
  );
}

