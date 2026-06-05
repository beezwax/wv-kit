import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve();

const allViewers = fs.readdirSync(path.join(ROOT, 'src'))
  .filter(d => d !== 'shared' && fs.existsSync(path.join(ROOT, 'src', d, 'index.js')));

const args = process.argv.slice(2);
const targets = args.length ? args : allViewers;

for (const name of targets) {
  if (!allViewers.includes(name)) {
    console.error(`Unknown viewer: ${name}\nAvailable: ${allViewers.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nBuilding ${name}...`);
  const sharedHtml = path.join(ROOT, 'src', 'index.html');
  const viewerHtml = path.join(ROOT, 'src', name, 'index.html');
  const html = fs.readFileSync(sharedHtml, 'utf-8').replace(
    '</head>',
    `  <link rel="stylesheet" href="./style.css">\n  <script type="module">import app from './index.js'; document.getElementById('app').append(app);</script>\n</head>`,
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
