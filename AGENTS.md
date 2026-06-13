# AGENTS.md — wv-kit Project Guide

This file is for AI agents working on FileMaker web viewer projects. Read it before writing any code.

---

## Quick reference: how to implement common requests

| Request | Files to touch |
|---|---|
| **Add a new FM script call** (browser → FM) | Add an entry to `fm/fm-scripts.{js,ts}`'s `defineContract({ fmScripts })` map (with `fmName` and optional `payload` schema from `fm/schema.{js,ts}`); add a handler in `fm/mocks.{js,ts}` |
| **Add a new FM callback** (FM → browser) | Add a handler + schema to the viewer's `src/<viewer>/js-functions.{js,ts}` (`defineJsFunctions` registers `window.<name>` on import); call it from a mock via `performJavaScriptInWebViewer('<name>', JSON.stringify(value))` |
| **Add a new viewer (layout)** | Create `src/<viewer>/index.{js,ts}` (side-effect `import './js-functions.{js,ts}'` + `buildApp`), `view.{js,jsx,tsx,svelte}`, `js-functions.{js,ts}`, plus `dev/on-first-load.js` that re-fires the viewer's "navigate to" script |
| **Add a new column/field to the list** | Add the field to the inner shape in `fm/schema.{js,ts}` (`productShape`); update the rendering in `src/list/view.{js,jsx,tsx,svelte}`; the existing `saveProduct` mock already round-trips arbitrary fields |
| **Make the detail page load on direct URL visit / reload** | Already handled: `src/<viewer>/dev/on-first-load.js` fires `fmScripts.navigateTo<Viewer>({ id })`. The mock handler is the single source of truth for "load this record" |
| **Initial data load on layout open** | In production, FileMaker's OnLayoutEnter runs the navigate-to script. In dev, `src/<viewer>/dev/on-first-load.js` plays the same role — but only on fresh page loads, not after an in-tab `goToLayout` (the destination mock already pushed data) |
| **Add a confirmation alert in a mock** | `performJavaScriptInWebViewer('alert', 'message')` — no special-casing, it just calls `window.alert` |
| **Persist data across server restarts** | Mocks read/write `src/<viewer>/dev/data.json` directly with `fs.readFileSync`/`fs.writeFileSync` on every call. The dev server watches `fm/` only, so writes here don't trigger a restart |
| **Navigate from a mock handler** | `goToLayout('/list')` or `goToLayout(`/detail?id=${id}`)`. A query-only string (`?q=foo`) updates `window.location.search`. No-op when target matches current URL |
| **Hook into validation failures in prod** | `window.addEventListener('wv-kit:schema-error', (e) => { /* e.detail.label, e.detail.issues, e.detail.value */ })` — fires before the dev throw and before the prod log+passthrough |

The full conventions for each of these are in the rest of this document.

---

A wv-kit project produces one or more web viewers — JavaScript apps running inside a FileMaker layout. Each viewer builds to a **single self-contained HTML file** that's pasted into FileMaker's admin settings; wv-kit provides the dev server and build pipeline for authoring those files.

The dev server uses **Vite in middleware mode** for all source-file transforms. Express handles wv-kit-specific concerns (viewer HTML injection, SSE, mock dispatch); Vite handles everything in `src/` via the project's `vite.config.js` plugins. For React add `@vitejs/plugin-react`; for Svelte add `@sveltejs/vite-plugin-svelte`; for Solid add `vite-plugin-solid`. The server runs at `http://localhost:3000` and prints clickable URLs for each discovered viewer on start.

FileMaker and the browser communicate in two directions:

| Direction | Mechanism |
|---|---|
| Browser → FileMaker | `window.FileMaker.PerformScriptWithOption(name, JSON.stringify(payload), 0)` |
| FileMaker → Browser | FileMaker calls a named global, e.g. `window.loadData(jsonStr)` |

In development, `wv-kit` mocks both sides: the dev server intercepts script calls and sends callbacks back to the browser over Server-Sent Events (SSE).

---

## Public API

Everything wv-kit gives you to import comes from the bare specifier `'wv-kit'` — both browser-side and server-side helpers share one entry point.

| Export | Side | Purpose |
|---|---|---|
| `onMount(fn)` | browser | Register a callback to run after the app element is mounted into `#app` |
| `performFileMakerScript(name, payload?)` | browser | Call a FileMaker script with an optional payload; auto-queues until `window.FileMaker` is available; serializes payload with `JSON.stringify` |
| `performJavaScriptInWebViewer(fn, ...args)` | server (mocks) | Push a callback to the browser over SSE; mocks use this to simulate FileMaker's `PerformJavaScriptInWebViewer` |
| `goToLayout(to)` | server (mocks) | "Go To Layout" equivalent — sends a typed nav frame to the browser. `'?…'` updates the query only; anything else replaces the URL |

```js
// browser
import { onMount, performFileMakerScript } from 'wv-kit';

// server (dev-server/mocks.js)
import { performJavaScriptInWebViewer, goToLayout } from 'wv-kit';
```

`flushMounts` is also exported but is internal — wv-kit's injected script calls it via `window.__wvFlushMounts?.()` after appending the app element. `addSseClient` / `removeSseClient` are likewise internal, used by `wv-kit/lib/server.js`.

---

## Project structure

wv-kit requires only two things:

```
src/
  index.html            # base HTML shell — must contain <main id="app"></main>
  <viewer-name>/
    index.js            # entry point — default export is the app DOM element
```

Everything else is optional and picked up automatically when present:

```
fm/                       # FileMaker boundary — shared by viewers AND the mock server
  contract.js             # defineContract({ fmScripts, jsFunctions }) — single source of truth
  schema.js               # Standard Schema definitions for every payload that crosses the boundary
  mocks.js                # Server-side FM script mock handlers — one handler per fmScript, owns goToLayout + the data push for that script
src/
  shared/
    style.css             # Global styles — injected into every viewer page if present
    product-utils.js      # Viewer-only utilities (formatting, etc.) — never imported by fm/
  <viewer-name>/
    view.js               # buildApp() — creates and returns the app element
    style.css             # Viewer-specific styles
    dev/
      on-first-load.js    # Dev-only: fires the FM script that production's OnLayoutEnter would. Runs ONLY on fresh page loads (typed URL, reload), NOT after in-tab navigation — for that, the goToLayout-triggering mock handler is the data source. ONE line per viewer — calls e.g. fmScripts.navigateToList() / navigateToDetail({ id })
      data.json           # Dev-only: writable mock data store — read fresh on every mocks.js handler call (fs.readFileSync, no in-memory cache)
      nav-bar-content.js  # Dev-only (optional): DOM element in the dev nav modal — interact only via window globals or fmScripts; importing from src/shared/ or fm/ is fine, viewer internals are not
```

