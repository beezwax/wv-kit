// @ts-check
/**
 * @file List viewer's inbound surface — every JS function FileMaker calls
 * via "Perform JavaScript in Web Viewer". Handlers read as ordinary
 * functions; schemas live in a small side-table below (optional per name).
 *
 * Importing this file registers `window.<name>` for each handler on the
 * browser side. On the server (`fm/mocks.js`) the same import yields the
 * validated emitters under `jsFunctions`.
 *
 * @typedef {import('../../fm/schema.js').ProductList} ProductList
 * @typedef {'info' | 'success' | 'warn' | 'error'}    ToastLevel
 */

import * as v from 'valibot';
import { defineJsFunctions } from 'wv-kit';
import { productListSchema } from '../../fm/schema.js';
import { products } from './view.js';

const toastLogger = { info: console.info, success: console.log, warn: console.warn, error: console.error };

const handlers = {
  /** @param {ProductList} list */
  loadData(list) { products.set(list); },

  /**
   * @param {ToastLevel} level
   * @param {string}     message
   */
  showToast(level, message) { toastLogger[level](`[${level}] ${message}`); },
};

const schemas = {
  loadData:  productListSchema,
  showToast: [v.picklist(['info', 'success', 'warn', 'error']), v.string()],
};

/**
 * Validated emitters for FM → browser callbacks on this viewer. Caller
 * passes the wire format — a JSON-stringified payload for object-shaped
 * jsFunctions, plain strings for tuple slots.
 *
 * @type {{
 *   loadData(json: string):                              void,
 *   showToast(level: ToastLevel, message: string):       void,
 * }}
 */
export const jsFunctions = defineJsFunctions(handlers, schemas);
