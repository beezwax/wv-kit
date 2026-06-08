// HTTP-level smoke test for `wv-kit preview`. Spawns lib/preview.js against
// each example that has both node_modules and a dist/ build, then verifies
// the iframe-based shell + verbatim dist serving + /sse + /script-mock.
//
// Doesn't cover the iframe-in-browser interactivity — that's in
// examples.playwright.test.js when the time comes; here we just verify the
// preview server's wire contract.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR    = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = path.resolve(TEST_DIR, '..');
const EXAMPLES    = path.join(REPO_ROOT, 'examples');
const PREVIEW     = path.join(REPO_ROOT, 'lib/preview.js');
const PORT        = 3015;
const BASE        = `http://127.0.0.1:${PORT}`;

const exampleDirs = fs.readdirSync(EXAMPLES)
  .map(d => path.join(EXAMPLES, d))
  .filter(d => fs.statSync(d).isDirectory())
  .filter(d => fs.existsSync(path.join(d, 'package.json')));

function start(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PREVIEW], {
      cwd,
      env: { ...process.env, NODE_NO_WARNINGS: '1', PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    let stderr = '';
    child.stdout.on('data', chunk => {
      if (!started && /running at http/.test(chunk.toString())) { started = true; resolve(child); }
    });
    child.stderr.on('data', c => { stderr += c.toString(); });
    child.on('exit', code => { if (!started) reject(new Error(`preview exited (code ${code})\n${stderr}`)); });
    setTimeout(() => { if (!started) { child.kill('SIGKILL'); reject(new Error('preview start timeout')); } }, 15_000).unref();
  });
}

function stop(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 4_000).unref();
  });
}

for (const exampleDir of exampleDirs) {
  const name = path.basename(exampleDir);
  const distDir = path.join(exampleDir, 'dist');
  const hasNm   = fs.existsSync(path.join(exampleDir, 'node_modules'));
  const hasDist = fs.existsSync(distDir) && fs.readdirSync(distDir).some(f => f.endsWith('.html'));
  const builtViewers = hasDist
    ? fs.readdirSync(distDir).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''))
    : [];

  const skipReason =
    !hasNm   ? 'node_modules not installed' :
    !hasDist ? 'no dist/ — run `npm run build` in this example first' :
    false;

  describe(`preview: examples/${name}`, { skip: skipReason }, () => {
    let server;
    before(async () => { server = await start(exampleDir); });
    after(async () => { await stop(server); });

    it('GET /ping → pong', async () => {
      const res = await fetch(`${BASE}/ping`);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), 'pong');
    });

    it('GET / redirects to /preview/<first-viewer>', async () => {
      const res = await fetch(`${BASE}/`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      const loc = res.headers.get('location');
      assert.ok(builtViewers.some(v => loc === `/preview/${v}`), `unexpected redirect: ${loc}`);
    });

    it('GET /sse opens a text/event-stream', async () => {
      const ctrl = new AbortController();
      const res = await fetch(`${BASE}/sse`, { signal: ctrl.signal });
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
      ctrl.abort();
      try { await res.body?.cancel(); } catch {}
    });

    for (const viewer of builtViewers) {
      describe(`viewer "${viewer}"`, () => {
        it('GET /preview/<viewer> serves the iframe shell', async () => {
          const res = await fetch(`${BASE}/preview/${viewer}`);
          assert.equal(res.status, 200);
          const body = await res.text();
          assert.match(body, new RegExp(`<iframe[^>]*src="/dist/${viewer}\\.html`));
          assert.match(body, /EventSource\('\/sse'\)/);
          assert.match(body, /PerformScriptWithOption/);
        });

        it('GET /preview/<viewer>?id=42 forwards the query into the iframe src', async () => {
          const res = await fetch(`${BASE}/preview/${viewer}?id=42`);
          const body = await res.text();
          assert.match(body, new RegExp(`<iframe[^>]*src="/dist/${viewer}\\.html\\?id=42"`));
        });

        it('GET /dist/<viewer>.html serves the built file verbatim', async () => {
          const onDisk = fs.readFileSync(path.join(distDir, `${viewer}.html`), 'utf-8');
          const res = await fetch(`${BASE}/dist/${viewer}.html`);
          assert.equal(res.status, 200);
          assert.match(res.headers.get('content-type') ?? '', /text\/html/);
          assert.equal(await res.text(), onDisk);
        });
      });
    }

    it('POST /script-mock/<name> returns 200 (mock dispatch path is wired)', async () => {
      const res = await fetch(`${BASE}/script-mock/${encodeURIComponent('noop-probe')}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      });
      assert.equal(res.status, 200);
    });
  });
}
