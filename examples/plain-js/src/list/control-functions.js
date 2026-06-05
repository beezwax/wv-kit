import { renderProducts } from './view.js';

export default {
  loadData(jsonStr) {
    renderProducts(JSON.parse(jsonStr));
  },
};
