import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { glob } from 'glob';
import { build, defineConfig } from 'vite';

const PROJECT_DIR = process.cwd();

const SRC_DIR = path.join(PROJECT_DIR, 'front-end-dependencies');
const OUT_DIR = path.join(PROJECT_DIR, 'src/shared/installed');

function buildConfig(file, filePath, plugins = []) {
  return {
    build: {
      copyPublicDir: false,
      emptyOutDir: false,
      lib: {
        entry: file,
        fileName: () => path.basename(filePath),
        formats: ['es'],
      },
      minify: false,
      outDir: path.join(OUT_DIR, path.dirname(filePath)),
      rollupOptions: {
        output: { format: 'es' },
        plugins,
      },
      sourcemap: false,
      target: ['esnext'],
    },
    configFile: false,
    logLevel: 'warn',
  };
}

async function buildStart() {
  rmSync(OUT_DIR, { force: true, recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const files = glob.sync(`${SRC_DIR}/**/[^.]*.js`, { absolute: true, ignore: `${SRC_DIR}/**/*.config.js` });

  if (files.length === 0) {
    console.warn(`No .js files found in "${SRC_DIR}/".`);
    return;
  }

  for (const file of files) {
    const filePath = path.relative(SRC_DIR, file);
    const configFile = file.replace(/\.js$/, '.config.js');
    const plugins = existsSync(configFile)
      ? (await import(pathToFileURL(configFile).href)).default
      : [];
    await build(buildConfig(file, filePath, plugins));
    console.log(`  ✓  ${filePath}  →  ${path.join(OUT_DIR, filePath)}`);
  }
  process.exit(0);
}

export default defineConfig({
  plugins: [{ apply: 'build', buildStart, name: 'build-each-file' }],
});
