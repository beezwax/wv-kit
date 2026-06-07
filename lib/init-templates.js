// File generators for `wv-kit init`. Each generator returns
// a flat `{ relativePath: fileContents }` map for the chosen options.

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

  if (typescript || (library === 'solid' && jsx)) {
    out['tsconfig.json'] = tsconfigFor(library);
  }

  out['README.md'] = readmeFor({ projectName, library, viewers });

  out['CLAUDE.md'] = claudeMdFor({ projectName, library, viewers, typescript, jsx });

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
    vite: '8.0.16',
    'wv-kit': '*',
  };
  const devDeps = {
    eslint: '^9.0.0',
  };
  const scripts = {
    start: 'node --watch-path=dev-server node_modules/wv-kit/lib/server.js',
    build: 'wv-kit build',
    check: 'wv-kit check',
  };

  const enableTs = () => {
    devDeps.typescript = '^5.5.0';
    devDeps['typescript-eslint'] = '^8.0.0';
    scripts.typecheck = 'tsc --noEmit';
  };

  if (library === 'react') {
    deps.react = '^18.3.1';
    deps['react-dom'] = '^18.3.1';
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
  } else if (library === 'svelte') {
    deps.svelte = '^5.0.0';
    deps['@sveltejs/vite-plugin-svelte'] = '^7.0.0';
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
    return `import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mergeConfig } from 'vite';
import baseConfig from 'wv-kit/vite.config.js';

export default mergeConfig(baseConfig, { plugins: [svelte()] });
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
  "include": ["src"]
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

function claudeMdFor({ projectName, library, viewers, typescript, jsx }) {
  const viewerList = viewers.map(v => `\`${v}\``).join(', ');
  const ext =
    (library === 'react' || library === 'solid')
      ? (jsx ? (typescript ? '.tsx' : '.jsx') : (typescript ? '.ts' : '.js'))
      : (typescript ? '.ts' : '.js');
  const tsLine = `\n- Language: ${typescript ? 'TypeScript' : 'JavaScript'} (${ext})`;
  return `# ${projectName}

A FileMaker web viewer project built with [wv-kit](https://www.npmjs.com/package/wv-kit).

For full conventions, patterns, and framework-specific guidance, read
\`node_modules/wv-kit/AGENTS.md\` — it is the authoritative guide for AI agents
working on a wv-kit project.

## This project

- Rendering library: **${library}**${tsLine}
- Viewers: ${viewerList}

## Commands

- \`npm start\` — dev server on http://localhost:3000 (auto-redirects to the first viewer)
- \`npm run build\` — bundle each viewer to a single self-contained \`dist/<viewer>.html\` ready to paste into FileMaker
- \`npm run check\` — run ESLint with the wv-kit rules

## Viewer contract (must follow)

Every \`src/<viewer>/index.{js,ts,tsx}\` must default-export a DOM element.
wv-kit appends it into \`<main id="app">\` then fires any \`onMount\` callbacks.

\`\`\`js
import { onMount } from 'wv-kit';
onMount(() => { /* element is now in the DOM */ });
export default myElement;
\`\`\`

## Production constraints (FileMaker web viewer)

Output is a single inlined HTML file with no URL routing. The ESLint config
forbids these in non-\`dev/\` code:

- \`window.location\` reads or writes — use FileMaker scripts for navigation
- \`<a href="…">\` for navigation — use \`<button>\` + click handler
- Bare imports not declared in \`package.json\`
- \`src/*/index.*\` missing a default export

## FileMaker communication

- **Browser → FileMaker:** \`performFileMakerScript(name, payload)\` from \`'wv-kit'\`. Calls before \`window.FileMaker\` exists are queued automatically.
- **FileMaker → Browser:** FileMaker calls a window global, e.g. \`window.loadData(jsonStr)\`. Register these on \`window\` from your viewer's entry.
- Centralize outbound calls in \`src/shared/filemaker-scripts.${typescript ? 'ts' : 'js'}\` and script-name strings in \`src/shared/script-names.${typescript ? 'ts' : 'js'}\`.

## Dev-only files (\`src/<viewer>/dev/\`)

- \`dev/client.js\` — runs at page load, seeds initial data by calling the same
  window globals FileMaker would call
- \`dev/data.json\` — mock data store, also writable by \`dev-server/mocks.js\`
- \`dev/nav-bar-content.js\` — DOM element shown in the dev nav modal

These files are excluded from the production build.

## Mocking FileMaker scripts

In \`dev-server/mocks.js\` export an object mapping script-name → handler.
Use \`performJavaScriptInWebViewer('windowFn', ...args)\` to push callbacks
back to the browser. Special targets: \`'navigate'\`, \`'navigateSearch'\`, \`'alert'\`.
`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Each viewer can optionally contribute a sample FileMaker script call demo
// (`sample: true`). The shared/filemaker-scripts module is generated once.

