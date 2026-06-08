import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { goToLayout, performJavaScriptInWebViewer } from 'wv-kit';

import { scriptNames } from '../src/shared/script-names.js';

const DATA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/list/dev/data.json');

const readAll  = ()      => JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const writeAll = (data)  => fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');

// Mocks mirror real FileMaker scripts: a "Go To Layout" script step followed
// by "Perform JavaScript in Web Viewer" reliably hands data to the new
// viewer. wv-kit queues the JS frame across the navigation so the freshly-
// loaded page receives it on connect. dev/client.js re-fires the same script
// on reload (goToLayout to the current URL is a no-op), so click-through and
// reload both go through this single handler.
export default {
  [scriptNames.navigateToList]: () => {
    goToLayout('/list');
    performJavaScriptInWebViewer('loadData', JSON.stringify(readAll()));
  },

  [scriptNames.navigateToDetail]: param => {
    const { id } = JSON.parse(param);
    goToLayout(`/detail?id=${id}`);

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
  },
};
