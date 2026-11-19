/**
 * Doppio (National Dex Doubles): acceso in `npm run dev`, spento nella build pubblicata finché non è completo.
 * Letto a ogni chiamata (i test lo spengono con vi.stubEnv). Per accenderlo per tutti si cambia solo questa funzione.
 */
// Fuori da Vite (gli script lanciati con tsx: banco, fetch) `import.meta.env` non esiste: lì è spento, come nella build pubblicata.
export const doublesEnabled = (env: { DEV: boolean } | undefined = import.meta.env): boolean => env?.DEV ?? false;
