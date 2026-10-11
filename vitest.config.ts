import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts{,x}'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
    env: {
      // Hermetic stand-ins for the Supabase env the client libs read via
      // import.meta.env. Tests never touch the network.
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
