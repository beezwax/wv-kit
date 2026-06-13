import * as v from 'valibot';

// Inner shapes — what your code actually consumes after parsing. Use these
// for fmScripts payloads (the wv-kit JSON.stringifies for the wire) and
// anywhere you construct/inspect a typed value.
export const productShape = v.object({
  id:          v.string(),
  name:        v.string(),
  sku:         v.string(),
  category:    v.string(),
  price:       v.number(),
  stock:       v.number(),
  status:      v.picklist(['active', 'discontinued']),
  description: v.string(),
  updatedAt:   v.string(),
});

export const productListShape = v.array(productShape);

export const idParamShape = v.object({ id: v.string() });

export const saveResultShape = v.object({
  success: v.boolean(),
  product: v.optional(productShape),
  error:   v.optional(v.string()),
});

export const deleteResultShape = v.object({
  success: v.boolean(),
  id:      v.optional(v.string()),
  error:   v.optional(v.string()),
});

// Wire schemas — what crosses the FM ↔ browser seam. FileMaker's "Perform
// JavaScript in Web Viewer" only delivers strings, so anything richer than a
// raw string is a JSON-stringified payload. Each wire schema is therefore
// a pipe: string → JSON.parse → validate-as-shape. Use these for the
// `jsFunctions` map in the contract.
const jsonOf = (shape) => v.pipe(v.string(), v.transform(JSON.parse), shape);

export const productSchema      = jsonOf(productShape);
export const productListSchema  = jsonOf(productListShape);
export const idParamSchema      = jsonOf(idParamShape);
export const saveResultSchema   = jsonOf(saveResultShape);
export const deleteResultSchema = jsonOf(deleteResultShape);

// Typedefs reference the inner shapes (which are what handlers actually
// receive — the wire schemas' InferOutput equals the shape's InferOutput
// because the final pipe step is the shape).
/** @typedef {v.InferOutput<typeof productShape>}      Product      */
/** @typedef {v.InferOutput<typeof productListShape>}  ProductList  */
/** @typedef {v.InferOutput<typeof idParamShape>}      IdParam      */
/** @typedef {v.InferOutput<typeof saveResultShape>}   SaveResult   */
/** @typedef {v.InferOutput<typeof deleteResultShape>} DeleteResult */

/** @satisfies {Product} */
export const blankProduct = {
  id:          'new',
  name:        '',
  sku:         '',
  category:    '',
  price:       0,
  stock:       0,
  status:      'active',
  description: '',
  updatedAt:   '',
};
