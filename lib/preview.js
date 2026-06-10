// `wv-kit preview` — serves built dist/<viewer>.html files inside an iframe-
// based shell that simulates FileMaker's web viewer host. The dist HTML is
// served verbatim (no injection); the parent shell installs window.FileMaker
// on the iframe, opens /sse, and routes everything through the same
// /script-mock endpoint + dev-server/mocks.js as `wv-kit start`.

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import express from 'express';
import esbuild from 'esbuild';

import { ROOT, SRC } from './directory-paths.js';
import { normalizeDevDataEncoding } from './normalize-dev-data-encoding.js';
import { addSseClient, removeSseClient, drainPostGotoQueueTo } from './sse.js';
import previewShell from './preview-shell.js';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
register('./ts-node-hook.js', pathToFileURL(LIB_DIR + '/'));

normalizeDevDataEncoding().catch(err => console.error('wv-kit: dev/*.json encoding check failed:', err));

const mocksPath = path.join(ROOT, 'dev-server/mocks.js');
const mocks = fs.existsSync(mocksPath)
  ? (await import(pathToFileURL(mocksPath).href)).default
  : {};

const DIST_DIR = path.join(ROOT, 'dist');

const app = express();
app.use('/script-mock', express.text({ type: '*/*' }));

const distViewers = fs.existsSync(DIST_DIR)
  ? fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''))
  : [];

app.get('/ping', (req, res) => res.send('pong'));

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addSseClient(res);
  drainPostGotoQueueTo(res);
  req.on('close', () => removeSseClient(res));
});

app.post('/script-mock/:scriptName', (req, res) => {
  mocks[req.params.scriptName]?.(req.body);
  res.end();
});

for (const name of distViewers) {
  app.get(`/dist/${name}.html`, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, `${name}.html`));
  });
  app.get(`/preview/${name}`, (req, res) => {
    const query = new URL(req.originalUrl, 'http://localhost').search;
    const hasOverlay = fs.existsSync(path.join(SRC, name, 'dev/nav-bar-content.js'));
    res.type('html').send(previewShell(name, distViewers, query, hasOverlay));
  });

  // Bundle the viewer's dev/nav-bar-content.js as a script-mode IIFE so the
  // parent can run it with `document` and `window` shadowed to point at the
  // iframe. Lets unchanged nav-bar-content code reach into the iframe's DOM.
  app.get(`/dev-overlay/${name}.js`, async (_req, res) => {
    const entry = path.join(SRC, name, 'dev/nav-bar-content.js');
    if (!fs.existsSync(entry)) { res.status(404).end(); return; }
    try {
      const result = await esbuild.build({
        entryPoints: [entry],
        absWorkingDir: ROOT,
        bundle: true,
        format: 'iife',
        globalName: '__wvOverlay',
        write: false,
        platform: 'browser',
        target: 'es2022',
        // Provide a non-empty value for import.meta.url — libraries (e.g.
        // kensington) call .startsWith on it for stack-trace filtering and
        // crash on undefined. The actual value doesn't matter for nav-bar
        // overlays; they don't load assets relative to themselves.
        define: { 'import.meta.url': JSON.stringify(`http://localhost/dev-overlay/${name}.js`) },
        logLevel: 'silent',
      });
      const code = result.outputFiles[0].text;
      res.type('application/javascript').send(code + '\nreturn __wvOverlay.default;\n');
    } catch (err) {
      res.status(500).type('text/plain').send(`overlay bundle failed: ${err.message}`);
    }
  });
}

app.get('/', (req, res) => {
  if (distViewers.length === 0) {
    res.status(503).type('text/plain').send(
      'No built viewers in dist/. Run `npm run build` first, then refresh.',
    );
    return;
  }
  res.redirect(`/preview/${distViewers[0]}`);
});

const PORT = Number.parseInt(process.env.PORT ?? '', 10) || 3001;
app.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\nwv-kit preview server running at ${base}`);
  if (distViewers.length === 0) {
    console.log('  (no built viewers in dist/ — run `npm run build` first)');
  } else {
    console.log('viewers:');
    for (const name of distViewers) console.log(`  ${base}/preview/${name}`);
  }
  console.log('');
});
