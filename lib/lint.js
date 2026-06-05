import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));

export function runEslint() {
  const ROOT        = path.resolve();
  const eslintBin   = path.join(ROOT, 'node_modules/eslint/bin/eslint.js');
  const projectCfg  = path.join(ROOT, 'eslint.config.js');
  const wvKitCfg    = path.resolve(LIB_DIR, '../eslint.config.js');
  const configFlag  = fs.existsSync(projectCfg) ? '' : `--config "${wvKitCfg}"`;

  if (!fs.existsSync(eslintBin)) {
    console.error('✖  ESLint is not installed. Run: npm install eslint\n');
    process.exit(1);
  }
  execSync(`node "${eslintBin}" ${configFlag} src`, { cwd: ROOT, stdio: 'inherit' });
}
