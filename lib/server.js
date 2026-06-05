import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { transform } from 'esbuild';
import express from 'express';

import { ROOT, SRC } from './directory-paths.js';
import injectedIndexPage from './injected-index-page.js';
import { addSseClient, removeSseClient } from './sse.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

register('./ts-node-hook.js', pathToFileURL(LIB_DIR + '/'));

const mocksPath = path.join(ROOT, 'dev-server/mocks.js');
const mocks = fs.existsSync(mocksPath)
  ? (await import(pathToFileURL(mocksPath).href)).default
  : {};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Shared static routes
app.get('/dev/shared-dev-index.js', (req, res) => res.sendFile(path.join(LIB_DIR, 'shared-dev-index.js')));
app.get('/dev/dev-nav.js',          (req, res) => res.sendFile(path.join(LIB_DIR, 'dev-nav.js')));
app.get('/wv-kit.js',               (req, res) => res.sendFile(path.join(LIB_DIR, 'browser/lifecycle.js')));
app.use('/src/shared', express.static(path.join(ROOT, 'src', 'shared')));

// Global endpoints
app.get('/ping', (req, res) => res.send('pong'));

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addSseClient(res);
  req.on('close', () => removeSseClient(res));
});

// TS/JSX transform — must be before static routes
const LOADERS = { '.jsx': 'jsx', '.ts': 'ts', '.tsx': 'tsx' };
app.use('/src', async (req, res, next) => {
  const ext = req.path.match(/\.(jsx|tsx?|js)$/)?.[0];
  if (!ext) return next();
  let filePath = path.join(SRC, req.path);
  let loader = LOADERS[ext];
  if (ext === '.js' && !fs.existsSync(filePath)) {
    for (const [tsExt, tsLoader] of Object.entries(LOADERS)) {
      const candidate = filePath.replace(/\.js$/, tsExt);
      if (fs.existsSync(candidate)) { filePath = candidate; loader = tsLoader; break; }
    }
  }
  if (!loader || !fs.existsSync(filePath)) return next();
  try {
    const result = await transform(fs.readFileSync(filePath, 'utf-8'), {
      loader,
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      target: 'esnext',
      format: 'esm',
    });
    res.setHeader('Content-Type', 'application/javascript');
    res.send(result.code);
  } catch (err) {
    res.status(500).type('js').send(`throw new Error(${JSON.stringify(err.message)});`);
  }
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
  app.use(`/src/${name}`, express.static(path.join(SRC, name)));
}

// Default redirect to first discovered viewer
app.get('/', (req, res) => res.redirect(viewerNames[0] ? `/${viewerNames[0]}/` : '/ping'));

app.use('/script-mock', express.text({ type: '*/*' }));
app.post('/script-mock/:scriptName', (req, res) => {
  mocks[req.params.scriptName]?.(req.body);
  res.end();
});

app.listen(3000, () => {
  console.log('server started on port 3000');
  console.log('viewers:', viewerNames.map(n => `/${n}`).join(', '));
});
