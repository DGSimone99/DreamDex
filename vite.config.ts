import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Il calcolo in sottofondo (src/engine/ranking.worker.ts) come modulo: i dati dei formati restano file separati, caricati solo se servono
  worker: { format: 'es' },
  // Su Windows il watcher di sistema perdeva alcune modifiche: si controllano i file a intervalli
  server: { watch: { usePolling: true, interval: 300 } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // I test UI digitano lettera per lettera in jsdom: sotto carico parallelo superano i 5 s di default
    testTimeout: 15000,
  },
});
