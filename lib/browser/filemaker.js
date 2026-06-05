// Calls a FileMaker script via window.FileMaker.PerformScriptWithOption.
// Queues calls made before window.FileMaker is set (script runs before
// the host injects FileMaker), and flushes the queue once it appears.

const option = 0;
const queue = [];

function dispatch() {
  queue.splice(0).forEach(([name, param]) => {
    window.FileMaker.PerformScriptWithOption(name, param, option);
  });
  setTimeout(() => window.dispatchEvent(new Event('FilemakerLoaded')), 0);
}

if (typeof window !== 'undefined') {
  if (Object.hasOwn(window, 'FileMaker')) {
    dispatch();
  } else {
    let _fm;
    Object.defineProperty(window, 'FileMaker', {
      configurable: true,
      get() { return _fm; },
      set(val) { _fm = val; dispatch(); },
    });
  }
}

export function performFileMakerScript(name, payload) {
  const param = payload === undefined ? '{}' : JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.FileMaker) {
    window.FileMaker.PerformScriptWithOption(name, param, option);
  } else {
    queue.push([name, param]);
  }
}
