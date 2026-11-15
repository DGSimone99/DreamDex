import { holdBand, type HoldBand } from '../../engine/defense';
import { getMove } from '../../engine/dex';
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

/**
 * Il tooltip di una casella di Coverage tipi dell'Offesa: il tipo bersaglio in testata col badge dei colpi (niente %);
 * il membro con la sua mossa migliore (nel colore del tipo, categoria, potenza, efficacia); in righe a parte quanti colpi
 * dopo la danza o con Tera/Z, solo se salgono di fascia.
 */
export function TypeHitTip({ species, type, hit, setupMove, onceName }: { species: string; type: string; hit: TargetHit; setupMove: string | null; onceName: string | null }) {
  const t = useT();
  const lang = useLang();
  const band = bandOf(hit.plainPct);
  const move = hit.move ? getMove(hit.move) : null;
  const mult = move ? multLabel(effectiveness(move.type as TypeName, [type])) : null;
  const extra = (pct: number | null, label: string | null) => {
    if (pct === null || !label) return null;
    const up = bandOf(pct);
    return RANK[up] > RANK[band] ? { label, band: up } : null;
  };
  const extras = [
    extra(hit.setupPct, setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : null),
    extra(hit.oncePct, onceName),
  ].filter((x): x is { label: string; band: HoldBand } => !!x);
  return (
    <>
      <div className="ftip-head">
        <img src={typeIconUrl(type)} alt="" draggable={false} />
        <b>{typeName(type as TypeName, lang)}</b>
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
        <p key={x.label} className="tht-extra"><i className="kob-tri" aria-hidden="true" />{x.label}<span className={`ftip-ko off ${x.band}`}>{HOLD_BANDS[x.band].tag}</span></p>
      ))}
    </>
  );
}