function sharedScripts(typescript) {
  const ext = typescript ? 'ts' : 'js';
  return {
    [`src/shared/script-names.${ext}`]: `export const scriptNames = {
  ping: 'ping',
};
`,
    [`src/shared/filemaker-scripts.${ext}`]: `import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.${typescript ? 'js' : 'js'}';

export default {
  ping(message${typescript ? ': string' : ''}) {
    performFileMakerScript(scriptNames.ping, { message });
  },
};
`,
    'dev-server/mocks.js': `import { performJavaScriptInWebViewer } from 'wv-kit';

export default {
  'ping': param => {
    const { message } = JSON.parse(param);
    // Echo a reply back to the browser via window.onPong
    performJavaScriptInWebViewer('onPong', JSON.stringify({ reply: \`pong: \${message}\` }));
  },
};
`,
  };
}

// ---------- plain-js ----------

function plainJsFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};

  if (sample) Object.assign(out, sharedScripts(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = plainJsViewerIndex(v, sample, ext);
    if (sample) {
      out[`src/${v}/dev/client.${ext}`] = `// Dev-only: seed initial data before the viewer mounts.
// In production, FileMaker calls these window globals.
window.onPong(JSON.stringify({ reply: 'pong: hello from dev/client' }));
`;
    }
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
import filemakerScripts from '../shared/filemaker-scripts.js';

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

button.addEventListener('click', () => filemakerScripts.ping('hello from ${name}'));

window.onPong = (json) => {
  const { reply: text } = JSON.parse(json);
  reply.textContent = text;
};

onMount(() => {});

export default el;
`;
}

// ---------- react ----------

function reactFiles({ viewers, sample, typescript, jsx }) {
  const ext = jsx ? (typescript ? 'tsx' : 'jsx') : (typescript ? 'ts' : 'js');
  const out = {};
  if (sample) Object.assign(out, sharedScripts(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = reactViewerIndex(v, sample, typescript, jsx);
  }
  return out;
}

function reactViewerIndex(name, sample, typescript, jsx) {
  const ext = jsx ? (typescript ? 'tsx' : 'jsx') : (typescript ? 'ts' : 'js');
  const title = capitalize(name);
  const onPong = typescript
    ? `(window as any).onPong = (json: string) => setReply(JSON.parse(json).reply);`
    : `window.onPong = (json) => setReply(JSON.parse(json).reply);`;

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
    return `import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import filemakerScripts from '../shared/filemaker-scripts.js';

function App() {
  const [reply, setReply] = useState('');
  useEffect(() => { ${onPong} }, []);
  return (
    <section className="viewer">
      <h1>${title}</h1>
      <p>Click the button to call a FileMaker script.</p>
      <button type="button" onClick={() => filemakerScripts.ping('hello from ${name}')}>
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
  return `import { createElement as h, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import filemakerScripts from '../shared/filemaker-scripts.js';

function App() {
  const [reply, setReply] = useState('');
  useEffect(() => { ${onPong} }, []);
  return h('section', { className: 'viewer' },
    h('h1', null, '${title}'),
    h('p', null, 'Click the button to call a FileMaker script.'),
    h('button', {
      type: 'button',
      onClick: () => filemakerScripts.ping('hello from ${name}'),
    }, 'Ping FileMaker'),
    h('p', null, reply),
  );
}

const container = document.createElement('div');
queueMicrotask(() => createRoot(container).render(h(App)));
export default container;
`;
}

// ---------- lit ----------

function litFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};
  if (sample) Object.assign(out, sharedScripts(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = litViewerIndex(v, sample, ext);
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
import filemakerScripts from '../shared/filemaker-scripts.js';

class ${className(name)} extends LitElement {
  static properties = { reply: { state: true } };
  reply = '';
  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    window.onPong = (json) => { this.reply = JSON.parse(json).reply; };
  }

  render() {
    return html\`
      <section class="viewer">
        <h1>${title}</h1>
        <p>Click the button to call a FileMaker script.</p>
        <button type="button" @click=\${() => filemakerScripts.ping('hello from ${name}')}>Ping FileMaker</button>
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

function solidFiles({ viewers, sample, jsx }) {
  const out = {};
  if (sample) Object.assign(out, sharedScripts(false));

  for (const v of viewers) {
    if (jsx) {
      out[`src/${v}/index.js`]  = `import buildApp from './view.jsx';\nexport default buildApp();\n`;
      out[`src/${v}/view.jsx`]  = solidJsxView(v, sample);
    } else {
      out[`src/${v}/index.js`]  = solidNoJsxView(v, sample);
    }
  }
  return out;
}

function solidJsxView(name, sample) {
  const title = capitalize(name);
  if (!sample) {
    return `import { render } from 'solid-js/web';

function App() {
  return (
    <section class="viewer">
      <h1>${title}</h1>
      <p>Edit src/${name}/view.jsx to get started.</p>
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
  return `import { createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import filemakerScripts from '../shared/filemaker-scripts.js';

function App() {
  const [reply, setReply] = createSignal('');
  onMount(() => {
    window.onPong = (json) => setReply(JSON.parse(json).reply);
  });
  return (
    <section class="viewer">
      <h1>${title}</h1>
      <p>Click the button to call a FileMaker script.</p>
      <button type="button" onClick={() => filemakerScripts.ping('hello from ${name}')}>Ping FileMaker</button>
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
function solidNoJsxView(name, sample) {
  const title = capitalize(name);
  if (!sample) {
    return `import h from 'solid-js/h';
import { render } from 'solid-js/web';

const App = () => h('section', { class: 'viewer' },
  h('h1', '${title}'),
  h('p', 'Edit src/${name}/index.js to get started.'),
);

const container = document.createElement('div');
queueMicrotask(() => render(App, container));
export default container;
`;
  }
  return `import h from 'solid-js/h';
import { createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import filemakerScripts from '../shared/filemaker-scripts.js';

const App = () => {
  const [reply, setReply] = createSignal('');
  onMount(() => {
    window.onPong = (json) => setReply(JSON.parse(json).reply);
  });
  return h('section', { class: 'viewer' },
    h('h1', '${title}'),
    h('p', 'Click the button to call a FileMaker script.'),
    h('button', { type: 'button', onClick: () => filemakerScripts.ping('hello from ${name}') }, 'Ping FileMaker'),
    h('p', reply),
  );
};

const container = document.createElement('div');
queueMicrotask(() => render(App, container));
export default container;
`;
}

// ---------- svelte ----------

function svelteFiles({ viewers, sample }) {
  const out = {};
  if (sample) Object.assign(out, sharedScripts(false));

  for (const v of viewers) {
    out[`src/${v}/index.js`]      = svelteViewerIndex(v);
    out[`src/${v}/View.svelte`]   = svelteViewerComponent(v, sample);
  }
  return out;
}

function svelteViewerIndex(name) {
  return `import { mount } from 'svelte';
import View from './View.svelte';

const container = document.createElement('div');
queueMicrotask(() => mount(View, { target: container }));
export default container;
`;
}

function svelteViewerComponent(name, sample) {
  const title = capitalize(name);
  if (!sample) {
    return `<section class="viewer">
  <h1>${title}</h1>
  <p>Edit src/${name}/View.svelte to get started.</p>
</section>
`;
  }
  return `<script>
  import filemakerScripts from '../shared/filemaker-scripts.js';
  let reply = $state('');
  $effect(() => {
    window.onPong = (json) => { reply = JSON.parse(json).reply; };
  });
</script>

<section class="viewer">
  <h1>${title}</h1>
  <p>Click the button to call a FileMaker script.</p>
  <button type="button" onclick={() => filemakerScripts.ping('hello from ${name}')}>Ping FileMaker</button>
  <p>{reply}</p>
</section>
`;
}

// ---------- kensington ----------

function kensingtonFiles({ viewers, sample, typescript }) {
  const ext = typescript ? 'ts' : 'js';
  const out = {};
  if (sample) Object.assign(out, sharedScripts(typescript));

  for (const v of viewers) {
    out[`src/${v}/index.${ext}`] = kensingtonViewerIndex(v, sample, ext);
  }
  return out;
}

function kensingtonViewerIndex(name, sample, ext) {
  const title = capitalize(name);
  if (!sample) {
    return `import { t } from 'kensington';

export default t.section({ class: 'viewer' },
  t.h1('${title}'),
  t.p('Edit src/${name}/index.${ext} to get started.'),
).toElement();
`;
  }
  return `import { t, signal } from 'kensington';
import filemakerScripts from '../shared/filemaker-scripts.js';

const reply = signal('');
window.onPong = (json) => { reply.value = JSON.parse(json).reply; };

export default t.section({ class: 'viewer' },
  t.h1('${title}'),
  t.p('Click the button to call a FileMaker script.'),
  t.button({
    type: 'button',
    onclick() { filemakerScripts.ping('hello from ${name}'); },
  }, 'Ping FileMaker'),
  t.p(() => reply.value),
).toElement();
`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
