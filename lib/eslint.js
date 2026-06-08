import fs from 'node:fs';
import path from 'node:path';

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
  meta: {
    type: 'problem',
    messages: { notDeclared: 'Bare import "{{spec}}" is not declared in package.json dependencies. Add it via npm install, or fix the typo.' },
  },
  create(ctx) {
    let deps = ctx.settings?.wvKitDeps;
    if (!deps) {
      const pkgPath = path.join(process.cwd(), 'package.json');
      deps = {};
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          deps = { ...pkg.dependencies, ...pkg.devDependencies };
        } catch { /* malformed — treat as empty */ }
      }
    }
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (src.startsWith('.') || src.startsWith('/') || src.startsWith('node:')) return;
        if (src.startsWith('https://') || src.startsWith('http://')) return;
        const pkg = src.startsWith('@') ? src.split('/').slice(0, 2).join('/') : src.split('/')[0];
        if (pkg === 'wv-kit') return; // peer dependency, always implicitly allowed
        if (!deps[pkg]) {
          ctx.report({ node, messageId: 'notDeclared', data: { spec: pkg } });
        }
      },
    };
  },
};

const noDevOutsideImport = {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' }, default: [] },
        },
        additionalProperties: false,
      },
    ],
    messages: { noDevOutsideImport: "Import from outside dev/ in a dev/ file — dev files should only call window control functions directly. Imports from src/shared/ and from sibling dev/ folders are allowed by default; for anything else, add the path to the rule's 'allow' option or use eslint-disable-line." },
  },
  create(ctx) {
    const filename = ctx.filename ?? ctx.getFilename?.();
    const sep = path.sep;
    if (!filename.includes(`${sep}dev${sep}`)) return {};
    const allow = ctx.options[0]?.allow ?? [];
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (!src.startsWith('../')) return;
        if (src.includes('/dev/')) return;
        // src/shared/ is the project's reusable surface — script-name maps,
        // FileMaker-script wrappers, types — all safe for dev/ files to
        // import. Allow by default; the `allow` option still adds extras.
        if (src.includes('/shared/')) return;
        if (allow.some(pattern => src.includes(pattern))) return;
        ctx.report({ node, messageId: 'noDevOutsideImport' });
      },
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
      'wv-kit/index-default-export':  'error',
    },
  },
};

export default plugin;