---

## The viewer contract

Every viewer follows four rules:

**1. `index.js` exports a DOM element as its default export.** wv-kit injects an inline script that does `document.getElementById('app').append(defaultExport)`, then calls `flushMounts()` to run any `onMount` callbacks.

**2. `view.js` returns — never appends — the app element.**

**3. `index.js` does NOT request initial data.** In production FileMaker pushes data to the viewer (typically via an OnLayoutEnter trigger that runs a "show <viewer>" script). The viewer never asks. `index.js` is just: register control functions on `window`, build the app, export.

**4. `dev/on-first-load.js` is the dev-only stand-in for FileMaker's OnLayoutEnter.** It fires the same FM script the production trigger would, using URL params for context. The mock handler owns both the navigation (`goToLayout`) and the data push (`performJavaScriptInWebViewer`), so click-through and reload go through one source of truth:

```js
// src/list/dev/on-first-load.js
import filemakerScripts from '../../shared/filemaker-scripts.js';
filemakerScripts.navigateToList();

// src/detail/dev/on-first-load.js
import filemakerScripts from '../../shared/filemaker-scripts.js';
const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
filemakerScripts.navigateToDetail(id);
```

Why not import `data.json` directly and call `window.loadData(...)`? Vite caches JSON imports in dev — after `saveProduct` writes to disk, the cached import is stale. Going through the FM script flow guarantees a fresh `fs.readFileSync` on every call. (See "Dev mocks" below.)

---

## Viewer examples

### Kensington

Kensington builds reactive DOM trees. `t.tag(attrs, children)` creates nodes; `signal` / `computed` power reactivity; `.toElement()` produces a live DOM element that kensington patches in place.

```js
// src/my-viewer/view.js
import { computed, signal, t } from 'kensington';

const items = signal([]);

export default function buildApp() {
  return t.div({ class: 'p-3' }, [
    t.ul(computed(() =>
      items.get().map(item =>
        t.li({ dataKey: item.id }, item.name),
      ),
    )),
    t.button({
      class: 'btn btn-primary mt-2',
      onclick() { items.set([...items.get(), { id: Date.now(), name: 'New item' }]); },
      type: 'button',
    }, 'Add'),
  ]).toElement();
}
```

```js
// src/my-viewer/control-functions.js
import { items } from './data.js'; // signal

export default {
  loadData(jsonStr) {
    items.set(JSON.parse(jsonStr));
  },
};
```

```js
// src/my-viewer/index.js
import { onMount } from 'wv-kit';
import controlFunctions from './control-functions.js';
import buildApp from './view.js';

Object.assign(window, controlFunctions);
onMount(() => {
  // element is in #app — safe to query, measure, or initialise third-party libs
  new bootstrap.Modal(document.getElementById('my-modal'));
});
export default buildApp();
```

```js
// src/my-viewer/dev/on-first-load.js — dev-only OnLayoutEnter stand-in
import filemakerScripts from '../../shared/filemaker-scripts.js';
filemakerScripts.navigateToMyViewer();   // same script production would run on enter
```

#### Kensington patterns

**Install the ESLint plugin** — catches reactive pitfalls (`.set()` in computed, missing `dataKey`, self-loop patterns) at lint time:
```bash
npm install --save-dev eslint-plugin-kensington
```
```js
// eslint.config.js
import kensington from 'eslint-plugin-kensington';
export default [kensington.configs.recommended];
```

**`transform` vs `computed`** — use `transform` for a single-signal derivation; use `computed` when reading multiple signals:
```js
const formatted = price.transform(v => `$${v.toFixed(2)}`);          // one signal
const label     = computed(() => `${count.get()} ${unit.get()}`);     // two signals
```

**`.get()` vs `.value`** — `.get()` subscribes the surrounding computed/effect; `.value` reads without subscribing. Use `.value` when you need the current value but do NOT want it to trigger re-runs (most importantly: when you read a signal before writing it in the same flow):
```js
effect(() => {
  const results = fetch(`/search?q=${query.get()}`);   // .get() — re-run when query changes
  results.then(data => {
    items.set(data);
    lastQuery.set(query.value);    // .value — avoids subscribing; prevents infinite loop
  });
});
```

**Never call `.set()` inside a `computed` body** — computeds must be pure derivations. Move side effects into a separate `effect`:
```js
// BAD
const rows = computed(() => {
  const visible = items.get().filter(isActive);
  if (!visible.length) selectedId.set(null);   // ← side effect in computed
  return visible.map(item => t.tr(item.name));
});

// GOOD
const visibleItems = computed(() => items.get().filter(isActive));
effect(() => { if (!visibleItems.get().length) selectedId.set(null); });
```

**Never create a `computed` or `.transform()` inside a reactive callback.** Kensington throws if a new computed is created inside an existing computed's re-run. All `signal.transform(...)` calls must live at `buildApp()` scope (or module scope), not inside another `.transform(...)` callback:
```js
// BAD — price.transform is created inside product.transform's callback on every re-run
product.transform(p => !p ? null : t.div([
  t.span(price.transform(v => formatPrice(v))), // ← ERROR
]));

// GOOD — hoist transforms to buildApp() scope, control visibility with prop:
export default function buildApp() {
  const formattedPrice = price.transform(v => formatPrice(v)); // created once
  return t.div([
    t.div({ prop: { hidden: product.transform(p => !p) } }, [
      t.span(formattedPrice),
    ]),
  ]).toElement();
}
```

