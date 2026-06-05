let _product = $state(null);
let _toast = $state(null); // { message, type } | null

export function setProduct(p) {
  _product = p;
}

export function showSaveResult(result) {
  const message = result.success ? '✓ Saved' : `Error: ${result.error}`;
  const type = result.success ? 'success' : 'danger';
  _toast = { message, type };
  setTimeout(() => { _toast = null; }, 3000);
}

export function getProduct() { return _product; }
export function getToast() { return _toast; }
