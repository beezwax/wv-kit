function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function handleMessage(event) {
  const msg = JSON.parse(event.data);
  if (msg.type === 'goToLayout') {
    // FileMaker's "Go To Layout" equivalent. Skip if we're already there —
    // matches FileMaker (no-op for current layout) and lets a mock handler
    // be re-triggered on reload (e.g. by dev/client.js) without looping.
    if (typeof msg.to === 'string' && msg.to.startsWith('?')) {
      if (msg.to !== window.location.search) window.location.search = msg.to;
    } else {
      const current = window.location.pathname + window.location.search;
      if (msg.to !== current && msg.to !== window.location.href) {
        window.location.href = msg.to;
      }
    }
    return;
  }
  // msg.type === 'js' — invoke the named global. window.alert falls through
  // here naturally; there's no special case.
  if (typeof window[msg.fn] === 'function') {
    window[msg.fn](...msg.args);
  }
}

function connect() {
  const sse = new EventSource('/sse');

  sse.addEventListener('message', handleMessage);

  sse.addEventListener('open', () => {
    console.log('[dev] SSE connected');
    window.FileMaker = {
      PerformScript(script, body) {
        fetch(`/script-mock/${script}`, { body, method: 'POST' }).then(() => {
          console.log(`Mocking "${script}"`, tryParse(body || '{}'));
        });
      },
      PerformScriptWithOption(script, body, option) {
        fetch(`/script-mock/${script}`, { body, method: 'POST' }).then(() => {
          console.log(`Mocking "${script}"`, tryParse(body || '{}'), option);
        });
      },
    };
  });

  sse.addEventListener('error', () => {
    console.log('[dev] SSE disconnected, reconnecting...');
    sse.close();
    setTimeout(connect, 1000);
  });
}

connect();
