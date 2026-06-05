import fs from 'node:fs';

import { performJavaScriptInWebViewer } from 'wv-kit/lib/sse.js';

import { scriptNames } from '../src/shared/script-names.js';

const DATA = new URL('../src/list/dev/data.json', import.meta.url).pathname;

function read() {
  return JSON.parse(fs.readFileSync(DATA, 'utf-8'));
}

function write(products) {
  fs.writeFileSync(DATA, JSON.stringify(products, null, 2));
}

export default {
  [scriptNames.requestProducts]: () => {
    performJavaScriptInWebViewer('loadData', JSON.stringify(read()));
  },

  [scriptNames.requestProduct]: param => {
    const { id } = JSON.parse(param);
    if (id === 'new') {
      const blank = { id: 'new', name: '', sku: '', category: '', price: 0, stock: 0, status: 'active', description: '', updatedAt: '' };
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(blank));
      return;
    }
    const product = read().find(p => p.id === id);
    if (product) {
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(product));
    } else {
      performJavaScriptInWebViewer('alert', `Product not found: ${id}`);
    }
  },

  [scriptNames.saveProduct]: param => {
    const incoming = JSON.parse(param);
    const products = read();
    const idx = products.findIndex(p => p.id === incoming.id);
    const updated = { ...incoming, updatedAt: new Date().toISOString().slice(0, 10) };
    if (idx >= 0) {
      products[idx] = updated;
    } else {
      products.push({ ...updated, id: `prod-${Date.now()}` });
    }
    write(products);
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },

  [scriptNames.deleteProduct]: param => {
    const { id } = JSON.parse(param);
    write(read().filter(p => p.id !== id));
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
