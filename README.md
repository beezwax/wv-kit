# wv-kit

Dev server and build pipeline for [FileMaker web viewer](https://help.claris.com/en/pro-help/content/defining-web-viewers.html) projects. Write your viewer as a normal ES module project; wv-kit compiles it to a single self-contained HTML file ready to paste into FileMaker.

`AGENTS.md` contains detailed conventions and patterns for this stack. Pass it to any AI coding assistant working on a wv-kit project so it understands the FileMaker constraints, viewer contract, and framework-specific patterns.

## What it does

- **Dev server** — live-reloads viewer pages, mocks FileMaker script calls, relays callbacks over SSE
- **Build** — Vite + `vite-plugin-singlefile` bundles every viewer to one inline HTML file
- **ESLint plugin** — catches patterns that don't work in a FileMaker web viewer (navigation via `window.location`, undeclared bare imports, missing default export, etc.)
- **TypeScript / JSX / TSX** — auto-transformed by esbuild in dev; Vite handles production

## Quick start

Scaffold a new project — the init script asks for the rendering library, TypeScript, JSX, single- vs multi-page, viewer names, and whether to seed a working FileMaker ping/pong sample:

```bash
npx github:beezwax/wv-kit init my-viewer
cd my-viewer
npm install
npm start
```

`npx` fetches wv-kit directly from GitHub for the one-shot init — no global install needed. (If you'd rather install globally, `npm i -g github:beezwax/wv-kit` then run `wv-kit init my-viewer` — `npx wv-kit` won't see the global install and will 404 on the npm registry.)

Open http://localhost:3000 — the dev server auto-redirects to the first viewer.

`init` writes `package.json`, `vite.config.js`, `eslint.config.js`, the `src/` skeleton, a `dev-server/mocks.js` stub (when sample is selected), and a project-specific `CLAUDE.md` that links AI agents to `node_modules/wv-kit/AGENTS.md`.

Supported libraries: plain JS, React (with or without JSX/TS), Lit, SolidJS (with or without JSX), Svelte 5, Kensington.

## Install into an existing project

```bash
npm install wv-kit
npm install eslint   # required peer dependency
```

## Public API

Everything wv-kit exports is reachable from the bare specifier `'wv-kit'` — browser-side and server-side helpers share one entry point.

| Export | Side | Purpose |
|---|---|---|
| `onMount(fn)` | browser | Register a callback to run after the app element is mounted into `#app` |
| `performFileMakerScript(name, payload?)` | browser | Call a FileMaker script with an optional payload; auto-queues until `window.FileMaker` is available; serializes the payload with `JSON.stringify` |
| `performJavaScriptInWebViewer(fn, ...args)` | server (mocks) | Push a callback to the browser over SSE; used by `dev-server/mocks.js` to simulate FileMaker pushing data back |

`.d.ts` declarations are bundled alongside the `.js` files, so TypeScript projects get types for these exports automatically.

## Project structure

wv-kit only requires two things:

```
src/
  index.html       # base HTML shell — must contain <main id="app"></main>
  <viewer>/
    index.js       # entry point — default export must be a DOM element
```

Everything else is optional and picked up automatically when present:

```
src/
  shared/
    style.css      # injected into every viewer page if present
  <viewer>/
    style.css      # viewer-specific styles, injected if present
    dev/
      client.js    # dev-only: seeds initial data
      data.json    # dev-only: mock data store
      nav-bar-content.js  # dev-only: element shown in the dev nav panel
dev-server/
  mocks.js         # FM script mock handlers (optional)
```

## Commands

| Command | What it does |
|---|---|
| `wv-kit init [dir]` | Interactive scaffolder — pick library, TypeScript, JSX, viewer layout, optional sample |
| `wv-kit start` | Start the dev server (port from `$PORT`, default 3000) |
| `wv-kit build [viewer…]` | Build one or all viewers → `dist/*.html` |
| `wv-kit check` | Run ESLint only (same as the lint step in `build`) |

`wv-kit build` runs ESLint before building and exits 1 on errors. On macOS the single-viewer form copies the output to the clipboard automatically.

## Viewer contract

`index.js` must export a DOM element as its default. wv-kit appends it to `#app` and then fires any `onMount` callbacks.

```js
// src/my-viewer/index.js
import { onMount } from 'wv-kit';

onMount(() => {
  // element is in the DOM here — safe to query or initialise plugins
});
export default myAppElement;
```

## Initializing viewers in dev (`dev/client.js`)

In production, FileMaker drives the viewer — it navigates to the layout and pushes data by calling window globals like `window.loadData(jsonStr)`. In dev there is no FileMaker, so `dev/client.js` plays that role.

It runs once when the page loads, imports data directly from `dev/data.json`, and calls the same window globals the production viewer expects:

```js
// src/my-viewer/dev/client.js
import data from './data.json' with { type: 'json' };

window.loadData(JSON.stringify(data));
```

Because it only calls window functions — the same interface FileMaker uses — the viewer code itself is completely unaware of whether it is running in dev or production. `dev/client.js` is never included in the production build.

`dev/data.json` doubles as the writable mock database. The dev-server `mocks.js` reads and writes it so that saves and deletes persist across page reloads during development.

## Dev nav bar

When the project has more than one viewer, a fixed nav bar appears at the bottom of every dev page with a link to each viewer. This is injected automatically — no configuration needed.

Each viewer can contribute a panel of dev tools to the nav bar's modal by exporting a DOM element from `dev/nav-bar-content.js`:

```js
// src/my-viewer/dev/nav-bar-content.js
import { t } from 'kensington';

export default t.button({
  type: 'button',
  class: 'btn btn-sm btn-outline-secondary',
  onclick() { window.loadData(JSON.stringify(defaultData)); },
}, 'Reset data').toElement();
```

The element appears inside the modal when the hamburger button is clicked. Clicking the button again closes the modal.

**`nav-bar-content.js` must interact only through window functions** — the same interface FileMaker uses. Do not import signals, state, or other internals from the viewer. Bare imports of UI libraries are fine.

## FileMaker communication

| Direction | Mechanism |
|---|---|
| Browser → FileMaker | `window.FileMaker.PerformScriptWithOption(name, json, 0)` |
| FileMaker → Browser | FileMaker calls a global, e.g. `window.loadData(jsonStr)` |

Calls to `window.FileMaker` made before FileMaker is ready are queued and replayed automatically.

Mock both sides in `dev-server/mocks.js`:

```js
import fs from 'node:fs';
import { performJavaScriptInWebViewer } from 'wv-kit';

const DATA = new URL('../src/list/dev/data.json', import.meta.url).pathname;

export default {
  'load records': () => {
    const records = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
    performJavaScriptInWebViewer('loadData', JSON.stringify(records));
  },

  'save record': param => {
    const incoming = JSON.parse(param);
    const records = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
    const idx = records.findIndex(r => r.id === incoming.id);
    if (idx >= 0) records[idx] = incoming; else records.push(incoming);
    fs.writeFileSync(DATA, JSON.stringify(records, null, 2));
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true }));
  },
};
```

`performJavaScriptInWebViewer` broadcasts to the browser over SSE. Special targets: `'navigate'` sets `window.location.href`, `'navigateSearch'` sets `window.location.search`, `'alert'` calls `window.alert`. All other names call `window[fn](...args)`.

## ESLint

`wv-kit build` runs ESLint automatically. For IDE inline errors, add a one-line config:

```js
// eslint.config.js
export { default } from 'wv-kit/eslint.config.js';
```

### Adding to an existing config

```js
// eslint.config.js
import wvKit from 'wv-kit/lib/eslint.js';

export default [
  // your existing rules ...

  // add wv-kit rules
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx'],
    plugins: { 'wv-kit': wvKit },
    rules: wvKit.configs.recommended.rules,
  },
  {
    // window.location reads are allowed in dev/ files
    files: ['src/**/dev/**'],
    rules: { 'wv-kit/no-window-location': 'off' },
  },
];
```

`no-dev-outside-import` accepts an `allow` array for imports that are intentionally outside `dev/`:

```js
'wv-kit/no-dev-outside-import': ['error', { allow: ['../shared/filemaker-scripts.js'] }]
```

Rules included:

| Rule | What it catches |
|---|---|
| `no-window-location` | `window.location` in production code |
| `no-anchor-href` | `<a href="…">` used for navigation |
| `no-bare-import` | bare imports not declared in `package.json` |
| `no-dev-outside-import` | dev files importing viewer internals |
| `index-default-export` | `src/*/index.js` missing a default export |

## Browser dependencies

Install packages with npm and import them with bare specifiers:

```bash
npm install chart.js
```

```js
import { Chart } from 'chart.js';
```

Vite's dep optimization pre-bundles each package in dev and inlines it in the production single-file build. The `no-bare-import` lint rule requires every bare specifier to be declared in `package.json`.

## TypeScript

The dev server transforms `.ts`, `.tsx`, and `.jsx` on the fly. Add `allowJs: true` and `checkJs: false` to `tsconfig.json` to allow importing plain JS from typed files.

wv-kit ships `.d.ts` declarations alongside its `.js` files. The package.json `exports` map includes a `types` condition, so imports from `'wv-kit'` are typed automatically — no separate `@types/...` package needed.

## Production constraints

FileMaker web viewers are single HTML files with no URL routing. Keep production code free of:

- `window.location` reads or writes — use FileMaker scripts for navigation instead
- `<a href="…">` — use `<button>` with a click listener

`dev/` files are excluded from these rules and may read `window.location` to seed initial data.

## Works with any rendering library

wv-kit's only requirement is a DOM element as the default export from `index.js`. Any library that produces DOM nodes works:

- **Vanilla JS** — build the DOM directly with `document.createElement`
- **Kensington** — `t.div(...).toElement()`
- **React** — `createRoot(container).render(<App />)` inside `queueMicrotask`
- **Svelte** — `mount(App, { target: container })`
- **SolidJS** — `render(() => <App />, container)`
- **Lit** — define a custom element and return `document.createElement('my-element')`

`npm install` the library, then import it with a bare specifier — Vite handles bundling.

---

## Conventions

The following patterns are used in wv-kit examples and `AGENTS.md`. They are not required by wv-kit, but are recommended for consistency.

### Outbound FileMaker script calls

Centralise all outbound script calls in one shared module that wraps `performFileMakerScript` from `'wv-kit'`. The helper handles JSON-stringifying the payload and queues calls made before `window.FileMaker` is set — projects don't write that themselves.

```js
// src/shared/filemaker-scripts.js
import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';

export default {
  loadRecord(id)     { performFileMakerScript(scriptNames.loadRecord, { id }); },
  saveRecord(record) { performFileMakerScript(scriptNames.saveRecord, record); },
  navigate(layout)   { performFileMakerScript(scriptNames.navigate,   { layout }); },
};
```

```js
// src/shared/script-names.js
export const scriptNames = {
  loadRecord: 'load record',
  saveRecord: 'save record',
  navigate:   'navigate',
};
```

### Inbound FM callbacks

Register inbound callbacks (the globals FileMaker calls) via `Object.assign(window, ...)` in `index.js`:

```js
// src/my-viewer/control-functions.js
export default {
  loadData(jsonStr)     { /* update UI */ },
  onSaveResult(jsonStr) { /* show toast */ },
};

// src/my-viewer/index.js
import { onMount } from 'wv-kit';
import controlFunctions from './control-functions.js';

Object.assign(window, controlFunctions);
onMount(() => { /* post-mount setup */ });
export default buildApp();
```

### Separating view from entry

Keep DOM construction in a separate `view.js` so `index.js` stays minimal:

```js
// src/my-viewer/view.js
export default function buildApp() {
  const el = document.createElement('div');
  // ... build the DOM tree ...
  return el; // return, never append
}

// src/my-viewer/index.js
import { onMount } from 'wv-kit';
import controlFunctions from './control-functions.js';
import buildApp from './view.js';

Object.assign(window, controlFunctions);
export default buildApp();
```

---

## Examples

The [`examples/`](./examples) directory has a fully-working product-catalog project per supported library — `plain-js`, `kensington`, `lit`, `react-tsx`, `solid`, `svelte`. Useful as reference for outbound script calls, inbound callbacks, mock data, and the dev nav.

## See also

- `AGENTS.md` — detailed guide for AI agents working on viewer projects, including Kensington, React, and plain JS patterns.
- `CONTRIBUTING.md` — local dev setup and the test suite layout, for working on wv-kit itself.
