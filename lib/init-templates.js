// File generators for `wv-kit init`. Each generator returns
// a flat `{ relativePath: fileContents }` map for the chosen options.
//
// Convention for the FM-boundary layout (fm/ directory + per-viewer
// js-functions.* files): when `typescript: true`, scaffold these files
// with .ts extensions (fm/{schema,fm-scripts,mocks}.ts and
// src/<viewer>/js-functions.ts). TypeScript projects use real `export type`
// declarations from valibot's InferOutput; JS projects use JSDoc @typedef.
// See examples/react-tsx (TS) vs examples/kensington (JS) for the two
// shapes side-by-side.

export function generateProject(opts) {
  const files = {};

  Object.assign(files, commonFiles(opts));
  Object.assign(files, libraryFiles(opts));

  return files;
}

function commonFiles({ projectName, library, viewers, typescript, jsx }) {
  const out = {};

  out['.gitignore'] = 'node_modules\ndist\n';

  out['src/index.html'] = htmlShell(projectName);

  out['package.json'] = JSON.stringify(packageJsonFor({ projectName, library, typescript, jsx }), null, 2) + '\n';

  out['vite.config.js'] = viteConfigFor(library, jsx);

  out['eslint.config.js'] = library === 'kensington'
    ? kensingtonEslintConfig()
    : `export { default } from 'wv-kit/eslint.config.js';\n`;

  if (typescript) {
    out['tsconfig.json'] = tsconfigFor(library);
  }

  out['README.md'] = readmeFor({ projectName, library, viewers });

  // AGENTS.md holds the project-specific guidance — it's the cross-tool
  // convention picked up by Claude Code, Cursor, Aider, Cody, and others.
  // CLAUDE.md is a one-liner pointer so Claude-specific tooling that looks
  // for it lands in the same place.
  out['AGENTS.md'] = agentsMdFor({ projectName, library, viewers, typescript, jsx });
  out['CLAUDE.md'] = `See [AGENTS.md](./AGENTS.md) for project guidance.\n`;

  out['src/shared/style.css'] = sharedStyles();

  return out;
}

function libraryFiles(opts) {
  switch (opts.library) {
    case 'plain-js':   return plainJsFiles(opts);
    case 'react':      return reactFiles(opts);
    case 'lit':        return litFiles(opts);
    case 'solid':      return solidFiles(opts);
    case 'svelte':     return svelteFiles(opts);
    case 'kensington': return kensingtonFiles(opts);
    default: throw new Error(`Unknown library: ${opts.library}`);
  }
}

// ---------- shared helpers ----------

function htmlShell(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="data:image/png;base64,iVBORw0KGgo=">
  </head>
  <body>
    <main id="app"></main>
  </body>
</html>
`;
}

function sharedStyles() {
  return `body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 2rem; }
button { padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
.viewer { max-width: 40rem; }
.viewer h1 { margin-top: 0; }
`;
}

function packageJsonFor({ projectName, library, typescript, jsx }) {
  const deps = {
    valibot: '^1.0.0',
    vite:    '8.0.16',
    'wv-kit': '*',
  };
  const devDeps = {
    eslint: '^9.0.0',
  };
  const scripts = {
    start:   'node --watch-path=fm node_modules/wv-kit/lib/server.js',
    build:   'wv-kit build',
    preview: 'wv-kit preview',
    check:   'wv-kit check',
  };

  const enableTs = () => {
    devDeps.typescript = '^5.5.0';
    devDeps['typescript-eslint'] = '^8.0.0';
    scripts.typecheck = 'tsc --noEmit';
  };

  if (library === 'react') {
    // React 19 — paired with @vitejs/plugin-react v5 (which uses
    // react-refresh@0.18 targeting React 19 internals; React 18 would crash
    // with "Invalid hook call" because the dispatcher patch doesn't match).
    deps.react = '^19.0.0';
    deps['react-dom'] = '^19.0.0';
    if (jsx) deps['@vitejs/plugin-react'] = '^5.0.0';
    // typescript-eslint's parser handles JSX too, so ESLint can parse
    // .jsx/.tsx without us pulling in a separate JSX parser.
    if (jsx || typescript) devDeps['typescript-eslint'] = '^8.0.0';
    if (typescript) enableTs();
  } else if (library === 'lit') {
    deps.lit = '^3.2.1';
    if (typescript) enableTs();
  } else if (library === 'solid') {
    deps['solid-js'] = '^1.9.5';
    if (jsx) deps['vite-plugin-solid'] = '^2.11.12';
    if (typescript) enableTs();
  } else if (library === 'svelte') {
    deps.svelte = '^5.0.0';
    deps['@sveltejs/vite-plugin-svelte'] = '^7.0.0';
    if (typescript) enableTs();
  } else if (library === 'kensington') {
    deps.kensington = '^2.0.0-signals.15';
    devDeps['kensington-eslint-plugin'] = '^0.3.2';
    if (typescript) enableTs();
  } else if (typescript) {
    enableTs();
  }

  return {
    name: projectName,
    version: '0.1.0',
    description: `${library} FileMaker web viewer project`,
    type: 'module',
    private: true,
    scripts,
    dependencies: deps,
    devDependencies: devDeps,
  };
}

function viteConfigFor(library, jsx) {
  if (library === 'react' && jsx) {
    return `import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [react()] });
