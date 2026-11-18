import { useId } from 'react';
import { getMove, toID } from '../../engine/dex';
import type { TypeName } from '../../engine/types';
import { gameName, typeName } from '../../i18n/game';
import { useLang, useT } from '../../i18n/react';
import { FloatTip, HiddenText, useFloatAnchor } from '../FloatTip';
import { typeColor } from '../Sprite';
import { MovePill } from '../MovePill';
import { Target, type KoTarget } from './KoBadges';

/** Mosse che servono ad altro che al danno: a 0 bersagli non sono "inutili", lo dice l'etichetta. */
const PIVOT = new Set(['uturn', 'voltswitch', 'flipturn']);
const HAZARDS = new Set(['rapidspin', 'mortalspin']);

/** Una mossa d'attacco del membro coi bersagli (fra quelli mandati KO in due colpi) su cui è la sua mossa migliore. */
export interface MoveShare { move: string; targets: KoTarget[] }

/**
 * Le mosse d'attacco del set e, per ognuna, i bersagli che manda KO in due colpi (dove è la mossa migliore del membro),
 * dalla più utile; quelle a 0 in fondo. `best(target)` = la mossa migliore del membro su quel bersaglio.
 */
export function moveShares(moves: string[], targets: KoTarget[], best: (target: KoTarget) => string | null | undefined): MoveShare[] {
  const attacks = moves.filter(name => { const move = getMove(name); return !!move && move.category !== 'Status'; }).map(name => getMove(name)!.name);
  const by = new Map<string, KoTarget[]>(attacks.map(name => [toID(name), []]));
  const names = new Map<string, string>(attacks.map(name => [toID(name), name]));
  for (const target of targets) {
    if (target.plain < 50) continue;
    const move = best(target);
    if (!move) continue;
    const id = toID(move);
    if (!by.has(id)) { by.set(id, []); names.set(id, getMove(move)?.name ?? move); }
    by.get(id)!.push(target);
  }
  return [...by.entries()].map(([id, list]) => ({ move: names.get(id)!, targets: list })).sort((a, b) => b.targets.length - a.targets.length);
}

/**
 * Sotto la barra dei colpi (squadra chiusa): quanto lavora ogni mossa d'attacco, nel colore del suo tipo, col numero dei
 * bersagli; passando su una mossa il tooltip li elenca. Pillola chiusa (tessera e numero); il nome si apre passandoci sopra. A 0 spenta (il motivo nel tooltip).
 */
export function MoveChips({ shares, of }: { shares: MoveShare[]; of: string }) {
  const t = useT();
  const lang = useLang();
  const tip = useFloatAnchor<string>();
  const id = useId();
  if (!shares.length) return <span className="mc-none">{t('kob.noAttacks')}</span>;
  const open = shares.find(s => s.move === tip.anchor?.key);
  const why = (name: string) => {
    const move = getMove(name);
    const id = toID(name);
    return move && move.priority > 0 ? t('kob.whyPriority') : PIVOT.has(id) ? t('kob.whyPivot') : HAZARDS.has(id) ? t('kob.whyHazards') : null;
  };
  return (
    <span className="mcs">
      {shares.map(({ move, targets }) => {
        const n = targets.length;
        const reason = n === 0 ? why(move) : null;
        const name = gameName('move', move, lang);
        // Raggiungibile con le frecce (data-nav, nel gruppo della tabella): col fuoco si apre il tooltip, i bersagli nella descrizione
        const desc = `${id}-${toID(move)}`;
        return (
          <MovePill key={move} name={move} size="sm" value={n} symbol={false} className={`mcp${n === 0 ? ' z' : ''}`}
            data-nav="" role="img" {...tip.bind(move)} aria-describedby={n ? desc : undefined}
            aria-label={`${name} ${n}${reason ? `, ${reason}` : ''}`}
            after={n > 0 && <HiddenText id={desc}>{targets.map(x => (x.kind === 'type' ? typeName(x.label as TypeName, lang) : x.label)).join(', ')}</HiddenText>} />
        );
      })}
      {open && tip.anchor && (
        <FloatTip rect={tip.anchor.rect} tone={typeColor(getMove(open.move)?.type ?? '')} className="kot">
          <div className="kot-head"><b>{gameName('move', open.move, lang)}</b><small>{of}</small></div>
          {open.targets.length
            ? <div className={`kot-list${open.targets[0].kind === 'mon' ? ' mons' : ''}`}>{open.targets.map(x => <Target key={x.label} target={x} />)}</div>
            : <p className="kot-none">{t('kob.moveNone')}{why(open.move) ? ` (${why(open.move)})` : ''}</p>}
        </FloatTip>
      )}
    </span>
  );
}
