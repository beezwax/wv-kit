import { execSync } from 'node:child_process';
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

export async function runInit() {
  const cwd = process.cwd();
  const ask = createAsker();
  const closeRl = () => ask.close();

  try {
    console.log('\nwv-kit init — scaffold a FileMaker web viewer project\n');

    const nameInput = (await ask('Project name (my-viewer): ')).trim() || 'my-viewer';
    const projectName = sanitizeName(nameInput) || 'my-viewer';
    const targetDir = path.resolve(cwd, projectName);

    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      console.log(`\n${targetDir} already exists and is not empty.`);
      const confirm = await yesNo(ask, 'Move the existing directory to the Trash and start fresh?', false);
      if (!confirm) {
        console.log('Aborted.');
        closeRl();
        return;
      }
      const where = moveToTrash(targetDir);
      if (where === 'trash') console.log(`  Moved existing ${path.basename(targetDir)} to Trash.`);
      else console.log(`  Backed up existing directory to ${where}`);
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

async function pickFromList(ask, prompt, options, defaultIndex = 0) {
  if (stdin.isTTY) {
    return pickInteractive(ask, prompt, options, defaultIndex);
  }
  // Non-TTY fallback (tests, scripts): numeric prompt.
  const def = defaultIndex + 1;
  console.log(`\n${prompt}:`);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt.label}`));
  while (true) {
    const ans = (await ask(`Choose 1-${options.length} (${def}): `)).trim() || String(def);
    const idx = Number.parseInt(ans, 10) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) return options[idx].key;
    console.log('  Invalid choice — try again.');
  }
}

// Arrow-key list picker. Repaints the option list in-place on each keypress
// and resolves when the user hits Enter. Falls back to the numeric prompt
// for non-TTY stdin.
function pickInteractive(ask, prompt, options, defaultIndex = 0) {
  return new Promise((resolve, reject) => {
    let selected = defaultIndex;

    stdout.write(`\n${prompt}: \x1b[2m(↑/↓ to move, Enter to select)\x1b[0m\n`);

    const renderInitial = () => {
      for (let i = 0; i < options.length; i++) stdout.write(formatLine(i, selected, options) + '\n');
    };
    const renderUpdate = () => {
      // Move cursor up to the first option line, then redraw all.
      stdout.write(`\x1b[${options.length}A`);
      for (let i = 0; i < options.length; i++) {
        stdout.write('\x1b[2K' + formatLine(i, selected, options) + '\n');
      }
    };

    renderInitial();

    // Stop the line-based asker from consuming raw input while we're active.
    ask.pause();
    readline.emitKeypressEvents(stdin);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);

    const cleanup = () => {
      stdin.removeListener('keypress', onKeypress);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      ask.resume();
    };

    const onKeypress = (_str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(130);
      }
      if (key.name === 'up' || key.name === 'k') {
        selected = (selected - 1 + options.length) % options.length;
        renderUpdate();
      } else if (key.name === 'down' || key.name === 'j') {
        selected = (selected + 1) % options.length;
        renderUpdate();
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        // Collapse the list to a single summary line so the transcript stays tidy.
        stdout.write(`\x1b[${options.length}A`);
        for (let i = 0; i < options.length; i++) stdout.write('\x1b[2K\n');
        stdout.write(`\x1b[${options.length}A\x1b[2m→\x1b[0m ${options[selected].label}\n`);
        resolve(options[selected].key);
      }
    };

    stdin.on('keypress', onKeypress);
    stdin.resume();
  });
}

function formatLine(i, selected, options) {
  const active = i === selected;
  const marker = active ? '\x1b[36m❯\x1b[0m ' : '  ';
  const label  = active ? `\x1b[36m${options[i].label}\x1b[0m` : options[i].label;
  return `${marker}${label}`;
}

async function yesNo(ask, prompt, defaultYes) {
  if (stdin.isTTY) {
    const key = await pickInteractive(ask, prompt, [
      { key: 'yes', label: 'Yes' },
      { key: 'no',  label: 'No' },
    ], defaultYes ? 0 : 1);
    return key === 'yes';
  }
  // Non-TTY fallback: short y/n prompt.
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
// Also supports pause()/resume() so the interactive list picker can take
// over stdin for raw-mode keypress handling.
function createAsker() {
  const queued = [];
  const waiters = [];
  let finalised = false;
  let drainOnClose = false;
  let rl = null;

  const open = () => {
    rl = readline.createInterface({ input: stdin });
    rl.on('line', line => {
      if (waiters.length) waiters.shift()(line);
      else queued.push(line);
    });
    rl.on('close', () => {
      rl = null;
      if (drainOnClose) {
        finalised = true;
        while (waiters.length) waiters.shift()('');
      }
    });
  };
  open();

  const ask = (prompt) => new Promise(resolve => {
    stdout.write(prompt);
    if (queued.length) resolve(queued.shift());
    else if (finalised) resolve('');
    else waiters.push(resolve);
  });
  ask.pause  = () => { if (rl) rl.close(); };
  ask.resume = () => { if (!finalised && !rl) open(); };
  ask.close  = () => { drainOnClose = true; if (rl) rl.close(); else finalised = true; };
  return ask;
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
}

// Move a directory to the OS trash where possible so the user can restore it
// if init was a mistake. Returns 'trash' on success, or the backup path used
// as a fallback. Never deletes in place.
function moveToTrash(targetDir) {
  if (process.platform === 'darwin') {
    try {
      const esc = targetDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      execSync(`osascript -e 'tell application "Finder" to delete POSIX file "${esc}"'`, { stdio: 'ignore' });
      return 'trash';
    } catch { /* fall through */ }
  }
  if (process.platform === 'linux') {
    try {
      execSync(`gio trash "${targetDir.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
      return 'trash';
    } catch { /* fall through */ }
  }
  // Cross-platform fallback: rename next to the original with a timestamp.
  // Nothing is destroyed; user can move or remove the backup later.
  const backup = `${targetDir}.backup-${Date.now()}`;
  fs.renameSync(targetDir, backup);
  return backup;
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
