// @ts-check
/**
 * @file Outbound side of the FileMaker boundary — JS-side wrappers for the
 * FM scripts this app calls. FileMaker scripts share a single namespace per
 * `.fmp12`, so this is one flat map. Payloads are JS objects validated
 * against the inner shape (`v.object(...)`); wv-kit JSON.stringifies before
 * handing the string to `PerformScriptWithOption`. FM reads it back with
 * `Get(ScriptParameter)`.
 *
 * Inbound (FM → browser) JS functions are declared **per viewer** in
 * `src/<viewer>/js-functions.js` — each WebViewer has its own `window`, so
 * the same FM jsFunction name can carry a different payload across viewers.
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
 * Outbound FM-script callers. Caller passes a JS object; wv-kit
 * JSON.stringifies and hands the string to PerformScriptWithOption.
 *
 * @type {{
 *   navigateToList():                                              void,
 *   navigateToDetail(payload: import('./schema.js').IdParam):      void,
 *   saveProduct(payload: import('./schema.js').Product):           void,
 *   deleteProduct(payload: import('./schema.js').IdParam):         void,
 * }}
 */
export const fmScripts = contract.fmScripts;
