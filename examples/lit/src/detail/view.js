import { LitElement, html, nothing } from 'lit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { formatPrice } from '../shared/product-utils.js';
import { renderSaveToast } from './save-toast.js';

let _element = null;

export function setProduct(product) {
  if (_element) _element.product = product;
}

export function setSaveResult(result) {
  if (_element) _element.saveResult = result;
}

class ProductDetail extends LitElement {
  static properties = {
    product:       {},
    saveResult:    {},
    _displayPrice: { state: true },
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.product       = null;
    this.saveResult    = null;
    this._displayPrice = 0;
    this._saveResultTimer = null;
  }

  willUpdate(changed) {
    if (changed.has('product') && this.product) {
      this._displayPrice = this.product.price;
    }
  }

  updated(changed) {
    if (changed.has('saveResult') && this.saveResult) {
      clearTimeout(this._saveResultTimer);
      this._saveResultTimer = setTimeout(() => {
        this.saveResult = null;
      }, 3000);
    }
  }

  _handleSave(e) {
    e.preventDefault();
    if (!this.product) return;
    const root = this;
    fmScripts.saveProduct({
      ...this.product,
      name:        root.querySelector('#f-name').value,
      sku:         root.querySelector('#f-sku').value,
      category:    root.querySelector('#f-category').value,
      price:       parseFloat(root.querySelector('#f-price').value),
      stock:       parseInt(root.querySelector('#f-stock').value, 10),
      status:      root.querySelector('#f-status').value,
      description: root.querySelector('#f-description').value,
    });
  }

  _handleDelete() {
    if (this.product && confirm(`Delete "${this.product.name}"? This cannot be undone.`)) {
      fmScripts.deleteProduct({ id: this.product.id });
    }
  }

  _handlePriceInput(e) {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) this._displayPrice = val;
  }

  render() {
    if (!this.product) {
      return html`
        <div class="container py-3">
          <p class="text-muted">Loading product…</p>
        </div>
      `;
    }

    const p = this.product;
    const isNew = p.id === 'new';

    return html`
      <div class="container py-3">
        <div class="d-flex align-items-center gap-3 mb-4">
          <button
            class="btn btn-outline-secondary"
            type="button"
            @click=${() => fmScripts.navigateToList()}
          >
            ← List
          </button>
          <h1 class="fs-4 mb-0 flex-grow-1">${isNew ? 'New Product' : p.name}</h1>
          <span class="text-muted small">${isNew ? '' : `Updated: ${p.updatedAt}`}</span>
        </div>

        <form @submit=${this._handleSave}>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-medium" for="f-name">Name</label>
              <input id="f-name" class="form-control" type="text" .value=${p.name} required>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="f-sku">SKU</label>
              <input id="f-sku" class="form-control" type="text" .value=${p.sku} required>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium" for="f-category">Category</label>
              <input id="f-category" class="form-control" type="text" .value=${p.category} required>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium" for="f-price">Price</label>
              <input
                id="f-price"
                class="form-control"
                type="number"
                step="0.01"
                min="0"
                .value=${p.price}
                @input=${this._handlePriceInput}
                required
              >
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium d-block">Formatted</label>
              <span class="form-control-plaintext fw-bold text-success fs-5">
                ${formatPrice(this._displayPrice)}
              </span>
            </div>
            <div class="col-md-3">
              <label class="form-label fw-medium" for="f-stock">Stock</label>
              <input id="f-stock" class="form-control" type="number" min="0" .value=${p.stock} required>
            </div>
            <div class="col-md-3">
              <label class="form-label fw-medium" for="f-status">Status</label>
              <select id="f-status" class="form-select" .value=${p.status}>
                <option value="active">Active</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label fw-medium" for="f-description">Description</label>
              <textarea id="f-description" class="form-control" rows="3" .value=${p.description}></textarea>
            </div>
          </div>

          <div class="d-flex gap-2 mt-4 pt-3 border-top">
            <button class="btn btn-primary" type="submit">Save</button>
            ${isNew ? nothing : html`
              <button
                class="btn btn-outline-danger ms-auto"
                type="button"
                @click=${this._handleDelete}
              >
                Delete
              </button>
            `}
          </div>
        </form>

        ${renderSaveToast(this.saveResult)}
      </div>
    `;
  }
}

customElements.define('product-detail', ProductDetail);

export default function buildApp() {
  _element = document.createElement('product-detail');
  return _element;
}
