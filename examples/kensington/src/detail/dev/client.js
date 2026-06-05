import data from '../../list/dev/data.json';
import blankProduct from './blank-product.js';

const id = new URLSearchParams(window.location.search).get('id') ?? 'new';

if (id === 'new') {
  window.loadDetail(JSON.stringify(blankProduct));
} else {
  const product = data.find(p => p.id === id);
  if (product) window.loadDetail(JSON.stringify(product));
}
