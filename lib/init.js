import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { generateProject } from './init-templates.js';

const LIBRARIES = [
  { key: 'kensington', label: 'Kensington' },
  { key: 'plain-js',   label: 'Plain JS (no framework)' },
  { key: 'react',      label: 'React' },
  { key: 'lit',        label: 'Lit' },
  { key: 'solid',      label: 'SolidJS' },
  { key: 'svelte',     label: 'Svelte 5' },
];

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

    // TypeScript applies to non-component files in every library (shared
    // utilities, control-functions, the index entry). Component files keep
    // their natural format (.svelte, .jsx/.tsx, etc.).
    const typescript = await yesNo(ask, 'Use TypeScript?', library === 'react');
    let jsx = false;
    if (library === 'react' || library === 'solid') {
      jsx = await yesNo(ask, typescript ? 'Use TSX?' : 'Use JSX?', true);
    }

    const viewerCount = await askInt(ask, 'Number of Web Viewers', 1);

    let viewers;
    if (viewerCount === 1) {
      const name = (await ask('Viewer name (app): ')).trim() || 'app';
      viewers = [sanitizeName(name)];
    } else {
      const defaultNames = ['list', 'detail', 'report', 'admin', 'settings', 'history']
        .slice(0, viewerCount).join(',');
      const raw = (await ask(`Viewer names, comma-separated (${defaultNames}): `)).trim() || defaultNames;
      viewers = raw.split(',').map(s => sanitizeName(s.trim())).filter(Boolean);
      if (viewers.length === 0) viewers = defaultNames.split(',');
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

    rewritePackageJson(targetDir);

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

async function askInt(ask, prompt, def) {
  while (true) {
    const ans = (await ask(`${prompt} (${def}): `)).trim();
    if (!ans) return def;
    const n = Number.parseInt(ans, 10);
    if (Number.isInteger(n) && n >= 1) return n;
    console.log('  Enter a positive integer.');
  }
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

function rewritePackageJson(targetDir) {
  const p = path.join(targetDir, 'package.json');
  if (!fs.existsSync(p)) return;
  const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  // wv-kit isn't published to npm yet — point at GitHub so `npm install`
  // in the scaffolded project actually resolves. Switch to a semver range
  // once the package ships to npm.
  if (pkg.dependencies && pkg.dependencies['wv-kit'] === '*') {
    pkg.dependencies['wv-kit'] = 'github:beezwax/wv-kit';
  }
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
}
