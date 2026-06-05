let _products = $state([]);
let _searchQuery = $state('');
let _categoryFilter = $state('');

export function setProducts(data) {
  _products = data;
  _searchQuery = '';
  _categoryFilter = '';
}

export function getProducts() { return _products; }
export function getSearchQuery() { return _searchQuery; }
export function getCategoryFilter() { return _categoryFilter; }
export function setSearchQuery(v) { _searchQuery = v; }
export function setCategoryFilter(v) { _categoryFilter = v; }
