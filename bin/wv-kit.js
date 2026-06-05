#!/usr/bin/env node
const [,, command = 'start', ...rest] = process.argv;

if (command === 'start') {
  await import('../lib/server.js');
} else if (command === 'build') {
  process.argv.splice(2, 1);
  await import('../lib/build.js');
} else if (command === 'install') {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const path = (await import('node:path')).default;
  const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../vite.postinstall.js');
  const viteBin = path.resolve('node_modules/.bin/vite');
  execFileSync(viteBin, ['build', '--config', configPath], { stdio: 'inherit' });
} else {
  console.error(`Unknown command: ${command}\nUsage: wv-kit [start | build [viewer...] | install]`);
  process.exit(1);
}
