// Broadcast to every connected dev tab. The server's `/sse` handler removes
// a client on its `req.on('close')` event, so dead connections don't leak.
// (Previously this kicked out the prior client on every new connection to
// match FileMaker's "one viewer per layout" model, but that caused tabs to
// fight each other forever in multi-viewer dev — each side's reconnect would
// kick the other.)
const clients = new Set();

export function addSseClient(res) {
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
