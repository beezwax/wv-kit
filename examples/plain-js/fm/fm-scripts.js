// @ts-check
/**
 * @file Outbound FM-script callers. FM scripts share a single namespace
 * per `.fmp12`, so this is one flat map. Payloads are JS objects validated
 * against the inner shape; wv-kit JSON.stringifies before
 * `PerformScriptWithOption`.
 */

import { defineContract } from 'wv-kit';
import { idParamShape, productShape } from './schema.js';

export const contract = defineContract({
  fmScripts: {
    navigateToList:   { fmName: 'navigate to list' },
    navigateToDetail: { fmName: 'navigate to detail', payload: idParamShape },
    saveProduct:      { fmName: 'save product',       payload: productShape },
    deleteProduct:    { fmName: 'delete product',     payload: idParamShape },
  },
});

/**
 * @type {{
 *   navigateToList():                                              void,
 *   navigateToDetail(payload: import('./schema.js').IdParam):      void,
 *   saveProduct(payload: import('./schema.js').Product):           void,
 *   deleteProduct(payload: import('./schema.js').IdParam):         void,
 * }}
 */
export const fmScripts = contract.fmScripts;

