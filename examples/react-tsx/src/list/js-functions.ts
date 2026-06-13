import { defineJsFunctions } from 'wv-kit';
import { productListSchema } from '../../fm/schema.js';
import { updateProducts } from './view.js';
import type { ProductList } from '../../fm/schema.js';

const handlers = {
  loadData(list: ProductList) { updateProducts(list); },
};

const schemas = {
  loadData: productListSchema,
};

export const jsFunctions: { loadData(json: string): void } =
  defineJsFunctions(handlers, schemas);
