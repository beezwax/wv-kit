import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

import { SRC } from './directory-paths.js';

// FileMaker exports JSON as UTF-16 LE with a BOM. If a user copies such a file
// into a viewer's dev/ folder, Vite and JSON.parse will choke on it. Detect by
// BOM and rewrite as UTF-8 (no BOM). Runs async (fire-and-forget from server
// startup) so it doesn't block restarts; the conversion is a no-op when files
// are already UTF-8, which is the common case.
export async function normalizeDevDataEncoding(srcDir = SRC) {
  const files = await glob('*/dev/*.json', { cwd: srcDir, absolute: true });
  await Promise.all(files.map(file => convertIfNeeded(file, srcDir)));
}

async function convertIfNeeded(file, srcDir) {
  const buf = await fs.readFile(file);
  const encoding = detectEncoding(buf);
  if (encoding === 'utf-8') return;

  const text = decode(buf, encoding);
  await fs.writeFile(file, text, 'utf8');
  console.log(`wv-kit: converted ${path.relative(srcDir, file)} from ${encoding} to UTF-8`);
}

function detectEncoding(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'UTF-16 LE';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'UTF-16 BE';
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'UTF-8 with BOM';
  return 'utf-8';
}

function decode(buf, encoding) {
  if (encoding === 'UTF-16 LE') return buf.slice(2).toString('utf16le');
  if (encoding === 'UTF-16 BE') return Buffer.from(buf.slice(2)).swap16().toString('utf16le');
  if (encoding === 'UTF-8 with BOM') return buf.slice(3).toString('utf8');
  return buf.toString('utf8');
}
