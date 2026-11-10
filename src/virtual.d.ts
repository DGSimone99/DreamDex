/** Mosse imparabili per specie (vite.config.ts, learnsetTable): specie → mossa → prima generazione. */
declare module 'virtual:learnsets' {
  const table: Record<string, Record<string, number>>;
  export default table;
}
