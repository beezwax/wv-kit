import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateProject } from './init-templates.js';

const LIBRARIES = [
  { key: 'plain-js',   label: 'Plain JS (no framework)' },
  { key: 'react',      label: 'React' },
  { key: 'lit',        label: 'Lit' },
  { key: 'solid',      label: 'SolidJS' },
  { key: 'svelte',     label: 'Svelte 5' },
  { key: 'kensington', label: 'Kensington' },
];

const TS_SUPPORTED = new Set(['plain-js', 'lit', 'kensington']);

export async function runInit(args) {
  const targetDirArg = args[0];
  const cwd = process.cwd();
  const defaultDir = targetDirArg || '.';
  const ask = createAsker();
  const closeRl = () => ask.close();

  try {
    console.log('\nwv-kit init — scaffold a FileMaker web viewer project\n');

    const dirInput = (await ask(`Project directory (${defaultDir}): `)).trim() || defaultDir;
    const targetDir = path.resolve(cwd, dirInput);
    const projectName = path.basename(targetDir).replace(/[^a-z0-9-_]/gi, '-').toLowerCase() || 'wv-kit-app';

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      const confirm = (await ask(`Directory ${targetDir} is not empty. Continue and overwrite files? (y/N): `)).trim().toLowerCase();
      if (confirm !== 'y' && confirm !== 'yes') {
        console.log('Aborted.');
        closeRl();
        return;
      }
    }

    const library = await pickFromList(ask, 'Rendering library', LIBRARIES);

    let typescript = false;
    let jsx = false;
    if (library === 'react') {
      typescript = await yesNo(ask, 'Use TypeScript?', true);
      jsx = await yesNo(ask, 'Use JSX?', true);
    } else if (library === 'solid') {
      jsx = await yesNo(ask, 'Use JSX?', true);
    } else if (library === 'svelte') {
      console.log('  Svelte template uses .svelte components.');
    } else if (TS_SUPPORTED.has(library)) {
      typescript = await yesNo(ask, 'Use TypeScript?', false);
    }

    const layout = await pickFromList(ask, 'Page layout', [
      { key: 'single', label: 'Single-page (one viewer)' },
      { key: 'multi',  label: 'Multi-page (two or more viewers)' },
    ]);

    let viewers;
    if (layout === 'single') {
      const name = (await ask('Viewer name (app): ')).trim() || 'app';
      viewers = [sanitizeName(name)];
    } else {
      const raw = (await ask('Viewer names, comma-separated (list,detail): ')).trim() || 'list,detail';
      viewers = raw.split(',').map(s => sanitizeName(s.trim())).filter(Boolean);
      if (viewers.length < 2) {
        viewers = ['list', 'detail'];
        console.log('  Using default viewers: list, detail');
      }
    }

    const sample = await yesNo(ask, 'Seed with a sample (button + FileMaker script call demo)?', true);

    closeRl();

    const files = generateProject({ projectName, library, typescript, jsx, viewers, sample });

    fs.mkdirSync(targetDir, { recursive: true });
    for (const [relPath, contents] of Object.entries(files)) {
      const full = path.join(targetDir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
    }

    const wvKitVersion = readPackageVersion();
    rewritePackageJson(targetDir, wvKitVersion);

    const rel = path.relative(cwd, targetDir) || '.';
    console.log(`\nCreated ${Object.keys(files).length} files in ${rel}\n`);
    console.log('Next steps:');
    if (rel !== '.') console.log(`  cd ${rel}`);
    console.log('  npm install');
    console.log('  npm start');
    console.log('');
  } finally {
    closeRl();
  }
}

async function pickFromList(ask, prompt, options) {
  console.log(`\n${prompt}:`);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt.label}`));
  while (true) {
    const ans = (await ask(`Choose 1-${options.length} (1): `)).trim() || '1';
    const idx = Number.parseInt(ans, 10) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) return options[idx].key;
    console.log('  Invalid choice — try again.');
  }
}

async function yesNo(ask, prompt, defaultYes) {
  const suffix = defaultYes ? '(Y/n)' : '(y/N)';
  const ans = (await ask(`${prompt} ${suffix}: `)).trim().toLowerCase();
  if (!ans) return defaultYes;
  return ans === 'y' || ans === 'yes';
}

// readline-based asker that works with piped stdin (where readline/promises'
// `question()` consumes the whole buffer on first call — Node bug #42454).
function createAsker() {
  const queued = [];
  const waiters = [];
  let closed = false;

  const rl = readline.createInterface({ input: stdin });
  rl.on('line', line => {
    if (waiters.length) waiters.shift()(line);
    else queued.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) waiters.shift()('');
  });

  const ask = (prompt) => new Promise(resolve => {
    stdout.write(prompt);
    if (queued.length) resolve(queued.shift());
    else if (closed) resolve('');
    else waiters.push(resolve);
  });
  ask.close = () => rl.close();
  return ask;
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
}

function readPackageVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

function rewritePackageJson(targetDir, wvKitVersion) {
  const p = path.join(targetDir, 'package.json');
  if (!fs.existsSync(p) || !wvKitVersion) return;
  const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (pkg.dependencies && 'wv-kit' in pkg.dependencies && pkg.dependencies['wv-kit'] === '*') {
    pkg.dependencies['wv-kit'] = `^${wvKitVersion}`;
  }
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
}
