import fs from 'node:fs';
import path from 'node:path';

const KNOWN_BARE = new Set(['wv-kit', 'kensington']);
const INDEX_NAMES = new Set(['index.js', 'index.ts', 'index.tsx', 'index.jsx']);

function isViewerIndex(filename) {
  const parts = filename.split(path.sep);
  const srcIdx = parts.lastIndexOf('src');
  if (srcIdx === -1) return false;
  const rel = parts.slice(srcIdx + 1);
  return rel.length === 2 && rel[0] !== 'shared' && INDEX_NAMES.has(rel[1]);
}

const noWindowLocation = {
  meta: { type: 'problem', messages: { noWindowLocation: 'window.location has no meaning in a FileMaker web viewer. Use filemakerScripts for navigation; use window.__wvQuery__ in dev/client.js to read query params injected by the dev server.' } },
  create(ctx) {
    return {
      MemberExpression(node) {
        if (node.object?.name === 'window' && node.property?.name === 'location') {
          ctx.report({ node, messageId: 'noWindowLocation' });
        }
      },
    };
  },
};

const noAnchorHref = {
  meta: { type: 'problem', messages: { noAnchorHref: '<a href="…"> for navigation — FileMaker web viewers do not handle anchor navigation. Use a <button> and filemakerScripts instead.' } },
  create(ctx) {
    return {
      JSXOpeningElement(node) {
        if (node.name?.name !== 'a') return;
        const href = node.attributes.find(a => a.type === 'JSXAttribute' && a.name?.name === 'href');
        if (!href) return;
        const val = href.value;
        // Allow empty, #, or expression slots (dynamic values handled at runtime)
        if (!val) return;
        if (val.type === 'Literal' && (!val.value || val.value === '#')) return;
        ctx.report({ node, messageId: 'noAnchorHref' });
      },
    };
  },
};

const noBareImport = {
  meta: { type: 'problem', messages: { noBareImport: 'Bare npm specifier — the browser cannot resolve it. Bundle via front-end-dependencies/ and import from src/shared/installed/.' } },
  create(ctx) {
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (src.startsWith('.') || src.startsWith('/') || src.startsWith('node:')) return;
        if (src.startsWith('https://') || src.startsWith('http://')) return;
        const pkg = src.startsWith('@') ? src.split('/').slice(0, 2).join('/') : src.split('/')[0];
        if (KNOWN_BARE.has(pkg)) return;
        ctx.report({ node, messageId: 'noBareImport' });
      },
    };
  },
};

const noDevOutsideImport = {
  meta: { type: 'problem', messages: { noDevOutsideImport: 'Import from outside dev/ in a dev/ file — dev files should only call window control functions directly and use shared/installed/ libraries. Add eslint-disable-line if intentional.' } },
  create(ctx) {
    const filename = ctx.filename ?? ctx.getFilename?.();
    const sep = path.sep;
    if (!filename.includes(`${sep}dev${sep}`)) return {};
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (!src.startsWith('../')) return;
        if (src.includes('/dev/') || src.includes('shared/installed/')) return;
        ctx.report({ node, messageId: 'noDevOutsideImport' });
      },
    };
  },
};

const viewerIndexDepth = {
  meta: {
    type: 'problem',
    messages: { wrongDepth: "This index.js won't be discovered as a viewer — wv-kit only scans src/<viewer>/index.js (one level deep). Move it up or rename the entry point." },
  },
  create(ctx) {
    const filename = ctx.filename ?? ctx.getFilename?.();
    const parts = filename.split(path.sep);
    const srcIdx = parts.lastIndexOf('src');
    // Not under src/ — ignore entirely
    if (srcIdx === -1) return {};
    const rel = parts.slice(srcIdx + 1);
    if (!INDEX_NAMES.has(rel.at(-1))) return {};
    // Exactly one level deep (src/<viewer>/index.*) is correct
    if (rel.length <= 2) return {};
    return {
      Program(node) { ctx.report({ node, messageId: 'wrongDepth' }); },
    };
  },
};

const indexDefaultExport = {
  meta: {
    type: 'problem',
    messages: { noDefault: "Viewer index.js must have a default export — wv-kit mounts it into #app with document.getElementById('app').append(defaultExport)." },
  },
  create(ctx) {
    const filename = ctx.filename ?? ctx.getFilename?.();
    if (!isViewerIndex(filename)) return {};
    let hasDefault = false;
    return {
      ExportDefaultDeclaration() { hasDefault = true; },
      'Program:exit'(node) {
        if (!hasDefault) ctx.report({ node, messageId: 'noDefault' });
      },
    };
  },
};

const plugin = {
  meta: { name: 'wv-kit', version: '0.1.0' },
  rules: {
    'no-window-location':    noWindowLocation,
    'no-anchor-href':        noAnchorHref,
    'no-bare-import':        noBareImport,
    'no-dev-outside-import': noDevOutsideImport,
    'viewer-index-depth':    viewerIndexDepth,
    'index-default-export':  indexDefaultExport,
  },
};

plugin.configs = {
  recommended: {
    plugins: { 'wv-kit': plugin },
    rules: {
      'wv-kit/no-window-location':    'error',
      'wv-kit/no-anchor-href':        'error',
      'wv-kit/no-bare-import':        'error',
      'wv-kit/no-dev-outside-import': 'error',
      'wv-kit/viewer-index-depth':    'error',
      'wv-kit/index-default-export':  'error',
    },
  },
};

export default plugin;
