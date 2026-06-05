import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleTester } from 'eslint';

import plugin from '../lib/eslint.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const jsxTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

// ─── no-window-location ───────────────────────────────────────────────────

describe('no-window-location', () => {
  tester.run('no-window-location', plugin.rules['no-window-location'], {
    valid: [
      // unrelated window properties are fine
      { code: 'window.loadData("[]");' },
      { code: 'window.FileMaker.PerformScript("x", "{}");' },
    ],
    invalid: [
      {
        code: 'const s = window.location.search;',
        errors: [{ messageId: 'noWindowLocation' }],
      },
      {
        code: 'window.location.href = "/list";',
        errors: [{ messageId: 'noWindowLocation' }],
      },
      {
        code: 'window.location = "/list";',
        errors: [{ messageId: 'noWindowLocation' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── no-anchor-href ───────────────────────────────────────────────────────

describe('no-anchor-href', () => {
  jsxTester.run('no-anchor-href', plugin.rules['no-anchor-href'], {
    valid: [
      { code: 'const x = <a>Link</a>;' },
      { code: 'const x = <a href="#">Link</a>;' },
      { code: 'const x = <a href="">Link</a>;' },
      { code: 'const x = <button type="button">Go</button>;' },
    ],
    invalid: [
      {
        code: 'const x = <a href="/list">Back</a>;',
        errors: [{ messageId: 'noAnchorHref' }],
      },
      {
        code: 'const x = <a href="https://example.com">Link</a>;',
        errors: [{ messageId: 'noAnchorHref' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── no-bare-import ───────────────────────────────────────────────────────

describe('no-bare-import', () => {
  tester.run('no-bare-import', plugin.rules['no-bare-import'], {
    valid: [
      { code: "import x from './utils.js';" },
      { code: "import x from '../shared/installed/react.js';" },
      { code: "import x from 'node:fs';" },
      { code: "import x from 'wv-kit';" },
      { code: "import x from 'kensington';" },
      // CDN imports are valid in browsers
      { code: "import x from 'https://cdn.jsdelivr.net/npm/react@18/+esm';" },
      { code: "import x from 'http://localhost:3000/src/foo.js';" },
    ],
    invalid: [
      {
        code: "import React from 'react';",
        errors: [{ messageId: 'noBareImport' }],
      },
      {
        code: "import { createRoot } from 'react-dom/client';",
        errors: [{ messageId: 'noBareImport' }],
      },
      {
        code: "import { signal } from 'kensington-signals';",
        errors: [{ messageId: 'noBareImport' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── no-dev-outside-import ────────────────────────────────────────────────

describe('no-dev-outside-import', () => {
  tester.run('no-dev-outside-import', plugin.rules['no-dev-outside-import'], {
    valid: [
      // non-dev file — rule doesn't apply
      { code: "import x from '../shared/utils.js';", filename: 'src/list/view.js' },
      // same-dir import in dev
      { code: "import x from './data.json';",         filename: 'src/list/dev/client.js' },
      // allowed via rule option
      {
        code: "import filemakerScripts from '../../shared/filemaker-scripts.js';",
        filename: 'src/list/dev/client.js',
        options: [{ allow: ['shared/filemaker-scripts.js'] }],
      },
      {
        code: "import { x } from '../control-functions.js';",
        filename: 'src/detail/dev/nav-bar-content.js',
        options: [{ allow: ['../control-functions.js'] }],
      },
      // shared/installed is exempt
      { code: "import { t } from '../../shared/installed/kensington.js';", filename: 'src/list/dev/nav-bar-content.js' },
    ],
    invalid: [
      {
        code: "import { product } from '../view.js';",
        filename: 'src/detail/dev/nav-bar-content.js',
        errors: [{ messageId: 'noDevOutsideImport' }],
      },
      {
        code: "import filemakerScripts from '../../shared/filemaker-scripts.js';",
        filename: 'src/list/dev/client.js',
        errors: [{ messageId: 'noDevOutsideImport' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── viewer-index-depth ───────────────────────────────────────────────────

describe('viewer-index-depth', () => {
  tester.run('viewer-index-depth', plugin.rules['viewer-index-depth'], {
    valid: [
      // correct depth
      { code: 'export default 1;', filename: '/project/src/list/index.js' },
      { code: 'export default 1;', filename: '/project/src/detail/index.ts' },
      // shared exempt
      { code: 'export default 1;', filename: '/project/src/shared/index.js' },
      // non-index file deep in a viewer — not this rule's concern
      { code: 'export default 1;', filename: '/project/src/list/components/Button.js' },
      // index.js outside src/ entirely — not this rule's concern
      { code: 'export default 1;', filename: '/project/node_modules/foo/index.js' },
    ],
    invalid: [
      {
        code: 'export default 1;',
        filename: '/project/src/list/sub/index.js',
        errors: [{ messageId: 'wrongDepth' }],
      },
      {
        code: 'export default 1;',
        filename: '/project/src/detail/components/index.ts',
        errors: [{ messageId: 'wrongDepth' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── index-default-export ─────────────────────────────────────────────────

describe('index-default-export', () => {
  tester.run('index-default-export', plugin.rules['index-default-export'], {
    valid: [
      {
        code: 'Object.assign(window, {}); export default buildApp();',
        filename: '/project/src/list/index.js',
      },
      {
        code: 'export default function buildApp() {}',
        filename: '/project/src/detail/index.ts',
      },
      // non-viewer files — rule doesn't apply
      { code: 'const x = 1;', filename: '/project/src/list/utils.js' },
    ],
    invalid: [
      {
        code: 'Object.assign(window, controlFunctions);',
        filename: '/project/src/list/index.js',
        errors: [{ messageId: 'noDefault' }],
      },
      {
        code: 'export const x = 1;',
        filename: '/project/src/detail/index.ts',
        errors: [{ messageId: 'noDefault' }],
      },
    ],
  });

  it('passes RuleTester', () => {});
});

// ─── recommended config ───────────────────────────────────────────────────

describe('plugin.configs.recommended', () => {
  it('includes all rules set to error', () => {
    const rules = plugin.configs.recommended.rules;
    const expected = [
      'wv-kit/no-window-location',
      'wv-kit/no-anchor-href',
      'wv-kit/no-bare-import',
      'wv-kit/no-dev-outside-import',
      'wv-kit/viewer-index-depth',
      'wv-kit/index-default-export',
    ];
    for (const rule of expected) {
      assert.equal(rules[rule], 'error', `${rule} should be 'error' in recommended`);
    }
  });

  it('registers all rules on the plugin', () => {
    const ruleNames = Object.keys(plugin.rules);
    assert.ok(ruleNames.includes('no-window-location'));
    assert.ok(ruleNames.includes('no-anchor-href'));
    assert.ok(ruleNames.includes('no-bare-import'));
    assert.ok(ruleNames.includes('no-dev-outside-import'));
    assert.ok(ruleNames.includes('viewer-index-depth'));
    assert.ok(ruleNames.includes('index-default-export'));
  });
});
