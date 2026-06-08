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

// After goToLayout(), the browser is mid-navigation: the current tab's SSE
// is being torn down and the new page hasn't connected yet. Any
// performJavaScriptInWebViewer calls fired right after would be lost.
// So we open a brief window after each goToLayout, queue subsequent js
// frames, and replay them to the next client that connects within the
// window. This mirrors FileMaker's behavior where "Go To Layout" followed
// by "Perform JavaScript in Web Viewer" reliably delivers JS to the new
// viewer.
const POST_GOTO_WINDOW_MS = 2000;
let postGotoExpiresAt = 0;
const postGotoQueue = [];

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const res of clients) res.write(`data: ${data}\n\n`);
}

// Push a window-global call from server to browser — what FileMaker would do
// via PerformJavaScriptInWebViewer when handing data back to the viewer.
export function performJavaScriptInWebViewer(fn, ...args) {
  const frame = { type: 'js', fn, args };
  if (Date.now() < postGotoExpiresAt) postGotoQueue.push(frame);
  broadcast(frame);
}

// Navigate the dev page to a new path or query string — what FileMaker would
// do via a "Go To Layout" script step (NOT JavaScript pushed to the viewer).
// `to` starting with `?` updates only the query (window.location.search);
// any other value sets window.location.href. Browser side skips the
// navigation when `to` matches the current URL, so a mock handler can be
// re-triggered on reload (e.g. by dev/client.js) without looping.
export function goToLayout(to) {
  broadcast({ type: 'goToLayout', to });
  postGotoExpiresAt = Date.now() + POST_GOTO_WINDOW_MS;
  postGotoQueue.length = 0;
}

// Called by the /sse handler whenever a new client connects. If we're inside
// the post-goToLayout window, replay the queue to this client (presumed to
// be the freshly-loaded page) and close the window.
export function drainPostGotoQueueTo(res) {
  if (Date.now() >= postGotoExpiresAt || postGotoQueue.length === 0) return;
  for (const frame of postGotoQueue) {
    res.write(`data: ${JSON.stringify(frame)}\n\n`);
  }
  postGotoQueue.length = 0;
  postGotoExpiresAt = 0;
}
