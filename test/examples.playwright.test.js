// Playwright e2e tests that exercise real user flows against every example.
// Each describe block boots the dev server in an example directory, launches
// Chromium, and runs the same two assertions:
//
//   1. The list viewer renders products from `dev/data.json` (proves the full
//      "FileMaker → browser" callback path: dev/client.js → window.loadData
//      → framework re-render).
//   2. Clicking "+ New Product" navigates to /detail (proves the full
//      "browser → FileMaker → browser" path: performFileMakerScript →
//      /script-mock → mock handler → SSE → window.location.href).

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR    = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT   = path.resolve(TEST_DIR, '..');
const EXAMPLES    = path.join(REPO_ROOT, 'examples');
const SERVER_FILE = path.join(REPO_ROOT, 'lib/server.js');
const PORT        = 3010;
const BASE_URL    = `http://127.0.0.1:${PORT}`;

let chromium;
let browserAvailable = false;
try {
  ({ chromium } = await import('playwright'));
  // Probe — `executablePath()` throws if the browser isn't installed.
  chromium.executablePath();
  browserAvailable = true;
} catch (err) {
  console.warn(`[playwright] skipping: ${err.message}`);
}

const exampleDirs = fs.readdirSync(EXAMPLES)
  .map(d => path.join(EXAMPLES, d))
  .filter(d => fs.statSync(d).isDirectory())
  .filter(d => fs.existsSync(path.join(d, 'package.json')));

function startServer(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_FILE], {
      cwd,
      env: { ...process.env, NODE_NO_WARNINGS: '1', PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    let stderr = '';
    const onStdout = chunk => {
      if (!started && /running at http/.test(chunk.toString())) {
        started = true;
        child.stdout.off('data', onStdout);
        resolve(child);
      }
    };
    child.stdout.on('data', onStdout);
    child.stderr.on('data', c => { stderr += c.toString(); });
    child.on('exit', code => {
      if (!started) reject(new Error(`server exited (code ${code})\n${stderr}`));
    });
    setTimeout(() => {
      if (!started) { child.kill('SIGKILL'); reject(new Error(`server start timeout\n${stderr}`)); }
    }, 30_000).unref();
  });
}

function stopServer(child) {
  return new Promise(resolve => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5_000).unref();
  });
}

// Load the seed product set so tests can pick a known product and assert on it.
function seedProducts(exampleDir) {
  const dataPath = path.join(exampleDir, 'src/list/dev/data.json');
  if (!fs.existsSync(dataPath)) return null;
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf-8')); } catch { return null; }
}

// Restore data.json from git so destructive tests don't leak between runs.
function restoreDataJson(exampleDir) {
  const rel = path.relative(REPO_ROOT, path.join(exampleDir, 'src/list/dev/data.json'));
  try { execSync(`git checkout HEAD -- "${rel}"`, { cwd: REPO_ROOT, stdio: 'ignore' }); } catch {}
}

