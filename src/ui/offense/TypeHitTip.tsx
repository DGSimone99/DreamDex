import { holdBand, type HoldBand } from '../../engine/defense';
import { battleSpecies, getMove, toID } from '../../engine/dex';
import type { TargetHit } from '../../engine/offense';
import { battleMoveType, moveAttackMultiplier, type TypeName } from '../../engine/types';
import type { TeamSet } from '../../engine/sets';
import { setupBoosts } from '../../engine/setupBoosts';
import { moveEffects } from './moveEffects';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { MoveLine } from '../dashboard/CoverageTip';
import { KoBadge } from '../KoBadge';
import type { DmgRange } from '../dmgText';
import { effWord } from '../effTag';
import { Sprite } from '../Sprite';
import { SPRITE_TIP_ROW } from '../spriteSizes';
import { TipDmg, TipHead, TipRow, TipRows, TipSec, TipTypeIcon } from '../TipHead';

/** Il badge dei colpi dal danno % (le soglie della Difesa: OHKO, 2HKO, 3HKO, 4HKO+). */
const bandOf = (pct: number): HoldBand => holdBand(pct / 100);
const RANK: Record<HoldBand, number> = { ohko: 3, two: 2, three: 1, four: 0 };

/** Il colpo di un membro su un bersaglio, quanto serve al tooltip (Coverage tipi: un `TargetHit`; Coverage meta: la casella). */
export type CellHit = Pick<TargetHit, 'move' | 'plainPct' | 'setupPct' | 'oncePct' | 'teamPct' | 'teamVia' | 'teamMove' | 'comboPct' | 'comboMove'>
  & Partial<Pick<TargetHit, 'plainRange' | 'setupRange' | 'onceRange' | 'teamRange' | 'comboRange'>>;

/**
 * La mossa di una riga, con lo stesso aspetto in ogni riga: la pillola nel colore del tipo, poi l'efficacia sul bersaglio a
 * parole ("superefficace ×2", "poco efficace ×½"; niente se neutra).
 */
function HitMove({ set, move, defTypes }: { set: TeamSet; move: string | null; defTypes: readonly string[] }) {
  const t = useT();
  const raw = move ? moveAttackMultiplier(set, move, defTypes) : null;
  const eff = effWord(t, raw, 'offense');
  return (
    <>
      {move ? <MoveLine name={move} type={battleMoveType(set, move)} /> : <span className="tht-none">{t('tht.noMove')}</span>}
      {eff && <span className="tip-eff">{eff}</span>}
    </>
  );
}

/**
 * Il tooltip di una casella di Coverage tipi o Coverage meta dell'Offesa: il bersaglio nella testata unica (tessera e nome
 * del tipo, o la minaccia in piedi con la sua sprite) col badge dei colpi; il membro in una riga di danno (sprite, nome, sotto
 * la mossa e l'efficacia; a destra il danno e la fascia); in sezioni a parte, con la stessa riga, dopo la danza, col meteo o
 * il campo di un compagno (triangolo azzurro, anche se cambia solo la mossa) o con Tera/Z, quando salgono di fascia:
 * l'etichetta della sezione col nome (Granfisico, "Pioggia · Pelipper"), sotto la mossa quello che cambia ("Att ×1,5").
 */
