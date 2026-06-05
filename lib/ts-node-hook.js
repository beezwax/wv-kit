import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const TS_EXTS = ['.ts', '.tsx', '.jsx'];
const TS_LOADERS = { '.ts': 'ts', '.tsx': 'tsx', '.jsx': 'jsx' };

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js')) {
      const base = specifier.slice(0, -3);
      for (const ext of TS_EXTS) {
        try {
          return await nextResolve(base + ext, context);
        } catch {
          // try next
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  const ext = TS_EXTS.find(e => url.endsWith(e));
  if (!ext) return nextLoad(url, context);
  const path = fileURLToPath(url);
  if (!existsSync(path)) return nextLoad(url, context);
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(path, 'utf-8');
  const { code } = await transform(source, { loader: TS_LOADERS[ext], format: 'esm' });
  return { format: 'module', shortCircuit: true, source: code };
}
