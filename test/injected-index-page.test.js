import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import injectedIndexPage from '../lib/injected-index-page.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

const BASE_HTML = `<!doctype html><html><head></head><body><main id="app"></main></body></html>`;

function setupProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wv-kit-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function scripts(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(m => ({ attrs: m[1], content: m[2].trim() }));
}

function links(html) {
  return [...html.matchAll(/<link([^>]*)>/g)].map(m => m[1]);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('injectedIndexPage', () => {
  describe('always injects', () => {
    let html, dir;
    before(() => {
      dir = setupProject({ 'src/index.html': BASE_HTML });
      html = injectedIndexPage('list', ['list'], dir);
    });
    after(() => cleanup(dir));

    it('injects shared-dev-index.js', () => {
      assert.ok(html.includes('/dev/shared-dev-index.js'));
    });

    it('injects app mount script for the viewer', () => {
      const s = scripts(html).find(s => s.content.includes('/src/list/index.js'));
      assert.ok(s, 'app script not found');
      assert.ok(s.content.includes("document.getElementById('app').append(app)"));
    });
  });

  describe('optional dev files', () => {
    it('includes dev/client.js when it exists', () => {
      const dir = setupProject({
        'src/index.html': BASE_HTML,
        'src/list/dev/client.js': 'window.loadData("[]");',
      });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(html.includes('/src/list/dev/client.js'));
    });

    it('omits dev/client.js when it does not exist', () => {
      const dir = setupProject({ 'src/index.html': BASE_HTML });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(!html.includes('/src/list/dev/client.js'));
    });

    it('includes nav-bar-content.js when it exists', () => {
      const dir = setupProject({
        'src/index.html': BASE_HTML,
        'src/list/dev/nav-bar-content.js': 'export default document.createElement("div");',
      });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(html.includes('/src/list/dev/nav-bar-content.js'));
      assert.ok(html.includes("dev-nav-modal-body"));
    });

    it('omits nav-bar-content.js when it does not exist', () => {
      const dir = setupProject({ 'src/index.html': BASE_HTML });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(!html.includes('nav-bar-content'));
    });
  });

  describe('CSS injection', () => {
    it('injects shared/style.css when present', () => {
      const dir = setupProject({
        'src/index.html': BASE_HTML,
        'src/shared/style.css': 'body {}',
      });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(links(html).some(a => a.includes('/src/shared/style.css')));
    });

    it('injects viewer style.css when present', () => {
      const dir = setupProject({
        'src/index.html': BASE_HTML,
        'src/list/style.css': '.list {}',
      });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(links(html).some(a => a.includes('/src/list/style.css')));
    });

    it('injects both CSS files when both are present', () => {
      const dir = setupProject({
        'src/index.html': BASE_HTML,
        'src/shared/style.css': 'body {}',
        'src/list/style.css': '.list {}',
      });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      const ls = links(html);
      assert.ok(ls.some(a => a.includes('/src/shared/style.css')));
      assert.ok(ls.some(a => a.includes('/src/list/style.css')));
    });

    it('omits CSS links when no style files exist', () => {
      const dir = setupProject({ 'src/index.html': BASE_HTML });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(!links(html).some(a => a.includes('style.css')));
    });
  });

  describe('dev nav', () => {
    it('renders dev nav when multiple viewers exist', () => {
      const dir = setupProject({ 'src/index.html': BASE_HTML });
      const html = injectedIndexPage('list', ['list', 'detail'], dir);
      cleanup(dir);
      assert.ok(html.includes('href="/list"') || html.includes('href="/detail"'));
    });

    it('omits dev nav for a single viewer', () => {
      const dir = setupProject({ 'src/index.html': BASE_HTML });
      const html = injectedIndexPage('list', ['list'], dir);
      cleanup(dir);
      assert.ok(!html.includes('dev-nav'));
    });
  });
});
