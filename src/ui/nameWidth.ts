import { useEffect, useState } from 'react';

/**
 * Larghezza vera della parte più lunga di un nome (fra spazi e trattini), in em: quanto è larga scritta a 1px.
 * Si misura una volta con il canvas nel font vero delle carte (Kanit corsivo 800) e si tiene in memoria per testo + font.
 * Senza canvas (i test) o prima che il font sia caricato si usa la stima di prima: 0.7em per lettera.
 */
export const NAME_FONT = "italic 800 16px Kanit";
/** Spaziatura delle lettere del nome (team.css: letter-spacing 0.01em) e un po' d'aria per la pendenza del corsivo. */
const SPACING = 0.01;
const SLANT = 0.06;

const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

function context(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    // jsdom (i test): niente CanvasRenderingContext2D, e getContext scriverebbe un avviso; si resta sulla stima
    const c = typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    ctx = c && typeof c.measureText === 'function' ? c : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

const fontReady = (font: string) => {
  try { return typeof document !== 'undefined' && !!document.fonts?.check(font); } catch { return false; }
};

/** Parti del nome che non si spezzano: va a capo solo agli spazi e dopo i trattini. */
const parts = (name: string) => name.split(/\s+|(?<=-)/).filter(Boolean);

/** La stima di prima (lettere × 0.7em): serve senza canvas e finché il font non c'è. */
export const estimateEm = (name: string) => Math.max(1, ...parts(name).map(p => p.length)) * 0.7;

/** Larghezza in em della parte più lunga del nome, misurata se si può (null = non si può ancora). */
export function measureEm(name: string, font = NAME_FONT): number | null {
  const key = `${font}|${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = context();
  if (!c || !fontReady(font)) return null;
  c.font = font;
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '16');
  const em = Math.max(...parts(name).map(p => c.measureText(p).width / size + p.length * SPACING)) + SLANT;
  if (!Number.isFinite(em) || em <= 0) return null;
  cache.set(key, em);
  return em;
}

/** --name-em della carta: la misura vera quando il font è pronto (la carta si ridisegna appena il font arriva). */
export function useNameEm(name: string): number {
  const [, setReady] = useState(0);
  const em = measureEm(name);
  useEffect(() => {
    if (em !== null || !context() || typeof document === 'undefined' || !document.fonts?.load) return;
    let alive = true;
    document.fonts.load(NAME_FONT).then(() => { if (alive) setReady(n => n + 1); }, () => {});
    return () => { alive = false; };
  }, [em]);
  return em ?? estimateEm(name);
}