`;
  }
  if (library === 'solid' && jsx) {
    return `import solid from 'vite-plugin-solid';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [solid()] });
`;
  }
  if (library === 'svelte') {
    return `import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, {
  plugins: [svelte({ preprocess: vitePreprocess() })],
});
`;
  }
  return `import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, {});
`;
}

function tsconfigFor(library) {
  const jsx =
    library === 'react' ? '"react-jsx"' :
    library === 'solid' ? '"preserve"' :
    '"react-jsx"';
  return `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "jsx": ${jsx},
    "allowImportingTsExtensions": true,
    "allowJs": true,
    "checkJs": false
  },
  "include": ["src", "fm"]
}
`;
}

function kensingtonEslintConfig() {
  return `import wvKit from 'wv-kit/lib/eslint.js';
import kensington from 'kensington-eslint-plugin';

export default [
  {
    files: ['src/**/*.js', 'src/**/*.ts'],
    plugins: { 'wv-kit': wvKit, kensington },
    rules: {
      ...wvKit.configs.recommended.rules,
      ...kensington.configs.recommended.rules,
    },
  },
  {
    files: ['src/**/dev/**'],
    rules: { 'wv-kit/no-window-location': 'off' },
  },
];
`;
}

function readmeFor({ projectName, library, viewers }) {
  const viewerList = viewers.map(v => `- \`/${v}\``).join('\n');
  return `# ${projectName}

A wv-kit FileMaker web viewer project (${library}).

## Develop

\`\`\`bash
npm install
npm start
\`\`\`

Open http://localhost:3000 — the dev server auto-redirects to the first viewer.

## Viewers

${viewerList}

## Build

\`\`\`bash
npm run build
\`\`\`

Each viewer is bundled to a single self-contained HTML file in \`dist/\`.
See AGENTS.md in the wv-kit repo for conventions and patterns.
`;
}

function agentsMdFor({ projectName, library, viewers, typescript, jsx }) {
  const viewerList = viewers.map(v => `\`${v}\``).join(', ');
  const ext =
    (library === 'react' || library === 'solid')
      ? (jsx ? (typescript ? '.tsx' : '.jsx') : (typescript ? '.ts' : '.js'))
      : (typescript ? '.ts' : '.js');
  const sharedExt = typescript ? 'ts' : 'js';
  const firstViewer = viewers[0];
  const navMethod = `navigateTo${firstViewer.charAt(0).toUpperCase()}${firstViewer.slice(1).replace(/[-_](.)/g, (_, c) => c.toUpperCase())}`;
  return `# ${projectName}

A FileMaker web viewer project built with [wv-kit](https://github.com/beezwax/wv-kit).

## Required reading before writing code

- \`node_modules/wv-kit/AGENTS.md\` — **the** authoritative guide for this stack: viewer contract, project structure, dev mocks (\`goToLayout\` + \`performJavaScriptInWebViewer\` chain pattern), production constraints, ESLint rules, framework-specific patterns. Start with the "Quick reference: how to implement common requests" table at the top.${library === 'kensington' ? `
- \`node_modules/kensington/AGENTS.md\` — authoritative guide to the Kensington rendering API (tags, signals, computed, effects, \`dataKey\`, cleanup).` : ''}

## This project