**Stable transforms in lists** — attach derived signals to the item object when created, not inside the list mapping. Creating a `.transform()` inside `computed(() => list.get().map(...))` makes a new computed on every re-render, breaking the reconciler's fast-path:
```js
// BAD — itemClass is a new computed on every list re-render
const rows = tasks.transform(list =>
  list.map(({ id, text, done }) =>
    t.li({ dataKey: id, class: done.transform(d => d ? 'done' : '') }, text)
  )
);

// GOOD — attach the derived signal to the item when it's created
function makeTask(text) {
  const done = signal(false);
  return { id: Date.now(), text, done, itemClass: done.transform(d => d ? 'done' : '') };
}
const rows = tasks.transform(list =>
  list.map(({ id, text, itemClass }) => t.li({ dataKey: id, class: itemClass }, text))
);
```

**Keyed lists** — always add `dataKey` when items may reorder, be added, or removed:
```js
t.tbody(
  computed(() => rows.get().map(row =>
    t.tr({ dataKey: row.id }, [
      t.td(row.name),
      t.td(row.status),
    ]),
  )),
)
```

**Loading state** — a signal can hold a tag, string, array, or `null`. Use this for clean loading/loaded transitions:
```js
const view = signal(t.p({ class: 'text-muted' }, 'Loading…'));

// When data arrives (e.g. in loadData):
export function loadData(jsonStr) {
  const items = JSON.parse(jsonStr);
  view.set(t.ul(items.map(i => t.li({ dataKey: i.id }, i.name))));
}

// In buildApp:
t.div({ class: 'container' }, view).toElement();
```

**Post-mount setup** — use `addConnectedCallback` when you need the element to be in the DOM first (querying by ID, measuring size, initialising a Bootstrap component):
```js
export default function buildApp() {
  const view = t.div({ id: 'my-modal', class: 'modal' }, [...]);

  view.addConnectedCallback(() => {
    const el = document.getElementById('my-modal');
    el.addEventListener('hidden.bs.modal', () => onClose());
  });

  return view.toElement();
}
```

**Attribute conventions:**
```js
t.button({
  // camelCase maps to HTML attributes
  ariaLabel: 'Close',
  dataBsDismiss: 'modal',   // data-bs-dismiss

  // use nested objects when 2+ attrs share a prefix on the same element
  data: { bs: { target: '#my-modal', toggle: 'modal' } },

  // prop: sets DOM properties, not attributes (for reactive values)
  prop: { checked: isChecked, value: currentValue },

  // event handlers: method shorthand, not arrow functions
  onclick() { doSomething(); },
  type: 'button',
})
```

**SVG and MathML** — use the same `t.tagName(attrs, children)` API as HTML. Kensington calls `createElementNS` automatically when serializing `t.svg(...)` or `t.math(...)` (and their descendants), so namespacing is handled for you:
```js
import { t } from 'kensington';
export function chevronIcon(direction = 'down') {
  const rotate = { down: 0, up: 180, left: 90, right: -90 }[direction];
  return t.svg({
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 20 20',
    fill: 'currentColor',
    width: 20, height: 20,
    style: rotate ? { transform: `rotate(${rotate}deg)` } : {},
    ariaHidden: 'true',
  },
    t.path({
      fillRule: 'evenodd', clipRule: 'evenodd',
      d: 'M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z',
    }),
  );
}
```
SVG element names that are camelCase in the spec (e.g. `linearGradient`, `clipPath`) keep their casing. All CSS properties are valid as presentation attributes on SVG elements. The same applies to MathML via `t.math(...)`.


---

### React

Uses `@vitejs/plugin-react` with the default automatic JSX runtime. Vite handles JSX transformation, dep optimization, and runtime deduplication; `react` and `react-dom` are imported as bare specifiers (both are in `KNOWN_BARE` in `lib/eslint.js`).

**`vite.config.js`:**

```js
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [react()] });
```

**Source files import directly from `react` / `react-dom/client`** — Vite's dep optimization handles bundling, no `import React from ...` (the automatic runtime injects what's needed):

```jsx
// src/my-viewer/view.jsx
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [data, setData] = useState(null);
  // ...
}

export default function buildApp() {
  const container = document.createElement('div');
  queueMicrotask(() => createRoot(container).render(<App />));
  return container;
}
```

**Use `onMount` to run code after the container is in the DOM.** Because React renders asynchronously via `queueMicrotask`, `onMount` alone does not guarantee the React tree is ready — use `useEffect` inside the component for React-specific post-render work. `onMount` is still useful for measuring the container or initialising non-React plugins.

**React state setters are not available until after the first render.** The FM-driven flow (mock pushes `loadData` via SSE) can fire *before* React's `useEffect` registers the state setter — so you need a tiny module-level buffer that drains on first registration. Without it, the data is silently dropped:

```js
// src/my-viewer/view.js
let _setData = null;
let _pending = null;

export function registerSetData(fn) {
  _setData = fn;
  if (_pending !== null) { fn(_pending); _pending = null; }
}
export function updateData(data) {
  if (_setData) _setData(data); else _pending = data;
}
```

```js
// src/my-viewer/control-functions.js
import { updateData } from './view.js';
export default {
  loadData(jsonStr) { updateData(JSON.parse(jsonStr)); },
};
```

```js
// src/my-viewer/view.js — inside App component
import { registerSetData } from './view.js'; // same file, or a data.js module

function App() {
  const [data, setData] = useState(null);
  useEffect(() => { registerSetData(setData); }, []);
  // ...
}
```

---

### Lit

Lit is the simplest framework to use with wv-kit — it's a pure browser library with no custom compiler. `npm install lit`, then import directly; Vite's dep optimization handles bundling. No dev server changes needed.

```js
import { LitElement, html, css, nothing } from 'lit';
```

**Always override `createRenderRoot` to use light DOM** — without it, Lit uses shadow DOM and Bootstrap styles do not penetrate:

```js
class MyViewer extends LitElement {
  static properties = { products: {}, query: {}, category: {} };
  createRenderRoot() { return this; }   // required for Bootstrap
  constructor() { super(); this.products = []; this.query = ''; this.category = ''; }
  render() { return html`...`; }
}
customElements.define('my-viewer', MyViewer);
```

**Expose a module-level element ref** so `control-functions.js` can update reactive properties:

