import type { Product } from '../shared/types.js';
import { updateProducts } from './view.js';

export default {
  loadData(jsonStr: string) {
    updateProducts(JSON.parse(jsonStr) as Product[]);
  },
};
