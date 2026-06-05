import fs from 'node:fs';
import path from 'node:path';

import { glob } from 'glob';

const ROOT = path.resolve();
const SRC  = path.join(ROOT, 'src');

// Specifiers that are allowed bare (Node built-ins are already excluded by the regex)
const KNOWN_BARE = new Set(['wv-kit', 'kensington']);

const RULES = [
  {
    id: 'no-location-read',
    message: 'window.location read outside dev/ — URL params do not exist in a FileMaker web viewer. Move this to dev/client.js.',
    pattern: /window\.location(?!\.href\s*=)/,
    files: 'non-dev',
  },
  {
    id: 'no-location-assign',
    message: 'window.location.href assignment — navigation must go through filemakerScripts, not URL changes.',
    pattern: /window\.location\.href\s*=/,
    files: 'all',
  },
  {
    id: 'no-anchor-href',
    message: '<a href="…"> for navigation — FileMaker web viewers do not handle anchor navigation. Use a <button> and filemakerScripts instead.',
    pattern: /<a\b[^>]*href\s*=\s*["'`][^"'`#{\s]/,
    files: 'non-dev',
  },
  {
    id: 'no-bare-import',
    message: 'Bare npm specifier import in src/ — the browser cannot resolve bare specifiers. Bundle the package into src/shared/installed/ via front-end-dependencies/.',
    test(line) {
      const m = line.match(/\bfrom\s+["']([^"'.][^"']*)["']/) ?? line.match(/^import\s+["']([^"'.][^"']*)["']/);
      if (!m) return false;
      const spec = m[1].split('/')[0].replace(/^@[^/]+\/[^/]+.*/, s => s.split('/').slice(0,2).join('/'));
      return !KNOWN_BARE.has(spec) && !spec.startsWith('node:');
    },
    files: 'non-dev',
  },
  {
    id: 'no-dev-outside-import',
    message: "Import from outside dev/ in a dev/ file — dev files should only interact through window functions and filemakerScripts. Add // wv-kit-ok to suppress if the import is intentional.",
    test(line, file) {
      if (!file.includes(`${path.sep}dev${path.sep}`)) return false;
      const m = line.match(/\bfrom\s+["'](\.[^"']+)["']/);
      if (!m) return false;
      const importPath = m[1];
      // Same-dir imports are fine
      if (!importPath.startsWith('../')) return false;
      // Imports that land in a dev/ or shared/installed/ directory are fine
      if (importPath.includes('/dev/') || importPath.includes('shared/installed/')) return false;
      return true;
    },
    files: 'dev',
  },
];

function srcFiles(mode) {
  const patterns = ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.jsx'];
  if (mode === 'non-dev') {
    return patterns.flatMap(p =>
      glob.sync(path.join(SRC, p), { ignore: [path.join(SRC, '**/dev/**')], absolute: true }),
    );
  }
  if (mode === 'dev') {
    return patterns.flatMap(p =>
      glob.sync(path.join(SRC, '**/dev/**', p), { absolute: true }),
    );
  }
  return patterns.flatMap(p => glob.sync(path.join(SRC, p), { absolute: true }));
}

export function check() {
  const findings = [];

  for (const rule of RULES) {
    const files = srcFiles(rule.files);
    for (const file of files) {
      const rel   = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes('// wv-kit-ok')) return;
        const matches = rule.test ? rule.test(line, file) : rule.pattern.test(line);
        if (matches) findings.push({ rule: rule.id, file: rel, line: i + 1, source: line.trim(), message: rule.message });
      });
    }
  }

  return findings;
}
