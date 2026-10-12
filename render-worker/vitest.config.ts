import { defineConfig } from 'vitest/config';

/**
 * Sizing test-suite configuration for the render worker.
 *
 * environment: node — the worker spawns ffmpeg/remotion and talks HTTP; there
 * is no DOM here.
 *
 * The Supabase env vars are STUBS: the storage layer is never allowed to open
 * a real client in this suite (the in-memory stub in test/supabase-stub.ts is
 * injected through `setSupabaseClientFactory`). They are set in the config so
 * that `supabaseConfigured` is true when src/config.ts is first evaluated —
 * otherwise the queue loop refuses to poll and the storage layer would throw
 * before the injected factory is consulted.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['test/**/*.test.ts'],
    // Each test file gets its own worker; the render-pipeline suite spawns
    // real binaries when they exist and must not race the queue suite for
    // /tmp artifacts.
    fileParallelism: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // --- stubbed Supabase (see test/supabase-stub.ts) ---
      SUPABASE_URL: 'https://stub.supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'stub-service-role-key',
      // --- timing knobs: keep boot + poll loops fast/deterministic ---
      PORT: '0',
      POLL_INTERVAL_MS: '3600000',
      HEARTBEAT_INTERVAL_MS: '30000',
      JOB_TIMEOUT_MS: '900000',
      RENDER_TIMEOUT_MS: '600000',
      // Pretend Chromium exists so importing src/index.ts never shells out to
      // `remotion browser ensure` (which would need network egress).
      REMOTION_BROWSER_EXECUTABLE: '/bin/true',
    },
  },
});
