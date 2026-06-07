import { products } from './view.js';

export default {
  loadData(jsonStr) {
    products.set(JSON.parse(jsonStr));
  },
};
