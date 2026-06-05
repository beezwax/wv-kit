const clients = new Set();

export function addSseClient(res) {
  for (const stale of clients) {
    try { stale.end(); } catch {}
  }
  clients.clear();
  clients.add(res);
}

export function removeSseClient(res) {
  clients.delete(res);
}

export function performJavaScriptInWebViewer(fn, ...args) {
  const data = JSON.stringify({ args, fn });
  for (const res of clients) {
    res.write(`data: ${data}\n\n`);
  }
}