```js
// view.js
let _element = null;
export function setProducts(data) {
  if (!_element) return;
  _element.products = data;
  _element.query    = '';   // reset filters so Reload is visibly effective
  _element.category = '';
}
export default function buildApp() {
  _element = document.createElement('my-viewer');
  return _element;
}
```

Setting a declared property (`_element.products = ...`) triggers LitElement's reactive update cycle automatically.

---

### Solid

Uses `vite-plugin-solid` — the standard SolidJS dev setup. The plugin applies `babel-plugin-jsx-dom-expressions` for the fine-grained reactive JSX transform, handles dep optimization, and deduplicates the Solid runtime. No wv-kit-specific workarounds are needed; `'solid-js'` is in `KNOWN_BARE` (`lib/eslint.js`).

**`vite.config.js`:**

```js
import solid from 'vite-plugin-solid';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [solid()] });
```

**Source files import from bare specifiers:**

```jsx
import { createSignal, createMemo, For, Show } from 'solid-js';
import { render } from 'solid-js/web';
```

Module-level signals work as expected — `render()` shares the reactive runtime, so signals declared at module scope drive the rendered tree. Standard reactive JSX patterns apply: accessors are called normally (`{value()}`), `<For each={signals()}>` tracks the array reactively, `<Show when={loaded()}>` toggles its children:

```jsx
const [products, setProducts] = createSignal([]);
const [query, setQuery] = createSignal('');

const filtered = createMemo(() =>
  products().filter(p => p.name.toLowerCase().includes(query().toLowerCase())),
);

function App() {
  return (
    <div>
      <input value={query()} onInput={e => setQuery(e.target.value)} />
      <Show when={filtered().length > 0} fallback={<p>No results</p>}>
        <For each={filtered()}>{p => <ProductRow product={p} />}</For>
      </Show>
    </div>
  );
}

export default function buildApp() {
  const container = document.createElement('div');
  render(() => <App />, container);
  return container;
}
```

`control-functions.js` calls module-level setters directly:

```js
export function loadProducts(data) { setProducts(data); setQuery(''); setCategory(''); }
```

---

### Svelte

Uses Svelte 5 with `@sveltejs/vite-plugin-svelte`. Standard Svelte dev setup — the plugin handles compilation, dep optimization, and runtime deduplication.

**`vite.config.js`:**

```js
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [svelte()] });
```

**State management — `.svelte.js` module files with `$state`:**

In Svelte 5, module-level reactive state replaces the `export let` + `$set` pattern. State lives in `.svelte.js` files (compiled by the plugin), accessed via getter/setter functions because `$state` variables that get reassigned cannot be directly exported (Svelte error `state_invalid_export`):

```js
// src/my-viewer/state.svelte.js
let _products = $state([]);
let _searchQuery = $state('');
let _categoryFilter = $state('');

export function setProducts(data) {
  _products = data;
  _searchQuery = '';   // reset filters atomically with data
  _categoryFilter = '';
}
export function getProducts() { return _products; }
export function getSearchQuery() { return _searchQuery; }
export function setSearchQuery(v) { _searchQuery = v; }
// etc.
```

**Component pattern — `mount()` from svelte, no `_app`, no `$set`:**

```js
// src/my-viewer/index.js
import { mount } from 'svelte';
import { onMount } from 'wv-kit';
import filemakerScripts from '../shared/filemaker-scripts.js';
import controlFunctions from './control-functions.js';
import App from './view.svelte';

Object.assign(window, controlFunctions);

const container = document.createElement('div');
onMount(() => { mount(App, { target: container }); });
export default container;
// index.js does NOT request data — production FileMaker pushes it (via OnLayoutEnter);
// in dev, src/<viewer>/dev/on-first-load.js plays that role.
```

`mount` is imported as a bare specifier — Vite resolves it to the same `svelte` instance that `@sveltejs/vite-plugin-svelte` uses to compile components, so reactive ownership is shared. `'svelte'` is in the wv-kit ESLint allowlist (`KNOWN_BARE` in `lib/eslint.js`) for this reason.

**control-functions calls state setters directly — no component instance needed:**

```js
// src/my-viewer/control-functions.js
import { setProducts } from './state.svelte.js';
export default {
  loadData(jsonStr) { setProducts(JSON.parse(jsonStr)); },
};
```

**Components use runes (`$props`, `$derived`, `$effect`):**

```svelte
<!-- src/my-viewer/view.svelte -->
<script>
  import { getProducts, getSearchQuery, setSearchQuery } from './state.svelte.js';
  import ProductRow from './ProductRow.svelte';

  const filtered = $derived(
    getProducts().filter(p => p.name.toLowerCase().includes(getSearchQuery().toLowerCase()))
  );
</script>

<input value={getSearchQuery()} oninput={e => setSearchQuery(e.target.value)} />
{#each filtered as p (p.id)}
  <ProductRow {p} />
{/each}
```

For detail views where local form state syncs from module state, use `$effect`:

```svelte
<script>
  import { getProduct } from './state.svelte.js';
  let name = $state(''), sku = $state('');
  $effect(() => {
    const p = getProduct();
    if (p) { name = p.name; sku = p.sku; }
  });
</script>
```

`$effect` requires component context — only use it inside `.svelte` files, never in `.svelte.js` modules (Svelte error `effect_orphan`).

---



For simple viewers with no reactivity, build the DOM directly:

```js
// src/my-viewer/view.js
export default function buildApp() {
  const container = document.createElement('div');
  container.className = 'p-3';
  container.innerHTML = `
    <h1 class="fs-4">My Viewer</h1>
    <ul id="items-list" class="list-group"></ul>
    <button id="add-btn" class="btn btn-primary mt-2" type="button">Add</button>
  `;

  container.querySelector('#add-btn').addEventListener('click', () => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = `Item ${Date.now()}`;
    container.querySelector('#items-list').appendChild(li);
  });

  return container;
}
```

For data-driven rendering, re-render the list on each `loadData` call:

```js
// src/my-viewer/control-functions.js
export default {
  loadData(jsonStr) {
    const items = JSON.parse(jsonStr);
    const list = document.getElementById('items-list');
    if (!list) return;
    list.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = item.name;
      list.appendChild(li);
    });
  },
};
```

