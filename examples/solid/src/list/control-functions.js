import { loadProducts } from './view.jsx';

export default {
  loadData(jsonStr) {
    loadProducts(JSON.parse(jsonStr));
  },
};
