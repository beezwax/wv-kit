#!/usr/bin/env node
const [,, command = 'start', ...rest] = process.argv;

if (command === 'start') {
  await import('../lib/server.js');
} else if (command === 'build') {
  process.argv.splice(2, 1);
  await import('../lib/build.js');
} else if (command === 'check') {
  const { check } = await import('../lib/check.js');
  const findings = check();
  if (findings.length === 0) {
    console.log('✓  No FileMaker compatibility issues found.');
  } else {
    for (const f of findings) {
      console.warn(`\n⚠  ${f.file}:${f.line}  [${f.rule}]`);
      console.warn(`   ${f.message}`);
      console.warn(`   ${f.source}`);
    }
    console.warn(`\n${findings.length} issue${findings.length !== 1 ? 's' : ''} found.`);
    process.exit(1);
  }
} else if (command === 'install') {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const path = (await import('node:path')).default;
  const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../vite.postinstall.js');
  const viteBin = path.resolve('node_modules/.bin/vite');
  execFileSync(viteBin, ['build', '--config', configPath], { stdio: 'inherit' });
} else {
  console.error(`Unknown command: ${command}\nUsage: wv-kit [start | build [viewer...] | check | install]`);
  process.exit(1);
}
