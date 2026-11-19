/**
 * Doppio (National Dex Doubles): acceso in `npm run dev`, spento nella build pubblicata finché non è completo.
 * Letto a ogni chiamata (i test lo spengono con vi.stubEnv). Per accenderlo per tutti si cambia solo questa funzione.
 */
export const doublesEnabled = (env: { DEV: boolean } = import.meta.env): boolean => env.DEV;
