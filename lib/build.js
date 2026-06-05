import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { runEslint } from './lint.js';

const ROOT        = path.resolve();
const INDEX_NAMES = ['index.js', 'index.ts', 'index.tsx', 'index.jsx'];

const allViewers = fs.readdirSync(path.join(ROOT, 'src'))
  .filter(d => d !== 'shared' && INDEX_NAMES.some(f => fs.existsSync(path.join(ROOT, 'src', d, f))));

const args = process.argv.slice(2);
const targets = args.length ? args : allViewers;

runEslint();

for (const name of targets) {
  if (!allViewers.includes(name)) {
    console.error(`Unknown viewer: ${name}\nAvailable: ${allViewers.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nBuilding ${name}...`);

  const indexFile = INDEX_NAMES.find(f => fs.existsSync(path.join(ROOT, 'src', name, f)));
  const cssLinks = [
    fs.existsSync(path.join(ROOT, 'src', 'shared', 'style.css')) ? '<link rel="stylesheet" href="../shared/style.css">' : '',
    fs.existsSync(path.join(ROOT, 'src', name, 'style.css'))     ? '<link rel="stylesheet" href="./style.css">'          : '',
  ].filter(Boolean).join('\n  ');

  const sharedHtml = path.join(ROOT, 'src', 'index.html');
  const viewerHtml = path.join(ROOT, 'src', name, 'index.html');
  const html = fs.readFileSync(sharedHtml, 'utf-8').replace(
    '</head>',
    `  ${cssLinks}\n  <script type="module">import app from './${indexFile}'; import { flushMounts } from 'wv-kit'; document.getElementById('app').append(app); flushMounts();</script>\n</head>`,
  );
  fs.writeFileSync(viewerHtml, html);
  try {
    execSync('vite build', {
      cwd: ROOT,
      env: { ...process.env, SRC: `src/${name}` },
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(viewerHtml);
  }
  const outPath = path.join(ROOT, 'dist', `${name}.html`);
  fs.renameSync(path.join(ROOT, 'dist', 'index.html'), outPath);
  if (targets.length === 1) {
    try {
      execSync(`pbcopy < "${outPath}"`);
      console.log(`→ dist/${name}.html (copied to clipboard)`);
    } catch {
      console.log(`→ dist/${name}.html`);
    }
  } else {
    console.log(`→ dist/${name}.html`);
  }
}
