// @ts-check
import { defineJsFunctions } from 'wv-kit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { deleteResultSchema, productSchema, saveResultSchema } from '../../fm/schema.js';
import { renderProduct, showSaveResult } from './view.jsx';

const handlers = {
  /** @param {import('../../fm/schema.js').Product} product */
  loadDetail(product) { renderProduct(product); },

  /** @param {import('../../fm/schema.js').SaveResult} result */
  onSaveResult(result) {
    if (result.product) renderProduct(result.product);
    showSaveResult(result);
  },

  /** @param {import('../../fm/schema.js').DeleteResult} result */
  onDeleteResult(result) {
    if (result.success) fmScripts.navigateToList();
  },
};

const schemas = {
  loadDetail:     productSchema,
  onSaveResult:   saveResultSchema,
  onDeleteResult: deleteResultSchema,
};

/**
 * @type {{
 *   loadDetail(json: string):     void,
 *   onSaveResult(json: string):   void,
 *   onDeleteResult(json: string): void,
 * }}
 */
export const jsFunctions = defineJsFunctions(handlers, schemas);
