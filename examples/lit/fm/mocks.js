import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as v from 'valibot';
import { defineMock, goToLayout, performJavaScriptInWebViewer } from 'wv-kit';

import { contract } from './fm-scripts.js';
import { blankProduct, productListShape } from './schema.js';

const DATA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/list/dev/data.json');

const readAll  = ()     => v.parse(productListShape, JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')));
const writeAll = (data) => fs.writeFileSync(DATA_PATH, JSON.stringify(v.parse(productListShape, data), null, 2) + '\n');

// Mocks replicate real FileMaker scripts: a "Go To Layout" step followed
// by "Perform JavaScript in Web Viewer" hands data to the new viewer.
// Mocks deliberately don't import per-viewer js-functions.js — real FM
// scripts can't see the browser's JS either. Each push is just a name and
// stringified arg(s), exactly mirroring what FM emits. The receiving
// viewer's defineJsFunctions wrapper validates against its schema on the
// browser side.
export default defineMock(contract, {
  navigateToList() {
    goToLayout('/list');
    performJavaScriptInWebViewer('loadData', JSON.stringify(readAll()));
  },

  navigateToDetail({ id }) {
    goToLayout(`/detail?id=${id}`);
    if (id === 'new') {
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(blankProduct));
      return;
    }
    const product = readAll().find(p => p.id === id);
    if (product) {
      performJavaScriptInWebViewer('loadDetail', JSON.stringify(product));
    } else {
      performJavaScriptInWebViewer('alert', `Product not found: ${id}`);
    }
  },

  saveProduct(incoming) {
    const products = readAll();
    const idx = products.findIndex(p => p.id === incoming.id);
    let updated = { ...incoming, updatedAt: new Date().toISOString().slice(0, 10) };
    if (idx >= 0) {
      products[idx] = updated;
    } else {
      updated = { ...updated, id: `prod-${Date.now()}` };
      products.push(updated);
    }
    writeAll(products);
    performJavaScriptInWebViewer('onSaveResult', JSON.stringify({ success: true, product: updated }));
  },

  deleteProduct({ id }) {
    const products = readAll();
    const idx = products.findIndex(p => p.id === id);
    if (idx >= 0) {
      products.splice(idx, 1);
      writeAll(products);
    }
    performJavaScriptInWebViewer('onDeleteResult', JSON.stringify({ success: true, id }));
  },
});
