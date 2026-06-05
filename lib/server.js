import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';

import { ROOT, SRC } from './directory-paths.js';
import injectedIndexPage from './injected-index-page.js';
import { addSseClient, removeSseClient } from './sse.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

const mocksPath = path.join(ROOT, 'dev-server/mocks.js');
const mocks = fs.existsSync(mocksPath)
  ? (await import(pathToFileURL(mocksPath).href)).default
  : {};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Shared static routes
app.get('/dev/shared-dev-index.js', (req, res) => res.sendFile(path.join(LIB_DIR, 'shared-dev-index.js')));
app.get('/dev/dev-nav.js', (req, res) => res.sendFile(path.join(LIB_DIR, 'dev-nav.js')));
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

// Auto-discover viewers from src/ directory
const viewers = fs.readdirSync(SRC)
  .filter(d => d !== 'shared' && fs.statSync(path.join(SRC, d)).isDirectory())
  .filter(d => fs.existsSync(path.join(SRC, d, 'index.js')));

const viewerNames = viewers;

for (const name of viewers) {
  app.get(`/${name}`, (req, res) => { res.send(injectedIndexPage(name, viewerNames)); });
  app.get(`/${name}/`, (req, res) => { res.send(injectedIndexPage(name, viewerNames)); });
  app.use(`/src/${name}`, express.static(path.join(SRC, name)));
}

// Mount project routes if present
const routesPath = path.join(ROOT, 'dev-server/routes.js');
if (fs.existsSync(routesPath)) {
  const { default: projectRoutes } = await import(pathToFileURL(routesPath).href);
  app.use(projectRoutes);
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