For post-mount work, use `onMount` from `'wv-kit'` in `index.js`:
```js
// src/my-viewer/index.js
import { onMount } from 'wv-kit';
import controlFunctions from './control-functions.js';
import buildApp from './view.js';

Object.assign(window, controlFunctions);
onMount(() => {
  const height = document.getElementById('header').offsetHeight;
  document.documentElement.style.setProperty('--header-height', `${height}px`);
});
export default buildApp();
```

---

## Production constraints

**Never read `window.location` outside of `dev/`.** In production, each viewer is a self-contained HTML file pasted into FileMaker. There are no URL params — FileMaker owns navigation entirely and pushes data to the viewer via callbacks (`window.loadDetail(jsonStr)` etc.). Any code that reads `window.location.search` or `window.location.href` belongs exclusively in `dev/on-first-load.js`.

**Never use `<a href="...">` for navigation** — FileMaker web viewers do not handle anchor-based navigation. All navigation must go through `filemakerScripts` (which calls `window.FileMaker.PerformScript`). Use `<button type="button">` with a click listener instead.

The correct separation:

```
src/<viewer>/index.js      ← production: no URLs, no window.location, no FM script calls at startup
src/<viewer>/dev/on-first-load.js ← dev-only OnLayoutEnter stand-in: reads URL, fires filemakerScripts.<scriptName>
```

```js
// src/detail/index.js — production entry point
import controlFunctions from './control-functions.js';
import buildApp from './view.js';
Object.assign(window, controlFunctions);
export default buildApp();
// FileMaker will call window.loadDetail(jsonStr) after navigating here.

// src/detail/dev/on-first-load.js — dev-only stand-in for OnLayoutEnter
import filemakerScripts from '../../shared/filemaker-scripts.js';
const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
filemakerScripts.navigateToDetail(id);
// The mock for 'navigate to detail' does goToLayout(/detail?id=X) + push loadDetail.
// goToLayout to the current URL is a no-op, so on reload there's no infinite loop.
```

---



All script name strings live in `src/shared/script-names.js`. All outbound calls go through `src/shared/filemaker-scripts.js`. Never use bare strings or call `window.FileMaker` directly.

```js
// src/shared/script-names.js
// One script per FM action. Navigate scripts own BOTH "Go To Layout" and
// the data push that follows — mirroring how a real FileMaker script does
// both steps in sequence. No separate "request" scripts.
export const scriptNames = {
  navigateToList:   'navigate to list',
  navigateToDetail: 'navigate to detail',
  saveProduct:      'save product',
  deleteProduct:    'delete product',
};
```

`filemaker-scripts.js` is a thin facade over `performFileMakerScript` from `'wv-kit'`. The helper handles JSON-stringifying the payload, and the queue logic (defining a `window.FileMaker` setter, dispatching queued calls when FileMaker arrives) is built in — projects do not write it themselves.

```js
// src/shared/filemaker-scripts.js
import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';

export default {
  navigateToList()     { performFileMakerScript(scriptNames.navigateToList); },
  navigateToDetail(id) { performFileMakerScript(scriptNames.navigateToDetail, { id }); },
  saveProduct(product) { performFileMakerScript(scriptNames.saveProduct, product); },
  deleteProduct(id)    { performFileMakerScript(scriptNames.deleteProduct, { id }); },
};
```

Calls made before `window.FileMaker` is set are queued automatically and replayed when FM signals readiness.

---

## Inbound FM callbacks

FileMaker calls named globals on `window`. Register them via `Object.assign(window, controlFunctions)` in `index.js`.

```js
// src/my-viewer/control-functions.js
import { records } from './data.js';

export default {
  // Called by FM with a JSON string
  loadData(jsonStr) {
    records.set(JSON.parse(jsonStr));
  },

  // Called by FM after a save
  onSaveResult(jsonStr) {
    const { success, error } = JSON.parse(jsonStr);
    if (success) {
      showToast('Saved');
    } else {
      showError(error);
    }
  },

  // Called by FM when an async image request completes
  loadImages(jsonStr) {
    const { IMAGES, TYPE } = JSON.parse(jsonStr);
    // update image signals...
  },
};
```

---

## Dev mocks (`dev-server/mocks.js`)

Each key is a script name from `scriptNames`. The handler receives the raw JSON string and can call `performJavaScriptInWebViewer` (FM → browser callback) or `goToLayout` (FM "Go To Layout" equivalent).

### The two server → browser primitives

| Call | Browser effect |
|---|---|
| `performJavaScriptInWebViewer(fn, ...args)` | `window[fn](...args)` — no special names; `'alert'`, `'loadData'`, `'onSaveResult'`, etc. all dispatch to the same-named window global |
| `goToLayout(to)` | `window.location.href = to`, or `window.location.search = to` when `to` starts with `?`. No-op when `to` matches the current URL |

Navigation is a separate primitive because in FileMaker it's a script step ("Go To Layout"), not JavaScript pushed to the viewer.

### Single source of truth, fresh on every call

- `dev-server/mocks.js` watches `dev-server/` only (not `src/`) so saves to `src/<viewer>/dev/data.json` don't restart the server.
- Every handler reads from disk with `fs.readFileSync` on every call — there is **no module-level in-memory cache** of products/records. That mirrors FileMaker, where each script re-queries.
- Every write uses `fs.writeFileSync`. After the write returns, the next read sees it.

### Canonical CRUD pattern

This is the shape mocks.js should take for any list/detail viewer. One handler per FM script step; navigate-style handlers own BOTH `goToLayout` and the data push:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { goToLayout, performJavaScriptInWebViewer } from 'wv-kit';
import { scriptNames } from '../src/shared/script-names.js';

const DATA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/list/dev/data.json');
const readAll   = ()     => JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const writeAll  = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');

