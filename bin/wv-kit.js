#!/usr/bin/env node
const [,, command = 'start', ...rest] = process.argv;

if (command === 'start') {
  await import('../lib/server.js');
} else if (command === 'build') {
  process.argv.splice(2, 1);
  await import('../lib/build.js');
} else if (command === 'check') {
  const { runEslint } = await import('../lib/lint.js');
  runEslint();
} else if (command === 'init') {
  const { runInit } = await import('../lib/init.js');
  await runInit();
} else {
  console.error(`Unknown command: ${command}\nUsage: wv-kit [start | build [viewer...] | check | init]`);
  process.exit(1);
}
