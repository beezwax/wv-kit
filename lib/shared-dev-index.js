function tryParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function handleMessage(event) {
  const { args, fn } = JSON.parse(event.data);
  switch (fn) {
    case 'navigate':
      window.location.href = args[0];
      break;
    case 'navigateSearch':
      window.location.search = args[0];
      break;
    case 'alert':
      window.alert(args[0]);
      break;
    default:
      if (typeof window[fn] === 'function') {
        window[fn](...args);
      }
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
