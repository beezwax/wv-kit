import fs from 'node:fs';
import path from 'node:path';

import { JSDOM } from 'jsdom';

import devNav from './dev-nav.js';

const PROJECT_DIR = process.cwd();
const INDEX_NAMES = ['index.js', 'index.ts', 'index.tsx', 'index.jsx'];

function resolveIndexFile(projectDir, viewer) {
  return INDEX_NAMES.find(f => fs.existsSync(path.join(projectDir, `src/${viewer}/${f}`))) ?? 'index.js';
}

function addScriptTagIfExists(document, urlPath, projectDir) {
  if (fs.existsSync(path.join(projectDir, urlPath))) {
    const devScriptTag = document.createElement('script');
    devScriptTag.type = 'module';
    devScriptTag.src = urlPath;
    document.head.appendChild(devScriptTag);
  }
}

// dev/on-first-load.js stands in for FileMaker's OnLayoutEnter — it should
// only run on fresh page loads, not when the page is reached via an in-tab
// goToLayout. shared-dev-index.js sets sessionStorage 'wv-kit:fromNav' right
// before each window.location mutation; this wrapper consumes the flag and
// dynamic-imports the module only if absent (so the mock's drained loadData
// is the single source of truth post-navigation).
function addOnFirstLoadScriptIfExists(document, urlPath, projectDir) {
  if (!fs.existsSync(path.join(projectDir, urlPath))) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = [
    `const fromNav = sessionStorage.getItem('wv-kit:fromNav');`,
    `sessionStorage.removeItem('wv-kit:fromNav');`,
    `if (!fromNav) import('${urlPath}');`,
  ].join('\n');
  document.head.appendChild(script);
}

export default function injectedIndexPage(name, allViewers, projectDir = PROJECT_DIR) {
  const indexPageRaw = fs.readFileSync(path.join(projectDir, 'src/index.html'), 'utf-8');
  const dom = new JSDOM(indexPageRaw);
  const { document } = dom.window;

  const sharedDevScriptTag = document.createElement('script');
  sharedDevScriptTag.type = 'module';
  sharedDevScriptTag.src = `/dev/shared-dev-index.js`;
  document.head.appendChild(sharedDevScriptTag);

  // Use the actual on-disk extension so Vite's request matches the file
  // directly. Vite's built-in `.js`→`.ts` swap means .ts works either way,
  // but .jsx and .tsx need the explicit extension.
  const indexFile = resolveIndexFile(projectDir, name);
  const appScript = document.createElement('script');
  appScript.type = 'module';
  appScript.textContent = `import app from '/src/${name}/${indexFile}'; document.getElementById('app').append(app); window.__wvFlushMounts?.();`;
  document.head.appendChild(appScript);

  addOnFirstLoadScriptIfExists(document, `/src/${name}/dev/on-first-load.js`, projectDir);

  if (fs.existsSync(path.join(projectDir, `src/${name}/dev/nav-bar-content.js`))) {
    const navScript = document.createElement('script');
    navScript.type = 'module';
    navScript.textContent = [
      `import content from '/src/${name}/dev/nav-bar-content.js';`,
      `document.querySelector('#dev-nav-modal-body')?.append(content);`,
    ].join('\n');
    document.head.appendChild(navScript);
  }

  for (const cssPath of [`src/shared/style.css`, `src/${name}/style.css`]) {
    if (fs.existsSync(path.join(projectDir, cssPath))) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = `/${cssPath}`;
      document.head.appendChild(cssLink);
    }
  }

  const hasNavContent = fs.existsSync(path.join(projectDir, `src/${name}/dev/nav-bar-content.js`));
  if (allViewers.length > 1 || hasNavContent) {
    document.body.insertAdjacentHTML('afterbegin', devNav({ allViewers, name }));
  }

  return dom.serialize();
}
