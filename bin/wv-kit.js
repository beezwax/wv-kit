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
} else {
  console.error(`Unknown command: ${command}\nUsage: wv-kit [start | build [viewer...] | check]`);
  process.exit(1);
}
