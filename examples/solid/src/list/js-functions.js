// @ts-check
import { defineJsFunctions } from 'wv-kit';
import { productListSchema } from '../../fm/schema.js';
import { loadProducts } from './view.jsx';

const handlers = {
  /** @param {import('../../fm/schema.js').ProductList} list */
  loadData(list) { loadProducts(list); },
};

const schemas = {
  loadData: productListSchema,
};

/** @type {{ loadData(json: string): void }} */
export const jsFunctions = defineJsFunctions(handlers, schemas);
