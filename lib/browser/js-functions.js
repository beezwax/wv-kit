import { performJavaScriptInWebViewer } from '../sse.js';
import { tupleWrapper, validateStrict } from './validate.js';

/**
 * Declare a viewer's inbound jsFunctions. Handlers and schemas are kept as
 * separate maps so the handler bodies read as ordinary functions; schemas
 * are an optional side-table that wires validation per name.
 *
 *   // src/list/js-functions.js
 *   const handlers = {
 *     loadData(list)            { products.set(list); },
 *     showToast(level, message) { toast(level, message); },
 *   };
 *
 *   const schemas = {
 *     loadData:  productListSchema,
 *     showToast: [v.picklist([...]), v.string()],
 *     // entries omitted here pass through unvalidated
 *   };
 *
 *   export const jsFunctions = defineJsFunctions(handlers, schemas);
 *
 * Importing this file:
 *   - In the browser: registers each handler onto `window.<name>` so FM's
 *     "Perform JavaScript in Web Viewer" delivers through the validating
 *     emitter to the handler.
 *   - On the server (dev mocks): skips window registration; the returned
 *     `jsFunctions.<name>(value)` emitter validates and broadcasts via SSE.
 *
 * Each call carries its own handler-registry closure, so two viewers
 * declaring the same name (with different schemas) never collide.
 *
 * Schemas are optional — names present in `handlers` but absent from
 * `schemas` get a pass-through emitter (no validation).
 */
export function defineJsFunctions(handlers = {}, schemas = {}) {
  const handlerRegistry = {};
  const emitters = {};

  // Handlers are browser-side only. On the server (the mock loads this
  // file too), leave the registry empty so emitters fall through to SSE
  // broadcast instead of running handler bodies that may touch
  // browser-only state (signals, DOM, etc.).
  const inBrowser = typeof window !== 'undefined';

  for (const [name, handler] of Object.entries(handlers)) {
    const decl   = schemas[name]; // may be undefined → no validation
    const tuple  = Array.isArray(decl);
    const schema = tuple ? tupleWrapper(decl) : decl;

    if (inBrowser) handlerRegistry[name] = handler;

    if (tuple) {
      emitters[name] = (...args) => {
        const validated = validateStrict(`jsFunctions.${name}`, schema, args);
        const local = handlerRegistry[name];
        if (local) {
          local(...validated);
        } else {
          // Wire path: send the raw caller input, not the validated value.
          // FM's "Perform JavaScript in Web Viewer" only carries strings;
          // the receiving browser re-validates.
          performJavaScriptInWebViewer(name, ...args);
        }
      };
    } else {
      emitters[name] = (value) => {
        const validated = validateStrict(`jsFunctions.${name}`, schema, value);
        const local = handlerRegistry[name];
        if (local) {
          local(validated);
        } else {
          performJavaScriptInWebViewer(name, value);
        }
      };
    }
  }

  // Browser side: wire window.<name> to flow through the validating emitter.
  for (const name of Object.keys(handlerRegistry)) {
    window[name] = (...args) => emitters[name](...args);
  }

  return emitters;
}
