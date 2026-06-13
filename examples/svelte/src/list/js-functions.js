// @ts-check
import { defineJsFunctions } from 'wv-kit';
import { productListSchema } from '../../fm/schema.js';
import { setProducts } from './state.svelte.js';

const handlers = {
  /** @param {import('../../fm/schema.js').ProductList} list */
  loadData(list) { setProducts(list); },
};

const schemas = {
  loadData: productListSchema,
};

/** @type {{ loadData(json: string): void }} */
export const jsFunctions = defineJsFunctions(handlers, schemas);
