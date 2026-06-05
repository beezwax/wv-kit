import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import wvKit from './lib/eslint.js';

// Try to load typescript-eslint from the consuming project's node_modules.
// Optional: only needed when the project has .ts/.tsx files.
let tseslint;
try {
  const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
  const resolved = requireFromProject.resolve('typescript-eslint');
  tseslint = (await import(pathToFileURL(resolved).href)).default;
} catch { /* not installed */ }

export default [
  ...(tseslint?.configs?.base ? [tseslint.configs.base] : []),
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx', 'src/**/*.jsx'],
    ...wvKit.configs.recommended,
  },
  {
    files: ['src/**/dev/**'],
    rules: { 'wv-kit/no-window-location': 'off' },
  },
];
