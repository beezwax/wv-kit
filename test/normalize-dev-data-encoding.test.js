import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { normalizeDevDataEncoding } from '../lib/normalize-dev-data-encoding.js';

const SAMPLE = [{ id: 1, name: 'héllo', emoji: '🦋' }];
const SAMPLE_JSON = JSON.stringify(SAMPLE, null, 2);

function makeSrc() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wv-kit-encoding-test-'));
}

function write(srcDir, rel, buf) {
  const full = path.join(srcDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  return full;
}

function utf16leWithBom(text) {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
}

function utf16beWithBom(text) {
  const buf = Buffer.from(text, 'utf16le');
  buf.swap16();
  return Buffer.concat([Buffer.from([0xfe, 0xff]), buf]);
}

function utf8WithBom(text) {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
}

// Silence the helper's console.log during tests so the runner output stays clean.
let logSpy;
let logged;
beforeEach(() => {
  logged = [];
  logSpy = console.log;
  console.log = (...args) => { logged.push(args.join(' ')); };
});
afterEach(() => { console.log = logSpy; });

describe('normalizeDevDataEncoding', () => {
  let srcDir;
  beforeEach(() => { srcDir = makeSrc(); });
  afterEach(() => { fs.rmSync(srcDir, { recursive: true, force: true }); });

  it('converts UTF-16 LE (with BOM) to UTF-8', async () => {
    const file = write(srcDir, 'list/dev/data.json', utf16leWithBom(SAMPLE_JSON));
    await normalizeDevDataEncoding(srcDir);

    const after = fs.readFileSync(file);
    assert.notEqual(after[0], 0xff, 'BOM should be stripped');
    assert.deepEqual(JSON.parse(after.toString('utf8')), SAMPLE);
    assert.ok(logged.some(l => l.includes('UTF-16 LE')), 'logs the detected encoding');
  });

  it('converts UTF-16 BE (with BOM) to UTF-8 and preserves surrogate-pair characters', async () => {
    const file = write(srcDir, 'detail/dev/data.json', utf16beWithBom(SAMPLE_JSON));
    await normalizeDevDataEncoding(srcDir);

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(parsed, SAMPLE);
    assert.equal(parsed[0].emoji, '🦋', 'emoji survives the BE→UTF-8 conversion');
  });

  it('strips a UTF-8 BOM', async () => {
    const file = write(srcDir, 'list/dev/data.json', utf8WithBom(SAMPLE_JSON));
    await normalizeDevDataEncoding(srcDir);

    const after = fs.readFileSync(file);
    assert.notEqual(after[0], 0xef, 'UTF-8 BOM should be stripped');
    assert.deepEqual(JSON.parse(after.toString('utf8')), SAMPLE);
  });

  it('leaves plain UTF-8 (ASCII) files untouched', async () => {
    const file = write(srcDir, 'list/dev/data.json', Buffer.from(SAMPLE_JSON, 'utf8'));
    const mtimeBefore = fs.statSync(file).mtimeMs;

    // Wait a tick so a stray rewrite would change the mtime visibly.
    await new Promise(r => setTimeout(r, 10));
    await normalizeDevDataEncoding(srcDir);

    assert.equal(fs.statSync(file).mtimeMs, mtimeBefore, 'untouched file should not be rewritten');
    assert.equal(logged.length, 0, 'should not log anything when nothing to convert');
  });

  it('leaves UTF-8 files containing multi-byte characters untouched', async () => {
    const file = write(srcDir, 'list/dev/data.json', Buffer.from(SAMPLE_JSON, 'utf8'));
    const before = fs.readFileSync(file);

    await normalizeDevDataEncoding(srcDir);
    assert.ok(before.equals(fs.readFileSync(file)));
  });

  it('processes all viewers in parallel', async () => {
    const a = write(srcDir, 'list/dev/data.json', utf16leWithBom(SAMPLE_JSON));
    const b = write(srcDir, 'detail/dev/data.json', utf16beWithBom(SAMPLE_JSON));
    const c = write(srcDir, 'other/dev/data.json', Buffer.from(SAMPLE_JSON, 'utf8'));

    await normalizeDevDataEncoding(srcDir);

    assert.deepEqual(JSON.parse(fs.readFileSync(a, 'utf8')), SAMPLE);
    assert.deepEqual(JSON.parse(fs.readFileSync(b, 'utf8')), SAMPLE);
    assert.deepEqual(JSON.parse(fs.readFileSync(c, 'utf8')), SAMPLE);
  });

  it('returns a Promise (so callers can await or fire-and-forget)', () => {
    write(srcDir, 'list/dev/data.json', Buffer.from(SAMPLE_JSON, 'utf8'));
    const result = normalizeDevDataEncoding(srcDir);
    assert.ok(result instanceof Promise);
    return result;
  });

  it('does nothing when no dev/*.json files exist', async () => {
    await normalizeDevDataEncoding(srcDir);
    assert.equal(logged.length, 0);
  });

  it('ignores non-JSON files in dev/', async () => {
    const sibling = write(srcDir, 'list/dev/on-first-load.js', utf16leWithBom('console.log("x");'));
    await normalizeDevDataEncoding(srcDir);

    // on-first-load.js should be untouched — the helper only handles *.json.
    const after = fs.readFileSync(sibling);
    assert.equal(after[0], 0xff);
    assert.equal(after[1], 0xfe);
  });
});
