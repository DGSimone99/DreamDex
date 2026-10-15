import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Su Windows il watcher di sistema perdeva alcune modifiche: si controllano i file a intervalli
  server: { watch: { usePolling: true, interval: 300 } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
