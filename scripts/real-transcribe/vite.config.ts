import { defineConfig } from 'vite';
// Harness server: cross-origin isolated (whisper.cpp needs it). The app itself is NOT served with these headers.
export default defineConfig({
  root: new URL('../..', import.meta.url).pathname,
  server: { port: 5199, strictPort: true, headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers', '@remotion/whisper-web'] },
});
