import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice } from '../shared/product-utils.js';

const [productId, setProductId] = createSignal(null);
const [productName, setProductName] = createSignal('Loading…');
const [updatedAt, setUpdatedAt] = createSignal('');
const [isNew, setIsNew] = createSignal(false);
const [loaded, setLoaded] = createSignal(false);

const [fName, setFName] = createSignal('');
const [fSku, setFSku] = createSignal('');
const [fCategory, setFCategory] = createSignal('');
const [fPrice, setFPrice] = createSignal(0);
const [fStock, setFStock] = createSignal(0);
const [fStatus, setFStatus] = createSignal('active');
const [fDescription, setFDescription] = createSignal('');

const [toast, setToast] = createSignal(null); // { message, type } | null

export function renderProduct(product) {
  setProductId(product.id);
  setIsNew(product.id === 'new');
  setProductName(product.id === 'new' ? 'New Product' : product.name);
  setUpdatedAt(product.id === 'new' ? '' : `Updated: ${product.updatedAt}`);
  setFName(product.name);
  setFSku(product.sku);
  setFCategory(product.category);
  setFPrice(product.price);
  setFStock(product.stock);
  setFStatus(product.status);
  setFDescription(product.description);
  setLoaded(true);
}

export function showSaveResult(result) {
  const msg = result.success ? '✓ Saved' : `Error: ${result.error}`;
  const type = result.success ? 'success' : 'danger';
  setToast({ message: msg, type });
  setTimeout(() => setToast(null), 3000);
}

function handleSubmit(e) {
  e.preventDefault();
  if (!productId()) return;
  filemakerScripts.saveProduct({
    id:          productId(),
    name:        fName(),
    sku:         fSku(),
    category:    fCategory(),
    price:       parseFloat(fPrice()),
    stock:       parseInt(fStock(), 10),
    status:      fStatus(),
    description: fDescription(),
  });
}

function handleDelete() {
  if (productId() && confirm(`Delete "${fName()}"? This cannot be undone.`)) {
    filemakerScripts.deleteProduct(productId());
  }
}

function App() {
  return (
    <div class="container py-3">
      <div class="d-flex align-items-center gap-3 mb-4">
        <button
          class="btn btn-outline-secondary"
          type="button"
          onClick={() => filemakerScripts.navigateToList()}
        >← List</button>
        <h1 class="fs-4 mb-0 flex-grow-1">{productName()}</h1>
        <span class="text-muted small">{updatedAt()}</span>
      </div>

      <Show when={!loaded()}>
        <p class="text-muted">Loading product…</p>
      </Show>

      <Show when={loaded()}>
        <form onSubmit={handleSubmit}>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-medium" for="f-name">Name</label>
              <input
                id="f-name"
                class="form-control"
                type="text"
                required
                value={fName()}
                onInput={e => setFName(e.target.value)}
              />
            </div>
            <div class="col-md-6">
              <label class="form-label fw-medium" for="f-sku">SKU</label>
              <input
                id="f-sku"
                class="form-control"
                type="text"
                required
                value={fSku()}
                onInput={e => setFSku(e.target.value)}
              />
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium" for="f-category">Category</label>
              <input
                id="f-category"
                class="form-control"
                type="text"
                required
                value={fCategory()}
                onInput={e => setFCategory(e.target.value)}
              />
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium" for="f-price">Price</label>
              <input
                id="f-price"
                class="form-control"
                type="number"
                step="0.01"
                min="0"
                required
                value={fPrice()}
                onInput={e => setFPrice(e.target.value)}
              />
            </div>
            <div class="col-md-4">
              <label class="form-label fw-medium d-block">Formatted</label>
              <span class="form-control-plaintext fw-bold text-success fs-5">
                {formatPrice(parseFloat(fPrice()) || 0)}
              </span>
            </div>
            <div class="col-md-3">
              <label class="form-label fw-medium" for="f-stock">Stock</label>
              <input
                id="f-stock"
                class="form-control"
                type="number"
                min="0"
                required
                value={fStock()}
                onInput={e => setFStock(e.target.value)}
              />
            </div>
            <div class="col-md-3">
              <label class="form-label fw-medium" for="f-status">Status</label>
              <select
                id="f-status"
                class="form-select"
                onChange={e => setFStatus(e.target.value)}
              >
                <option value="active" selected={fStatus() === 'active'}>Active</option>
                <option value="discontinued" selected={fStatus() === 'discontinued'}>Discontinued</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label fw-medium" for="f-description">Description</label>
              <textarea
                id="f-description"
                class="form-control"
                rows="3"
                onInput={e => setFDescription(e.target.value)}
              >{fDescription()}</textarea>
            </div>
          </div>
          <div class="d-flex gap-2 mt-4 pt-3 border-top">
            <button class="btn btn-primary" type="submit">Save</button>
            <Show when={!isNew()}>
              <button
                class="btn btn-outline-danger ms-auto"
                type="button"
                onClick={handleDelete}
              >Delete</button>
            </Show>
          </div>
        </form>
      </Show>

      <Show when={toast()}>
        <div class={`alert alert-${toast()?.type} position-fixed bottom-0 end-0 m-3`}>
          {toast()?.message}
        </div>
      </Show>
    </div>
  );
}

export default function buildApp() {
  const container = document.createElement('div');
  render(() => <App />, container);
  return container;
}