- **Rendering library:** ${library}
- **Language:** ${typescript ? 'TypeScript' : 'JavaScript'} (${ext})
- **Viewers:** ${viewerList}
- **Outbound FM scripts (browser → FM):** \`fm/fm-scripts.${sharedExt}\` — typed callers from \`defineContract({ fmScripts })\`
- **Inbound JS functions (FM → browser):** \`src/<viewer>/js-functions.${sharedExt}\` — one per viewer; \`defineJsFunctions(handlers, schemas?)\` registers \`window.<name>\` for each handler
- **Schemas:** \`fm/schema.${sharedExt}\` — Standard Schema (valibot) shapes + wire schemas (\`v.pipe(v.string(), v.transform(JSON.parse), shape)\`)
- **Mock handlers:** \`fm/mocks.${sharedExt}\` — one handler per FM script; reads/writes \`src/<viewer>/dev/data.json\` fresh on every call

## Commands

- \`npm start\` — dev server (port from \`$PORT\`, default 3000). Prints clickable per-viewer URLs. This is your day-to-day development loop.
- \`npm run build\` — bundles each viewer to a single self-contained \`dist/<viewer>.html\` ready to paste into FileMaker.
- \`npm run preview\` — serves the **built** \`dist/<viewer>.html\` files inside an iframe-based shell that simulates the FileMaker host (port from \`$PORT\`, default 3001). Used as a pre-paste sanity check or to share a stakeholder-ready URL — not as a dev loop (no HMR; requires \`npm run build\` between edits). The \`window.FileMaker\` shim is injected by the parent into the iframe (same model as the real FileMaker host), and \`window.location\` changes are scoped to the iframe (matching FileMaker's layout-scoped navigation).
- \`npm run check\` — runs ESLint with the wv-kit rules.

> **Directive for agents.** After every code change, run \`npm run check\` before reporting the task done. The wv-kit ESLint rules catch the things FileMaker actually breaks on (\`window.location\` reads, anchor-based nav, undeclared bare imports, missing default exports, dev-only imports leaking into production) — passing them is a hard prerequisite for "works in FileMaker." Fix any errors; do not silence the rule unless the developer confirms.

## The non-obvious bits (read these even if you skip everything else)

**1. \`index.${sharedExt}\` doesn't request initial data.** In production FileMaker pushes
data via OnLayoutEnter; in dev, \`src/<viewer>/dev/on-first-load.js\` plays that role
by re-firing the same FM script the production trigger would. It runs ONLY on
fresh page loads (typed URL, reload) — not after an in-tab \`goToLayout\`
navigation; wv-kit sets a \`sessionStorage\` flag for that.

\`\`\`js
// src/${firstViewer}/dev/on-first-load.js
import { fmScripts } from '../../../fm/fm-scripts.js';
fmScripts.${navMethod}(/* payload */);
\`\`\`

**2. Mocks deliberately don't import per-viewer \`js-functions.${sharedExt}\`.** Real FM
scripts can't see the browser's JS either. Mocks push via raw
\`performJavaScriptInWebViewer(name, JSON.stringify(value))\` — exactly what a
real FM script's "Perform JavaScript in Web Viewer" step does. The receiving
viewer's \`defineJsFunctions\` wrapper validates against its schema on the
browser side.

**3. One mock handler owns BOTH \`goToLayout\` AND the data push** for that
script. wv-kit queues the \`performJavaScriptInWebViewer\` frame across the
navigation so the freshly-loaded page reliably receives it. Example:

\`\`\`js
// fm/mocks.${sharedExt}
navigateToDetail({ id }) {
  goToLayout(\`/detail?id=\${id}\`);
  const product = readAll().find(r => r.id === id);
  performJavaScriptInWebViewer('loadDetail', JSON.stringify(product));
},
\`\`\`

**4. \`goToLayout\` to the current URL is a no-op.** That's why \`dev/on-first-load.js\`
can safely re-fire the navigate-to script on reload without an infinite loop —
click-through, reload, and direct visit all flow through the same handler.

**5. Mocks read/write \`src/<viewer>/dev/data.json\` directly.** \`fs.readFileSync\`
on every call (no in-memory cache). \`npm start\` watches \`fm/\` only,
so writes to \`src/.../data.json\` don't restart the server mid-save.

**6. FileMaker carries only text across the WebViewer boundary.** Outbound
(\`fmScripts.X(payload)\`) — wv-kit JSON.stringifies for you; declare schemas
as JS object shapes (\`v.object(...)\`). Inbound (window functions FM calls) —
each parameter arrives as a string; declare schemas as wire schemas
(\`v.pipe(v.string(), v.transform(JSON.parse), shape)\`). Handlers receive
the parsed value.

## Mocks are templates for the real FileMaker scripts

The intended workflow with wv-kit is:

1. Build and iterate inside the wv-kit dev environment, using \`fm/mocks.${sharedExt}\` as the FileMaker side.
2. Once the viewer behaves correctly, copy the bundled \`dist/<viewer>.html\` into FileMaker as the web viewer's HTML.
3. Recreate each mock handler in FileMaker as a real script, using the JS mock as the line-by-line spec.

Write mocks **as if you were already writing the FileMaker script.** Each mock handler should map 1:1 to a sequence of FileMaker script steps, in the order a FileMaker developer would write them:

| JS mock | FileMaker script step |
|---|---|
| \`JSON.parse(param)\` | \`Set Variable [ $params ; JSONGetElement ( Get(ScriptParameter) ; "id" ) ]\` |
| \`readAll().find(r => r.id === id)\` | \`Perform Find\` / \`Go to Related Record\` |
| Mutating an object + \`writeAll(...)\` | \`Set Field\` steps + \`Commit Records\` |
| \`goToLayout('/list')\` | \`Go to Layout [ "list" ]\` |
| \`performJavaScriptInWebViewer('loadDetail', json)\` | \`Perform JavaScript in Web Viewer [ Function: "loadDetail" ; Parameter: $json ]\` |
| Throwing / early-return on bad input | \`Exit Script [ Result: { error: "..." } ]\` |

Things to **avoid** in mocks because they have no FileMaker equivalent:

- Holding records in a Node module-level variable across calls. FileMaker scripts always re-query.
- Async/await chains that aren't reproducible with FM's synchronous-by-default execution. (One \`fetch\` to an external API maps to FM's \`Insert from URL\`, but parallel \`Promise.all\` doesn't.)
- Browser-only APIs (\`crypto.randomUUID()\`, \`window.*\`) — use \`Get(UUID)\` shape: \`'prod-' + Date.now()\` in the mock is fine; producing an opaque token a FileMaker formula can't generate is not.
- Implicit type coercion the mock relies on. If the FM script will pass numbers, parse them in the mock; if FM passes strings, treat them as strings.

In short: a developer reading your mock should be able to translate each line into one FileMaker script step or expression. If a line can't be translated, simplify the mock to match what FileMaker can do.

## Conventions adopted by this project

These are decisions \`wv-kit init\` (and this AGENTS.md) make for you. If a request implies a different choice, push back and confirm before deviating.

- **Inbound callback naming.** Each viewer's primary data push is \`load<Viewer>(json)\`${viewers.length ? ` — i.e. ${viewers.map(v => `\`window.load${capitalize(v)}\``).join(', ')}` : ''}. Action results use \`on<Action>Result(json)\` (e.g. \`onSaveResult\`, \`onDeleteResult\`). Generic \`loadData\` is reserved for the canonical list page when there's only one. Declared per viewer in \`src/<viewer>/js-functions.${sharedExt}\`.
- **FM script-name strings** are lowercase phrases with spaces: \`'navigate to detail'\`, \`'save product'\`, \`'delete product'\`. They live in \`fm/fm-scripts.${sharedExt}\` as \`{ fmName: 'navigate to detail' }\` entries inside the \`defineContract\` call.
- **Schemas are the single source of truth.** Value shapes are declared in \`fm/schema.${sharedExt}\` once and reused by both directions of the boundary. Outbound payloads use the inner shape (\`productShape\`); inbound wire schemas wrap it (\`productSchema = v.pipe(v.string(), v.transform(JSON.parse), productShape)\`).
- **Same FM jsFunction name across viewers can have different schemas.** Each viewer is a separate WebViewer with its own \`window\`. \`defineJsFunctions\` is per-viewer specifically so two viewers can declare \`loadData\` with different payload shapes.
- **Mock data location.** Each viewer has its own \`src/<viewer>/dev/data.json\`. If multiple viewers operate on the **same record type** (e.g. list + detail of products), pick ONE as canonical (typically the list's), and have the other viewers' mocks read from that same path. Leave the unused \`data.json\` files as \`{}\` or delete them.
- **Styling.** Plain CSS in \`src/shared/style.css\` — no Bootstrap, no Tailwind, no utility-class framework. If you want Bootstrap, add the CDN \`<link>\` to \`src/index.html\` and call it out here before writing classes that depend on it.
- **Page redirect.** The root \`/\` redirects to the first viewer auto-discovered from \`src/\`. To pin a specific landing page, change viewer directory naming.

${typescript ? '' : `## Typing the FM boundary (JS project)

