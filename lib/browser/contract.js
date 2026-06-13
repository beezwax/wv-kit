import { performFileMakerScript } from './filemaker.js';
import { validate } from './validate.js';

/**
 * Declare the outbound (browser → FileMaker) script surface for a project.
 * FM scripts share a single namespace per `.fmp12` file, so this map is
 * flat: one entry per FM script the browser can call.
 *
 *   // fm/fm-scripts.js
 *   export const contract = defineContract({
 *     fmScripts: {
 *       navigateToList:   { fmName: 'navigate to list' },
 *       saveProduct:      { fmName: 'save product', payload: productShape },
 *     },
 *   });
 *
 * Inbound (FM → browser) jsFunctions are declared per viewer with
 * `defineJsFunctions` in `src/<viewer>/js-functions.js`, since each viewer
 * is a separate WebViewer with its own `window` and may use the same FM
 * jsFunction name for a different payload.
 */
export function defineContract({ fmScripts = {} }) {
  const fmScriptCallers = {};
  for (const [key, { fmName, payload }] of Object.entries(fmScripts)) {
    fmScriptCallers[key] = (input) => {
      if (payload) {
        performFileMakerScript(fmName, validate(`fmScripts.${key}`, payload, input));
      } else {
        performFileMakerScript(fmName);
      }
    };
  }

  return {
    spec: { fmScripts },
    fmScripts: fmScriptCallers,
  };
}
