# AGENTS.md — wv-kit Project Guide

This file is for AI agents working on FileMaker web viewer projects. Read it before writing any code.

---

## What this stack is

A FileMaker web viewer is a browser running inside a FileMaker layout. Each viewer is a **single self-contained HTML file** pasted into FileMaker's admin settings. This project uses `wv-kit` to provide a dev server and build pipeline for authoring those files.

FileMaker and the browser communicate via two mechanisms:
- **Browser → FileMaker**: `window.FileMaker.PerformScriptWithOption(scriptName, JSON.stringify(payload), 0)`
- **FileMaker → Browser**: FileMaker calls named globals on `window` (e.g. `window.loadData(jsonStr)`)

In development, `wv-kit` mocks both directions — the dev server intercepts script calls and fires callbacks back to the browser via SSE.

---

## Project structure

```
src/
  shared/               # Shared utilities used across viewers
    style.css           # Global styles — imports Bootstrap from CDN
    filemaker-scripts.js  # Wraps all window.FileMaker calls
    script-names.js     # Central registry of FileMaker script name strings
    por-kensington.js   # Project kensington subclass (adds custom tags)
    installed/          # Auto-generated — do not edit (run `wv-kit install`)
  <viewer-name>/        # One directory per viewer
    index.js            # Entry point — exports default app element
    view.js             # Builds and returns the app DOM element
    control-functions.js  # window.load* callbacks exposed to FileMaker
    style.css           # Viewer-specific styles
    dev/
      client.js         # Dev-only: seeds initial data via window.load* calls
      nav-bar-content.js  # Dev-only: exports a DOM element shown in dev nav modal

dev-server/
  mocks.js              # FileMaker script mock handlers (server-side)
  routes.js             # Project-specific Express routes (optional)
  front-end-dependencies/
    <package>.js        # Re-exports from npm package (one file per dep)
    <package>.config.js # Optional Rollup plugins for that dep
```

---

## Creating a new viewer

1. Create `src/<name>/index.js`, `view.js`, `control-functions.js`, `style.css`
2. `index.js` must **export a DOM element as its default export**:
   ```js
   import controlFunctions from './control-functions.js';
   import buildApp from './view.js';
   Object.assign(window, controlFunctions);
   export default buildApp();
   ```
3. `view.js` exports `buildApp()` which **returns** (does not append) the app element:
   ```js
   export default function buildApp() {
     return t.div({ ... }, [...]).toElement();
   }
   ```
4. `control-functions.js` exports an object of functions that FileMaker will call:
   ```js
   export default {
     loadData(jsonStr) { /* parse and render */ },
     onSaveResult(jsonStr) { /* handle save response */ },
   };
   ```
5. Add `dev/client.js` to seed initial data in development:
   ```js
   import data from './data.json' with { type: 'json' };
   window.loadData(JSON.stringify(data));
   ```
6. The viewer is auto-discovered — no registration needed. `wv-kit start` picks up any `src/*/index.js`.

---

## FileMaker scripts

All FileMaker script names live in `src/shared/script-names.js` as string constants. Never hardcode script names inline.

All calls go through `src/shared/filemaker-scripts.js`:
```js
import filemakerScripts from '../shared/filemaker-scripts.js';
filemakerScripts.saveChangeSet(JSON.stringify(payload));
```

When `window.FileMaker` is not yet available (FM is still loading), calls are queued and replayed automatically once FM signals it is ready.

---

## Dev mocks (`dev-server/mocks.js`)

This file is the server-side mock of FileMaker. It exports a default object keyed by script name. Each handler receives the raw JSON string that the app sent:

```js
import { scriptNames } from '../src/shared/script-names.js';
import { performJavaScriptInWebViewer } from 'wv-kit/lib/sse.js';

export default {
  [scriptNames.saveChangeSet]: body => {
    const { currentSkuId, edapiPayload } = JSON.parse(body);
    // ... write to dev data files ...
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true }));
  },
};
```

`performJavaScriptInWebViewer(fn, ...args)` sends an SSE event that calls `window[fn](...args)` in the browser. This mirrors FileMaker's "Perform JavaScript in Web Viewer" feature.