Hover types, autocomplete, and red squiggles on wrong calls all flow through JSDoc + a \`tsconfig.json\`:

- **Use \`tsconfig.json\`, not \`jsconfig.json\`.** JetBrains IDEs route JS files through the TypeScript Language Service only when a \`tsconfig.json\` is present.
- **JSDoc \`@typedef\` in \`fm/schema.js\`** for each shape — e.g. \`/** @typedef {v.InferOutput<typeof productShape>} Product */\`. Other files use \`@param {import('../../fm/schema.js').Product} p\`.
- **Per-export inline \`@type {{ ... }}\`** for \`fmScripts\` and \`jsFunctions\` namespaces — JetBrains' JS engine sometimes doesn't navigate the conditional types in wv-kit's generics, so listing methods explicitly per-export is the most portable shape.
- **Avoid:** \`@type\` on \`export const { x } = obj\` (annotation applies to the wrong target — use separate \`export const x = obj.x;\` lines), and sibling \`.d.ts\` (JetBrains' resolution is inconsistent here).
- **If types disappear after a change** in JetBrains: File → Invalidate Caches and Restart. The TS service caches aggressively.

See \`node_modules/wv-kit/AGENTS.md\` → "Typing JS projects with JSDoc" for the full conventions and patterns.

`}${typescript ? `## TypeScript convention

- All boundary files (\`fm/{schema,fm-scripts,mocks}.${sharedExt}\` and \`src/<viewer>/js-functions.${sharedExt}\`) are TypeScript. \`schema.${sharedExt}\` exports real \`type\` aliases derived from valibot via \`v.InferOutput<typeof shape>\`.
- Use \`import type { Product } from '../../fm/schema.js'\` for type-only imports in viewer code. \`tsconfig.json\` resolves \`.js\` imports to \`.ts\` files (\`allowImportingTsExtensions: true\` isn't required for that — TS does it by default with \`bundler\` resolution).
- Run \`npm run typecheck\` (\`tsc --noEmit\`) for full type checking. The dev server only does type erasure (esbuild) — it won't catch type errors at runtime.

` : ''}## Project policy — fill these in before serious work

