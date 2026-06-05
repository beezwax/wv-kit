import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice } from '../shared/product-utils.js';
import { buildFormFields } from './form-fields.js';

let currentProduct = null;

export function renderProduct(product) {
  currentProduct = product;

  document.getElementById('product-name').textContent = product.id === 'new' ? 'New Product' : product.name;
  document.getElementById('f-name').value         = product.name;
  document.getElementById('f-sku').value          = product.sku;
  document.getElementById('f-category').value     = product.category;
  document.getElementById('f-price').value        = product.price;
  document.getElementById('f-price-fmt').textContent = formatPrice(product.price);
  document.getElementById('f-stock').value        = product.stock;
  document.getElementById('f-status').value       = product.status;
  document.getElementById('f-description').value  = product.description;
  document.getElementById('updated-label').textContent = product.id === 'new' ? '' : `Updated: ${product.updatedAt}`;
  document.getElementById('delete-btn').hidden = product.id === 'new';

  document.getElementById('loading-msg')?.remove();
  document.getElementById('detail-form').classList.remove('d-none');
}

export function showSaveResult(result) {
  const toast = document.getElementById('toast');
  toast.textContent  = result.success ? '✓ Saved' : `Error: ${result.error}`;
  toast.className    = `alert alert-${result.success ? 'success' : 'danger'} position-fixed bottom-0 end-0 m-3`;
  toast.classList.remove('d-none');
  setTimeout(() => toast.classList.add('d-none'), 3000);
}

export default function buildApp() {
  const app = document.createElement('div');
  app.className = 'container py-3';
  app.innerHTML = `
    <div class="d-flex align-items-center gap-3 mb-4">
      <button id="back-btn" class="btn btn-outline-secondary" type="button">← List</button>
      <h1 id="product-name" class="fs-4 mb-0 flex-grow-1">Loading…</h1>
      <span id="updated-label" class="text-muted small"></span>
    </div>

    <p id="loading-msg" class="text-muted">Loading product…</p>

    <form id="detail-form" class="d-none">
      <div class="d-flex gap-2 mt-4 pt-3 border-top">
        <button id="save-btn" class="btn btn-primary" type="submit">Save</button>
        <button id="delete-btn" class="btn btn-outline-danger ms-auto" type="button">Delete</button>
      </div>
    </form>

    <div id="toast" class="d-none"></div>
  `;

  const form = app.querySelector('#detail-form');
  form.insertBefore(buildFormFields(), form.firstElementChild);

  queueMicrotask(() => {
    document.getElementById('back-btn').addEventListener('click', () => {
      filemakerScripts.navigateToList();
    });

    document.getElementById('f-price').addEventListener('input', evt => {
      const val = parseFloat(evt.target.value);
      if (!isNaN(val)) {
        document.getElementById('f-price-fmt').textContent = formatPrice(val);
      }
    });

    document.getElementById('detail-form').addEventListener('submit', evt => {
      evt.preventDefault();
      if (!currentProduct) return;
      filemakerScripts.saveProduct({
        ...currentProduct,
        name:        document.getElementById('f-name').value,
        sku:         document.getElementById('f-sku').value,
        category:    document.getElementById('f-category').value,
        price:       parseFloat(document.getElementById('f-price').value),
        stock:       parseInt(document.getElementById('f-stock').value, 10),
        status:      document.getElementById('f-status').value,
        description: document.getElementById('f-description').value,
      });
    });

    document.getElementById('delete-btn').addEventListener('click', () => {
      if (currentProduct && confirm(`Delete "${currentProduct.name}"? This cannot be undone.`)) {
        filemakerScripts.deleteProduct(currentProduct.id);
      }
    });
  });

  return app;
}