export default {
  [scriptNames.navigateToList]: () => {
    goToLayout('/list');
    performJavaScriptInWebViewer('loadData', JSON.stringify(readAll()));
  },

  [scriptNames.navigateToDetail]: param => {
    const { id } = JSON.parse(param);
    goToLayout(`/detail?id=${id}`);
    if (id === 'new') {
      const blank = { id: 'new', name: '', /* ... */ };
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(blank));
      return;
    }
    const record = readAll().find(r => r.id === id);
    if (record) performJavaScriptInWebViewer('loadDetail', JSON.stringify(record));
    else        performJavaScriptInWebViewer('alert', `Not found: ${id}`);
  },

  [scriptNames.saveProduct]: param => {
    const incoming = JSON.parse(param);
    const records  = readAll();
    const idx      = records.findIndex(r => r.id === incoming.id);
    let updated    = { ...incoming, updatedAt: new Date().toISOString().slice(0, 10) };
    if (idx >= 0)  records[idx] = updated;
    else           records.push((updated = { ...updated, id: `prod-${Date.now()}` }));
    writeAll(records);
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },

  [scriptNames.deleteProduct]: param => {
    const { id } = JSON.parse(param);
    const records = readAll();
    const idx = records.findIndex(r => r.id === id);
    if (idx >= 0) { records.splice(idx, 1); writeAll(records); }
    performJavaScriptInWebViewer('onDeleteResult', JSON.stringify({ success: true, id }));
    // Do NOT also goToLayout('/list') here. The browser-side onDeleteResult
    // handler calls filemakerScripts.navigateToList(), which triggers that
    // mock — keeping the post-delete navigation decision in browser code.
  },
};
```

### The "Go To Layout + Perform JavaScript" chain — why this works

The two calls in `navigateToDetail` happen on the server while the browser is mid-navigation: the old page's SSE is closing, the new page hasn't connected yet. wv-kit handles this by opening a brief post-`goToLayout` queue window (2 s). Any `performJavaScriptInWebViewer` frames fired in the same handler are queued; the next SSE client to connect drains them. So the freshly-loaded `/detail` page receives `loadDetail` reliably.

### Why dev/on-first-load.js calls the same script

Because each navigate-style mock is the single source of truth for "go to this layout AND load its data", `dev/on-first-load.js` can just re-fire it on page load:

```js
// src/detail/dev/on-first-load.js
import filemakerScripts from '../../shared/filemaker-scripts.js';
const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
filemakerScripts.navigateToDetail(id);
```

`goToLayout` to the current URL is a no-op (matches FileMaker), so reload doesn't loop. Click-through, reload, and direct visit all flow through the same handler. In production FileMaker plays this role via an OnLayoutEnter trigger that runs the same `navigate to detail` script.

### Mocking alerts and other window globals

There are no special-cased names. `'alert'`, `'confirm'`, anything on `window`:
```js
performJavaScriptInWebViewer('alert', 'Coming soon');
```
That just calls `window.alert('Coming soon')` in the browser. Same for any inbound callback the viewer registers — `loadData`, `onSaveResult`, custom names, etc.

### What about side effects in mock handlers?

Run them inline. Mocks are plain Node — `fs`, `setTimeout`, `await fetch(...)` all work. A handler can be `async`:

```js
[scriptNames.searchRemote]: async param => {
  const { q } = JSON.parse(param);
  const res = await fetch(`https://example.com/api?q=${encodeURIComponent(q)}`);
  performJavaScriptInWebViewer('onSearchResult', JSON.stringify(await res.json()));
},
```

---

## Browser dependencies

Install npm packages normally (`npm install <pkg>`) and import them with bare specifiers in `src/`:

```js
import { Chart } from 'chart.js';
import _ from 'lodash-es';
```

Vite's dep optimization pre-bundles each package on first request in dev and rolls it into the single-file output for production. No build-time intermediate step is needed.

The `wv-kit/no-bare-import` ESLint rule requires every bare specifier in `src/` to be declared in the project's `package.json` `dependencies` (or `devDependencies`). This catches typos and missing installs at lint time — it does not block bare imports themselves.

---

## Vite config

wv-kit provides a base config (`wv-kit/vite.config.js`) with `vite-plugin-singlefile`, `root: process.env.SRC`, and `outDir: '../../dist'`. Extend it with project-specific plugins:

```js
// vite.config.js
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';
import { visualizer } from 'rollup-plugin-visualizer';

export default mergeConfig(baseConfig, {
  build: { cssMinify: true, minify: false },
  plugins: [
    visualizer({ filename: `./dist/stats/${process.env.SRC}.html` }),
  ],
});
```

Do not set `root` or `outDir` — those belong to the base config.

---

## Styling

Bootstrap is loaded from CDN in `src/shared/style.css`. Use Bootstrap-first, then CSS variables, then custom rules as a last resort.

```css
/* Good: Bootstrap utility class */
<div class="d-flex align-items-center gap-2 p-3">

/* Good: CSS variable override via inline style */
<table style="--bs-table-bg: var(--bs-secondary-bg-subtle)">

/* Good: theme via :root */
:root { --bs-border-radius: 6px; }