for (const exampleDir of exampleDirs) {
  const exampleName  = path.basename(exampleDir);
  const hasNm        = fs.existsSync(path.join(exampleDir, 'node_modules'));
  const hasList      = fs.existsSync(path.join(exampleDir, 'src/list'));
  const products     = seedProducts(exampleDir);
  const productName  = products?.[0]?.name ?? null;
  const productId    = products?.[0]?.id   ?? null;
  const otherProduct = products?.[1]       ?? null;

  const skipReason =
    !browserAvailable ? 'Playwright chromium not available (run: npx playwright install chromium)' :
    !hasNm           ? 'node_modules not installed for this example' :
    !hasList         ? 'no list/ viewer in this example' :
    !productName     ? 'no list/dev/data.json or no products' :
    false;

  describe(`playwright: examples/${exampleName}`, { skip: skipReason }, () => {
    let server;
    let browser;
    let context;

    before(async () => {
      restoreDataJson(exampleDir);
      server  = await startServer(exampleDir);
      browser = await chromium.launch();
      context = await browser.newContext();
    });

    after(async () => {
      try { await context?.close(); } catch {}
      try { await browser?.close(); } catch {}
      await stopServer(server);
      restoreDataJson(exampleDir);
    });

    it('list viewer renders products from dev/data.json', async () => {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => { if (!/WebSocket closed without opened/i.test(e.message)) errors.push(e.message); });
      await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
      // Wait for the framework to have populated the DOM with the product name.
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });
      assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
      await page.close();
    });

    it('clicking "+ New Product" navigates to detail and renders a blank form', async () => {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => { if (!/WebSocket closed without opened/i.test(e.message)) errors.push(e.message); });
      await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });

      await Promise.all([
        page.waitForURL(/\/detail(\?|$|\/)/, { timeout: 10_000 }),
        page.getByRole('button', { name: /\+\s*New Product/i }).click(),
      ]);

      // DOM assertion: detail page renders "New Product" h1 and the name
      // field is empty (proves dev/client.js's blank-product seed fired).
      await page.locator('h1', { hasText: /^New Product$/ }).waitFor({ timeout: 10_000 });
      const nameValue = await page.locator('input[type="text"]').first().inputValue();
      assert.equal(nameValue, '', 'name input should be empty for a new product');

      assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
      await page.close();
    });

    it('list search input filters out non-matching rows', async () => {
      if (!otherProduct) return;
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });
      await page.locator(`text=${otherProduct.name}`).first().waitFor({ timeout: 5_000 });

      // Type something that only the first product matches.
      await page.getByPlaceholder(/search name or sku/i).fill(productName);

      // First product still shown, second product gone.
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 5_000 });
      await page.locator(`text=${otherProduct.name}`).first().waitFor({ state: 'hidden', timeout: 5_000 });
      await page.close();
    });

    it('clicking a list row loads that product on the detail page', async () => {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });

      await Promise.all([
        page.waitForURL(new RegExp(`/detail\\?id=${productId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`), { timeout: 10_000 }),
        page.locator('tr', { hasText: productName }).first().click(),
      ]);

      // h1 on every framework's detail view renders the product's name.
      await page.locator('h1', { hasText: productName }).waitFor({ timeout: 10_000 });
      await page.close();
    });

    it('back button on detail returns to /list', async () => {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/detail?id=${encodeURIComponent(productId)}`, { waitUntil: 'domcontentloaded' });
      await page.locator('h1', { hasText: productName }).waitFor({ timeout: 10_000 });

      await Promise.all([
        page.waitForURL(/\/list(\?|$|\/)/, { timeout: 10_000 }),
        page.getByRole('button', { name: /←\s*List|^List$|Back/i }).click(),
      ]);
      await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });
      await page.close();
    });

    it('editing name + Save persists to data.json and shows the saved name in the list', async () => {
      const page = await context.newPage();
      const renamed = `Renamed-${Date.now()}`;
      try {
        await page.goto(`${BASE_URL}/detail?id=${encodeURIComponent(productId)}`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1', { hasText: productName }).waitFor({ timeout: 10_000 });

        // Name is the first text input on the detail page (the list's search
        // input lives on a different page). Not every example wraps inputs in
        // a <form>, so don't scope to one.
        const nameInput = page.locator('input[type="text"]').first();
        await nameInput.fill(renamed);

        await page.getByRole('button', { name: /^Save$/i }).click();

        // Wait for the on-screen toast / success indicator. Every example
        // surfaces the word "Saved" after a successful save.
        await page.locator('text=/Saved/').first().waitFor({ timeout: 10_000 });

        // Disk-level assertion: data.json was actually rewritten.
        const dataPath = path.join(exampleDir, 'src/list/dev/data.json');
        const fresh = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        const row = fresh.find(p => p.id === productId);
        assert.ok(row, `${productId} disappeared from data.json`);
        assert.equal(row.name, renamed, 'name on disk does not match what was saved');

        // On-screen assertion: navigate back to the list and the renamed product appears.
        await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
        await page.locator(`text=${renamed}`).first().waitFor({ timeout: 10_000 });
      } finally {
        await page.close();
        restoreDataJson(exampleDir);
      }
    });

    it('clicking Delete removes the product from the list (DOM + disk)', async () => {
      if (!otherProduct) return;
      const page = await context.newPage();
      page.on('dialog', d => d.accept());
      try {
        await page.goto(`${BASE_URL}/detail?id=${encodeURIComponent(otherProduct.id)}`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1', { hasText: otherProduct.name }).waitFor({ timeout: 10_000 });

        await Promise.all([
          page.waitForURL(/\/list(\?|$|\/)/, { timeout: 10_000 }),
          page.getByRole('button', { name: /^Delete$/i }).click(),
        ]);

        // Wait for the list to repaint (the FM mock fires both onDeleteResult
        // and a navigate; the list page will issue requestProducts on load).
        await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });

        // DOM assertion: the deleted product's name is no longer in the table.
        assert.equal(await page.locator(`tbody tr`, { hasText: otherProduct.name }).count(), 0,
          `${otherProduct.name} should be removed from the visible list`);

        // Disk assertion: data.json no longer contains the deleted id.
        const dataPath = path.join(exampleDir, 'src/list/dev/data.json');
        const fresh = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
        assert.equal(fresh.find(p => p.id === otherProduct.id), undefined,
          `${otherProduct.id} should be gone from data.json`);
      } finally {
        await page.close();
        restoreDataJson(exampleDir);
      }
    });

    it('detail dev nav "Load:" dropdown swaps the displayed product', async () => {
      if (!otherProduct) return;
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/detail?id=${encodeURIComponent(productId)}`, { waitUntil: 'domcontentloaded' });
        await page.locator('h1', { hasText: productName }).waitFor({ timeout: 10_000 });

        // Open the dev-nav modal and pick the second product from the dropdown.
        await page.locator('footer button').click();
        await page.locator('#dev-nav-modal').waitFor({ state: 'visible' });
        await page.locator('#dev-nav-modal-body select').selectOption(otherProduct.id);

        // DOM assertion: the h1 swapped to the newly-loaded product.
        await page.locator('h1', { hasText: otherProduct.name }).waitFor({ timeout: 5_000 });
      } finally {
        await page.close();
      }
    });

    it('dev nav "Clear filters" empties the search input and reveals hidden rows', async () => {
      if (!otherProduct) return;
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => { if (!/WebSocket closed without opened/i.test(e.message)) errors.push(e.message); });
      try {
        await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
        await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });
        await page.locator(`text=${otherProduct.name}`).first().waitFor({ timeout: 5_000 });

        // Apply a filter that only matches the first product.
        const searchInput = page.getByPlaceholder(/search name or sku/i);
        await searchInput.fill(productName);
        await page.locator(`text=${otherProduct.name}`).first().waitFor({ state: 'hidden', timeout: 5_000 });

        // Open the dev-nav modal and click "Clear filters".
        await page.locator('footer button').click();
        await page.locator('#dev-nav-modal').waitFor({ state: 'visible' });
        await page.locator('#dev-nav-modal-body').getByRole('button', { name: /^Clear filters$/i }).click();

        // DOM assertion: search input is empty and the previously-hidden
        // product is visible again.
        assert.equal(await searchInput.inputValue(), '', 'search input should be cleared');
        await page.locator(`text=${otherProduct.name}`).first().waitFor({ timeout: 5_000 });

        assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
      } finally {
        await page.close();
      }
    });

    it('saving a product preserves the active list filter', async () => {
      if (!otherProduct) return;
      const page = await context.newPage();
      try {
        await page.goto(`${BASE_URL}/list/`, { waitUntil: 'domcontentloaded' });
        await page.locator(`text=${productName}`).first().waitFor({ timeout: 10_000 });

        // Apply a filter only the first product matches.
        const searchInput = page.getByPlaceholder(/search name or sku/i);
        await searchInput.fill(productName);
        await page.locator(`text=${otherProduct.name}`).first().waitFor({ state: 'hidden', timeout: 5_000 });

        // Send a save through /script-mock; this fires loadData via the
        // FM-style flow that an actual save would trigger downstream.
        await fetch(`${BASE_URL}/script-mock/${encodeURIComponent('request products')}`, {
          method: 'POST', headers: { 'content-type': 'text/plain' }, body: '',
        });
        await page.waitForTimeout(200);

        // Filter still applied: search input retains its value, second
        // product still hidden, first still visible.
        assert.equal(await searchInput.inputValue(), productName,
          'search input should not be cleared by a fresh loadData');
        assert.equal(await page.locator(`tbody tr`, { hasText: otherProduct.name }).count(), 0,
          'second product should still be filtered out');
        await page.locator(`text=${productName}`).first().waitFor({ timeout: 5_000 });
      } finally {
        await page.close();
      }
    });
  });
}
