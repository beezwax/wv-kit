import fs from 'node:fs';

import { performJavaScriptInWebViewer } from 'wv-kit';

import { scriptNames } from '../src/shared/script-names.js';

const DATA = new URL('../src/list/dev/data.json', import.meta.url).pathname;

// Read once at server start; mutations stay in-memory so we don't trigger
// node --watch by writing back to a file under src/.
const products = JSON.parse(fs.readFileSync(DATA, 'utf-8'));

export default {
  [scriptNames.requestProducts]: () => {
    performJavaScriptInWebViewer('loadData', JSON.stringify(products));
  },

  [scriptNames.requestProduct]: param => {
    const { id } = JSON.parse(param);
    if (id === 'new') {
      const blank = { id: 'new', name: '', sku: '', category: '', price: 0, stock: 0, status: 'active', description: '', updatedAt: '' };
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(blank));
      return;
    }
    const product = products.find(p => p.id === id);
    if (product) {
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(product));
    } else {
      performJavaScriptInWebViewer('alert', `Product not found: ${id}`);
    }
  },

  [scriptNames.saveProduct]: param => {
    const incoming = JSON.parse(param);
    const idx = products.findIndex(p => p.id === incoming.id);
    let updated = { ...incoming, updatedAt: new Date().toISOString().slice(0, 10) };
    if (idx >= 0) {
      products[idx] = updated;
    } else {
      const newId = `prod-${Date.now()}`; updated = { ...updated, id: newId }; products.push(updated);
    }
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },

  [scriptNames.deleteProduct]: param => {
    const { id } = JSON.parse(param);
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) products.splice(idx, 1);
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