Special browser-side operations use named cases handled in `wv-kit`'s `shared-dev-index.js`:
- `performJavaScriptInWebViewer('navigate', url)` → `window.location.href = url`
- `performJavaScriptInWebViewer('navigateSearch', qs)` → `window.location.search = qs`
- `performJavaScriptInWebViewer('alert', msg)` → `window.alert(msg)`

All other names call the matching `window[fn]` directly — so `performJavaScriptInWebViewer('loadData', json)` calls `window.loadData(json)`.

---

## Dev routes (`dev-server/routes.js`)

Optional Express router for serving mock data or persisting dev state:

```js
import express from 'express';
const router = express.Router();

router.post('/my-viewer/save', (req, res) => {
  // persist req.body to a dev data file
  res.sendStatus(204);
});

export default router;
```

---

## Front-end dependencies

npm packages needed in the browser are pre-bundled into `src/shared/installed/` by `wv-kit install`. To add a new package:

1. Create `front-end-dependencies/<name>.js` re-exporting what the viewer needs:
   ```js
   export { foo, bar } from 'some-package';
   ```
2. Optionally create `front-end-dependencies/<name>.config.js` for Rollup plugins:
   ```js
   import replace from '@rollup/plugin-replace';
   export default [replace({ ... })];
   ```
3. Run `wv-kit install` (or `npm install` which triggers `postinstall`)
4. Import from `../shared/installed/<name>.js` in viewer code

Never import bare npm specifiers directly in `src/` — the browser can't resolve them. Always go through `installed/`.

---

## Styling

- Bootstrap is loaded from the CDN in `src/shared/style.css` — use Bootstrap utility classes first
- Theme Bootstrap via CSS variables (`--bs-*`) rather than overriding component styles
- Viewer-specific styles go in `src/<name>/style.css`
- Shared styles go in `src/shared/style.css`
- Use `<colgroup>` as the single source of truth for table column widths
- Semantic colors: destructive actions use `#FF3B30` (macOS system red); never Bootstrap's `#dc3545`
- Modal headers are dark: `background: #3a3a3a`, white title — this is in `shared/style.css`

---

## Kensington (template library)

Kensington is used to build reactive DOM trees. Import `t` from `src/shared/por-kensington.js`:

```js
import { computed, signal, t } from '../shared/por-kensington.js';

const count = signal(0);
const el = t.div({ class: 'counter' }, [
  computed(() => `Count: ${count.get()}`),
  t.button({ onclick() { count.set(count.get() + 1); }, type: 'button' }, '+'),
]).toElement();
```

Key rules:
- Use `t.literal` for trusted SVG/HTML strings, never `t.unsafeLiteral`
- Event handlers are inline method shorthand: `onclick() { ... }`, not arrow functions assigned to properties
- All attribute keys are camelCase; use nested objects when 2+ share a prefix: `data: { bs: { toggle: 'modal' } }`
- `t.div(...).toElement()` returns a live DOM element; kensington updates it in-place when signals change
- `signal.addConnectedCallback(fn)` fires `fn` when the element is appended to the DOM — use this for post-mount setup that queries the DOM

---

## Building for production

```bash
wv-kit build              # builds all viewers → dist/*.html
wv-kit build list         # builds one viewer
```

Each viewer becomes a single self-contained HTML file in `dist/`. On macOS, a single-viewer build automatically copies the output to the clipboard, ready to paste into FileMaker.

---

## Things to avoid

- **Do not** call `document.getElementById('app').append(...)` in viewer code — `index.js` exports the element; the infrastructure appends it
- **Do not** import from `node_modules/` directly in `src/` — use `installed/`  
- **Do not** put server-side Node.js code (using `fs`, `path`, etc.) in `src/`
- **Do not** hardcode FileMaker script names — use `scriptNames` from `script-names.js`
- **Do not** modify files in `src/shared/installed/` — they are auto-generated
- **Do not** add Bootstrap utility classes to elements that also set `style=` — pick one
- **Keep viewers independent** — `src/list/` should not import from `src/detail-full/`; shared code goes in `src/shared/`
