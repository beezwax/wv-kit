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
npx github:beezwax/wv-kit init
cd <project-name>   # the directory init created
npm install
npm start
```

`init` interactively asks for a project name (and everything else); the directory is created from that name. `npx` fetches wv-kit directly from GitHub for the one-shot init — no global install needed. (If you'd rather install globally, `npm i -g github:beezwax/wv-kit` then run `wv-kit init` — `npx wv-kit` won't see the global install and will 404 on the npm registry.)

Open http://localhost:3000 — the dev server auto-redirects to the first viewer.

`init` writes `package.json`, `vite.config.js`, `eslint.config.js`, the `src/` skeleton, a `fm/mocks.js` stub (when sample is selected), and a project-specific `CLAUDE.md` that links AI agents to `node_modules/wv-kit/AGENTS.md`.

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
| `defineContract({ fmScripts })` | browser | Declare the outbound (browser → FM) script surface in one place. Returns typed `fmScripts.X(payload)` callers that validate the payload (Standard Schema) before sending. |
| `defineJsFunctions(handlers, schemas?)` | browser | Declare a viewer's inbound (FM → browser) handlers and (optional) schemas. Registers each handler onto `window.<name>` and returns a typed emitter map. Each viewer's `src/<viewer>/js-functions.js` calls this once. |
| `performJavaScriptInWebViewer(fn, ...args)` | server (mocks) | Push a callback to the browser over SSE; used by `fm/mocks.js` to simulate FileMaker's `PerformJavaScriptInWebViewer` |
| `goToLayout(to)` | server (mocks) | Tell the dev page to go to a new path or query — the equivalent of a FileMaker "Go To Layout" script step. `'?…'` updates the query only; anything else replaces the full URL. |
| `defineMock(contract, handlers)` | server (mocks) | Build the mock dispatcher for `fm/mocks.js` from the contract. Each handler receives the parsed + validated FM-script payload. |

wv-kit's contract layer is schema-library-agnostic: any [Standard Schema](https://standardschema.dev) implementation works (valibot, zod 4, arktype). Examples use valibot.

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
fm/                        # FM boundary — shared by viewers and the mock
  fm-scripts.js            # defineContract — outbound (browser → FM)
  schema.js                # Standard Schema value shapes
  mocks.js                 # FM script mock handlers
src/
  shared/
    style.css              # injected into every viewer page if present
  <viewer>/
    style.css              # viewer-specific styles
    js-functions.js        # defineJsFunctions — inbound (FM → browser)
    dev/
      on-first-load.js     # dev-only: seeds initial data
      data.json            # dev-only: mock data store
      nav-bar-content.js   # dev-only: element shown in the dev nav panel
```

## Commands

| Command | What it does |
|---|---|
| `wv-kit init` | Interactive scaffolder — asks for project name, library, TypeScript, JSX, viewer count, optional sample |
| `wv-kit start` | Start the dev server (port from `$PORT`, default 3000) |
| `wv-kit build [viewer…]` | Build one or all viewers → `dist/*.html` |
| `wv-kit preview` | Serve the **built** `dist/*.html` inside an iframe-based FileMaker simulator (port from `$PORT`, default 3001) |
| `wv-kit check` | Run ESLint only (same as the lint step in `build`) |

`wv-kit build` runs ESLint before building and exits 1 on errors. On macOS the single-viewer form copies the output to the clipboard automatically.

### When to use `start` vs `preview`

