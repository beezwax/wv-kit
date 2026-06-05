export function buildFormFields() {
  const div = document.createElement('div');
  div.className = 'row g-3';
  div.innerHTML = `
    <div class="col-md-6">
      <label class="form-label fw-medium" for="f-name">Name</label>
      <input id="f-name" class="form-control" type="text" required>
    </div>
    <div class="col-md-6">
      <label class="form-label fw-medium" for="f-sku">SKU</label>
      <input id="f-sku" class="form-control" type="text" required>
    </div>
    <div class="col-md-4">
      <label class="form-label fw-medium" for="f-category">Category</label>
      <input id="f-category" class="form-control" type="text" required>
    </div>
    <div class="col-md-4">
      <label class="form-label fw-medium" for="f-price">Price</label>
      <input id="f-price" class="form-control" type="number" step="0.01" min="0" required>
    </div>
    <div class="col-md-4">
      <label class="form-label fw-medium d-block">Formatted</label>
      <span id="f-price-fmt" class="form-control-plaintext fw-bold text-success fs-5"></span>
    </div>
    <div class="col-md-3">
      <label class="form-label fw-medium" for="f-stock">Stock</label>
      <input id="f-stock" class="form-control" type="number" min="0" required>
    </div>
    <div class="col-md-3">
      <label class="form-label fw-medium" for="f-status">Status</label>
      <select id="f-status" class="form-select">
        <option value="active">Active</option>
        <option value="discontinued">Discontinued</option>
      </select>
    </div>
    <div class="col-12">
      <label class="form-label fw-medium" for="f-description">Description</label>
      <textarea id="f-description" class="form-control" rows="3"></textarea>
    </div>
  `;
  return div;
}
