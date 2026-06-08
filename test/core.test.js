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

import { addSseClient, removeSseClient, performJavaScriptInWebViewer, goToLayout, drainPostGotoQueueTo } from '../lib/sse.js';

describe('SSE client registry', () => {

  function parseFrame(s) {
    return JSON.parse(s.replace('data: ', '').trim());
  }

  it('performJavaScriptInWebViewer broadcasts a js-typed frame to clients', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    performJavaScriptInWebViewer('loadData', '[]');
    removeSseClient(client);
    assert.equal(written.length, 1);
    const frame = parseFrame(written[0]);
    assert.equal(frame.type, 'js');
    assert.equal(frame.fn, 'loadData');
    assert.deepEqual(frame.args, ['[]']);
  });

  it('goToLayout() broadcasts a goToLayout-typed frame (separate from js)', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    goToLayout('/list');
    goToLayout('?id=42');
    removeSseClient(client);
    assert.equal(written.length, 2);
    assert.deepEqual(parseFrame(written[0]), { type: 'goToLayout', to: '/list' });
    assert.deepEqual(parseFrame(written[1]), { type: 'goToLayout', to: '?id=42' });
  });

  it('does not broadcast after client is removed', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    removeSseClient(client);
    performJavaScriptInWebViewer('loadData', '[]');
    goToLayout('/list');
    assert.equal(written.length, 0);
  });

  it('serialises multiple args', () => {
    const written = [];
    const client = { write: d => written.push(d) };
    addSseClient(client);
    performJavaScriptInWebViewer('onSaveResult', '{"ok":true}', 42);
    removeSseClient(client);
    const frame = parseFrame(written[0]);
    assert.deepEqual(frame.args, ['{"ok":true}', 42]);
  });

  it('broadcasts to every connected client (multi-tab dev)', () => {
    const a = [], b = [];
    const ca = { write: d => a.push(d), end() {} };
    const cb = { write: d => b.push(d), end() {} };
    addSseClient(ca);
    addSseClient(cb);  // ca is NOT kicked — both stay registered
    performJavaScriptInWebViewer('ping');
    removeSseClient(ca);
    removeSseClient(cb);
    assert.equal(a.length, 1, 'first client should still receive after a second connects');
    assert.equal(b.length, 1, 'second client should also receive');
  });

  it('drops clients only when explicitly removed (tab close)', () => {
    const received = [];
    const client = { write: d => received.push(d) };
    addSseClient(client);
    performJavaScriptInWebViewer('a');
    removeSseClient(client);
    performJavaScriptInWebViewer('b');
    assert.equal(received.length, 1, 'should only receive while registered');
    assert.ok(received[0].includes('"fn":"a"'));
  });

  it('replays performJavaScriptInWebViewer calls fired during a goToLayout window to the next client', () => {
    // No clients connected yet — simulate the mock-handler sequence.
    goToLayout('/detail?id=42');
    performJavaScriptInWebViewer('loadData', '{"id":42}');

    // The freshly-loaded /detail page now connects its SSE.
    const received = [];
    const client = { write: d => received.push(d) };
    addSseClient(client);
    drainPostGotoQueueTo(client);
    removeSseClient(client);

    assert.equal(received.length, 1, 'one queued js frame should be replayed');
    const frame = JSON.parse(received[0].replace('data: ', '').trim());
    assert.equal(frame.type, 'js');
    assert.equal(frame.fn, 'loadData');
    assert.deepEqual(frame.args, ['{"id":42}']);
  });

  it('drainPostGotoQueueTo is a no-op outside the window and drains only once', () => {
    goToLayout('/x');
    performJavaScriptInWebViewer('once', 'a');

    const a = [], b = [];
    const ca = { write: d => a.push(d) };
    const cb = { write: d => b.push(d) };
    addSseClient(ca);
    drainPostGotoQueueTo(ca);   // ca gets the queued frame
    addSseClient(cb);
    drainPostGotoQueueTo(cb);   // cb gets nothing — queue was already drained
    removeSseClient(ca);
    removeSseClient(cb);

    assert.equal(a.length, 1, 'first new client should receive the queued frame');
    assert.equal(b.length, 0, 'second new client should not receive a replay');
  });
});
