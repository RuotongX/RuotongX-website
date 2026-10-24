import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Commit the build came from: Workers Builds sets WORKERS_CI_COMMIT_SHA; locally ask git.
function buildSha() {
  if (process.env.WORKERS_CI_COMMIT_SHA) return process.env.WORKERS_CI_COMMIT_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}
const sha = buildSha();
const buildInfo = sha
  ? `build <a href="https://github.com/RuotongX/RuotongX-website/commit/${sha}" target="_blank" rel="noopener">${sha}</a>`
  : 'dev build';

export default defineConfig({
  base: '/',
  server: { port: 5320, strictPort: true },
  preview: { port: 5321, strictPort: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
  plugins: [{ name: 'build-info', transformIndexHtml: (html) => html.replaceAll('%BUILD_INFO%', buildInfo) }],
});
