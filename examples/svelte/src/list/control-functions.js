import { setProducts } from './state.svelte.js';

export default {
  loadData(jsonStr) {
    setProducts(JSON.parse(jsonStr));
  },
};
