// Parent shell served by `wv-kit preview`. Hosts the built dist HTML in an
// iframe and acts as the FileMaker simulator:
//
// - Installs `window.FileMaker` on the iframe (the same shim FileMaker
//   provides to its real web viewer), forwarding script calls to the dev
//   server's /script-mock/:name route.
// - Listens to /sse on the parent (the iframe's window is never touched
//   directly by the SSE layer) and dispatches frames into the iframe.
// - Treats every iframe load as "OnLayoutEnter": fires the convention-named
//   `navigate to <viewer>` script with the current URL params as JSON.
//   That's how the canonical CRUD mock pattern populates a freshly-loaded
//   layout.
//
// The dist HTML is served byte-for-byte from /dist/:viewer.html — exactly
// what the developer will paste into FileMaker. No injection.

export default function previewShell(viewer, allViewers, query = '', hasOverlay = false) {
  // Bar shows whenever there's something useful: viewer-switching links, or
  // the dev-nav hamburger for the current viewer.
  const nav = (allViewers.length > 1 || hasOverlay) ? renderNav(viewer, allViewers, hasOverlay) : '';
  const iframeSrc = `/dist/${viewer}.html${query}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>wv-kit preview · ${viewer}</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #f4f4f4; }
      body { display: flex; flex-direction: column; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
      iframe { flex: 1; border: 0; width: 100%; background: #fff; }
      .wv-bar {
        display: flex; align-items: center; gap: 4px;
        background: #1a1a1a; color: #ccc; padding: 6px 12px;
        font-size: 12px; line-height: 1; border-top: 1px solid #333;
      }
      .wv-bar a {
        color: rgba(255,255,255,0.65); text-decoration: none;
        padding: 4px 10px; border-radius: 4px; cursor: pointer;
      }
      .wv-bar a.active { color: #fff; font-weight: 600; background: rgba(255,255,255,0.15); }
      .wv-bar .wv-label { color: rgba(255,255,255,0.4); margin-right: 6px; }
      .wv-bar .wv-status { margin-left: auto; color: rgba(255,255,255,0.4); }
      .wv-bar button.wv-hamburger {
        background: none; border: 0; color: rgba(255,255,255,0.8);
        cursor: pointer; padding: 4px; margin-left: 4px;
      }
      #wv-modal {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: none; align-items: flex-start; justify-content: center;
        padding-top: 48px; z-index: 10000;
      }
      #wv-modal[open] { display: flex; }
      #wv-modal .wv-modal-card {
        background: #fff; border-radius: 8px; width: 90%; max-width: 800px;
        overflow: hidden;
      }
      #wv-modal .wv-modal-head {
        display: flex; align-items: center; padding: 12px 16px;
        background: #3a3a3a; color: #fff;
      }
      #wv-modal .wv-modal-head h5 { margin: 0; font-size: 18px; font-weight: 600; }
      #wv-modal .wv-modal-head button {
        background: none; border: 0; color: #fff; font-size: 20px; line-height: 1;
        margin-left: auto; padding: 0 4px; cursor: pointer;
      }
      #wv-modal-body { padding: 16px; max-height: 70vh; overflow-y: auto; }
    </style>
  </head>
  <body>
    <iframe id="wv-viewer" src="${iframeSrc}"></iframe>
    ${nav}
    <div id="wv-modal">
      <div class="wv-modal-card">
        <div class="wv-modal-head">
          <h5>FileMaker Layout Objects</h5>
          <button type="button" id="wv-modal-close">&#x00D7;</button>
        </div>
        <div id="wv-modal-body"></div>
      </div>
    </div>
    <script type="module">
      const HAS_OVERLAY = ${hasOverlay ? 'true' : 'false'};
      const VIEWER      = ${JSON.stringify(viewer)};
      const iframe      = document.getElementById('wv-viewer');
      const statusEl    = document.getElementById('wv-status');
      const modal       = document.getElementById('wv-modal');
      const modalBody   = document.getElementById('wv-modal-body');
      const modalClose  = document.getElementById('wv-modal-close');
      const hamburger   = document.querySelector('.wv-hamburger');

      let iframeReady = false;
      let overlayCurrentViewer = null;

      function setStatus(s) { if (statusEl) statusEl.textContent = s; }

      function installFileMakerInto(w) {
        // The shim FileMaker injects into its web viewer. Calls land on the
        // dev server's /script-mock endpoint; the matching mocks.js handler
        // runs server-side, then pushes results back via SSE.
        w.FileMaker = {
          PerformScript(script, body) {
            fetch('/script-mock/' + encodeURIComponent(script), {
              method: 'POST',
              headers: { 'content-type': 'text/plain' },
              body: body ?? '',
            });
          },
          PerformScriptWithOption(script, body, _option) {
            fetch('/script-mock/' + encodeURIComponent(script), {
              method: 'POST',
              headers: { 'content-type': 'text/plain' },
              body: body ?? '',
            });
          },
        };
      }

      // Install on the PARENT too — nav-bar-content code runs in this realm,
      // so anything that calls filemakerScripts.X() needs window.FileMaker
      // here. Same mock pipeline; the result still flows back to the iframe
      // via SSE → dispatch.
      installFileMakerInto(window);

      if (hamburger) hamburger.addEventListener('click', () => {
        modal.toggleAttribute('open');
      });
      if (modalClose) modalClose.addEventListener('click', () => modal.removeAttribute('open'));
      modal.addEventListener('click', e => { if (e.target === modal) modal.removeAttribute('open'); });

      async function loadOverlayFor(viewerName) {
        if (overlayCurrentViewer === viewerName) return;
        overlayCurrentViewer = viewerName;
        modalBody.replaceChildren();
        if (!HAS_OVERLAY && viewerName === VIEWER) return;
        try {
          const code = await fetch('/dev-overlay/' + viewerName + '.js').then(r => r.ok ? r.text() : null);
          if (!code) return;
          // Run the bundled IIFE with \`document\` and \`window\` shadowed to the
          // iframe's. Returns the default-exported element — created with
          // iframe.contentDocument so its event handlers naturally close over
          // the iframe's globals. adoptNode moves it into the parent's modal.
          const fn = new Function('document', 'window', code);
          const elInIframe = fn(iframe.contentDocument, iframe.contentWindow);
          // Duck-type — Node from the iframe's realm doesn't satisfy
          // \`instanceof Node\` against the parent's class.
          if (elInIframe && typeof elInIframe.nodeType === 'number') {
            modalBody.appendChild(modalBody.ownerDocument.adoptNode(elInIframe));
          }
        } catch (err) {
          console.warn('[preview] failed to load dev-overlay for', viewerName, err);
        }
      }

      async function runClientFor(viewer) {
        if (!viewer) { fireOnLayoutEnter(); return; }
        try {
          const code = await fetch('/dev-client/' + viewer + '.js').then(r => r.ok ? r.text() : null);
          if (!code) { fireOnLayoutEnter(); return; }
          // Run with window shadowed to iframe.contentWindow so calls like
          // window.loadData(...) land directly in the viewer.
          const fn = new Function('window', code);
          fn(iframe.contentWindow);
        } catch (err) {
          console.warn('[preview] failed to run dev-client for', viewer, err);
          fireOnLayoutEnter();
        }
      }

      function currentViewer() {
        // Derive the viewer name from the iframe's URL, not the parent's.
        // This way navigating from /list to /detail in the iframe makes the
        // OnLayoutEnter equivalent fire 'navigate to detail', not the
        // initial viewer's script.
        const m = /\\/dist\\/([^.\\/]+)\\.html$/.exec(iframe.contentWindow.location.pathname);
        return m ? m[1] : null;
      }

      function fireOnLayoutEnter() {
        const viewer = currentViewer();
        if (!viewer) return;
        // Forward the iframe's query string as params, mirroring how
        // FileMaker's OnLayoutEnter would receive whatever the previous
        // script set up.
        const search = iframe.contentWindow.location.search;
        const params = Object.fromEntries(new URLSearchParams(search));
        fetch('/script-mock/' + encodeURIComponent('navigate to ' + viewer), {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: JSON.stringify(params),
        });
      }

      iframe.addEventListener('load', () => {
        installFileMakerInto(iframe.contentWindow);
        iframeReady = true;
        const v = currentViewer();
        // Mirror the iframe URL into the parent's URL bar (bookmarks +
        // reload preserve state). We use replaceState rather than pushState
        // — the iframe's own history already grew an entry when it
        // navigated, so the parent just needs to label it. Browser
        // back/forward then steps through the iframe's history naturally,
        // and our load handler re-labels the parent URL each time.
        if (v) {
          const newUrl = '/preview/' + v + iframe.contentWindow.location.search;
          if (newUrl !== location.pathname + location.search) {
            history.replaceState({}, '', newUrl);
          }
        }
        runClientFor(v);
        if (v) loadOverlayFor(v);
      });

      // Translate FM-layout-style URLs (e.g. /list, /detail?id=42) emitted
      // by goToLayout(...) in mocks.js into the corresponding /dist file.
      function translateLayoutUrl(to) {
        const [pathPart, queryPart = ''] = to.split('?');
        const name = pathPart.replace(/^\\//, '').replace(/\\/$/, '');
        return '/dist/' + name + '.html' + (queryPart ? '?' + queryPart : '');
      }

      function dispatch(msg) {
        const w = iframe.contentWindow;
        if (!w) return;

        if (msg.type === 'goToLayout') {
          if (typeof msg.to === 'string' && msg.to.startsWith('?')) {
            if (msg.to !== w.location.search) w.location.search = msg.to;
            return;
          }
          const target = translateLayoutUrl(msg.to);
          const current = w.location.pathname + w.location.search;
          if (target !== current && target !== w.location.href) {
            iframeReady = false;
            w.location.href = target;
            // On load: parent reinstalls FileMaker + fires OnLayoutEnter.
          }
          return;
        }

        // type === 'js' — invoke a window global in the iframe.
        if (!iframeReady) return; // OnLayoutEnter on load will re-trigger
        const fn = w[msg.fn];
        if (typeof fn === 'function') fn(...msg.args);
      }

      function connect() {
        const sse = new EventSource('/sse');
        sse.addEventListener('message', e => {
          try { dispatch(JSON.parse(e.data)); } catch {}
        });
        sse.addEventListener('open', () => {
          setStatus('● connected');
          // FileMaker may have been installed before SSE was ready; safe to
          // call again — same shim.
          if (iframe.contentWindow) installFileMakerInto(iframe.contentWindow);
        });
        sse.addEventListener('error', () => {
          setStatus('○ reconnecting…');
          sse.close();
          setTimeout(connect, 1000);
        });
      }
      connect();
    </script>
  </body>
</html>`;
}

function renderNav(currentViewer, allViewers, hasOverlay) {
  const links = allViewers.length > 1
    ? allViewers.map(name => {
        const cls = name === currentViewer ? 'active' : '';
        return `<a class="${cls}" href="/preview/${name}">${name}</a>`;
      }).join('')
    : '';
  const hamburger = hasOverlay
    ? `<button class="wv-hamburger" type="button" title="Layout objects">
         <svg fill="currentColor" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/></svg>
       </button>`
    : '';
  return `<div class="wv-bar">
    <span class="wv-label">wv-kit preview ·</span>
    ${links}
    <span class="wv-status" id="wv-status">○ connecting…</span>
    ${hamburger}
  </div>`;
}
