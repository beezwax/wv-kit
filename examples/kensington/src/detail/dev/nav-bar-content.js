import { signal, t } from '../../shared/installed/kensington.js';

const products = signal([]);

fetch('/api/products')
  .then(r => r.json())
  .then(data => products.set(data));

export default t.div({ class: 'd-flex align-items-center gap-2' }, [
  t.label({ class: 'form-label mb-0 small fw-medium' }, 'Load:'),
  t.select({
    class: 'form-select form-select-sm w-auto',
    onchange(e) {
      const id = e.target.value;
      if (!id) return;
      if (id === 'new') {
        const blank = { id: 'new', name: '', sku: '', category: '', price: 0, stock: 0, status: 'active', description: '', updatedAt: '' };
        window.loadDetail(JSON.stringify(blank));
      } else {
        const product = products.get().find(p => p.id === id);
        if (product) window.loadDetail(JSON.stringify(product));
      }
      e.target.value = '';
    },
  }, [
    t.option({ value: '' }, 'Pick a product…'),
    t.option({ value: 'new' }, '＋ New product'),
    products.transform(list => list.map(p => t.option({ value: p.id }, p.name))),
  ]),
]).toElement();
