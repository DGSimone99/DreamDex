import { flushSync } from 'react-dom';
import { reducedMotion } from '../useMediaQuery';

/**
 * Disegno senza scheda grafica (accelerazione hardware spenta): Chrome ripiega su un renderer software
 * (SwiftShader, llvmpipe) o non offre WebGL. Le View Transitions lì scattano, quindi si saltano.
 */
let software: boolean | undefined;
function softwareRendering(): boolean {
  if (software !== undefined) return software;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return (software = true);
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    software = true;
  }
  return software;
}

/** Cambio di layout animato (card compatte, editor) con le View Transitions, dove ci sono, la grafica regge e il movimento è ammesso. */
export function animated(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const still = reducedMotion();
  if (!doc.startViewTransition || still || softwareRendering()) return update();
  doc.startViewTransition(() => flushSync(update));
}
