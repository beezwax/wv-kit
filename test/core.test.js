import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Helpers ──────────────────────────────────────────────────────────────

const INDEX_NAMES = ['index.js', 'index.ts', 'index.tsx', 'index.jsx'];

function discoverViewers(srcDir) {
  return fs.readdirSync(srcDir)
    .filter(d => d !== 'shared' && fs.statSync(path.join(srcDir, d)).isDirectory())
    .filter(d => INDEX_NAMES.some(f => fs.existsSync(path.join(srcDir, d, f))));
}

function setupSrc(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wv-kit-src-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content ?? '');
  }
  return dir;
}

// ─── Viewer discovery ─────────────────────────────────────────────────────

describe('viewer discovery', () => {
  it('finds a viewer with index.js', () => {
    const dir = setupSrc({ 'list/index.js': 'export default 1;' });
    assert.deepEqual(discoverViewers(dir), ['list']);
    fs.rmSync(dir, { recursive: true });
  });

  it('finds viewers with TypeScript entry points', () => {
    const dir = setupSrc({
      'list/index.ts': '',
      'detail/index.tsx': '',
    });
    const viewers = discoverViewers(dir).sort();
    assert.deepEqual(viewers, ['detail', 'list']);
    fs.rmSync(dir, { recursive: true });
  });

  it('excludes the shared directory', () => {
    const dir = setupSrc({
      'shared/index.js': '',
      'list/index.js': '',
    });
    assert.deepEqual(discoverViewers(dir), ['list']);
    fs.rmSync(dir, { recursive: true });
  });

  it('excludes directories without any index file', () => {
    const dir = setupSrc({
      'list/view.js': '',
      'detail/index.js': '',
    });
    assert.deepEqual(discoverViewers(dir), ['detail']);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns an empty array when src/ has no viewer directories', () => {
    const dir = setupSrc({ 'shared/style.css': '' });
    assert.deepEqual(discoverViewers(dir), []);
    fs.rmSync(dir, { recursive: true });
  });

  it('finds multiple viewers', () => {
    const dir = setupSrc({
      'list/index.js': '',
      'detail/index.js': '',
      'report/index.js': '',
    });
    assert.deepEqual(discoverViewers(dir).sort(), ['detail', 'list', 'report']);
    fs.rmSync(dir, { recursive: true });
  });
});

// ─── SSE ──────────────────────────────────────────────────────────────────

import { addSseClient, removeSseClient, performJavaScriptInWebViewer } from '../lib/sse.js';

describe('SSE client registry', () => {

  it('broadcasts to registered clients', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    performJavaScriptInWebViewer('loadData', '[]');
    removeSseClient(client);
    assert.equal(written.length, 1);
    assert.ok(written[0].includes('"fn":"loadData"'));
    assert.ok(written[0].includes('"args":["[]"]'));
  });

  it('does not broadcast after client is removed', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    removeSseClient(client);
    performJavaScriptInWebViewer('loadData', '[]');
    assert.equal(written.length, 0);
  });

  it('serialises multiple args', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    performJavaScriptInWebViewer('navigate', '/list');
    removeSseClient(client);
    const payload = JSON.parse(written[0].replace('data: ', '').trim());
    assert.equal(payload.fn, 'navigate');
    assert.deepEqual(payload.args, ['/list']);
  });

  it('replaces the previous client when a new one connects', () => {
    const a = [], b = [];
    const ca = { write: d => a.push(d), end() {} };
    const cb = { write: d => b.push(d), end() {} };
    addSseClient(ca);
    addSseClient(cb);  // clears ca, registers cb
    performJavaScriptInWebViewer('ping');
    removeSseClient(cb);
    assert.equal(a.length, 0, 'old client should not receive after replacement');
    assert.equal(b.length, 1, 'new client should receive');
  });
});