These are the things \`wv-kit init\` can't decide for you. Capture them here so the next request doesn't require re-asking.

> **Directive for agents.** If a request hinges on a policy below that's still a \`<e.g. ...>\` placeholder, **ask the developer to commit to a value** before writing code. Do not invent the answer and proceed silently. Adding a fact to this section is part of completing the request. (Decisions already filled in are binding — if a request implies a different choice, push back and confirm before deviating.)

\`\`\`
Domain types / schema:
  <e.g. Product { id: string, name: string, price: number, stock: number,
                  category: string, status: 'active'|'discontinued', description: string }>

Post-save UX:
  <e.g. detail page flips back to view mode and shows a "Saved" toast for 3s;
        list page is NOT auto-refreshed>

Post-delete UX:
  <e.g. detail page issues navigateToList() so onDeleteResult triggers a return
        to the list, which re-loads fresh data>

"New" + Cancel UX:
  <e.g. Cancel on a new (id='new') record navigates to list; Cancel on an
        existing record stays on detail>

List row interaction:
  <e.g. whole row is clickable with cursor:pointer; no per-row buttons>

Validation rules:
  <e.g. name required; price >= 0; stock >= 0; sku unique among existing records>

Empty / loading state:
  <e.g. show "No products match." when empty; no spinner during initial load
        (data arrives within one tick of mount)>

Extra UI dependencies (charting, date pickers, icons):
  <e.g. no extra UI deps — hand-roll with SVG/CSS where needed>
  <OR: chart.js for visualisations; lucide for icons; no other UI libs>

Zero / null / missing-value rendering:
  <e.g. always represent every record in aggregations, including ones with
        zero/null on the measured field (so categories with stock=0 still
        appear in the legend at 0%); show "—" for missing scalar fields>
\`\`\`

## Production constraints (enforced by the wv-kit ESLint config)

The build produces a single inlined HTML file with no URL routing or anchor
navigation. Forbidden in non-\`dev/\` code:

- \`window.location\` reads or writes
- \`<a href="…">\` for navigation (use \`<button>\` + a script call)
- Bare imports not declared in \`package.json\`
- \`src/*/index.*\` missing a default export

\`dev/\` files are exempt from \`window.location\` and can import from \`src/shared/\`.

## Server → browser primitives (only two)

| Call | Browser effect |
|---|---|
| \`performJavaScriptInWebViewer(fn, ...args)\` | \`window[fn](...args)\` — no special-cased names; \`'alert'\` is just \`window.alert\` |
| \`goToLayout(to)\` | \`window.location.href = to\`, or \`window.location.search = to\` when \`to\` starts with \`?\`. No-op when \`to\` matches the current URL |
`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Each viewer can optionally contribute a sample FileMaker script call demo
// (`sample: true`). The shared/filemaker-scripts module is generated once.

// fm/ directory — the FileMaker boundary. Shared by viewers AND mocks.
function sharedFmFiles(typescript) {
  const ext = typescript ? 'ts' : 'js';
  return {
    [`fm/schema.${ext}`]: schemaTemplate(typescript),
    [`fm/fm-scripts.${ext}`]: fmScriptsTemplate(typescript),
    [`fm/mocks.${ext}`]: mocksTemplate(typescript),
  };
}

function schemaTemplate(typescript) {
  if (typescript) {
    return `import * as v from 'valibot';

// Inner shapes — what your code consumes. Use these in fmScripts payloads
// (wv-kit JSON.stringifies for the wire) and anywhere you construct/inspect
// a typed value.
export const pingShape = v.object({ message: v.string() });
export const pongShape = v.object({ reply:   v.string() });

// Wire schemas — FileMaker carries only text, so inbound payloads are
// JSON-stringified. Each wire schema is a pipe: string → JSON.parse → shape.
const jsonOf = <S extends v.GenericSchema>(shape: S) =>
  v.pipe(v.string(), v.transform(JSON.parse), shape);

export const pongSchema = jsonOf(pongShape);

export type Ping = v.InferOutput<typeof pingShape>;
export type Pong = v.InferOutput<typeof pongShape>;
`;
  }
  return `import * as v from 'valibot';

// Inner shapes — what your code consumes. Use these in fmScripts payloads
// (wv-kit JSON.stringifies for the wire) and anywhere you construct/inspect
// a typed value.
export const pingShape = v.object({ message: v.string() });
export const pongShape = v.object({ reply:   v.string() });

// Wire schemas — FileMaker carries only text, so inbound payloads are
// JSON-stringified. Each wire schema is a pipe: string → JSON.parse → shape.
const jsonOf = (shape) => v.pipe(v.string(), v.transform(JSON.parse), shape);

export const pongSchema = jsonOf(pongShape);

/** @typedef {v.InferOutput<typeof pingShape>} Ping */
/** @typedef {v.InferOutput<typeof pongShape>} Pong */
`;
}

function fmScriptsTemplate(_typescript) {
  return `import { defineContract } from 'wv-kit';
import { pingShape } from './schema.js';

export const contract = defineContract({
  fmScripts: {
    ping: { fmName: 'ping', payload: pingShape },
  },
});

export const fmScripts = contract.fmScripts;
`;
}

