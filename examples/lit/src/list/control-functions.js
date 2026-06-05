import { setProducts } from './view.js';

export default {
  loadData(jsonStr) {
    setProducts(JSON.parse(jsonStr));
  },
};
