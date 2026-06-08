// End-to-end tests that run the same checks against every example in
// `examples/`. For each example we spawn the wv-kit dev server with its
// `cwd` set to the example, then hit it over HTTP.
//
// All examples share port 3000, so describe blocks run sequentially (which is
// the default within a single test file in node:test).

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR    = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = path.resolve(TEST_DIR, '..');
const EXAMPLES    = path.join(REPO_ROOT, 'examples');
const SERVER_FILE = path.join(REPO_ROOT, 'lib/server.js');
const PORT        = 3000;
const BASE_URL    = `http://127.0.0.1:${PORT}`;

const INDEX_NAMES = ['index.js', 'index.ts', 'index.tsx', 'index.jsx'];

const exampleDirs = fs.readdirSync(EXAMPLES)
  .map(d => path.join(EXAMPLES, d))
  .filter(d => fs.statSync(d).isDirectory())
  .filter(d => fs.existsSync(path.join(d, 'package.json')));

function discoverViewers(srcDir) {
  return fs.readdirSync(srcDir)
    .filter(d => d !== 'shared' && fs.statSync(path.join(srcDir, d)).isDirectory())
    .filter(d => INDEX_NAMES.some(f => fs.existsSync(path.join(srcDir, d, f))));
}

function viewerIndexFile(srcDir, viewer) {
  return INDEX_NAMES.find(f => fs.existsSync(path.join(srcDir, viewer, f)));
}

function startServer(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_FILE], {
      cwd,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    let stderr = '';

    const onStdout = chunk => {
      const s = chunk.toString();
      if (!started && /running at http/.test(s)) {
        started = true;
        child.stdout.off('data', onStdout);
        resolve(child);
      }
    };
    child.stdout.on('data', onStdout);
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.on('exit', code => {
      if (!started) reject(new Error(`server exited before start (code ${code})\n${stderr}`));
    });

    setTimeout(() => {
      if (!started) {
        child.kill('SIGKILL');
        reject(new Error(`server start timeout\n${stderr}`));
      }
    }, 30_000).unref();
  });
}

function stopServer(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 5_000).unref();
  });
}

for (const exampleDir of exampleDirs) {
  const exampleName = path.basename(exampleDir);
  const hasNodeModules = fs.existsSync(path.join(exampleDir, 'node_modules'));

  describe(`examples/${exampleName}`, { skip: !hasNodeModules && 'node_modules not installed — run `npm install` in this example first' }, () => {
    let server;
    const srcDir = path.join(exampleDir, 'src');
    const viewers = fs.existsSync(srcDir) ? discoverViewers(srcDir) : [];

    before(async () => { server = await startServer(exampleDir); });
    after(async () => { await stopServer(server); });

    it('has at least one viewer in src/', () => {
      assert.ok(viewers.length > 0, `no viewers discovered in ${srcDir}`);
    });

    it('GET /ping → pong', async () => {
      const res = await fetch(`${BASE_URL}/ping`);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), 'pong');
    });

    it('GET /wv-kit.js serves the lifecycle module', async () => {
      const res = await fetch(`${BASE_URL}/wv-kit.js`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.match(body, /flushMounts/);
      assert.match(body, /onMount/);
    });

    it('GET / redirects to the first viewer', async () => {
      const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      const location = res.headers.get('location');
      assert.ok(location, 'missing Location header');
      assert.ok(viewers.some(v => location === `/${v}/`), `Location ${location} does not match a known viewer`);
    });

    it('GET /sse opens a text/event-stream', async () => {
      const controller = new AbortController();
      const res = await fetch(`${BASE_URL}/sse`, { signal: controller.signal });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
      controller.abort();
      // drain so the body close doesn't leak
      try { await res.body?.cancel(); } catch {}
    });

    for (const viewer of viewers) {
      describe(`viewer "${viewer}"`, () => {
        it('GET /<viewer>/ returns an HTML shell with #app and dev scripts', async () => {
          const res = await fetch(`${BASE_URL}/${viewer}/`);
          assert.equal(res.status, 200);
          const body = await res.text();
          assert.match(body, /<main id="app">/);
          assert.match(body, /\/dev\/shared-dev-index\.js/);
          // The injected inline script imports the viewer's index module by its
          // actual extension (.js/.ts/.tsx/.jsx).
          assert.match(body, new RegExp(`/src/${viewer}/index\\.(js|ts|tsx|jsx)`));
        });

        it('Vite transforms the viewer entry module', async () => {
          // Request `.js` and let Vite's middleware resolve to the actual
          // on-disk file (`.ts`/`.tsx`/`.jsx`). That's how the injected
          // shell loads the entry, so it's the right path to test.
          const url = `${BASE_URL}/src/${viewer}/index.js`;
          const res = await fetch(url);
          assert.equal(res.status, 200, `failed to fetch ${url}`);
          assert.match(res.headers.get('content-type') ?? '', /javascript/);
          const body = await res.text();
          assert.ok(body.length > 0, 'empty transform output');
          assert.ok(/export\s+default/.test(body) || /export\s*\{/.test(body),
            'transformed module has no export');
        });

        // Guard against drift like the dead `fetch('/api/products')` pattern
        // that previously existed in plain-js and react-tsx (the server has
        // no /api/* endpoints).
        it('dev/nav-bar-content.js (if present) does not reference dead /api/* endpoints', () => {
          const navPath = path.join(srcDir, viewer, 'dev/nav-bar-content.js');
          if (!fs.existsSync(navPath)) return;
          const src = fs.readFileSync(navPath, 'utf-8');
          assert.doesNotMatch(src, /\/api\//,
            `${path.relative(REPO_ROOT, navPath)} references /api/* — that endpoint does not exist on the dev server`);
        });
      });
    }

    it('dev nav appears in multi-viewer projects', async () => {
      if (viewers.length < 2) return;
      const res = await fetch(`${BASE_URL}/${viewers[0]}/`);
      const body = await res.text();
      assert.match(body, /id="dev-nav-modal-body"|dev-nav/i);
    });

    it('POST /script-mock/<name> accepts requests', async () => {
      // Pick any script name from mocks.js if present; otherwise verify the
      // endpoint still responds (it's a no-op when no handler is registered).
      const mocksPath = path.join(exampleDir, 'dev-server/mocks.js');
      let scriptName = 'noop-test';
      if (fs.existsSync(mocksPath)) {
        const src = fs.readFileSync(mocksPath, 'utf-8');
        // Match either `'name':` or `[scriptNames.foo]:` — fall back to a
        // scriptNames lookup via the shared module.
        const literalMatch = src.match(/['"]([\w-]+)['"]\s*:/);
        if (literalMatch) scriptName = literalMatch[1];
        else {
          const namesPath = ['src/shared/script-names.js', 'src/shared/script-names.ts']
            .map(p => path.join(exampleDir, p)).find(fs.existsSync);
          if (namesPath) {
            const ns = fs.readFileSync(namesPath, 'utf-8');
            const m = ns.match(/['"]([\w \-]+)['"]/);
            if (m) scriptName = m[1];
          }
        }
      }
      const res = await fetch(`${BASE_URL}/script-mock/${encodeURIComponent(scriptName)}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      });
      assert.equal(res.status, 200);
    });
  });
}
