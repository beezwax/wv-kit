import { LitElement, html } from 'lit';
import filemakerScripts from '../shared/filemaker-scripts.js';
import { renderProductRow } from './product-row.js';

let _element = null;

export function setProducts(products) {
  if (!_element) return;
  _element.products = products;
}

class ProductList extends LitElement {
  static properties = {
    products: {},
    query:    {},
    category: {},
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.products = [];
    this.query    = '';
    this.category = '';
  }

  get _categories() {
    return [...new Set(this.products.map(p => p.category))].sort();
  }

  get _filtered() {
    const q = this.query.toLowerCase();
    return this.products.filter(p =>
      (!this.category || p.category === this.category) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    );
  }

  render() {
    const filtered = this._filtered;

    return html`
      <div class="container py-3">
        <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
          <h1 class="fs-4 mb-0">Product Catalog</h1>
          <span class="text-muted small">
            ${filtered.length} product${filtered.length !== 1 ? 's' : ''}
          </span>
          <input
            class="form-control w-auto"
            placeholder="Search name or SKU…"
            type="search"
            .value=${this.query}
            @input=${e => { this.query = e.target.value; }}
          >
          <select
            class="form-select w-auto"
            .value=${this.category}
            @change=${e => { this.category = e.target.value; }}
          >
            <option value="">All Categories</option>
            ${this._categories.map(c => html`<option value=${c}>${c}</option>`)}
          </select>
          <button
            class="btn btn-primary ms-auto"
            type="button"
            @click=${() => filemakerScripts.navigateToDetail('new')}
          >
            + New Product
          </button>
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
              ${filtered.length === 0
                ? html`<tr><td colspan="6" class="text-center text-muted py-4">No products found</td></tr>`
                : filtered.map(p => renderProductRow(p))
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}

customElements.define('product-list', ProductList);

export default function buildApp() {
  _element = document.createElement('product-list');
  return _element;
}
