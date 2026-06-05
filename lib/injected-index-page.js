import fs from 'node:fs';
import path from 'node:path';

import { JSDOM } from 'jsdom';

import devNav from './dev-nav.js';

const PROJECT_DIR = process.cwd();

function addScriptTagIfExists(document, urlPath) {
  if (fs.existsSync(path.join(PROJECT_DIR, urlPath))) {
    const devScriptTag = document.createElement('script');
    devScriptTag.type = 'module';
    devScriptTag.src = urlPath;
    document.head.appendChild(devScriptTag);
  }
}

export default function injectedIndexPage(name, allViewers) {
  const indexPageRaw = fs.readFileSync(path.join(PROJECT_DIR, 'src/index.html'), 'utf-8');
  const dom = new JSDOM(indexPageRaw);
  const { document } = dom.window;

  const sharedDevScriptTag = document.createElement('script');
  sharedDevScriptTag.type = 'module';
  sharedDevScriptTag.src = `/dev/shared-dev-index.js`;
  document.head.appendChild(sharedDevScriptTag);

  addScriptTagIfExists(document, `/src/${name}/dev/client.js`);

  if (fs.existsSync(path.join(PROJECT_DIR, `src/${name}/dev/nav-bar-content.js`))) {
    const navScript = document.createElement('script');
    navScript.type = 'module';
    navScript.textContent = [
      `import content from '/src/${name}/dev/nav-bar-content.js';`,
      `document.querySelector('#dev-nav-modal-body')?.append(content);`,
    ].join('\n');
    document.head.appendChild(navScript);
  }

  if (fs.existsSync(path.join(PROJECT_DIR, `src/${name}/style.css`))) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = `/src/${name}/style.css`;
    document.head.appendChild(cssLink);
  }

  const appScript = document.createElement('script');
  appScript.type = 'module';
  appScript.textContent = `import app from '/src/${name}/index.js'; document.getElementById('app').append(app);`;
  document.head.appendChild(appScript);

  if (allViewers.length > 1) {
    document.body.insertAdjacentHTML('afterbegin', devNav({ allViewers, name }));
  }

  return dom.serialize();
}