| | `wv-kit start` | `wv-kit preview` |
|---|---|---|
| Runs | source files, transformed by Vite middleware | the built `dist/<viewer>.html`, served byte-for-byte |
| Hosts the viewer in | the top-level page (same realm as the dev runtime) | an iframe inside a parent shell that simulates FileMaker |
| `window.FileMaker` | installed inline, same realm | injected from the parent into the iframe — same model as the real FileMaker host |
| `window.location` | top-level (URL bar changes on `goToLayout`) | iframe-scoped (matches FileMaker's layout-scoped nav) |
| Iteration speed | instant — edit, reload, see | requires `npm run build` between changes |
| Best for | day-to-day development | pre-paste sanity check, demo to stakeholders, isolating "works in start, breaks in dist" bugs |

Most development happens in `start`. `preview` earns its keep right before you copy `dist/<viewer>.html` into FileMaker — it exercises the exact bytes you're about to paste in an environment that mirrors FileMaker's hosting model (sandboxed iframe + externally-injected `FileMaker`). It's also the cleanest way to share the running viewer with a stakeholder, since there's no dev-time scaffolding leaking through.

Mocks come from the project's existing `fm/mocks.js`. Dev-nav `nav-bar-content.js` works too — the preview shell bundles it on the fly and runs it in the parent with the iframe's `document` and `window` shadowed in, so existing `document.querySelector(...)` etc. still reach the viewer's DOM. The parent URL bar mirrors the iframe URL (back/forward and bookmarks work).

## Installing a built viewer in FileMaker

Each `dist/<viewer>.html` is a single self-contained HTML file — every JS, CSS, font, and image is inlined. That's the form FileMaker's web viewer wants.

1. **Build the viewer.** On macOS the single-viewer form copies to the clipboard automatically.
   ```bash
   npm run build              # all viewers → dist/*.html
   npm run build list         # single viewer → dist/list.html (clipboard on macOS)
   ```

2. **In FileMaker Pro**, open the file in **Layout mode** and select (or insert via `Insert → Web Viewer…`) the web viewer object for the layout you want this viewer to live on.

3. **In Web Viewer Setup**, point the **Web Address** calculation at the HTML via a `data:` URI:
   ```
   "data:text/html;charset=utf-8," & GetAsURLEncoded ( Globals::WebViewerHTML )
   ```
   Store the HTML in a text field (often a global) and paste the dist HTML in there — keeps the calculation small and lets you update the viewer by re-pasting into the field. (You *can* paste the HTML inline into the calculation, but the editor gets unwieldy at production-bundle sizes.)

4. **Enable** "Allow JavaScript to perform FileMaker scripts" in the Web Viewer Setup — otherwise `window.FileMaker.PerformScriptWithOption(...)` calls from the viewer have no effect.

5. **Recreate each mock as a real FileMaker script.** `fm/mocks.js` was written as a line-by-line spec — each handler maps to a FM script that takes `Get(ScriptParameter)` as JSON, does the equivalent FM steps (`Go to Layout`, `Set Field`, `Commit Records`, `Perform JavaScript in Web Viewer`), and matches the script name strings declared in `fm/fm-scripts.js`. See `AGENTS.md` → "Mocks are templates for the real FileMaker scripts" for the JS-to-FM translation table.

6. **Trigger the initial data load.** In dev, `src/<viewer>/dev/on-first-load.js` plays the role of FileMaker's `OnLayoutEnter` trigger by firing the `navigate to <viewer>` script on page load. In production, attach the same script to the layout's **OnLayoutEnter** trigger so the viewer receives its initial state when the user arrives.

To update the viewer later: rebuild, paste the new HTML into the field, save the record. No FileMaker script changes unless the contract in `fm/fm-scripts.js` changed.

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

## Initializing viewers in dev (`dev/on-first-load.js`)

In production, FileMaker drives the viewer — it navigates to the layout (`OnLayoutEnter`) and pushes data by calling window globals like `window.loadData(jsonStr)`. In dev there is no FileMaker, so `dev/on-first-load.js` plays that role.

**It runs only on fresh page loads** (typed URL, browser reload, hard refresh) — *not* after an in-tab navigation triggered by `goToLayout`. wv-kit sets a `sessionStorage` flag before each `goToLayout` so the destination page knows the mock that fired the navigation has already pushed its initial data, and skips `on-first-load.js` on that load. This keeps data sources single-sourced post-navigation.

```js
// src/my-viewer/dev/on-first-load.js — fires the FM script for this viewer
import { fmScripts } from '../../fm/fm-scripts.js';

const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
fmScripts.navigateToDetail({ id });
```

For a list view, you can either re-fire the navigate script (simplest) or fetch the data directly:

```js
// src/list/dev/on-first-load.js
import { jsFunctions } from '../js-functions.js';

// loadData's wire schema expects a JSON string — fetch as text and pass through
const data = await fetch(new URL('./data.json', import.meta.url)).then(r => r.text());
jsFunctions.loadData(data);
```

Because both paths only call window functions — the same interface FileMaker uses — the viewer code itself is completely unaware of whether it is running in dev or production. `dev/on-first-load.js` is never included in the production build.

`dev/data.json` doubles as the writable mock database. The mock (`fm/mocks.js`) reads and writes it so that saves and deletes persist across page reloads during development.

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

**FileMaker carries only text across the WebViewer boundary.** Every `PerformScriptWithOption` parameter is a string (FM reads it back with `Get(ScriptParameter)`); every parameter to "Perform JavaScript in Web Viewer" is also a string. wv-kit serializes outbound payloads automatically and inbound schemas describe the wire format — see "Wire format" below.

### Declaring both sides with the contract API

Schema-driven, single source of truth. Each viewer is one WebViewer with its own `window`, so inbound (`jsFunctions`) is declared per viewer; outbound (`fmScripts`) is shared since FM scripts live in one namespace per `.fmp12`.

```js
// fm/fm-scripts.js — outbound (browser → FM)
import { defineContract } from 'wv-kit';
import { idParamShape, productShape } from './schema.js';

export const contract = defineContract({
  fmScripts: {
    navigateToList:   { fmName: 'navigate to list' },
    navigateToDetail: { fmName: 'navigate to detail', payload: idParamShape },
    saveProduct:      { fmName: 'save product',       payload: productShape },
  },
});
export const fmScripts = contract.fmScripts;
```

```js
// fm/schema.js — value shapes + wire schemas
import * as v from 'valibot';

export const productShape = v.object({ id: v.string(), name: v.string(), /* … */ });

// Wire schemas: FM only delivers strings, so inbound schemas are pipes —
// string → JSON.parse → validate-as-shape.
const jsonOf = (shape) => v.pipe(v.string(), v.transform(JSON.parse), shape);
export const productSchema = jsonOf(productShape);
```

```js
// src/list/js-functions.js — inbound (FM → browser), per viewer
import { defineJsFunctions } from 'wv-kit';
import { productListSchema } from '../../fm/schema.js';
import { setProducts } from './state.js';

const handlers = {
  loadData(list)            { setProducts(list); },
  showToast(level, message) { /* … */ },
};

const schemas = {
  loadData:  productListSchema,
  showToast: [v.picklist(['info','success','warn','error']), v.string()],  // tuple = multi-arg
};

export const jsFunctions = defineJsFunctions(handlers, schemas);
```

```js
// src/list/index.js
import './js-functions.js';   // side-effect: registers FM-callback handlers on window.*
import buildApp from './view.js';
export default buildApp();
```

```js
// fm/mocks.js — replicates FM scripts; mirrors real FM steps line-by-line
import { defineMock, goToLayout, performJavaScriptInWebViewer } from 'wv-kit';
import { contract } from './fm-scripts.js';
import { productListShape, blankProduct } from './schema.js';

const readAll = () => /* fs.readFileSync etc */;

export default defineMock(contract, {
  navigateToList() {
    goToLayout('/list');
    performJavaScriptInWebViewer('loadData', JSON.stringify(readAll()));
  },
  saveProduct(incoming) {
    /* … persist … */
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },
});
```

Mocks deliberately **don't** import per-viewer `js-functions.js` — real FM scripts can't see the browser's JS either, and keeping that constraint makes the mocks an exact spec for the FM script you'll write. The browser-side `defineJsFunctions` validates every inbound call against its schema on arrival.

### Wire format

Because FM only carries strings, the contract schemas describe the wire format explicitly:

- **Outbound `fmScripts.X(payload)`** — caller passes a JS object; wv-kit `JSON.stringify`s before handing the string to `PerformScriptWithOption`.
- **Inbound `jsFunctions`** — schemas are *wire schemas* (`v.pipe(v.string(), v.transform(JSON.parse), shape)`). Handler receives the parsed value.
- **Multi-arg (tuple) inbound** — schemas declared as an array: `[v.picklist([…]), v.string()]`. Each tuple slot is a separate string parameter on the wire, no JSON wrapping. Handler is called with positional args.

### Navigation

Navigation is a **separate** call because in FileMaker it's a "Go To Layout" script step (not JavaScript pushed to the viewer):

```js
import { goToLayout } from 'wv-kit';

goToLayout('/list');             // window.location.href = '/list'
goToLayout('/detail?id=42');     // window.location.href = '/detail?id=42'
goToLayout('?id=42');            // window.location.search = '?id=42' (path preserved)
```

### Schema-error hook

A `wv-kit:schema-error` CustomEvent fires on `window` whenever inbound or emitter-side validation fails — in both dev (before the throw) and prod (before the log + pass-through). Wire it to your error tracker or UI:

```js
window.addEventListener('wv-kit:schema-error', (e) => {
  const { label, issues, value } = e.detail;
  Sentry.captureMessage(`Schema validation failed: ${label}`, { extra: { issues, value } });
});
```

`label` pinpoints the failure (e.g. `"jsFunctions.loadData"` or `"fmScripts.saveProduct"`). Attach the listener as early as possible — listeners attached after the failure miss it (standard event semantics).

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
'wv-kit/no-dev-outside-import': ['error', { allow: ['../../fm/fm-scripts.js'] }]
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

### Typing JS projects with JSDoc

Plain-JS projects can still get hover types, autocomplete, and red squiggles on wrong calls. Add a `tsconfig.json` (JetBrains IDEs only route JS through the TypeScript Language Service when a `tsconfig.json` is present — `jsconfig.json` has spotty support there):

```json
{
  "compilerOptions": {
    "module":            "esnext",
    "moduleResolution":  "bundler",
    "target":            "es2022",
    "lib":               ["es2022", "dom", "dom.iterable"],
    "allowJs":           true,
    "checkJs":           false,
    "strict":            true,
    "noEmit":            true,
    "skipLibCheck":      true,
    "resolveJsonModule": true,
    "isolatedModules":   true
  },
  "include": ["src/**/*", "fm/**/*"]
}
```

For the broken-out namespaces (`fmScripts`, `jsFunctions`), JetBrains' JS engine sometimes doesn't navigate the conditional types in wv-kit's generics — use an inline `@type` annotation listing each method explicitly:

```js
/**
 * @type {{
 *   loadData(json: string):                                          void,
 *   showToast(level: 'info'|'success'|'warn'|'error', message: string): void,
 * }}
 */
export const jsFunctions = defineJsFunctions(handlers, schemas);
```

VS Code and `tsc` resolve the generics either way; the inline annotation is mostly for JetBrains portability. Opt files into strict checking with `// @ts-check` at the top.

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

### FileMaker boundary

See the [FileMaker communication](#filemaker-communication) section above for the full pattern. Summary:

- **`fm/fm-scripts.js`** — `defineContract({ fmScripts })`, exports typed callers `fmScripts.X(payload)`.
- **`fm/schema.js`** — Standard Schema value shapes (`v.object(...)`) plus wire schemas (`v.pipe(v.string(), v.transform(JSON.parse), shape)`).
- **`src/<viewer>/js-functions.js`** — `defineJsFunctions(handlers, schemas?)`, one per viewer. Importing it registers `window.<name>` for each handler. Same FM-side function name can have a different schema across viewers because each viewer is its own WebViewer.
- **`fm/mocks.js`** — `defineMock(contract, handlers)`. Mocks call `performJavaScriptInWebViewer(name, JSON.stringify(value))` directly; they never import per-viewer js-functions (matches the FM constraint that scripts can't see the browser's JS).

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
import './js-functions.js';   // side-effect: registers FM-callback handlers
import buildApp from './view.js';

export default buildApp();
```

---

## Examples

The [`examples/`](./examples) directory has a fully-working product-catalog project per supported library — `plain-js`, `kensington`, `lit`, `react-tsx`, `solid`, `svelte`. Useful as reference for outbound script calls, inbound callbacks, mock data, and the dev nav.

## See also

- `AGENTS.md` — detailed guide for AI agents working on viewer projects, including Kensington, React, and plain JS patterns.
- `CONTRIBUTING.md` — local dev setup and the test suite layout, for working on wv-kit itself.
