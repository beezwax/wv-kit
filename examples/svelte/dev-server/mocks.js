import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { performJavaScriptInWebViewer } from 'wv-kit';

import { scriptNames } from '../src/shared/script-names.js';

const DATA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/list/dev/data.json');

// Single source of truth: src/list/dev/data.json. Read fresh on every handler
// call so dev mirrors the FileMaker contract — scripts always re-query, never
// hold a stale in-memory copy. `npm start` watches dev-server/ only (not src/)
// so writes here don't restart the server mid-save.
const readAll  = ()      => JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const writeAll = (data)  => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');

export default {
  [scriptNames.requestProducts]: () => {
    performJavaScriptInWebViewer('loadData', JSON.stringify(readAll()));
  },

  [scriptNames.requestProduct]: param => {
    const { id } = JSON.parse(param);
    if (id === 'new') {
      const blank = { id: 'new', name: '', sku: '', category: '', price: 0, stock: 0, status: 'active', description: '', updatedAt: '' };
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(blank));
      return;
    }
    const product = readAll().find(p => p.id === id);
    if (product) {
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(product));
    } else {
      performJavaScriptInWebViewer('alert', `Product not found: ${id}`);
    }
  },

  [scriptNames.saveProduct]: param => {
    const incoming = JSON.parse(param);
    const products = readAll();
    const idx = products.findIndex(p => p.id === incoming.id);
    let updated = { ...incoming, updatedAt: new Date().toISOString().slice(0, 10) };
    if (idx >= 0) {
      products[idx] = updated;
    } else {
      const newId = `prod-${Date.now()}`;
      updated = { ...updated, id: newId };
      products.push(updated);
    }
    writeAll(products);
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },

  [scriptNames.deleteProduct]: param => {
    const { id } = JSON.parse(param);
    const products = readAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
      products.splice(idx, 1);
      writeAll(products);
    }
    performJavaScriptInWebViewer('onDeleteResult', JSON.stringify({ success: true, id }));
    performJavaScriptInWebViewer('navigate', '/list');
  },

  [scriptNames.navigateToDetail]: param => {
    const { id } = JSON.parse(param);
    performJavaScriptInWebViewer('navigate', `/detail?id=${id}`);
  },

  [scriptNames.navigateToList]: () => {
    performJavaScriptInWebViewer('navigate', '/list');
  },
};
