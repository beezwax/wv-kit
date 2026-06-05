<script>
  import filemakerScripts from '../shared/filemaker-scripts.js';
  import { formatPrice } from '../shared/product-utils.js';
  import { getProduct, getToast } from './state.svelte.js';

  let name = $state('');
  let sku = $state('');
  let category = $state('');
  let price = $state(0);
  let stock = $state(0);
  let status = $state('active');
  let description = $state('');

  $effect(() => {
    const p = getProduct();
    if (p) {
      name = p.name;
      sku = p.sku;
      category = p.category;
      price = p.price;
      stock = p.stock;
      status = p.status;
      description = p.description;
    }
  });

  const title = $derived(
    !getProduct() ? 'Loading…' : getProduct().id === 'new' ? 'New Product' : getProduct().name,
  );
  const updatedLabel = $derived(
    getProduct() && getProduct().id !== 'new' ? `Updated: ${getProduct().updatedAt}` : '',
  );
  const isNew = $derived(!getProduct() || getProduct().id === 'new');
  const formattedPrice = $derived(getProduct() ? formatPrice(price) : '');

  function handleSubmit(evt) {
    evt.preventDefault();
    const p = getProduct();
    if (!p) return;
    filemakerScripts.saveProduct({ ...p, name, sku, category, price, stock, status, description });
  }

  function handleDelete() {
    const p = getProduct();
    if (p && confirm(`Delete "${p.name}"? This cannot be undone.`)) {
      filemakerScripts.deleteProduct(p.id);
    }
  }
</script>

<div class="container py-3">
  <div class="d-flex align-items-center gap-3 mb-4">
    <button
      class="btn btn-outline-secondary"
      type="button"
      onclick={() => filemakerScripts.navigateToList()}
    >
      ← List
    </button>
    <h1 class="fs-4 mb-0 flex-grow-1">{title}</h1>
    <span class="text-muted small">{updatedLabel}</span>
  </div>

  {#if !getProduct()}
    <p class="text-muted">Loading product…</p>
  {:else}
    <form onsubmit={handleSubmit}>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-medium" for="f-name">Name</label>
          <input
            id="f-name"
            bind:value={name}
            class="form-control"
            type="text"
            required
          >
        </div>
        <div class="col-md-6">
          <label class="form-label fw-medium" for="f-sku">SKU</label>
          <input
            id="f-sku"
            bind:value={sku}
            class="form-control"
            type="text"
            required
          >
        </div>
        <div class="col-md-4">
          <label class="form-label fw-medium" for="f-category">Category</label>
          <input
            id="f-category"
            bind:value={category}
            class="form-control"
            type="text"
            required
          >
        </div>
        <div class="col-md-4">
          <label class="form-label fw-medium" for="f-price">Price</label>
          <input
            id="f-price"
            bind:value={price}
            class="form-control"
            type="number"
            step="0.01"
            min="0"
            required
          >
        </div>
        <div class="col-md-4">
          <label class="form-label fw-medium d-block">Formatted</label>
          <span class="form-control-plaintext fw-bold text-success fs-5">{formattedPrice}</span>
        </div>
        <div class="col-md-3">
          <label class="form-label fw-medium" for="f-stock">Stock</label>
          <input
            id="f-stock"
            bind:value={stock}
            class="form-control"
            type="number"
            min="0"
            required
          >
        </div>
        <div class="col-md-3">
          <label class="form-label fw-medium" for="f-status">Status</label>
          <select id="f-status" bind:value={status} class="form-select">
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <div class="col-12">
          <label class="form-label fw-medium" for="f-description">Description</label>
          <textarea
            id="f-description"
            bind:value={description}
            class="form-control"
            rows="3"
          ></textarea>
        </div>
      </div>
      <div class="d-flex gap-2 mt-4 pt-3 border-top">
        <button class="btn btn-primary" type="submit">Save</button>
        {#if !isNew}
          <button
            class="btn btn-outline-danger ms-auto"
            type="button"
            onclick={handleDelete}
          >
            Delete
          </button>
        {/if}
      </div>
    </form>
  {/if}

  {#if getToast()}
    <div class="alert alert-{getToast().type} position-fixed bottom-0 end-0 m-3">
      {getToast().message}
    </div>
  {/if}
</div>
