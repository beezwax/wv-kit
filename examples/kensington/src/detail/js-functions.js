// @ts-check
/**
 * @file Detail viewer's inbound surface. See `src/list/js-functions.js`
 * for the conventions.
 *
 * @typedef {import('../../fm/schema.js').Product}      Product
 * @typedef {import('../../fm/schema.js').SaveResult}   SaveResult
 * @typedef {import('../../fm/schema.js').DeleteResult} DeleteResult
 * @typedef {'info' | 'success' | 'warn' | 'error'}     ToastLevel
 */

import * as v from 'valibot';
import { defineJsFunctions } from 'wv-kit';
import { fmScripts } from '../../fm/fm-scripts.js';
import {
  deleteResultSchema,
  productSchema,
  saveResultSchema,
} from '../../fm/schema.js';
import { loadProduct, showSaveResult } from './view.js';

const toastLogger = { info: console.info, success: console.log, warn: console.warn, error: console.error };

const handlers = {
  /** @param {Product} product */
  loadDetail(product) { loadProduct(product); },

  /** @param {SaveResult} result */
  onSaveResult(result) {
    if (result.product) loadProduct(result.product);
    showSaveResult(result);
  },

  /** @param {DeleteResult} result */
  onDeleteResult(result) {
    if (result.success) fmScripts.navigateToList();
  },

  /**
   * @param {ToastLevel} level
   * @param {string}     message
   */
  showToast(level, message) { toastLogger[level](`[${level}] ${message}`); },
};

const schemas = {
  loadDetail:     productSchema,
  onSaveResult:   saveResultSchema,
  onDeleteResult: deleteResultSchema,
  showToast:      [v.picklist(['info', 'success', 'warn', 'error']), v.string()],
};

/**
 * Validated emitters for FM → browser callbacks on this viewer.
 *
 * @type {{
 *   loadDetail(json: string):                            void,
 *   onSaveResult(json: string):                          void,
 *   onDeleteResult(json: string):                        void,
 *   showToast(level: ToastLevel, message: string):       void,
 * }}
 */
export const jsFunctions = defineJsFunctions(handlers, schemas);
