const queue = [];

export function onMount(fn) {
  queue.push(fn);
}

export function flushMounts() {
  while (queue.length) queue.shift()();
}