export function TypeHitTip({ species, set, type, target, hit, setupMove, onceName }: { species: string; set: TeamSet; type?: string; target?: string; hit: CellHit; setupMove: string | null; onceName: string | null }) {
  const t = useT();
  const lang = useLang();
  const band = bandOf(hit.plainPct);
  const defTypes = type ? [type] : (battleSpecies({ species: target ?? '', item: '' })?.types ?? []);
  // L'effetto di danza e meteo/campo sulla mossa di ogni riga (Att ×2 solo per una mossa fisica, Fuoco ×1,5 solo per il Fuoco...)
  const boosts = setupBoosts(set)?.boosts ?? null;
  const teamConds = (hit.teamVia ?? []).map(v => v.condition as string);
  const effectOf = (kind: 'setup' | 'once' | 'team' | 'combo', move: string | null) => (kind === 'setup' ? moveEffects(set, move, { boosts }, t, lang)
    : kind === 'team' ? moveEffects(set, move, { conditions: teamConds }, t, lang)
      : kind === 'combo' ? moveEffects(set, move, { boosts, conditions: teamConds }, t, lang) : '');
  type Extra = { label: string; effect: string; band: HoldBand; kind: 'setup' | 'once' | 'team' | 'combo'; move: string | null; pct: number; range: DmgRange | null };
  const extra = (pct: number | null, range: DmgRange | null | undefined, label: string | null, kind: Extra['kind'], move: string | null, always = false): Extra | null => {
    if (pct === null || !label) return null;
    const up = bandOf(pct);
    const effect = effectOf(kind, move);
    return RANK[up] > RANK[band] || always ? { label, effect, band: up, kind, move, pct, range: range ?? null } : null;
  };
  // Col meteo o il campo del team: "Sole · Ninetales" (più condizioni insieme col "+"); se cambia la mossa migliore la riga
  // c'è anche senza salire di fascia, col nome della mossa
  const teamMoveChanged = !!hit.teamMove && !!hit.move && toID(hit.teamMove) !== toID(hit.move);
  const teamLabel = hit.teamVia?.length ? hit.teamVia.map(s => `${t(`conditionName.${s.condition}`)} · ${s.species}`).join(' + ') : null;
  const setupName = setupMove ? gameName('move', getMove(setupMove)?.name ?? setupMove, lang) : null;
  const top = (pct: number | null) => (pct === null ? -1 : RANK[bandOf(pct)]);
  const comboUp = !!setupName && !!teamLabel && top(hit.comboPct) > Math.max(top(hit.plainPct), top(hit.setupPct), top(hit.teamPct));
  const extras = [
    extra(hit.setupPct, hit.setupRange, setupName, 'setup', hit.move),
    extra(hit.teamPct, hit.teamRange, teamLabel, 'team', hit.teamMove ?? hit.move, teamMoveChanged),
    // Danza e meteo del team insieme: solo se arrivano più in alto di ognuno dei due da solo
    // Nella riga mista solo i nomi ("Danzaspada + Sole"): chi porta il meteo è già scritto nella riga del meteo
    comboUp ? extra(hit.comboPct, hit.comboRange, `${setupName} + ${(hit.teamVia ?? []).map(v => t(`conditionName.${v.condition}`)).join(' + ')}`, 'combo', hit.comboMove ?? hit.move) : null,
    extra(hit.oncePct, hit.onceRange, onceName, 'once', hit.move),
  ].filter((x): x is Extra => !!x);
  return (
    <>
      <TipHead lead={type ? <TipTypeIcon type={type} /> : undefined} sprite={type ? undefined : target ?? ''} title={type ? typeName(type as TypeName, lang) : target}
        badge={<KoBadge side="off" band={band} />} />
      <TipSec>
        <TipRows>
          <TipRow className="tht-row" lead={<Sprite species={species} size={SPRITE_TIP_ROW} />} title={species}
            sub={<HitMove set={set} move={hit.move} defTypes={defTypes} />}
            value={<TipDmg pct={hit.plainPct} range={hit.plainRange} side="off" band={band} />} />
        </TipRows>
      </TipSec>
      {extras.map(x => (
        <TipSec key={x.label} className="tht-extra"
          label={<>{(x.kind === 'setup' || x.kind === 'combo') && <i className="kob-tri" aria-hidden="true" />}{(x.kind === 'team' || x.kind === 'combo') && <i className="kob-tri team" aria-hidden="true" />}{x.label}</>}>
          <TipRows>
            <TipRow className="tht-row" title={<HitMove set={set} move={x.move} defTypes={defTypes} />} sub={x.effect || undefined}
              value={<TipDmg pct={x.pct} range={x.range} side="off" band={x.band} />} />
          </TipRows>
        </TipSec>
      ))}
    </>
  );
}
