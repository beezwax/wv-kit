import { products, resetFilters } from './view.js';

export default {
  loadData(jsonStr) {
    resetFilters();
    products.set(JSON.parse(jsonStr));
  },
};
