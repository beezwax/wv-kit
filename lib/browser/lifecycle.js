const queue = [];

export function onMount(fn) {
  queue.push(fn);
}

export function flushMounts() {
  while (queue.length) queue.shift()();
}

// Expose flushMounts globally so the wv-kit injected inline script can call it
// without importing this module a second time (which would create a split instance).
if (typeof window !== 'undefined') window.__wvFlushMounts = flushMounts;