function mocksTemplate(_typescript) {
  return `import { defineMock, performJavaScriptInWebViewer } from 'wv-kit';
import { contract } from './fm-scripts.js';

// Mocks replicate real FileMaker scripts: each handler maps 1:1 to a
// sequence of FileMaker script steps. Mocks deliberately don't import
// per-viewer js-functions — real FM scripts can't see the browser's JS
// either. Each push is just a name and stringified arg(s), exactly
// mirroring what FM emits. The receiving viewer's defineJsFunctions
// wrapper validates against its schema on the browser side.
export default defineMock(contract, {
  ping({ message }) {
    // Echo back via the onPong jsFunction — same shape a real FM script
    // would use:  Perform JavaScript in Web Viewer [ Function: "onPong" ;
    // Parameter: JSONSetElement ( "{}" ; "reply" ; "pong: " & $message ; JSONString ) ]
    performJavaScriptInWebViewer('onPong', JSON.stringify({ reply: \`pong: \${message}\` }));
  },
});
`;
}

// Per-viewer js-functions file — the inbound (FM → browser) side. Schemas
// declared here; handlers register on window.<name> at module import. The
// `onReply(fn)` registration lets each library wire its own state-update
// path (React useState, Svelte $state, Solid signal, Lit reactive property,
// plain DOM, …) without this file knowing the framework.
function viewerJsFunctions(viewerName, typescript) {
  const ext = typescript ? 'ts' : 'js';
  if (typescript) {
    return {
      [`src/${viewerName}/js-functions.${ext}`]: `import { defineJsFunctions } from 'wv-kit';
import { pongSchema } from '../../fm/schema.js';
import type { Pong } from '../../fm/schema.js';

let _onPong: (reply: string) => void = () => {};
export function onReply(fn: (reply: string) => void): void { _onPong = fn; }

const handlers = {
  onPong(pong: Pong) { _onPong(pong.reply); },
};

const schemas = { onPong: pongSchema };

export const jsFunctions: { onPong(json: string): void } =
  defineJsFunctions(handlers, schemas);
`,
    };
  }
  return {
    [`src/${viewerName}/js-functions.${ext}`]: `// @ts-check
import { defineJsFunctions } from 'wv-kit';
import { pongSchema } from '../../fm/schema.js';

/** @type {(reply: string) => void} */
let _onPong = () => {};

/** @param {(reply: string) => void} fn */
export function onReply(fn) { _onPong = fn; }

const handlers = {
  /** @param {import('../../fm/schema.js').Pong} pong */
  onPong(pong) { _onPong(pong.reply); },
};

const schemas = { onPong: pongSchema };

/** @type {{ onPong(json: string): void }} */
export const jsFunctions = defineJsFunctions(handlers, schemas);
`,
  };
}

// Per-viewer dev/ files. dev/on-first-load.js runs once on page load and
// plays the role FileMaker would in production (OnLayoutEnter): firing the
// outbound FM script that pushes initial state. It runs ONLY on fresh
// loads — not after an in-tab goToLayout navigation (wv-kit sets a
// sessionStorage flag for that).
function viewerDevFiles(viewerName) {
  return {
    [`src/${viewerName}/dev/data.json`]: JSON.stringify([], null, 2) + '\n',
    [`src/${viewerName}/dev/on-first-load.js`]: `// Dev-only: re-fire the FM script the production OnLayoutEnter trigger
// would run, so click-through, reload, and direct visit all flow through
// the same mock handler.
import { fmScripts } from '../../../fm/fm-scripts.js';

fmScripts.ping({ message: 'hello from ${viewerName}' });
`,
  };
}

// ---------- plain-js ----------

function plainJsFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};

  if (sample) Object.assign(out, sharedFmFiles(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = plainJsViewerIndex(v, sample, ext);
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function plainJsViewerIndex(name, sample, ext) {
  const title = capitalize(name);
  if (!sample) {
    return `import { onMount } from 'wv-kit';

const el = document.createElement('section');
el.className = 'viewer';
el.innerHTML = \`<h1>${title}</h1><p>Edit src/${name}/index.${ext} to get started.</p>\`;

onMount(() => {
  // element mounted into #app
});

export default el;
`;
  }
  return `import { onMount } from 'wv-kit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';   // side-effect: registers window.onPong

const el = document.createElement('section');
el.className = 'viewer';
el.innerHTML = \`
  <h1>${title}</h1>
  <p>Click the button to call a FileMaker script. Reply appears below.</p>
  <button type="button">Ping FileMaker</button>
  <p data-reply></p>
\`;

const button = el.querySelector('button');
const reply  = el.querySelector('[data-reply]');

button.addEventListener('click', () => fmScripts.ping({ message: 'hello from ${name}' }));

onReply(text => { reply.textContent = text; });

onMount(() => {});

export default el;
`;
}

// ---------- react ----------

function reactFiles({ viewers, sample, typescript, jsx }) {
  const ext = jsx ? (typescript ? 'tsx' : 'jsx') : (typescript ? 'ts' : 'js');
  const out = {};
  if (sample) Object.assign(out, sharedFmFiles(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = reactViewerIndex(v, sample, typescript, jsx);
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function reactViewerIndex(name, sample, typescript, jsx) {
  const ext = jsx ? (typescript ? 'tsx' : 'jsx') : (typescript ? 'ts' : 'js');
  const title = capitalize(name);

  if (jsx) {
    if (!sample) {
      return `import { createRoot } from 'react-dom/client';

function App() {
  return (
    <section className="viewer">
      <h1>${title}</h1>
      <p>Edit src/${name}/index.${ext} to get started.</p>
    </section>
  );
}

const container = document.createElement('div');
queueMicrotask(() => createRoot(container).render(<App />));
export default container;
`;
    }
    return `import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';   // side-effect: registers window.onPong

${reactStoreSnippet(typescript)}

function App() {
  const reply = useSyncExternalStore(store.subscribe, store.read);
  return (
    <section className="viewer">
      <h1>${title}</h1>
      <p>Click the button to call a FileMaker script.</p>
      <button type="button" onClick={() => fmScripts.ping({ message: 'hello from ${name}' })}>
        Ping FileMaker
      </button>
      <p>{reply}</p>
    </section>
  );
}

const container = document.createElement('div');
queueMicrotask(() => createRoot(container).render(<App />));
export default container;
`;
  }

  // No JSX — use React.createElement directly.
  if (!sample) {
    return `import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return h('section', { className: 'viewer' },
    h('h1', null, '${title}'),
    h('p', null, 'Edit src/${name}/index.${ext} to get started.'),
  );
}

const container = document.createElement('div');
queueMicrotask(() => createRoot(container).render(h(App)));
export default container;
`;
  }
  return `import { createElement as h, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';   // side-effect: registers window.onPong

${reactStoreSnippet(typescript)}

function App() {
  const reply = useSyncExternalStore(store.subscribe, store.read);
  return h('section', { className: 'viewer' },
    h('h1', null, '${title}'),
    h('p', null, 'Click the button to call a FileMaker script.'),
    h('button', {
      type: 'button',
      onClick: () => fmScripts.ping({ message: 'hello from ${name}' }),
    }, 'Ping FileMaker'),
    h('p', null, reply),
  );
}

const container = document.createElement('div');
queueMicrotask(() => createRoot(container).render(h(App)));
export default container;
`;
}

// Tiny external store so React's useSyncExternalStore can pick up
// onReply calls that arrive BEFORE the component mounts (e.g. from
// dev/on-first-load.js, which runs synchronously at page load — useEffect
// is too late). Module-level binding means the latest value is always
// readable.
function reactStoreSnippet(typescript) {
  return `let _reply = '';
const listeners = new Set${typescript ? '<() => void>' : ''}();
const store = {
  read:      () => _reply,
  subscribe: (l${typescript ? ': () => void' : ''}) => { listeners.add(l); return () => listeners.delete(l); },
};
onReply((reply${typescript ? ': string' : ''}) => {
  _reply = reply;
  for (const l of listeners) l();
});`;
}

// ---------- lit ----------

function litFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};
  if (sample) Object.assign(out, sharedFmFiles(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = litViewerIndex(v, sample, ext);
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function litViewerIndex(name, sample, ext) {
  const tag = `wv-${name}`;
  const title = capitalize(name);
  if (!sample) {
    return `import { LitElement, html } from 'lit';

class ${className(name)} extends LitElement {
  createRenderRoot() { return this; }
  render() {
    return html\`<section class="viewer"><h1>${title}</h1><p>Edit src/${name}/index.${ext} to get started.</p></section>\`;
  }
}
customElements.define('${tag}', ${className(name)});

export default document.createElement('${tag}');
`;
  }
  return `import { LitElement, html } from 'lit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';   // side-effect: registers window.onPong

class ${className(name)} extends LitElement {
  static properties = { reply: { state: true } };
  createRenderRoot() { return this; }

  constructor() {
    super();
    // Initialize reactive state in the constructor (not as a class field) —
    // class fields run after Lit installs the property accessor and would
    // overwrite it. See https://lit.dev/msg/class-field-shadowing.
    this.reply = '';
  }

  connectedCallback() {
    super.connectedCallback();
    onReply(text => { this.reply = text; });
  }

  render() {
    return html\`
      <section class="viewer">
        <h1>${title}</h1>
        <p>Click the button to call a FileMaker script.</p>
        <button type="button" @click=\${() => fmScripts.ping({ message: 'hello from ${name}' })}>Ping FileMaker</button>
        <p>\${this.reply}</p>
      </section>
    \`;
  }
}
customElements.define('${tag}', ${className(name)});

export default document.createElement('${tag}');
`;
}

function className(name) {
  return name.split(/[-_]/).map(capitalize).join('') + 'Viewer';
}

// ---------- solid ----------

function solidFiles({ viewers, sample, jsx, typescript }) {
  const out = {};
  if (sample) Object.assign(out, sharedFmFiles(typescript));

  const indexExt = typescript ? 'ts'  : 'js';
  const viewExt  = typescript ? 'tsx' : 'jsx';

  for (const v of viewers) {
    if (jsx) {
      const sideEffect = sample ? `import './js-functions.js';\n` : '';
      out[`src/${v}/index.${indexExt}`]  = `${sideEffect}import buildApp from './view.${viewExt}';\nexport default buildApp();\n`;
      out[`src/${v}/view.${viewExt}`]    = solidJsxView(v, sample, viewExt);
    } else {
      out[`src/${v}/index.${indexExt}`]  = solidNoJsxView(v, sample, indexExt);
    }
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function solidJsxView(name, sample, viewExt = 'jsx') {
  const title = capitalize(name);
  if (!sample) {
    return `import { render } from 'solid-js/web';

function App() {
  return (
    <section class="viewer">
      <h1>${title}</h1>
      <p>Edit src/${name}/view.${viewExt} to get started.</p>
    </section>
  );
}

export default function buildApp() {
  const container = document.createElement('div');
  queueMicrotask(() => render(() => <App />, container));
  return container;
}
`;
  }
  return `import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';

const [reply, setReply] = createSignal('');
onReply(text => setReply(text));

function App() {
  return (
    <section class="viewer">
      <h1>${title}</h1>
      <p>Click the button to call a FileMaker script.</p>
      <button type="button" onClick={() => fmScripts.ping({ message: 'hello from ${name}' })}>Ping FileMaker</button>
      <p>{reply()}</p>
    </section>
  );
}

export default function buildApp() {
  const container = document.createElement('div');
  queueMicrotask(() => render(() => <App />, container));
  return container;
}
`;
}

// No-JSX Solid uses `solid-js/h` which compiles to the same hyperscript form.
function solidNoJsxView(name, sample, indexExt = 'js') {
  const title = capitalize(name);
  if (!sample) {
    return `import h from 'solid-js/h';
import { render } from 'solid-js/web';

const App = () => h('section', { class: 'viewer' },
  h('h1', '${title}'),
  h('p', 'Edit src/${name}/index.${indexExt} to get started.'),
);

const container = document.createElement('div');
queueMicrotask(() => render(App, container));
export default container;
`;
  }
  return `import h from 'solid-js/h';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';

const [reply, setReply] = createSignal('');
onReply(text => setReply(text));

const App = () => h('section', { class: 'viewer' },
  h('h1', '${title}'),
  h('p', 'Click the button to call a FileMaker script.'),
  h('button', { type: 'button', onClick: () => fmScripts.ping({ message: 'hello from ${name}' }) }, 'Ping FileMaker'),
  h('p', reply),
);

const container = document.createElement('div');
queueMicrotask(() => render(App, container));
export default container;
`;
}

// ---------- svelte ----------

function svelteFiles({ viewers, sample, typescript }) {
  const out = {};
  if (sample) Object.assign(out, sharedFmFiles(typescript));

  const indexExt = typescript ? 'ts' : 'js';
  for (const v of viewers) {
    out[`src/${v}/index.${indexExt}`] = svelteViewerIndex(v, sample);
    out[`src/${v}/View.svelte`]       = svelteViewerComponent(v, sample, typescript);
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function svelteViewerIndex(name, sample) {
  const sideEffect = sample ? `import './js-functions.js';\n` : '';
  return `${sideEffect}import { mount } from 'svelte';
import View from './View.svelte';

const container = document.createElement('div');
queueMicrotask(() => mount(View, { target: container }));
export default container;
`;
}

function svelteViewerComponent(name, sample, typescript) {
  const title = capitalize(name);
  const scriptOpen = typescript ? `<script lang="ts">` : `<script>`;
  if (!sample) {
    return `<section class="viewer">
  <h1>${title}</h1>
  <p>Edit src/${name}/View.svelte to get started.</p>
</section>
`;
  }
  return `${scriptOpen}
  import { fmScripts } from '../../fm/fm-scripts.js';
  import { onReply } from './js-functions.js';

  let reply = $state('');
  onReply(text => { reply = text; });
</script>

<section class="viewer">
  <h1>${title}</h1>
  <p>Click the button to call a FileMaker script.</p>
  <button type="button" onclick={() => fmScripts.ping({ message: 'hello from ${name}' })}>Ping FileMaker</button>
  <p>{reply}</p>
</section>
`;
}

// ---------- kensington ----------

function kensingtonFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};
  if (sample) Object.assign(out, sharedFmFiles(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = kensingtonViewerIndex(v, sample, ext);
    if (sample) Object.assign(out, viewerDevFiles(v));
    if (sample) Object.assign(out, viewerJsFunctions(v, typescript));
  }
  return out;
}

function kensingtonViewerIndex(name, sample, ext) {
  const title = capitalize(name);
  if (!sample) {
    return `import { t } from 'kensington';

export default t.section({ class: 'viewer' }, [
  t.h1('${title}'),
  t.p('Edit src/${name}/index.${ext} to get started.'),
]).toElement();
`;
  }
  return `import { t, signal } from 'kensington';
import { fmScripts } from '../../fm/fm-scripts.js';
import { onReply } from './js-functions.js';

const reply = signal('');
onReply(text => reply.set(text));

export default t.section({ class: 'viewer' }, [
  t.h1('${title}'),
  t.p('Click the button to call a FileMaker script.'),
  t.button({
    type: 'button',
    onclick() { fmScripts.ping({ message: 'hello from ${name}' }); },
  }, 'Ping FileMaker'),
  t.p(reply),
]).toElement();
`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
