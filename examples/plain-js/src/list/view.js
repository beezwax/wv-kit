import filemakerScripts from '../shared/filemaker-scripts.js';
import { createProductRow } from './product-row.js';

let allProducts = [];

export function renderProducts(products) {
  allProducts = products;

  const select = document.getElementById('category-filter');
  if (select && select.options.length === 1) {
    const categories = [...new Set(products.map(p => p.category))].sort();
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  applyFilter();
}

function applyFilter() {
  const filter = document.getElementById('category-filter')?.value ?? '';
  const query = document.getElementById('search-input')?.value.toLowerCase() ?? '';
  const filtered = allProducts.filter(p =>
    (!filter || p.category === filter) &&
    (!query || p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)),
  );
  renderRows(filtered);
  document.getElementById('count-label').textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
}

function renderRows(products) {
  const tbody = document.getElementById('product-rows');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No products found</td></tr>';
    return;
  }

  products.forEach(p => {
    tbody.appendChild(createProductRow(p, () => filemakerScripts.navigateToDetail(p.id)));
  });
}

export default function buildApp() {
  const app = document.createElement('div');
  app.className = 'container py-3';
  app.innerHTML = `
    <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <h1 class="fs-4 mb-0">Product Catalog</h1>
      <span id="count-label" class="text-muted small"></span>
      <input id="search-input" class="form-control w-auto" placeholder="Search name or SKU…" type="search">
      <select id="category-filter" class="form-select w-auto">
        <option value="">All Categories</option>
      </select>
      <button id="new-btn" class="btn btn-primary ms-auto" type="button">+ New Product</button>
    </div>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th class="text-end">Price</th>
            <th class="text-end">Stock</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="product-rows">
          <tr><td colspan="6" class="text-center text-muted py-5">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  queueMicrotask(() => {
    document.getElementById('search-input').addEventListener('input', applyFilter);
    document.getElementById('category-filter').addEventListener('change', applyFilter);
    document.getElementById('new-btn').addEventListener('click', () => {
      filemakerScripts.navigateToDetail('new');
    });
  });

  return app;
}
