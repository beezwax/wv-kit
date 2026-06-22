import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createServer as createViteServer } from 'vite';
import express from 'express';

import { ROOT, SRC } from './directory-paths.js';
import injectedIndexPage from './injected-index-page.js';
import { normalizeDevDataEncoding } from './normalize-dev-data-encoding.js';
import { addSseClient, removeSseClient, drainPostGotoQueueTo } from './sse.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

register('./ts-node-hook.js', pathToFileURL(LIB_DIR + '/'));

normalizeDevDataEncoding().catch(err => console.error('wv-kit: dev/*.json encoding check failed:', err));

// Prefer fm/mocks.{js,ts} (colocates with fm/fm-scripts.* and fm/schema.*).
// Fall back to dev-server/mocks.js for back-compat with projects scaffolded
// before the rename.
const mocksPath = ['fm/mocks.ts', 'fm/mocks.js', 'dev-server/mocks.js']
  .map(p => path.join(ROOT, p))
  .find(fs.existsSync) ?? null;
const mocks = mocksPath
  ? (await import(pathToFileURL(mocksPath).href)).default
  : {};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Shared static routes
app.get('/dev/shared-dev-index.js', (req, res) => res.sendFile(path.join(LIB_DIR, 'shared-dev-index.js')));
app.get('/dev/dev-nav.js',          (req, res) => res.sendFile(path.join(LIB_DIR, 'dev-nav.js')));
app.get('/wv-kit.js',               (req, res) => res.sendFile(path.join(LIB_DIR, 'browser/lifecycle.js')));

// Global endpoints
app.get('/ping', (req, res) => res.send('pong'));

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addSseClient(res);
  // Replay any js frames queued during a recent goToLayout — this is the
  // freshly-loaded page that the goToLayout sent the user to.
  drainPostGotoQueueTo(res);
  req.on('close', () => removeSseClient(res));
});

// Auto-discover viewers from src/ directory
const INDEX_NAMES = ['index.js', 'index.ts', 'index.tsx', 'index.jsx'];
const viewers = fs.readdirSync(SRC)
  .filter(d => d !== 'shared' && fs.statSync(path.join(SRC, d)).isDirectory())
  .filter(d => INDEX_NAMES.some(f => fs.existsSync(path.join(SRC, d, f))));

const viewerNames = viewers;

for (const name of viewers) {
  app.get(`/${name}`, (req, res) => { res.send(injectedIndexPage(name, viewerNames)); });
  app.get(`/${name}/`, (req, res) => { res.send(injectedIndexPage(name, viewerNames)); });
}

// Default redirect to first discovered viewer
app.get('/', (req, res) => res.redirect(viewerNames[0] ? `/${viewerNames[0]}/` : '/ping'));

app.use('/script-mock', express.text({ type: '*/*' }));
app.post('/script-mock/:scriptName', (req, res) => {
  mocks[req.params.scriptName]?.(req.body);
  res.end();
});

// Vite dev server in middleware mode — handles all remaining /src transforms.
// Cache dir is placed in os.tmpdir() so node --watch never sees Vite's writes.
const viteConfigPath = path.join(ROOT, 'vite.config.js');

// Serve src/*/dev/*.json files fresh from disk on every request, bypassing
// Vite's module-graph cache. Mock handlers write these files at runtime
// (saveState, saveData, etc.), so Vite's cache is stale after the first write.
// We also exclude them from the watcher so those writes don't invalidate the
// module graph and cause churn — the middleware already guarantees freshness.
const freshDevJson = {
  name: 'wv-kit-fresh-dev-json',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];
      if (!url.match(/^\/src\/[^/]+\/dev\/[^/]+\.json$/)) return next();
      const file = path.join(ROOT, url);
      if (!file.startsWith(SRC + path.sep)) return next();
      try {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(`export default ${fs.readFileSync(file, 'utf-8')};`);
      } catch { next(); }
    });
  },
};

const vite = await createViteServer({
  configFile: fs.existsSync(viteConfigPath) ? viteConfigPath : false,
  root: ROOT,
  cacheDir: path.join(os.tmpdir(), 'wv-kit-dev', path.basename(ROOT)),
  // hmr is disabled (the browser does a full reload on FM-driven navigation);
  // ws: false stops Vite from opening a standalone WebSocket server on its
  // default port 24678 — `hmr: false` only disables the *protocol*, the ws
  // server is still spun up otherwise (for ping/error overlay), and in
  // middleware mode it binds to its own port, which leaks across `node
  // --watch` restarts as a "Port 24678 is already in use" error.
  // Watch stays enabled so Vite invalidates its module-graph cache when
  // source files change on disk. dev/*.json files are excluded because mock
  // handlers write them at runtime — freshDevJson middleware handles freshness.
  plugins: [freshDevJson],
  server: {
    middlewareMode: true,
    hmr: false,
    ws: false,
    watch: { ignored: ['**/src/*/dev/*.json'] },
  },
  appType: 'custom',
  logLevel: 'warn',
});
app.use(vite.middlewares);

const PORT = Number.parseInt(process.env.PORT ?? '', 10) || 3000;
app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\nwv-kit dev server running at ${base}`);
  if (viewerNames.length) {
    console.log('viewers:');
    for (const name of viewerNames) console.log(`  ${base}/${name}/`);
  } else {
    console.log('  (no viewers found in src/)');
  }
  console.log('');
});
