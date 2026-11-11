/** Mosse imparabili per specie (vite.config.ts, learnsetTable): specie → mossa → prima generazione. */
declare module 'virtual:learnsets' {
  const table: Record<string, Record<string, number>>;
  export default table;
}

/** Versione dell'app (da package.json, vite.config.ts): va nelle segnalazioni. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Chiave pubblica di Web3Forms per il modulo Segnala (segreto di GitHub nella pubblicazione); senza, solo GitHub. */
  readonly VITE_WEB3FORMS_KEY?: string;
}
