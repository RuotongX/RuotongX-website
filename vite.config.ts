import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Workers Builds sets WORKERS_CI_COMMIT_SHA; locally fall back to git, then to 'dev'.
function buildSha() {
  const ci = process.env.WORKERS_CI_COMMIT_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: '/',
  define: { __BUILD__: JSON.stringify(buildSha()) },
  server: { port: 5320, strictPort: true },
  preview: { port: 5321, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
});
