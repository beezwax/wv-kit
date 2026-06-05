import data from '../../list/dev/data.json' with { type: 'json' };

const id = new URLSearchParams(window.location.search).get('id') ?? 'new';

if (id === 'new') {
  const blank = { id: 'new', name: '', sku: '', category: '', price: 0, stock: 0, status: 'active', description: '', updatedAt: '' };
  window.loadDetail(JSON.stringify(blank));
} else {
  const product = data.find(p => p.id === id);
  if (product) window.loadDetail(JSON.stringify(product));
}