/* Bad: override Bootstrap component internals */
.modal-header { background: #333; }   /* use shared/style.css pattern instead */
```

Colors:
- Destructive actions: `#FF3B30` (macOS system red) — not Bootstrap's `#dc3545`
- Hover on destructive: `#D70015`
- Modal header background: `#3a3a3a` with white text — defined once in `shared/style.css`

Tables with fixed layout — `<colgroup>` is the single source of truth:
```html
<table style="table-layout: fixed; width: 100%">
  <colgroup>
    <col style="width: 200px">   <!-- fixed -->
    <col>                         <!-- flexible — add min-width to prevent collapse -->
    <col style="width: 80px; min-width: 80px">
  </colgroup>
  ...
</table>
```

---

## TypeScript

`.ts` and `.tsx` files are transformed automatically by the dev server (same esbuild middleware as JSX). Vite handles them natively in production with no extra plugins.

**wv-kit ships `.d.ts` declarations alongside its `.js` files.** The package.json `exports` map includes a `types` condition, so TypeScript projects automatically get types for `onMount`, `flushMounts`, `performFileMakerScript`, and `performJavaScriptInWebViewer` when importing from `'wv-kit'` — no extra `@types/...` package needed.

**For TypeScript projects, install `typescript-eslint` and `typescript` as devDependencies.** wv-kit's `eslint.config.js` auto-detects `typescript-eslint` in the consumer project's `node_modules` and applies it as the parser for `.ts`/`.tsx` files. Without it, `wv-kit build` fails on lint with `Unexpected token` parsing errors on any TS-specific syntax. JS-only projects don't need this.

```json
// package.json
"devDependencies": {
  "typescript": "^6.0.3",
  "typescript-eslint": "^8.60.1"
}
```

**esbuild does type erasure only — it does not type-check.** Type errors will not fail the dev server or build. Add a `tsc --noEmit` script for checking:

```json
"scripts": {
  "typecheck": "tsc --noEmit"
}
```

A minimal `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Plain TypeScript — name files `.ts`, import types freely:
```ts
// src/my-viewer/types.ts
export interface Sku {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}
```

```ts
// src/my-viewer/control-functions.ts
import type { Sku } from './types.js';  // use .js extension even for .ts files
import { skus } from './data.js';

export default {
  loadData(jsonStr: string): void {
    skus.set(JSON.parse(jsonStr) as Sku[]);
  },
};
```

React with TSX — name files `.tsx`; the automatic JSX runtime means no `import React` is needed:
```tsx
import type { Sku } from './types.js';

interface Props {
  items: Sku[];
  onSelect: (id: string) => void;
}

export default function SkuList({ items, onSelect }: Props) {
  return (
    <ul className="list-group">
      {items.map(sku => (
        <li
          key={sku.id}
          className="list-group-item list-group-item-action"
          onClick={() => onSelect(sku.id)}
        >
          {sku.name}
        </li>
      ))}
    </ul>
  );
}
```

**Import extensions**: always use `.js` in import paths even when importing a `.ts` file — this matches how TypeScript resolves modules in ESM:
```ts
import { skus } from './data.js';      // imports data.ts
import type { Sku } from './types.js'; // imports types.ts
```

### Typing JS projects with JSDoc (no `.ts` files)

Plain-JS projects can still get hover types, autocomplete, and red squiggles on wrong calls — driven by JSDoc annotations + a TypeScript config. This matters most around the FM boundary, where the contract's `fmScripts.X` and `jsFunctions.X` calls have payload schemas that should flow as types.

**Setup (one-time):**

1. **Use `tsconfig.json`, not `jsconfig.json`.** JetBrains IDEs (WebStorm/RubyMine/IntelliJ) route JS files through the TypeScript Language Service only when a `tsconfig.json` is present. They have spotty support for `jsconfig.json` — usually just module resolution, not type inference. VS Code accepts either, so `tsconfig.json` is the portable choice. A minimal config for a JS-only project:

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
     "include": ["src/**/*", "dev-server/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

   `checkJs: false` keeps IDE features (hover, autocomplete) live without erroring on every pre-existing untyped DOM handler. Opt specific files into strict checking with `// @ts-check` at the top.

2. **Tell ESLint to skip `.d.ts`** if you write any. ESLint can't parse TypeScript syntax without `typescript-eslint`. For pure-JS projects, add an ignore in `eslint.config.js`:

   ```js
   export default [
     { ignores: ['**/*.d.ts'] },
     ...wvKitConfig,
     // ...
   ];
   ```

**Patterns that work well in JetBrains' JS engine:**

- **`@typedef`s living in the same file as the values they describe.** Inferring `v.InferOutput<typeof schema>` into a named type:

  ```js
  /** @typedef {v.InferOutput<typeof productSchema>} Product */
  ```

  This works cross-file: other files can `import('./schema.js').Product` inside an `@type`.

- **`@satisfies` for matching a literal against a type without widening.** Useful for "blank" records that should keep their literal types (e.g. `status: 'active'` stays narrowed to `'active'`, not widened to `string`):

  ```js
  /** @satisfies {Product} */
  export const blankProduct = { /* ... */ };
  ```

- **Inline `@type` with TypeScript-style object literals** for namespaced API surfaces (the contract's `fmScripts`, `jsFunctions`, `mount`). JetBrains parses these inline annotations reliably, where it can struggle with conditional/mapped types that flow through library generics:

  ```js
  /**
   * @type {{
   *   navigateToList(): void,
   *   navigateToDetail(payload: import('./schema.js').IdParam): void,
   *   saveProduct(payload: import('./schema.js').Product): void,
   * }}
   */
  export const fmScripts = contract.fmScripts;
  ```

  This is what `fm/contract.js` should look like for IDE-portable typing of the contract's broken-out namespaces — even when wv-kit's d.ts would *technically* infer the same types via generics, JetBrains' JS engine sometimes doesn't navigate those conditionals.

**Patterns that don't work reliably in JetBrains:**

- `@type` on a destructured `export const { x } = obj` — the annotation applies to the whole expression, not the binding. Use separate `export const x = obj.x;` lines instead.
- Sibling `.d.ts` shadowing a `.js` — JetBrains' resolution is inconsistent compared to VS Code/`tsc`. Stick with inline JSDoc in the `.js`.
- Cross-file `@typedef` chains where each link contributes a piece — JetBrains follows one hop reliably; deeper chains sometimes drop on the floor. Inline the type or duplicate the `@typedef` at the use site.

**If types stop showing after a change:**

- **JetBrains:** File → Invalidate Caches and Restart. The TS service caches type info aggressively and won't always re-evaluate when a `.d.ts`/`tsconfig.json`/`@type` block lands.
- **JetBrains:** Settings → Languages & Frameworks → TypeScript — confirm "TypeScript Language Service" is enabled and "Recompile on changes" is on.
- **VS Code:** Cmd+Shift+P → "TypeScript: Restart TS Server."

---

## Linting

`wv-kit` ships an ESLint plugin and a built-in config. **If ESLint is installed in the project, `wv-kit build` runs it automatically** using wv-kit's config — no `eslint.config.js` needed.

```bash
npm install eslint   # opt in — build will now lint on every wv-kit build
```

To customise rules, add an `eslint.config.js` at the project root — it takes precedence over wv-kit's default. To get IDE inline errors without customising anything, a one-line re-export is enough:

```js
// eslint.config.js — commit this to get IDE inline errors
export { default } from 'wv-kit/eslint.config.js';
```

```js
// eslint.config.js
import wvKit from 'wv-kit/lib/eslint.js';

export default [
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'src/**/*.tsx'],
    ...wvKit.configs.recommended,
    rules: { ...wvKit.configs.recommended.rules, 'wv-kit/no-anchor-href': 'warn' },
  },
];
```

The `no-dev-outside-import` rule accepts an `allow` array for imports that are legitimately needed in dev files:

```js
rules: {
  'wv-kit/no-dev-outside-import': ['error', { allow: ['../shared/filemaker-scripts.js'] }],
}
```

Add a `lint` script for editor/CI use: `"lint": "eslint src"`.

To suppress a rule on one line use a standard ESLint disable comment:
```js
import { x } from '../view.js'; // eslint-disable-line wv-kit/no-dev-outside-import
```

---

## Building for production

```bash
wv-kit build              # all viewers → dist/*.html
wv-kit build list         # one viewer (copies to clipboard on macOS)
wv-kit build list report  # multiple specific viewers
wv-kit check              # run ESLint only, exit 1 if issues found
```

`wv-kit build` runs ESLint before building and fails on any errors. ESLint must be installed as a peer dependency.

Each output is a self-contained HTML file. Paste it into FileMaker via **Admin → Settings → Web Viewer → HTML field**.

---

## Previewing the built HTML before paste

```bash
wv-kit preview          # default port 3001, or set $PORT
```

Serves the built `dist/<viewer>.html` files inside an iframe-based shell that simulates the FileMaker host. Useful as a final sanity check before pasting the HTML into FileMaker; also the cleanest URL to share with a stakeholder reviewing the viewer.

### How it differs from `wv-kit start`

| | `wv-kit start` | `wv-kit preview` |
|---|---|---|
| Runs | source files, transformed by Vite middleware | the built `dist/<viewer>.html`, byte-for-byte |
| Hosts viewer in | top-level page (same realm as dev runtime) | sandboxed iframe inside a parent shell |
| `window.FileMaker` | installed inline, same realm | injected by the parent into the iframe — same model as the real FileMaker host |
| `window.location` | top-level (parent URL bar changes on `goToLayout`) | iframe-scoped (matches FileMaker's layout-scoped nav) |
| Iteration | edit → reload | edit → `wv-kit build` → reload |

The fidelity wins are: production-bundle behavior (any divergence between Vite's dev transforms and the production bundler shows up here), and the cross-realm `window.FileMaker` install path (which matches FileMaker's host model and validates that wv-kit's queue-until-FileMaker logic works under separated realms).

### Wire model

- `GET /preview/:viewer` → parent shell HTML containing `<iframe src="/dist/:viewer.html?<query>">`. Parent owns the SSE listener, the FileMaker shim install, the dev-nav modal, and the URL bar.
- `GET /dist/:viewer.html` → the built file, verbatim. No injection.
- `GET /dev-overlay/:viewer.js` → on-the-fly esbuild bundle of `src/<viewer>/dev/nav-bar-content.js` as a script-mode IIFE. The parent runs it via `new Function('document', 'window', code)(iframe.contentDocument, iframe.contentWindow)`, so the existing nav-bar-content code (with `document.querySelector(...)` etc.) reaches into the iframe's DOM as it expects. The returned element is `adoptNode`'d into the parent's modal body.
- `GET /sse`, `POST /script-mock/:name` — identical to the dev server, same `mocks.js` runs.
- `goToLayout('/list')` → SSE frame → parent translates to `/dist/list.html` and sets `iframe.contentWindow.location.href`. Iframe navigation triggers parent's `load` handler, which re-fires the "navigate to <viewer>" OnLayoutEnter equivalent and `history.replaceState`s the parent URL bar to match.

### Limitations

- **No source maps yet.** The default `dist/` build doesn't ship maps (Vite's production default). Breakpoints in `src/` won't hit anywhere meaningful in preview; you debug against bundled lines. Fix on the table: a future `--debug` build (or auto-rebuild into `.preview-dist/` with inline maps) — flag this when you hit it.
- **No HMR / file watch.** Preview reflects whatever the last `wv-kit build` produced. Re-run build to see source changes.
- **Initial visit re-fires the OnLayoutEnter script.** Same model as `start` — the dev-only equivalent of FileMaker's layout-enter trigger. Mocks that side-effect on each invocation (e.g., increment a counter) will fire on every page reload and every in-iframe navigation.

---

## Things to avoid

**Never** read `window.location` or use `<a href="...">` for navigation outside of `dev/` — see **Production constraints** above.

**Import paths from viewer files use `../shared/`, not `../../shared/`.** The dev server serves viewer modules at `/src/{viewer}/file.js`, so one `../` step reaches `/src/shared/`. Two steps (`../../`) would resolve to `/shared/` which 404s.

**Bare npm specifiers must be declared in `package.json` dependencies.** Vite resolves them automatically, but the `wv-kit/no-bare-import` rule fails the build for any bare import that isn't listed. CDN URLs (`https://cdn.jsdelivr.net/...`) are allowed.

**Never** put Node.js code (`fs`, `path`, `child_process`) in `src/` — only in `dev-server/`.

**Never** hardcode FileMaker script names — use `scriptNames` from `script-names.js`.

**Keep viewers independent** — `src/list/` must not import from `src/detail-full/`. Shared logic goes in `src/shared/`.

**Query the DOM only after mount** — `document.getElementById(...)` inside `view.js` runs before the element is appended. Use `onMount` in `index.js` (plain JS), `addConnectedCallback` (Kensington), or `useEffect` (React) for post-mount work.

**`index.js` default export is the app element** — wv-kit appends it to `#app` and then calls any `onMount` callbacks. Do not call `document.getElementById('app').append(...)` yourself.

---

## Examples

The `examples/` directory contains three fully working viewers that demonstrate wv-kit conventions:

- **`examples/plain-js/`** — vanilla JS with direct DOM manipulation
- **`examples/kensington/`** — reactive UI using the Kensington library; includes ESLint config with `kensington-eslint-plugin`
- **`examples/react-tsx/`** — React with TypeScript and TSX

Each example has its own `dev-server/mocks.js`, `src/shared/`, and viewer source that follows the patterns described in this file.
