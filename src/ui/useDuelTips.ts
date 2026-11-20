import { useEffect, useRef, useState } from 'react';
import type { EngineData } from '../engine/data';
import type { DuelTipsResult } from '../engine/duelTips';
import type { TeamSet } from '../engine/sets';
import { duelTipsLater } from './useRanking';

/** Attesa dopo l'ultimo cambio prima di calcolare (mentre si scrivono gli EV non parte un calcolo per tasto). */
const WAIT = 150;

/**
 * I consigli completi della Sfida (varianti, voti, effetti sul meta), calcolati in sottofondo. null mentre calcola o
 * senza avversario; una risposta arrivata dopo un cambio più recente si butta.
 */
export function useDuelTips(team: TeamSet[], index: number, opp: TeamSet | null, pool: string[], data: EngineData): DuelTipsResult | null {
  const [state, setState] = useState<{ seq: number; result: DuelTipsResult } | null>(null);
  const seq = useRef(0);
  const key = opp ? JSON.stringify([team, index, opp, pool]) : null;
  useEffect(() => {
    const mine = ++seq.current;
    setState(null);
    if (!key || !opp) return undefined;
    const timer = window.setTimeout(() => {
      duelTipsLater(team, index, opp, pool, data)
        .then(result => { if (seq.current === mine) setState({ seq: mine, result }); })
        .catch(() => undefined);
    }, WAIT);
    return () => window.clearTimeout(timer);
  }, [key, data]); // eslint-disable-line react-hooks/exhaustive-deps
  return state && state.seq === seq.current ? state.result : null;
}
