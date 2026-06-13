# Contributing to wv-kit

Guide for working on wv-kit itself. For using wv-kit to build a viewer, see `README.md`.

## Local setup

```bash
git clone <repo>
cd wv-kit
npm install
```

The `examples/` directory contains six reference projects that double as the integration-test surface. Each declares `"wv-kit": "file:../.."`, so installing into an example links back to your working copy of the repo:

```bash
cd examples/plain-js
npm install
npm start          # dev server on :3000, edits in ../../lib/* reflect immediately
```

When you change anything in `lib/`, you can validate against all six examples by running the test suite (below) rather than starting each by hand.

## Architecture

| File | Role |
|---|---|
| `bin/wv-kit.js` | CLI entry — dispatches `start` / `build` / `check` / `init` |
| `lib/server.js` | Dev server: Express + Vite middleware, viewer auto-discovery, SSE relay, mock dispatch. Port via `PORT` env, default 3000. |
| `lib/build.js` | Per-viewer single-file build: lint → inject `index.html` → `vite build` → rename to `dist/<viewer>.html` |
| `lib/injected-index-page.js` | Builds the dev HTML shell — injects shared/viewer CSS, `dev/on-first-load.js`, `dev/nav-bar-content.js`, the dev nav |
| `lib/sse.js` | One-active-client SSE registry; `performJavaScriptInWebViewer` broadcasts here |
| `lib/shared-dev-index.js` | Browser-side dev runtime — receives SSE, dispatches to `window[fn]`, stubs `window.FileMaker` |
| `lib/browser/lifecycle.js` | Public browser API: `onMount`, `performFileMakerScript`, queue-until-ready |
| `lib/eslint.js` | ESLint plugin with the wv-kit rules |
| `lib/ts-node-hook.js` | Node `--experimental-loader` hook so the server can `import` `.ts`/`.tsx` mock files |
| `lib/init.js`, `lib/init-templates.js` | `wv-kit init` scaffolder |

## Tests

```bash
npm test
```

Runs three suites with the built-in Node test runner (`test/*.test.js`):

| Suite | File | What it covers |
|---|---|---|
| Unit | `core.test.js`, `eslint-rules.test.js`, `injected-index-page.test.js` | viewer discovery, SSE registry, ESLint rules, HTML injection logic |
| HTTP e2e | `examples.e2e.test.js` | Spawns `lib/server.js` against each example on port 3000 and checks the wire contract: viewer shell HTML, Vite transforms, SSE headers, `/script-mock` POSTs, dev nav presence |
| Playwright e2e | `examples.playwright.test.js` | Launches Chromium against each example on port 3010 and exercises real flows: list renders products from `dev/data.json`; clicking "+ New Product" round-trips through `performFileMakerScript` → `/script-mock` → SSE → `window.location` navigation |

### One-time setup

```bash
npx playwright install chromium
```

### Per-example prerequisite

Each example needs its own `npm install` before the e2e tests can use it:

```bash
for d in examples/*/; do (cd "$d" && npm install); done
```

Examples without `node_modules` are skipped with a hint at the test output rather than failing.

### Parallel-safe ports

`lib/server.js` reads `PORT` from the environment. The HTTP suite uses the default 3000; the Playwright suite sets `PORT=3010`. That lets `node --test` run both files in parallel without collision.

## The `init` scaffolder

`lib/init.js` runs the interactive prompts; `lib/init-templates.js` is a flat library of file generators per `{ library, typescript, jsx, sample }` combination. To add a new library option:

1. Add an entry to the `LIBRARIES` array in `lib/init.js`.
2. Update the TS/JSX prompt block in `runInit` if the library has natural defaults.
3. Add a `<library>Files(opts)` generator in `lib/init-templates.js` returning `{ relPath: contents }`.
4. Wire it into `libraryFiles`, and add any framework-specific entries to `packageJsonFor` / `viteConfigFor`.
5. Add a matching example under `examples/<library>/` so the e2e suite covers it.

## Commit notes

- Don't add files to `examples/<name>/node_modules` to the repo — they're regenerated locally with `npm install` per example.
- The `files` array in `package.json` controls what ships to npm — examples are intentionally excluded.
