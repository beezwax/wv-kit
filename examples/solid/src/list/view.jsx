import { createSignal, createMemo, For, Show } from 'solid-js';
import { render } from 'solid-js/web';
import filemakerScripts from '../shared/filemaker-scripts.js';
import ProductRow from './ProductRow.jsx';

const [products, setProducts] = createSignal([]);
const [query, setQuery] = createSignal('');
const [category, setCategory] = createSignal('');

export function loadProducts(data) { setProducts(data); }

const categories = createMemo(() => {
  const cats = [...new Set(products().map(p => p.category))].sort();
  return cats;
});

const filtered = createMemo(() => {
  const q = query().toLowerCase();
  const cat = category();
  return products().filter(p =>
    (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
  );
});

const countLabel = createMemo(() => {
  const n = filtered().length;
  return `${n} product${n !== 1 ? 's' : ''}`;
});

function App() {
  return (
    <div class="container py-3">
      <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
        <h1 class="fs-4 mb-0">Product Catalog</h1>
        <span class="text-muted small">{countLabel()}</span>
        <input
          class="form-control w-auto"
          placeholder="Search name or SKU…"
          type="search"
          onInput={e => setQuery(e.target.value)}
        />
        <select
          class="form-select w-auto"
          onChange={e => setCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <For each={categories()}>
            {cat => <option value={cat}>{cat}</option>}
          </For>
        </select>
        <button
          class="btn btn-primary ms-auto"
          type="button"
          onClick={() => filemakerScripts.navigateToDetail('new')}
        >+ New Product</button>
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
          <tbody>
            <Show
              when={filtered().length > 0}
              fallback={<tr><td colspan="6" class="text-center text-muted py-4">No products found</td></tr>}
            >
              <For each={filtered()}>{p => <ProductRow product={p} />}</For>
            </Show>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function buildApp() {
  const container = document.createElement('div');
  render(() => <App />, container);
  return container;
}
