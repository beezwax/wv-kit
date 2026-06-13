function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Once a goToLayout actually starts navigating, subsequent JS frames on this
// (dying) page are intended for the new page and must be dropped here — the
// server's post-goto queue replays them to whoever connects /sse next.
let navigating = false;

// Inbound JS frames that arrived before their window.* handler was wired
// (race: SSE drain delivered before the viewer's index.js finished evaluating
// and called contract.mount()). We retry these every time a new frame
// arrives, and again on DOMContentLoaded as a final drain.
const pending = [];

function dispatch(msg) {
  if (typeof window[msg.fn] === 'function') {
    window[msg.fn](...msg.args);
    return true;
  }
  return false;
}

function drainPending() {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (dispatch(pending[i])) pending.splice(i, 1);
  }
}

function handleMessage(event) {
  const msg = JSON.parse(event.data);
  if (msg.type === 'goToLayout') {
    if (typeof msg.to === 'string' && msg.to.startsWith('?')) {
      if (msg.to !== window.location.search) {
        navigating = true;
        // Tell the next page that it arrived via in-tab navigation —
        // dev/on-first-load.js is suppressed for that load (the mock's
        // drained loadData is the canonical post-nav data source).
        sessionStorage.setItem('wv-kit:fromNav', '1');
        window.location.search = msg.to;
      }
    } else {
      const current = window.location.pathname + window.location.search;
      if (msg.to !== current && msg.to !== window.location.href) {
        navigating = true;
        sessionStorage.setItem('wv-kit:fromNav', '1');
        window.location.href = msg.to;
      }
    }
    return;
  }
  // msg.type === 'js' — invoke the named global.
  if (navigating) return;
  if (!dispatch(msg)) pending.push(msg);
  // A new mount() may have landed since earlier deferrals — retry the queue.
  drainPending();
}

// readyState is 'interactive' (NOT 'loading') by the time this module runs —
// type="module" scripts are deferred and execute after HTML parse. The viewer's
// index.js (and its mount() call) is also deferred and runs in document order
// AFTER us. DOMContentLoaded fires only after every deferred module has
// executed, so it's the right moment to flush handlers that arrived before
// their window.* was wired. attach unconditionally unless we somehow loaded
// after 'load' (readyState 'complete') — in which case drain right now.
function drainOnLoad() {
  drainPending();
  if (pending.length) {
    console.warn('[dev] unhandled JS frames after DOMContentLoaded:', pending.map(m => m.fn));
    pending.length = 0;
  }
}
if (document.readyState === 'complete') {
  drainOnLoad();
} else {
  document.addEventListener('DOMContentLoaded', drainOnLoad);
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
