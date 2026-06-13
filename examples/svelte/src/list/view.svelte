<script>
  import { fmScripts } from '../../fm/fm-scripts.js';
  import ProductRow from './ProductRow.svelte';
  import {
    getProducts, getSearchQuery, getCategoryFilter,
    setSearchQuery, setCategoryFilter,
  } from './state.svelte.js';

  const categories = $derived([...new Set(getProducts().map(p => p.category))].sort());

  const filtered = $derived(
    getProducts().filter(p =>
      (!getCategoryFilter() || p.category === getCategoryFilter()) &&
      (!getSearchQuery() || p.name.toLowerCase().includes(getSearchQuery().toLowerCase()) || p.sku.toLowerCase().includes(getSearchQuery().toLowerCase())),
    ),
  );

  const countLabel = $derived(`${filtered.length} product${filtered.length !== 1 ? 's' : ''}`);
</script>

<div class="container py-3">
  <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
    <h1 class="fs-4 mb-0">Product Catalog</h1>
    <span class="text-muted small">{countLabel}</span>
    <input
      value={getSearchQuery()}
      oninput={e => setSearchQuery(e.target.value)}
      class="form-control w-auto"
      placeholder="Search name or SKU…"
      type="search"
    >
    <select
      value={getCategoryFilter()}
      onchange={e => setCategoryFilter(e.target.value)}
      class="form-select w-auto"
    >
      <option value="">All Categories</option>
      {#each categories as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select>
    <button
      class="btn btn-primary ms-auto"
      type="button"
      onclick={() => fmScripts.navigateToDetail({ id: 'new' })}
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
        {#if getProducts().length === 0}
          <tr>
            <td colspan="6" class="text-center text-muted py-5">Loading…</td>
          </tr>
        {:else if filtered.length === 0}
          <tr>
            <td colspan="6" class="text-center text-muted py-4">No products found</td>
          </tr>
        {:else}
          {#each filtered as p (p.id)}
            <ProductRow product={p} />
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
