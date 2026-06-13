import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fmScripts } from '../../fm/fm-scripts.js';
import type { Product } from '../../fm/schema.js';
import { ProductRow } from './ProductRow.js';

type SetProducts = (products: Product[]) => void;
let _setProducts: SetProducts | null = null;
let _pendingProducts: Product[] | null = null;
export function registerSetProducts(fn: SetProducts) {
  _setProducts = fn;
  if (_pendingProducts) { fn(_pendingProducts); _pendingProducts = null; }
}
export function updateProducts(products: Product[]) { if (_setProducts) _setProducts(products); else _pendingProducts = products; }

function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { registerSetProducts(setProducts); }, []);

  const categories = [...new Set(products.map(p => p.category))].sort();

  const filtered = products.filter(p =>
    (!category || p.category === category) &&
    (!query || p.name.toLowerCase().includes(query.toLowerCase()) ||
               p.sku.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <h1 className="fs-4 mb-0">Product Catalog</h1>
        <span className="text-muted small">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
        <input
          className="form-control w-auto"
          placeholder="Search name or SKU…"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <select
          className="form-select w-auto"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className="btn btn-primary ms-auto"
          type="button"
          onClick={() => fmScripts.navigateToDetail({ id: 'new' })}
        >
          + New Product
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Name</th><th>SKU</th><th>Category</th>
              <th className="text-end">Price</th>
              <th className="text-end">Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-4">No products found</td></tr>
            ) : filtered.map(p => <ProductRow key={p.id} product={p} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function buildApp(): HTMLElement {
  const container = document.createElement('div');
  queueMicrotask(() => createRoot(container).render(<ProductList />));
  return container;
}
